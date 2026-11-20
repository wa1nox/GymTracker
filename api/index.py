import os
import hmac
import hashlib
import json
from urllib.parse import parse_qsl
import asyncpg
from fastapi import FastAPI, Header, HTTPException, Depends
from pydantic import BaseModel

app = FastAPI()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")

async def get_db():
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    try:
        yield conn
    finally:
        await conn.close()

def verify_telegram_user(init_data: str = Header(default="", alias="X-Telegram-Init-Data")) -> dict:
    if not init_data:
        raise HTTPException(status_code=401, detail="No initData provided")
    try:
        parsed_data = dict(parse_qsl(init_data))
        received_hash = parsed_data.pop("hash", "")
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed_data.items()))
        secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

        if calculated_hash != received_hash:
            raise HTTPException(status_code=401, detail="Invalid signature")

        return json.loads(parsed_data["user"])
    except Exception:
        raise HTTPException(status_code=401, detail="Auth error")

class SetInput(BaseModel):
    exercise_id: int
    weight: float
    reps: int

class GoalInput(BaseModel):
    exercise_id: int
    target_weight: float
    target_reps: int

class ExerciseInput(BaseModel):
    name: str
    muscle_group: str

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/init")
async def init_app(user: dict = Depends(verify_telegram_user), conn=Depends(get_db)):
    uid = user["id"]
    await conn.execute(
        "INSERT INTO users (telegram_id, username) VALUES ($1, $2) ON CONFLICT (telegram_id) DO NOTHING",
        uid, user.get("username", "")
    )
    exercises = await conn.fetch(
        "SELECT id, name, muscle_group FROM exercises WHERE user_id IS NULL OR user_id = $1 ORDER BY id", uid
    )
    goals = await conn.fetch(
        """SELECT g.id, g.exercise_id, e.name as exercise_name, g.target_weight, g.target_reps, g.is_completed
           FROM goals g JOIN exercises e ON g.exercise_id = e.id
           WHERE g.user_id = $1 ORDER BY g.is_completed ASC, g.id DESC""", uid
    )
    recent_sets = await conn.fetch(
        """SELECT s.id, e.name as exercise_name, s.weight, s.reps, s.created_at
           FROM sets s
           JOIN workouts w ON s.workout_id = w.id
           JOIN exercises e ON s.exercise_id = e.id
           WHERE w.user_id = $1 ORDER BY s.created_at DESC LIMIT 15""", uid
    )
    return {
        "exercises": [dict(r) for r in exercises],
        "goals": [dict(r) for r in goals],
        "recent_sets": [dict(r) for r in recent_sets]
    }

@app.post("/api/sets")
async def add_set(data: SetInput, user: dict = Depends(verify_telegram_user), conn=Depends(get_db)):
    uid = user["id"]
    # Находим или создаем тренировку за сегодня
    workout = await conn.fetchrow(
        "SELECT id FROM workouts WHERE user_id = $1 AND started_at::date = CURRENT_DATE LIMIT 1", uid
    )
    if not workout:
        workout = await conn.fetchrow(
            "INSERT INTO workouts (user_id) VALUES ($1) RETURNING id", uid
        )

    await conn.execute(
        "INSERT INTO sets (workout_id, exercise_id, weight, reps) VALUES ($1, $2, $3, $4)",
        workout["id"], data.exercise_id, data.weight, data.reps
    )

    # Проверяем, не выполнена ли цель
    completed_goals = await conn.fetch(
        """UPDATE goals SET is_completed = TRUE
           WHERE user_id = $1 AND exercise_id = $2 AND is_completed = FALSE
           AND target_weight <= $3 AND target_reps <= $4
           RETURNING id""",
        uid, data.exercise_id, data.weight, data.reps
    )
    return {"status": "ok", "goal_completed": len(completed_goals) > 0}

@app.post("/api/goals")
async def add_goal(data: GoalInput, user: dict = Depends(verify_telegram_user), conn=Depends(get_db)):
    await conn.execute(
        "INSERT INTO goals (user_id, exercise_id, target_weight, target_reps) VALUES ($1, $2, $3, $4)",
        user["id"], data.exercise_id, data.target_weight, data.target_reps
    )
    return {"status": "ok"}

@app.post("/api/exercises")
async def add_exercise(data: ExerciseInput, user: dict = Depends(verify_telegram_user), conn=Depends(get_db)):
    row = await conn.fetchrow(
        "INSERT INTO exercises (user_id, name, muscle_group) VALUES ($1, $2, $3) RETURNING id, name, muscle_group",
        user["id"], data.name, data.muscle_group
    )
    return dict(row)

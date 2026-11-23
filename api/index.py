import os
import hmac
import hashlib
import json
from datetime import date
from urllib.parse import parse_qsl
import asyncpg
from fastapi import FastAPI, Header, HTTPException, Depends
from pydantic import BaseModel

app = FastAPI()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")

async def get_db():
    url = DATABASE_URL.strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    conn = await asyncpg.connect(url, statement_cache_size=0, ssl="require")
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
    deadline: str | None = None

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
        "SELECT id, user_id, name, muscle_group FROM exercises WHERE user_id IS NULL OR user_id = $1 ORDER BY id", uid
    )
    goals = await conn.fetch(
        """SELECT g.id, g.exercise_id, e.name as exercise_name,
                  g.target_weight, g.target_reps, g.is_completed,
                  TO_CHAR(g.deadline, 'YYYY-MM-DD') as deadline,
                  COALESCE((
                      SELECT MAX(s.weight)
                      FROM sets s JOIN workouts w ON s.workout_id = w.id
                      WHERE w.user_id = $1 AND s.exercise_id = g.exercise_id
                  ), 0) as current_best
           FROM goals g JOIN exercises e ON g.exercise_id = e.id
           WHERE g.user_id = $1 ORDER BY g.is_completed ASC, g.id DESC""", uid
    )
    days = await conn.fetch(
        """SELECT DISTINCT TO_CHAR(s.created_at, 'YYYY-MM-DD') as day
           FROM sets s JOIN workouts w ON s.workout_id = w.id
           WHERE w.user_id = $1 ORDER BY day DESC""", uid
    )
    workout_days = [r["day"] for r in days]
    selected_day = workout_days[0] if workout_days else ""
    day_sets = []
    if selected_day:
        rows = await conn.fetch(
            """SELECT s.id, e.name as exercise_name, e.muscle_group, s.weight, s.reps,
                      TO_CHAR(s.created_at, 'HH24:MI') as time
               FROM sets s
               JOIN workouts w ON s.workout_id = w.id
               JOIN exercises e ON s.exercise_id = e.id
               WHERE w.user_id = $1 AND TO_CHAR(s.created_at, 'YYYY-MM-DD') = $2
               ORDER BY s.created_at ASC""",
            uid, selected_day
        )
        day_sets = [dict(r) for r in rows]

    return {
        "exercises": [dict(r) for r in exercises],
        "goals": [dict(r) for r in goals],
        "workout_days": workout_days,
        "selected_day": selected_day,
        "day_sets": day_sets
    }

@app.get("/api/history")
async def get_history(date: str = "", user: dict = Depends(verify_telegram_user), conn=Depends(get_db)):
    uid = user["id"]
    days = await conn.fetch(
        """SELECT DISTINCT TO_CHAR(s.created_at, 'YYYY-MM-DD') as day
           FROM sets s JOIN workouts w ON s.workout_id = w.id
           WHERE w.user_id = $1 ORDER BY day DESC""", uid
    )
    workout_days = [r["day"] for r in days]
    target_day = date if date else (workout_days[0] if workout_days else "")

    day_sets = []
    if target_day:
        rows = await conn.fetch(
            """SELECT s.id, e.name as exercise_name, e.muscle_group, s.weight, s.reps,
                      TO_CHAR(s.created_at, 'HH24:MI') as time
               FROM sets s
               JOIN workouts w ON s.workout_id = w.id
               JOIN exercises e ON s.exercise_id = e.id
               WHERE w.user_id = $1 AND TO_CHAR(s.created_at, 'YYYY-MM-DD') = $2
               ORDER BY s.created_at ASC""",
            uid, target_day
        )
        day_sets = [dict(r) for r in rows]

    return {"workout_days": workout_days, "selected_day": target_day, "day_sets": day_sets}

@app.get("/api/stats")
async def get_stats(exercise_id: int = 0, user: dict = Depends(verify_telegram_user), conn=Depends(get_db)):
    uid = user["id"]
    summary = await conn.fetchrow(
        """SELECT COUNT(DISTINCT s.created_at::date) as total_days,
                  COUNT(DISTINCT CASE WHEN DATE_TRUNC('month', s.created_at) = DATE_TRUNC('month', CURRENT_DATE)
                        THEN s.created_at::date END) as month_days,
                  COALESCE(SUM(s.weight * s.reps), 0) as total_volume
           FROM sets s JOIN workouts w ON s.workout_id = w.id
           WHERE w.user_id = $1""", uid
    )

    progress = []
    if exercise_id > 0:
        rows = await conn.fetch(
            """SELECT TO_CHAR(s.created_at, 'DD.MM') as label,
                      MAX(s.weight) as max_weight
               FROM sets s JOIN workouts w ON s.workout_id = w.id
               WHERE w.user_id = $1 AND s.exercise_id = $2
               GROUP BY s.created_at::date, TO_CHAR(s.created_at, 'DD.MM')
               ORDER BY s.created_at::date ASC
               LIMIT 12""",
            uid, exercise_id
        )
        progress = [dict(r) for r in rows]

    return {
        "total_days": summary["total_days"],
        "month_days": summary["month_days"],
        "total_volume": float(summary["total_volume"]),
        "progress": progress
    }

@app.post("/api/sets")
async def add_set(data: SetInput, user: dict = Depends(verify_telegram_user), conn=Depends(get_db)):
    uid = user["id"]
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
    dl = date.fromisoformat(data.deadline) if data.deadline else None
    await conn.execute(
        "INSERT INTO goals (user_id, exercise_id, target_weight, target_reps, deadline) VALUES ($1, $2, $3, $4, $5)",
        user["id"], data.exercise_id, data.target_weight, data.target_reps, dl
    )
    return {"status": "ok"}

@app.delete("/api/goals/{goal_id}")
async def delete_goal(goal_id: int, user: dict = Depends(verify_telegram_user), conn=Depends(get_db)):
    await conn.execute("DELETE FROM goals WHERE id = $1 AND user_id = $2", goal_id, user["id"])
    return {"status": "deleted"}

@app.post("/api/exercises")
async def add_exercise(data: ExerciseInput, user: dict = Depends(verify_telegram_user), conn=Depends(get_db)):
    row = await conn.fetchrow(
        "INSERT INTO exercises (user_id, name, muscle_group) VALUES ($1, $2, $3) RETURNING id, user_id, name, muscle_group",
        user["id"], data.name, data.muscle_group
    )
    return dict(row)

@app.put("/api/exercises/{ex_id}")
async def update_exercise(ex_id: int, data: ExerciseInput, user: dict = Depends(verify_telegram_user), conn=Depends(get_db)):
    await conn.execute(
        "UPDATE exercises SET name = $1, muscle_group = $2 WHERE id = $3 AND user_id = $4",
        data.name, data.muscle_group, ex_id, user["id"]
    )
    return {"status": "updated"}

@app.delete("/api/exercises/{ex_id}")
async def delete_exercise(ex_id: int, user: dict = Depends(verify_telegram_user), conn=Depends(get_db)):
    await conn.execute(
        "DELETE FROM exercises WHERE id = $1 AND user_id = $2",
        ex_id, user["id"]
    )
    return {"status": "deleted"}

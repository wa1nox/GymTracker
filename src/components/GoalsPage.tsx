import { useState } from 'react';
import { Exercise, Goal } from '../types';

interface Props {
  exercises: Exercise[];
  goals: Goal[];
  selectedEx: number;
  onSelectEx: (id: number) => void;
  onAddGoal: (targetWeight: number, targetReps: number) => void;
}

export function GoalsPage({
  exercises,
  goals,
  selectedEx,
  onSelectEx,
  onAddGoal,
}: Props) {
  const [goalW, setGoalW] = useState<number>(100);
  const [goalR, setGoalR] = useState<number>(8);

  return (
    <div>
      <h2 className="page-title">Цели</h2>

      <div className="card">
        <select
          className="input"
          value={selectedEx}
          onChange={(e) => onSelectEx(Number(e.target.value))}
          style={{ width: '100%', marginBottom: 12 }}
        >
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            className="input"
            type="number"
            step="0.25"
            value={goalW}
            onChange={(e) => setGoalW(Number(e.target.value))}
            placeholder="Вес (кг)"
            style={{ width: '50%' }}
          />
          <input
            className="input"
            type="number"
            value={goalR}
            onChange={(e) => setGoalR(Number(e.target.value))}
            placeholder="Повторы"
            style={{ width: '50%' }}
          />
        </div>

        <button className="btn btn-full" onClick={() => onAddGoal(goalW, goalR)}>
          Поставить цель
        </button>
      </div>

      {goals.map((g) => (
        <div
          key={g.id}
          className="card"
          style={{
            borderLeft: g.is_completed ? '4px solid var(--success)' : '4px solid var(--accent)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {g.exercise_name} {g.is_completed ? '(Выполнено)' : ''}
          </div>
          <div style={{ color: 'var(--muted)', marginTop: 4 }}>
            Цель: <b style={{ color: 'var(--text)' }}>{g.target_weight} кг x {g.target_reps} раз</b>
          </div>
        </div>
      ))}
    </div>
  );
}

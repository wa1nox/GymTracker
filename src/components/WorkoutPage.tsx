import { useState } from 'react';
import { Exercise, GROUPS } from '../types';

interface Props {
  exercises: Exercise[];
  selectedEx: number;
  onSelectEx: (id: number) => void;
  weight: number;
  onChangeWeight: (w: number) => void;
  reps: number;
  onChangeReps: (r: number) => void;
  onSaveSet: () => void;
  onAddEx: (name: string, group: string) => void;
  onUpdateEx: (id: number, name: string, group: string) => void;
  onDeleteEx: (id: number, name: string) => void;
}

export function WorkoutPage(p: Props) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editGroup, setEditGroup] = useState('Грудь');
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('Грудь');

  const currentEx = p.exercises.find((e) => e.id === p.selectedEx);

  const stepWeight = (delta: number) => {
    const next = Math.max(0, Number((p.weight + delta).toFixed(2)));
    p.onChangeWeight(next);
  };

  const openEdit = () => {
    if (!currentEx) return;
    setEditName(currentEx.name);
    setEditGroup(currentEx.muscle_group);
    setEditing(true);
  };

  const saveEdit = () => {
    if (!currentEx || !editName.trim()) return;
    p.onUpdateEx(currentEx.id, editName.trim(), editGroup);
    setEditing(false);
  };

  const createEx = () => {
    if (!newName.trim()) return;
    p.onAddEx(newName.trim(), newGroup);
    setNewName('');
  };

  return (
    <div>
      <h2 className="page-title">Тренировка</h2>

      <div className="card">
        <div className="row-between" style={{ marginBottom: 8 }}>
          <label style={{ color: 'var(--muted)', fontSize: 14 }}>Упражнение</label>
          {currentEx && currentEx.user_id !== null && !editing && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-sec btn-sm" onClick={openEdit}>
                Изменить
              </button>
              <button
                className="btn-danger"
                onClick={() => p.onDeleteEx(currentEx.id, currentEx.name)}
              >
                Удалить
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div style={{ marginBottom: 14, padding: 12, background: '#101319', borderRadius: 12 }}>
            <input
              className="input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              style={{ width: '100%', marginBottom: 8 }}
            />
            <select
              className="input"
              value={editGroup}
              onChange={(e) => setEditGroup(e.target.value)}
              style={{ width: '100%', marginBottom: 10 }}
            >
              {GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ flex: 1 }} onClick={saveEdit}>
                Сохранить
              </button>
              <button className="btn-sec" style={{ flex: 1 }} onClick={() => setEditing(false)}>
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <select
            className="input"
            value={p.selectedEx}
            onChange={(e) => {
              p.onSelectEx(Number(e.target.value));
              setEditing(false);
            }}
            style={{ width: '100%', fontSize: 16, fontWeight: 600, marginBottom: 18 }}
          >
            {p.exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name} ({ex.muscle_group})
              </option>
            ))}
          </select>
        )}

        <div className="row-between" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--muted)' }}>Вес:</span>
            <input
              className="input"
              type="number"
              step="0.25"
              value={p.weight}
              onChange={(e) => p.onChangeWeight(Math.max(0, Number(e.target.value)))}
              style={{ width: 78, textAlign: 'center', fontWeight: 700, fontSize: 17, padding: '8px 4px' }}
            />
            <span>кг</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-sec" onClick={() => stepWeight(-1.25)}>-1.25</button>
            <button className="btn-sec" onClick={() => stepWeight(1.25)}>+1.25</button>
          </div>
        </div>

        <div className="row-between" style={{ marginBottom: 20 }}>
          <span style={{ color: 'var(--muted)' }}>
            Повторения: <b style={{ color: 'var(--text)', fontSize: 18 }}>{p.reps}</b>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-sec" onClick={() => p.onChangeReps(Math.max(1, p.reps - 1))}>-1</button>
            <button className="btn-sec" onClick={() => p.onChangeReps(p.reps + 1)}>+1</button>
          </div>
        </div>

        <button className="btn btn-full" style={{ padding: 16, fontSize: 16 }} onClick={p.onSaveSet}>
          Записать подход
        </button>
      </div>

      <div className="card">
        <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 10 }}>
          Добавить своё упражнение
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            className="input"
            placeholder="Название"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ flex: 1 }}
          />
          <select
            className="input"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
          >
            {GROUPS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <button className="btn-sec btn-full" onClick={createEx}>
          + Добавить упражнение
        </button>
      </div>
    </div>
  );
}

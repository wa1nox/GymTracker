import { useEffect, useState } from 'react';

interface Exercise { id: number; name: string; muscle_group: string; }
interface Goal { id: number; exercise_id: number; exercise_name: string; target_weight: number; target_reps: number; is_completed: boolean; }
interface SetItem { id: number; exercise_name: string; weight: number; reps: number; created_at: string; }

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
        HapticFeedback?: {
          notificationOccurred?: (type: 'error' | 'success' | 'warning') => void;
          impactOccurred?: (style: 'light' | 'medium' | 'heavy') => void;
        };
      };
    };
  }
}

export function App() {
  const [tab, setTab] = useState<'workout' | 'goals' | 'history'>('workout');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [recentSets, setRecentSets] = useState<SetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Форма подхода
  const [selectedEx, setSelectedEx] = useState<number>(1);
  const [weight, setWeight] = useState<number>(50);
  const [reps, setReps] = useState<number>(10);
  const [timer, setTimer] = useState<number>(0);

  // Форма цели
  const [goalWeight, setGoalWeight] = useState<number>(100);
  const [goalReps, setGoalReps] = useState<number>(8);

  // Форма нового упражнения
  const [newExName, setNewExName] = useState('');
  const [newExGroup, setNewExGroup] = useState('Грудь');

  const tg = window.Telegram?.WebApp;
  const initDataRaw = tg?.initData || '';

  useEffect(() => {
    tg?.ready?.();
    tg?.expand?.();
  }, []);

  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': initDataRaw,
        ...(options.headers || {}),
      },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const loadData = async () => {
    try {
      const data = await apiFetch('/api/init');
      setExercises(data.exercises);
      setGoals(data.goals);
      setRecentSets(data.recent_sets);
      if (data.exercises.length > 0 && !selectedEx) {
        setSelectedEx(data.exercises[0].id);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Таймер отдыха
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleSaveSet = async () => {
    try {
      tg?.HapticFeedback?.notificationOccurred?.('success');
      const res = await apiFetch('/api/sets', {
        method: 'POST',
        body: JSON.stringify({ exercise_id: selectedEx, weight, reps }),
      });
      if (res.goal_completed) {
        alert('🎉 Поздравляем! Цель по этому упражнению выполнена!');
      }
      setTimer(90);
      loadData();
    } catch (e: unknown) {
      alert('Ошибка сохранения: ' + (e instanceof Error ? e.message : 'Неизвестная ошибка'));
    }
  };

  const handleAddGoal = async () => {
    await apiFetch('/api/goals', {
      method: 'POST',
      body: JSON.stringify({ exercise_id: selectedEx, target_weight: goalWeight, target_reps: goalReps }),
    });
    tg?.HapticFeedback?.notificationOccurred?.('success');
    loadData();
  };

  const handleAddExercise = async () => {
    if (!newExName.trim()) return;
    const created = await apiFetch('/api/exercises', {
      method: 'POST',
      body: JSON.stringify({ name: newExName, muscle_group: newExGroup }),
    });
    setNewExName('');
    await loadData();
    setSelectedEx(created.id);
  };

  const btnStyle: React.CSSProperties = {
    padding: '10px 16px', borderRadius: 10, border: 'none',
    background: '#2481cc', color: '#fff', fontWeight: 600, cursor: 'pointer'
  };

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 16, marginBottom: 14
  };

  if (loading) return <div style={{ padding: 20, color: '#fff' }}>Загрузка трекера...</div>;
  if (error) return <div style={{ padding: 20, color: '#ff6b6b' }}>Ошибка: {error}</div>;

  return (
    <div style={{ padding: 16, paddingBottom: 80, color: '#fff', fontFamily: 'sans-serif' }}>
      {timer > 0 && (
        <div style={{ ...cardStyle, background: '#1e3a5f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⏱ Отдых: <b>{Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}</b></span>
          <button onClick={() => setTimer(0)} style={{ ...btnStyle, padding: '4px 10px', background: '#444' }}>Сброс</button>
        </div>
      )}

      {tab === 'workout' && (
        <div>
          <h2 style={{ marginTop: 0 }}>🏋️ Тренировка</h2>
          <div style={cardStyle}>
            <label style={{ display: 'block', marginBottom: 6, opacity: 0.7 }}>Упражнение:</label>
            <select
              value={selectedEx}
              onChange={(e) => setSelectedEx(Number(e.target.value))}
              style={{ width: '100%', padding: 10, borderRadius: 8, fontSize: 16, marginBottom: 14 }}
            >
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name} ({ex.muscle_group})</option>
              ))}
            </select>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span>Вес: <b>{weight} кг</b></span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setWeight(Math.max(0, weight - 2.5))} style={btnStyle}>-2.5</button>
                <button onClick={() => setWeight(weight + 2.5)} style={btnStyle}>+2.5</button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span>Повторения: <b>{reps}</b></span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setReps(Math.max(1, reps - 1))} style={btnStyle}>-1</button>
                <button onClick={() => setReps(reps + 1)} style={btnStyle}>+1</button>
              </div>
            </div>

            <button onClick={handleSaveSet} style={{ ...btnStyle, width: '100%', padding: 14, fontSize: 16 }}>
              ✅ Записать подход
            </button>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 8 }}>Добавить своё упражнение</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                placeholder="Название (напр. Брусья)"
                value={newExName}
                onChange={(e) => setNewExName(e.target.value)}
                style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none' }}
              />
              <select
                value={newExGroup}
                onChange={(e) => setNewExGroup(e.target.value)}
                style={{ padding: 8, borderRadius: 8, border: 'none' }}
              >
                <option value="Грудь">Грудь</option>
                <option value="Спина">Спина</option>
                <option value="Ноги">Ноги</option>
                <option value="Плечи">Плечи</option>
                <option value="Руки">Руки</option>
              </select>
            </div>
            <button onClick={handleAddExercise} style={{ ...btnStyle, width: '100%' }}>+ Добавить упражнение</button>
          </div>
        </div>
      )}

      {tab === 'goals' && (
        <div>
          <h2 style={{ marginTop: 0 }}>🎯 Цели</h2>
          <div style={cardStyle}>
            <select
              value={selectedEx}
              onChange={(e) => setSelectedEx(Number(e.target.value))}
              style={{ width: '100%', padding: 10, borderRadius: 8, marginBottom: 10 }}
            >
              {exercises.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input type="number" value={goalWeight} onChange={(e) => setGoalWeight(Number(e.target.value))} placeholder="Вес (кг)" style={{ width: '50%', padding: 8, borderRadius: 8 }} />
              <input type="number" value={goalReps} onChange={(e) => setGoalReps(Number(e.target.value))} placeholder="Повторы" style={{ width: '50%', padding: 8, borderRadius: 8 }} />
            </div>
            <button onClick={handleAddGoal} style={{ ...btnStyle, width: '100%' }}>Поставить цель</button>
          </div>

          {goals.map((g) => (
            <div key={g.id} style={{ ...cardStyle, borderLeft: g.is_completed ? '4px solid #4caf50' : '4px solid #2481cc' }}>
              <div style={{ fontWeight: 600 }}>{g.exercise_name} {g.is_completed ? '✅ Выполнено!' : ''}</div>
              <div style={{ opacity: 0.8 }}>Цель: {g.target_weight} кг × {g.target_reps} раз</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div>
          <h2 style={{ marginTop: 0 }}>📊 Последние подходы</h2>
          {recentSets.length === 0 && <div style={{ opacity: 0.6 }}>Пока нет записанных подходов</div>}
          {recentSets.map((s) => (
            <div key={s.id} style={cardStyle}>
              <div style={{ fontWeight: 600 }}>{s.exercise_name}</div>
              <div>{s.weight} кг × {s.reps} раз</div>
            </div>
          ))}
        </div>
      )}

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex',


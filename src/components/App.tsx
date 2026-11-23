import { useEffect, useState } from 'react';

interface Exercise {
  id: number;
  user_id: number | null;
  name: string;
  muscle_group: string;
}

interface Goal {
  id: number;
  exercise_id: number;
  exercise_name: string;
  target_weight: number;
  target_reps: number;
  is_completed: boolean;
}

interface SetItem {
  id: number;
  exercise_name: string;
  muscle_group: string;
  weight: number;
  reps: number;
  time: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
        HapticFeedback?: {
          notificationOccurred?: (type: 'error' | 'success' | 'warning') => void;
          impactOccurred?: (style: 'light' | 'medium' | 'heavy') => void;
        };
      };
    };
  }
}

const THEME = {
  bg: '#0f1115',
  card: '#181b22',
  cardBorder: '1px solid #262a35',
  accent: '#ff5e3a',
  accentGradient: 'linear-gradient(135deg, #ff5e3a 0%, #ff2a68 100%)',
  success: '#10b981',
  text: '#f3f4f6',
  textMuted: '#9ca3af',
  navBg: '#14171f',
};

const GROUPS = ['Грудь', 'Спина', 'Ноги', 'Плечи', 'Руки', 'Пресс'];
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const btn: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 12,
  border: 'none',
  background: THEME.accentGradient,
  color: '#fff',
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  ...btn,
  background: '#252a36',
  fontWeight: 600,
};

const card: React.CSSProperties = {
  background: THEME.card,
  border: THEME.cardBorder,
  borderRadius: 18,
  padding: 18,
  marginBottom: 16,
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
};

const inp: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid #2e3442',
  background: '#101319',
  color: '#fff',
  fontSize: 15,
};

export function App() {
  const [tab, setTab] = useState<'workout' | 'goals' | 'history'>('workout');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedEx, setSelectedEx] = useState<number>(1);
  const [weight, setWeight] = useState<number>(50);
  const [reps, setReps] = useState<number>(10);
  const [timer, setTimer] = useState<number>(0);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editGroup, setEditGroup] = useState('Грудь');

  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('Грудь');

  const [goalW, setGoalW] = useState<number>(100);
  const [goalR, setGoalR] = useState<number>(8);

  const [workoutDays, setWorkoutDays] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [daySets, setDaySets] = useState<SetItem[]>([]);
  const [showCal, setShowCal] = useState<boolean>(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth());
  const tg = window.Telegram?.WebApp;
  const hashP = new URLSearchParams(window.location.hash.slice(1));
  const queryP = new URLSearchParams(window.location.search);
  const initData =
    tg?.initData ||
    hashP.get('tgWebAppData') ||
    queryP.get('tgWebAppData') ||
    '';

  useEffect(() => {
    tg?.ready?.();
    tg?.expand?.();
    tg?.setHeaderColor?.(THEME.bg);
    tg?.setBackgroundColor?.(THEME.bg);
  }, []);

  const api = async (url: string, opts: RequestInit = {}) => {
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': initData,
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const loadData = async () => {
    try {
      const data = await api('/api/init');
      setExercises(data.exercises);
      setGoals(data.goals);
      setWorkoutDays(data.workout_days || []);
      setSelectedDay(data.selected_day || '');
      setDaySets(data.day_sets || []);
      if (data.selected_day) {
        const p = data.selected_day.split('-');
        setYear(Number(p.at(0)));
        setMonth(Number(p.at(1)) - 1);
      }
      const first = data.exercises.at(0);
      if (first && !data.exercises.some((e: Exercise) => e.id === selectedEx)) {
        setSelectedEx(first.id);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const currentEx = exercises.find((e) => e.id === selectedEx);

  const selectDay = async (day: string) => {
    tg?.HapticFeedback?.impactOccurred?.('light');
    setSelectedDay(day);
    const data = await api(`/api/history?date=${day}`);
    setWorkoutDays(data.workout_days || []);
    setDaySets(data.day_sets || []);
  };

  const saveSet = async () => {
    try {
      tg?.HapticFeedback?.notificationOccurred?.('success');
      const res = await api('/api/sets', {
        method: 'POST',
        body: JSON.stringify({ exercise_id: selectedEx, weight, reps }),
      });
      if (res.goal_completed) alert('Цель выполнена!');
      setTimer(90);
      loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const addExercise = async () => {
    if (!newName.trim()) return;
    const created = await api('/api/exercises', {
      method: 'POST',
      body: JSON.stringify({ name: newName.trim(), muscle_group: newGroup }),
    });
    setNewName('');
    tg?.HapticFeedback?.notificationOccurred?.('success');
    await loadData();
    setSelectedEx(created.id);
  };

  const startEdit = () => {
    if (!currentEx) return;
    setEditName(currentEx.name);
    setEditGroup(currentEx.muscle_group);
    setEditing(true);
  };

  const updateExercise = async () => {
    if (!currentEx || !editName.trim()) return;
    await api(`/api/exercises/${currentEx.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: editName.trim(), muscle_group: editGroup }),
    });
    setEditing(false);
    tg?.HapticFeedback?.notificationOccurred?.('success');
    loadData();
  };

  const deleteExercise = async () => {
    if (!currentEx) return;
    if (!window.confirm(`Удалить «${currentEx.name}»?`)) return;
    await api(`/api/exercises/${currentEx.id}`, { method: 'DELETE' });
    setEditing(false);
    tg?.HapticFeedback?.notificationOccurred?.('warning');
    loadData();
  };

  const addGoal = async () => {
    await api('/api/goals', {
      method: 'POST',
      body: JSON.stringify({
        exercise_id: selectedEx,
        target_weight: goalW,
        target_reps: goalR,
      }),
    });
    tg?.HapticFeedback?.notificationOccurred?.('success');
    loadData();
  };
  const stepWeight = (delta: number) => {
    tg?.HapticFeedback?.impactOccurred?.('light');
    setWeight((prev) => Math.max(0, Number((prev + delta).toFixed(2))));
  };

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  const renderCells = () => {
    const first = new Date(year, month, 1).getDay();
    const offset = first === 0 ? 6 : first - 1;
    const total = new Date(year, month + 1, 0).getDate();
    const wSet = new Set(workoutDays);
    const list = [];

    for (let i = 0; i < offset; i++) {
      list.push(<div key={`e-${i}`} />);
    }

    for (let d = 1; d <= total; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${year}-${mStr}-${dStr}`;
      const active = wSet.has(dateStr);
      const chosen = selectedDay === dateStr;

      list.push(
        <button
          key={dateStr}
          onClick={() => selectDay(dateStr)}
          style={{
            padding: '10px 0',
            borderRadius: 12,
            border: chosen ? `2px solid ${THEME.accent}` : '1px solid transparent',
            background: active ? 'rgba(255, 94, 58, 0.2)' : '#101319',
            color: THEME.text,
            fontWeight: active || chosen ? 700 : 400,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
          }}
        >
          <span>{d}</span>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: active ? THEME.success : 'transparent',
            }}
          />
        </button>
      );
    }
    return list;
  };

  const grouped = daySets.reduce<Record<string, SetItem[]>>((acc, s) => {
    if (!acc[s.exercise_name]) acc[s.exercise_name] = [];
    acc[s.exercise_name].push(s);
    return acc;
  }, {});

  const dayIdx = workoutDays.indexOf(selectedDay);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: THEME.bg,
          color: THEME.text,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          gap: 16,
        }}
      >
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        `}</style>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: '4px solid #252a36',
            borderTopColor: THEME.accent,
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.5 }}>
          GYM TRACKER
        </div>
        <div style={{ fontSize: 13, color: THEME.textMuted, animation: 'pulse 1.5s infinite' }}>
          Синхронизация тренировок...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: THEME.bg, padding: 20, color: '#ff6b6b' }}>
        {error}
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: THEME.bg,
        padding: 16,
        paddingBottom: 105,
        color: THEME.text,
        fontFamily: 'sans-serif',
      }}
    >
      {timer > 0 && (
        <div
          style={{
            ...card,
            background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
            border: `1px solid ${THEME.accent}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 16 }}>
            Отдых: <b style={{ color: THEME.accent, fontSize: 18 }}>{Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}</b>
          </span>
          <button
            onClick={() => setTimer(0)}
            style={{ ...secondaryBtn, padding: '6px 12px', fontSize: 13 }}
          >
            Сброс
          </button>
        </div>
      )}

      {tab === 'workout' && (
        <div>
          <h2 style={{ marginTop: 0, fontSize: 22 }}>Тренировка</h2>

          <div style={card}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <label style={{ color: THEME.textMuted, fontSize: 14 }}>Упражнение</label>
              {currentEx && currentEx.user_id !== null && !editing && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={startEdit}
                    style={{ ...secondaryBtn, padding: '6px 10px', fontSize: 12 }}
                  >
                    Изменить
                  </button>
                  <button
                    onClick={deleteExercise}
                    style={{ ...btn, padding: '6px 10px', fontSize: 12, background: '#dc2626' }}
                  >
                    Удалить
                  </button>
                </div>
              )}
            </div>

            {editing ? (
              <div style={{ marginBottom: 14, padding: 12, background: '#101319', borderRadius: 12 }}>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ ...inp, width: '100%', marginBottom: 8, boxSizing: 'border-box' }}
                />
                <select
                  value={editGroup}
                  onChange={(e) => setEditGroup(e.target.value)}
                  style={{ ...inp, width: '100%', marginBottom: 10 }}
                >
                  {GROUPS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={updateExercise} style={{ ...btn, flex: 1 }}>Сохранить</button>
                  <button onClick={() => setEditing(false)} style={{ ...secondaryBtn, flex: 1 }}>Отмена</button>
                </div>
              </div>
            ) : (
              <select
                value={selectedEx}
                onChange={(e) => {
                  setSelectedEx(Number(e.target.value));
                  setEditing(false);
                }}
                style={{ ...inp, width: '100%', fontSize: 16, fontWeight: 600, marginBottom: 18 }}
              >
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.muscle_group})
                  </option>
                ))}
              </select>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: THEME.textMuted }}>Вес:</span>
                <input
                  type="number"
                  step="0.25"
                  value={weight}
                  onChange={(e) => setWeight(Math.max(0, Number(e.target.value)))}
                  style={{ ...inp, width: 78, textAlign: 'center', fontWeight: 700, fontSize: 17 }}
                />
                <span>кг</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => stepWeight(-1.25)} style={secondaryBtn}>-1.25</button>
                <button onClick={() => stepWeight(1.25)} style={secondaryBtn}>+1.25</button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ color: THEME.textMuted }}>
                Повторения: <b style={{ color: THEME.text, fontSize: 18 }}>{reps}</b>
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setReps((r) => Math.max(1, r - 1))} style={secondaryBtn}>-1</button>
                <button onClick={() => setReps((r) => r + 1)} style={secondaryBtn}>+1</button>
              </div>
            </div>

            <button onClick={saveSet} style={{ ...btn, width: '100%', padding: 16, fontSize: 16 }}>
              Записать подход
            </button>
          </div>

          <div style={card}>
            <div style={{ fontSize: 14, color: THEME.textMuted, marginBottom: 10 }}>
              Добавить своё упражнение
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                placeholder="Название"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ ...inp, flex: 1 }}
              />
              <select value={newGroup} onChange={(e) => setNewGroup(e.target.value)} style={inp}>
                {GROUPS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <button onClick={addExercise} style={{ ...secondaryBtn, width: '100%' }}>
              + Добавить упражнение
            </button>
          </div>
        </div>
      )}
      {tab === 'goals' && (
        <div>
          <h2 style={{ marginTop: 0, fontSize: 22 }}>Цели</h2>
          <div style={card}>
            <select
              value={selectedEx}
              onChange={(e) => setSelectedEx(Number(e.target.value))}
              style={{ ...inp, width: '100%', marginBottom: 12 }}
            >
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                type="number"
                step="0.25"
                value={goalW}
                onChange={(e) => setGoalW(Number(e.target.value))}
                placeholder="Вес (кг)"
                style={{ ...inp, width: '50%' }}
              />
              <input
                type="number"
                value={goalR}
                onChange={(e) => setGoalR(Number(e.target.value))}
                placeholder="Повторы"
                style={{ ...inp, width: '50%' }}
              />
            </div>
            <button onClick={addGoal} style={{ ...btn, width: '100%' }}>
              Поставить цель
            </button>
          </div>

          {goals.map((g) => (
            <div
              key={g.id}
              style={{
                ...card,
                borderLeft: g.is_completed ? `4px solid ${THEME.success}` : `4px solid ${THEME.accent}`,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {g.exercise_name} {g.is_completed ? '(Выполнено)' : ''}
              </div>
              <div style={{ color: THEME.textMuted, marginTop: 4 }}>
                Цель: <b style={{ color: THEME.text }}>{g.target_weight} кг x {g.target_reps} раз</b>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 22 }}>История</h2>
            <button onClick={() => setShowCal((v) => !v)} style={{ ...secondaryBtn, padding: '8px 14px', fontSize: 13 }}>
              {showCal ? 'Скрыть календарь' : 'Календарь'}
            </button>
          </div>

          {showCal && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <button onClick={() => shiftMonth(-1)} style={{ ...secondaryBtn, padding: '6px 12px' }}>{'<'}</button>
                <b style={{ fontSize: 16 }}>{MONTHS[month]} {year}</b>
                <button onClick={() => shiftMonth(1)} style={{ ...secondaryBtn, padding: '6px 12px' }}>{'>'}</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center', fontSize: 12, color: THEME.textMuted, marginBottom: 8 }}>
                {DAYS.map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {renderCells()}
              </div>
            </div>
          )}

          {workoutDays.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <button
                disabled={dayIdx === -1 || dayIdx >= workoutDays.length - 1}
                onClick={() => selectDay(workoutDays[dayIdx + 1])}
                style={{ ...secondaryBtn, padding: '8px 12px', opacity: dayIdx === -1 || dayIdx >= workoutDays.length - 1 ? 0.4 : 1 }}
              >
                Пред. день
              </button>
              <b>{selectedDay || 'Выберите дату'}</b>
              <button
                disabled={dayIdx <= 0}
                onClick={() => selectDay(workoutDays[dayIdx - 1])}
                style={{ ...secondaryBtn, padding: '8px 12px', opacity: dayIdx <= 0 ? 0.4 : 1 }}
              >
                След. день
              </button>
            </div>
          )}

          {Object.keys(grouped).length === 0 ? (
            <div style={{ ...card, color: THEME.textMuted, textAlign: 'center' }}>
              За выбранный день тренировок не найдено
            </div>
          ) : (
            Object.entries(grouped).map(([name, items]) => (
              <div key={name} style={card}>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 10 }}>{name}</div>
                {items.map((s, idx) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '6px 0',
                      borderTop: idx > 0 ? '1px solid #262a35' : 'none',
                    }}
                  >
                    <span>Подход {idx + 1}: <b>{s.weight} кг x {s.reps}</b></span>
                    <span style={{ color: THEME.textMuted, fontSize: 13 }}>{s.time}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          gap: 8,
          background: THEME.navBg,
          borderTop: '1px solid #262a35',
          padding: '10px 12px 18px',
        }}
      >
        {[
          { id: 'workout', label: 'Зал', icon: '🏋️' },
          { id: 'goals', label: 'Цели', icon: '🎯' },
          { id: 'history', label: 'История', icon: '📅' },
        ].map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                tg?.HapticFeedback?.impactOccurred?.('light');
                setTab(item.id as 'workout' | 'goals' | 'history');
              }}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 14,
                border: 'none',
                background: active ? THEME.accentGradient : 'transparent',
                color: active ? '#fff' : THEME.textMuted,
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default App;

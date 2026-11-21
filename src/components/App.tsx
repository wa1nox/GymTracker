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
        HapticFeedback?: {
          notificationOccurred?: (type: 'error' | 'success' | 'warning') => void;
          impactOccurred?: (style: 'light' | 'medium' | 'heavy') => void;
        };
      };
    };
  }
}

const MUSCLE_GROUPS = ['Грудь', 'Спина', 'Ноги', 'Плечи', 'Руки', 'Пресс'];
const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];
const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

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

  const [isEditingEx, setIsEditingEx] = useState(false);
  const [editExName, setEditExName] = useState('');
  const [editExGroup, setEditExGroup] = useState('Грудь');

  const [newExName, setNewExName] = useState('');
  const [newExGroup, setNewExGroup] = useState('Грудь');

  const [goalWeight, setGoalWeight] = useState<number>(100);
  const [goalReps, setGoalReps] = useState<number>(8);

  const [workoutDays, setWorkoutDays] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [daySets, setDaySets] = useState<SetItem[]>([]);
  const [showCalendar, setShowCalendar] = useState<boolean>(true);
  const [calYear, setCalYear] = useState<number>(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState<number>(new Date().getMonth());

  const tg = window.Telegram?.WebApp;
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const queryParams = new URLSearchParams(window.location.search);
  const initDataRaw =
    tg?.initData ||
    hashParams.get('tgWebAppData') ||
    queryParams.get('tgWebAppData') ||
    '';

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
      setWorkoutDays(data.workout_days || []);
      setSelectedDay(data.selected_day || '');
      setDaySets(data.day_sets || []);
      if (data.selected_day) {
        const parts = data.selected_day.split('-');
        setCalYear(Number(parts[0]));
        setCalMonth(Number(parts[1]) - 1);
      }
      const firstEx = data.exercises.at(0);
      if (firstEx && !data.exercises.some((e: Exercise) => e.id === selectedEx)) {
        setSelectedEx(firstEx.id);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const currentExercise = exercises.find((e) => e.id === selectedEx);

  const handleSelectDay = async (dayStr: string) => {
    tg?.HapticFeedback?.impactOccurred?.('light');
    setSelectedDay(dayStr);
    const data = await apiFetch(`/api/history?date=${dayStr}`);
    setWorkoutDays(data.workout_days || []);
    setDaySets(data.day_sets || []);
  };

  const handleSaveSet = async () => {
    try {
      tg?.HapticFeedback?.notificationOccurred?.('success');
      const res = await apiFetch('/api/sets', {
        method: 'POST',
        body: JSON.stringify({ exercise_id: selectedEx, weight, reps }),
      });
      if (res.goal_completed) {
        alert('Цель по этому упражнению выполнена!');
      }
      setTimer(90);
      loadData();
    } catch (e: unknown) {
      alert('Ошибка сохранения: ' + (e instanceof Error ? e.message : 'Неизвестная ошибка'));
    }
  };

  const handleAddExercise = async () => {
    if (!newExName.trim()) return;
    const created = await apiFetch('/api/exercises', {
      method: 'POST',
      body: JSON.stringify({ name: newExName.trim(), muscle_group: newExGroup }),
    });
    setNewExName('');
    tg?.HapticFeedback?.notificationOccurred?.('success');
    await loadData();
    setSelectedEx(created.id);
  };

  const startEditExercise = () => {
    if (!currentExercise) return;
    setEditExName(currentExercise.name);
    setEditExGroup(currentExercise.muscle_group);
    setIsEditingEx(true);
  };

  const handleUpdateExercise = async () => {
    if (!currentExercise || !editExName.trim()) return;
    await apiFetch(`/api/exercises/${currentExercise.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: editExName.trim(), muscle_group: editExGroup }),
    });
    setIsEditingEx(false);
    tg?.HapticFeedback?.notificationOccurred?.('success');
    loadData();
  };

  const handleDeleteExercise = async () => {
    if (!currentExercise) return;
    if (!window.confirm(`Удалить упражнение «${currentExercise.name}» и его историю?`)) return;
    await apiFetch(`/api/exercises/${currentExercise.id}`, {
      method: 'DELETE',
    });
    setIsEditingEx(false);
    tg?.HapticFeedback?.notificationOccurred?.('warning');
    loadData();
  };

  const handleAddGoal = async () => {
    await apiFetch('/api/goals', {
      method: 'POST',
      body: JSON.stringify({
        exercise_id: selectedEx,
        target_weight: goalWeight,
        target_reps: goalReps,
      }),
    });
    tg?.HapticFeedback?.notificationOccurred?.('success');
    loadData();
  };

  const changeWeight = (delta: number) => {
    tg?.HapticFeedback?.impactOccurred?.('light');
    setWeight((prev) => Math.max(0, Number((prev + delta).toFixed(2))));
  };

  const changeMonth = (delta: number) => {
    let nextMonth = calMonth + delta;
    let nextYear = calYear;
    if (nextMonth < 0) {
      nextMonth = 11;
      nextYear -= 1;
    } else if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    setCalMonth(nextMonth);
    setCalYear(nextYear);
  };

  const renderCalendarCells = () => {
    const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const workoutSet = new Set(workoutDays);
    const cells = [];

    for (let i = 0; i < startOffset; i++) {
      cells.push(<div key={`empty-${i}`} />);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(calMonth + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const fullDate = `${calYear}-${mStr}-${dStr}`;
      const hasWorkout = workoutSet.has(fullDate);
      const isSelected = selectedDay === fullDate;

      cells.push(
        <button
          key={fullDate}
          onClick={() => handleSelectDay(fullDate)}
          style={{
            padding: '8px 0',
            borderRadius: 10,
            border: isSelected ? '2px solid #2481cc' : '1px solid transparent',
            background: hasWorkout ? 'rgba(36, 129, 204, 0.28)' : 'rgba(255,255,255,0.04)',
            color: '#fff',
            fontWeight: hasWorkout || isSelected ? 700 : 400,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <span>{d}</span>
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: hasWorkout ? '#4caf50' : 'transparent',
            }}
          />
        </button>
      );
    }
    return cells;
  };

  const groupedSets = daySets.reduce<Record<string, SetItem[]>>((acc, item) => {
    if (!acc[item.exercise_name]) {
      acc[item.exercise_name] = [];
    }
    acc[item.exercise_name].push(item);
    return acc;
  }, {});

  const currentDayIdx = workoutDays.indexOf(selectedDay);

  const btnStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: 10,
    border: 'none',
    background: '#2481cc',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  };

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  };

  if (loading) {
    return <div style={{ padding: 20, color: '#fff' }}>Загрузка трекера...</div>;
  }

  if (error) {
    return <div style={{ padding: 20, color: '#ff6b6b' }}>Ошибка: {error}</div>;
  }

  return (
    <div style={{ padding: 16, paddingBottom: 84, color: '#fff', fontFamily: 'sans-serif' }}>
      {timer > 0 && (
        <div
          style={{
            ...cardStyle,
            background: '#1e3a5f',
            display: 'flex',
            justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>
          Отдых: <b>{Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}</b>
        </span>
        <button
          onClick={() => setTimer(0)}
          style={{ ...btnStyle, padding: '4px 10px', background: '#444' }}
        >
          Сброс
        </button>
      </div>
    )}

    {tab === 'workout' && (
      <div>
        <h2 style={{ marginTop: 0 }}>Тренировка</h2>

        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ opacity: 0.7 }}>Упражнение:</label>
            {currentExercise && currentExercise.user_id !== null && !isEditingEx && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={startEditExercise}
                  style={{ ...btnStyle, padding: '4px 10px', fontSize: 12, background: '#3a3a3c' }}
                >
                  Изменить
                </button>
                <button
                  onClick={handleDeleteExercise}
                  style={{ ...btnStyle, padding: '4px 10px', fontSize: 12, background: '#c0392b' }}
                >
                  Удалить
                </button>
              </div>
            )}
          </div>

          {isEditingEx ? (
            <div style={{ marginBottom: 14, padding: 10, background: 'rgba(0,0,0,0.25)', borderRadius: 10 }}>
              <input
                value={editExName}
                onChange={(e) => setEditExName(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 8, border: 'none', marginBottom: 8, boxSizing: 'border-box' }}
              />
              <select
                value={editExGroup}
                onChange={(e) => setEditExGroup(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 8, border: 'none', marginBottom: 8 }}
              >
                {MUSCLE_GROUPS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleUpdateExercise} style={{ ...btnStyle, flex: 1 }}>Сохранить</button>
                <button onClick={() => setIsEditingEx(false)} style={{ ...btnStyle, flex: 1, background: '#444' }}>Отмена</button>
              </div>
            </div>
          ) : (
            <select
              value={selectedEx}
              onChange={(e) => {
                setSelectedEx(Number(e.target.value));
                setIsEditingEx(false);
              }}
              style={{ width: '100%', padding: 10, borderRadius: 8, fontSize: 16, marginBottom: 14 }}
            >
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} ({ex.muscle_group})
                </option>
              ))}
            </select>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Вес:</span>
              <input
                type="number"
                step="0.25"
                value={weight}
                onChange={(e) => setWeight(Math.max(0, Number(e.target.value)))}
                style={{
                  width: 74,
                  padding: '6px 4px',
                  borderRadius: 8,
                  border: 'none',
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: 16,
                }}
              />
              <span>кг</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => changeWeight(-1.25)} style={btnStyle}>-1.25</button>
              <button onClick={() => changeWeight(1.25)} style={btnStyle}>+1.25</button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span>Повторения: <b>{reps}</b></span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setReps((r) => Math.max(1, r - 1))} style={btnStyle}>-1</button>
              <button onClick={() => setReps((r) => r + 1)} style={btnStyle}>+1</button>
            </div>
          </div>

          <button onClick={handleSaveSet} style={{ ...btnStyle, width: '100%', padding: 14, fontSize: 16 }}>
            Записать подход
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
              {MUSCLE_GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <button onClick={handleAddExercise} style={{ ...btnStyle, width: '100%' }}>
            + Добавить упражнение
          </button>
        </div>
      </div>
    )}

    {tab === 'goals' && (
      <div>
        <h2 style={{ marginTop: 0 }}>Цели</h2>
        <div style={cardStyle}>
          <select
            value={selectedEx}
            onChange={(e) => setSelectedEx(Number(e.target.value))}
            style={{ width: '100%', padding: 10, borderRadius: 8, marginBottom: 10 }}
          >
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>{ex.name}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              type="number"
              step="0.25"
              value={goalWeight}
              onChange={(e) => setGoalWeight(Number(e.target.value))}
              placeholder="Вес (кг)"
              style={{ width: '50%', padding: 8, borderRadius: 8, border: 'none' }}
            />
            <input
              type="number"
              value={goalReps}
              onChange={(e) => setGoalReps(Number(e.target.value))}
              placeholder="Повторы"
              style={{ width: '50%', padding: 8, borderRadius: 8, border: 'none' }}
            />
          </div>
          <button onClick={handleAddGoal} style={{ ...btnStyle, width: '100%' }}>
            Поставить цель
          </button>
        </div>

        {goals.map((g) => (
          <div
            key={g.id}
            style={{
              ...cardStyle,
              borderLeft: g.is_completed ? '4px solid #4caf50' : '4px solid #2481cc',
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {g.exercise_name} {g.is_completed ? '(Выполнено)' : ''}
            </div>
            <div style={{ opacity: 0.8 }}>
              Цель: {g.target_weight} кг x {g.target_reps} раз
            </div>
          </div>
        ))}
      </div>
    )}

    {tab === 'history' && (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>История</h2>
          <button
            onClick={() => setShowCalendar((v) => !v)}
            style={{ ...btnStyle, padding: '6px 12px', fontSize: 13 }}
          >
            {showCalendar ? 'Скрыть календарь' : 'Календарь'}
          </button>
        </div>

        {showCalendar && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <button onClick={() => changeMonth(-1)} style={{ ...btnStyle, padding: '4px 10px' }}>
                {'<'}
              </button>
              <b>{MONTH_NAMES[calMonth]} {calYear}</b>
              <button onClick={() => changeMonth(1)} style={{ ...btnStyle, padding: '4px 10px' }}>
                {'>'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center', fontSize: 12, opacity: 0.6, marginBottom: 6 }}>
              {WEEK_DAYS.map((wd) => (
                <div key={wd}>{wd}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {renderCalendarCells()}
            </div>
          </div>
        )}

        {workoutDays.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <button
              disabled={currentDayIdx === -1 || currentDayIdx >= workoutDays.length - 1}
              onClick={() => handleSelectDay(workoutDays[currentDayIdx + 1])}
              style={{
                ...btnStyle,
                padding: '6px 10px',
                opacity: currentDayIdx === -1 || currentDayIdx >= workoutDays.length - 1 ? 0.4 : 1,
              }}
            >
              Пред. день
            </button>
            <b>{selectedDay || 'Выберите дату'}</b>
            <button
              disabled={currentDayIdx <= 0}
              onClick={() => handleSelectDay(workoutDays[currentDayIdx - 1])}
              style={{
                ...btnStyle,
                padding: '6px 10px',
                opacity: currentDayIdx <= 0 ? 0.4 : 1,
              }}
            >
              След. день
            </button>
          )}

          {Object.keys(groupedSets).length === 0 ? (
            <div style={{ ...cardStyle, opacity: 0.6, textAlign: 'center' }}>
              За выбранный день тренировок не найдено
            </div>
          ) : (
            Object.entries(groupedSets).map(([exName, items]) => (
              <div key={exName} style={cardStyle}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                  {exName}
                </div>
                {items.map((s, idx) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '4px 0',
                      borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                    }}
                  >
                    <span>
                      Подход {idx + 1}: <b>{s.weight} кг x {s.reps}</b>
                    </span>
                    <span style={{ opacity: 0.5, fontSize: 12 }}>
                      {s.time}
                    </span>
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
          background: '#1c1c1e',
          borderTop: '1px solid #333',
          padding: '10px 0',
        }}
      >
        <button
          onClick={() => setTab('workout')}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            color: tab === 'workout' ? '#2481cc' : '#888',
            fontWeight: 600,
          }}
        >
          Зал
        </button>
        <button
          onClick={() => setTab('goals')}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            color: tab === 'goals' ? '#2481cc' : '#888',
            fontWeight: 600,
          }}
        >
          Цели
        </button>
        <button
          onClick={() => setTab('history')}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            color: tab === 'history' ? '#2481cc' : '#888',
            fontWeight: 600,
          }}
        >
          История
        </button>
      </div>
    </div>
  );
}

export default App;

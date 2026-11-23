import { useEffect, useState } from 'react';
import '../styles.css';

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

const ACCENTS = [
  { id: 'orange', name: 'Огонь', color: '#ff5e3a', grad: 'linear-gradient(135deg, #ff5e3a 0%, #ff2a68 100%)' },
  { id: 'green', name: 'Неон', color: '#10b981', grad: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
  { id: 'blue', name: 'Электро', color: '#3b82f6', grad: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' },
  { id: 'purple', name: 'Кибер', color: '#8b5cf6', grad: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' },
  { id: 'gold', name: 'Золото', color: '#f59e0b', grad: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
];

const BACKGROUNDS = [
  { id: 'obsidian', name: 'Обсидиан', bg: '#0f1115', card: '#181b22', nav: '#14171f' },
  { id: 'graphite', name: 'Графит', bg: '#18181b', card: '#27272a', nav: '#1f1f23' },
  { id: 'midnight', name: 'Полночь', bg: '#0b1120', card: '#131c31', nav: '#0f172a' },
];

const REST_OPTIONS = Array.of(60, 90, 120, 180);

const GROUPS = ['Грудь', 'Спина', 'Ноги', 'Плечи', 'Руки', 'Пресс'];
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function App() {
  const [tab, setTab] = useState<'workout' | 'goals' | 'history' | 'settings'>('workout');
  const [prevTab, setPrevTab] = useState<'workout' | 'goals' | 'history'>('workout');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [accentId, setAccentId] = useState<string>(() => localStorage.getItem('gt_accent') || 'orange');
  const [bgId, setBgId] = useState<string>(() => localStorage.getItem('gt_bg') || 'obsidian');
  const [restSec, setRestSec] = useState<number>(() => Number(localStorage.getItem('gt_rest')) || 90);

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
    const acc = ACCENTS.find((a) => a.id === accentId) || ACCENTS.find(Boolean)!;
    const bgObj = BACKGROUNDS.find((b) => b.id === bgId) || BACKGROUNDS.find(Boolean)!;
    const root = document.documentElement;

    root.style.setProperty('--accent', acc.color);
    root.style.setProperty('--accent-grad', acc.grad);
    root.style.setProperty('--bg', bgObj.bg);
    root.style.setProperty('--card', bgObj.card);
    root.style.setProperty('--nav-bg', bgObj.nav);

    localStorage.setItem('gt_accent', acc.id);
    localStorage.setItem('gt_bg', bgObj.id);
    tg?.setHeaderColor?.(bgObj.bg);
    tg?.setBackgroundColor?.(bgObj.bg);
  }, [accentId, bgId]);

  useEffect(() => {
    localStorage.setItem('gt_rest', String(restSec));
  }, [restSec]);

  useEffect(() => {
    tg?.ready?.();
    tg?.expand?.();
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

  const toggleSettings = () => {
    tg?.HapticFeedback?.impactOccurred?.('light');
    if (tab === 'settings') {
      setTab(prevTab);
    } else {
      setPrevTab(tab);
      setTab('settings');
    }
  };

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
      setTimer(restSec);
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
      const cls = `cal-day ${active ? 'active' : ''} ${chosen ? 'chosen' : ''}`;

      list.push(
        <button key={dateStr} className={cls} onClick={() => selectDay(dateStr)}>
          <span>{d}</span>
          <span className={`cal-dot ${active ? 'visible' : ''}`} />
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
      <div className="loader-screen">
        <div className="spinner" />
        <div style={{ fontSize: 18, fontWeight: 700 }}>GYM TRACKER</div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Синхронизация тренировок...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-wrap" style={{ color: '#ff6b6b' }}>
        {error}
      </div>
    );
  }

  const pageTitles: Record<string, string> = {
    workout: 'Тренировка',
    goals: 'Цели',
    history: 'История',
    settings: 'Настройки',
  };

  return (
    <div className="app-wrap">
      <div className="top-header">
        <h2 className="page-title" style={{ margin: 0 }}>
          {pageTitles[tab]}
        </h2>
        <button
          className={`icon-btn ${tab === 'settings' ? 'active' : ''}`}
          onClick={toggleSettings}
          title="Настройки"
        >
          {tab === 'settings' ? '✕' : '⚙️'}
        </button>
      </div>

      {timer > 0 && (
        <div className="card row-between" style={{ borderColor: 'var(--accent)' }}>
          <span style={{ fontSize: 16 }}>
            Отдых:{' '}
            <b style={{ color: 'var(--accent)', fontSize: 18 }}>
              {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
            </b>
          </span>
          <button className="btn-sec btn-sm" onClick={() => setTimer(0)}>
            Сброс
          </button>
        </div>
      )}

      {tab === 'workout' && (
        <div>
          <div className="card">
            <div className="row-between" style={{ marginBottom: 8 }}>
              <label style={{ color: 'var(--muted)', fontSize: 14 }}>
                Упражнение
              </label>
              {currentEx && currentEx.user_id !== null && !editing && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-sec btn-sm" onClick={startEdit}>
                    Изменить
                  </button>
                  <button className="btn-danger" onClick={deleteExercise}>
                    Удалить
                  </button>
                </div>
              )}
            </div>
            {editing ? (
              <div
                style={{
                  marginBottom: 14,
                  padding: 12,
                  background: '#101319',
                  borderRadius: 12,
                }}
              >
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
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn"
                    style={{ flex: 1 }}
                    onClick={updateExercise}
                  >
                    Сохранить
                  </button>
                  <button
                    className="btn-sec"
                    style={{ flex: 1 }}
                    onClick={() => setEditing(false)}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <select
                className="input"
                value={selectedEx}
                onChange={(e) => {
                  setSelectedEx(Number(e.target.value));
                  setEditing(false);
                }}
                style={{
                  width: '100%',
                  fontSize: 16,
                  fontWeight: 600,
                  marginBottom: 18,
                }}
              >
                {exercises.map((ex) => (
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
                  value={weight}
                  onChange={(e) =>
                    setWeight(Math.max(0, Number(e.target.value)))
                  }
                  style={{
                    width: 78,
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: 17,
                    padding: '8px 4px',
                  }}
                />
                <span>кг</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn-sec"
                  onClick={() => stepWeight(-1.25)}
                >
                  -1.25
                </button>
                <button
                  className="btn-sec"
                  onClick={() => stepWeight(1.25)}
                >
                  +1.25
                </button>
              </div>
            </div>

            <div className="row-between" style={{ marginBottom: 20 }}>
              <span style={{ color: 'var(--muted)' }}>
                Повторения:{' '}
                <b style={{ color: 'var(--text)', fontSize: 18 }}>{reps}</b>
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn-sec"
                  onClick={() => setReps((r) => Math.max(1, r - 1))}
                >
                  -1
                </button>
                <button
                  className="btn-sec"
                  onClick={() => setReps((r) => r + 1)}
                >
                  +1
                </button>
              </div>
            </div>

            <button
              className="btn btn-full"
              style={{ padding: 16, fontSize: 16 }}
              onClick={saveSet}
            >
              Записать подход
            </button>
          </div>

          <div className="card">
            <div
              style={{
                fontSize: 14,
                color: 'var(--muted)',
                marginBottom: 10,
              }}
            >
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
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-sec btn-full" onClick={addExercise}>
              + Добавить упражнение
            </button>
          </div>
        </div>
      )}

      {tab === 'goals' && (
        <div>
          <div className="card">
            <select
              className="input"
              value={selectedEx}
              onChange={(e) => setSelectedEx(Number(e.target.value))}
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
            <button className="btn btn-full" onClick={addGoal}>
              Поставить цель
            </button>
          </div>

          {goals.map((g) => (
            <div
              key={g.id}
              className="card"
              style={{
                borderLeft: g.is_completed
                  ? '4px solid var(--success)'
                  : '4px solid var(--accent)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {g.exercise_name} {g.is_completed ? '(Выполнено)' : ''}
              </div>
              <div style={{ color: 'var(--muted)', marginTop: 4 }}>
                Цель:{' '}
                <b style={{ color: 'var(--text)' }}>
                  {g.target_weight} кг x {g.target_reps} раз
                </b>
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === 'history' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: 12,
            }}
          >
            <button
              className="btn-sec btn-sm"
              onClick={() => setShowCal((v) => !v)}
            >
              {showCal ? 'Скрыть календарь' : 'Показать календарь'}
            </button>
          </div>

          {showCal && (
            <div className="card">
              <div className="row-between" style={{ marginBottom: 12 }}>
                <button
                  className="btn-sec btn-sm"
                  onClick={() => shiftMonth(-1)}
                >
                  {'<'}
                </button>
                <b style={{ fontSize: 16 }}>
                  {MONTHS[month]} {year}
                </b>
                <button
                  className="btn-sec btn-sm"
                  onClick={() => shiftMonth(1)}
                >
                  {'>'}
                </button>
              </div>

              <div
                className="cal-grid"
                style={{
                  textAlign: 'center',
                  fontSize: 12,
                  color: 'var(--muted)',
                  marginBottom: 8,
                }}
              >
                {DAYS.map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              <div className="cal-grid">{renderCells()}</div>
            </div>
          )}

          {workoutDays.length > 0 && (
            <div className="row-between" style={{ marginBottom: 14 }}>
              <button
                className="btn-sec btn-sm"
                disabled={dayIdx === -1 || dayIdx >= workoutDays.length - 1}
                onClick={() => selectDay(workoutDays.slice(dayIdx + 1).find(Boolean)!)}
                style={{
                  opacity:
                    dayIdx === -1 || dayIdx >= workoutDays.length - 1 ? 0.4 : 1,
                }}
              >
                Пред. день
              </button>
              <b>{selectedDay || 'Выберите дату'}</b>
              <button
                className="btn-sec btn-sm"
                disabled={dayIdx <= 0}
                onClick={() => selectDay(workoutDays.slice(dayIdx - 1).find(Boolean)!)}
                style={{ opacity: dayIdx <= 0 ? 0.4 : 1 }}
              >
                След. день
              </button>
            </div>
          )}

          {Object.keys(grouped).length === 0 ? (
            <div
              className="card"
              style={{ color: 'var(--muted)', textAlign: 'center' }}
            >
              За выбранный день тренировок не найдено
            </div>
          ) : (
            Object.entries(grouped).map(([name, items]) => (
              <div key={name} className="card">
                <div
                  style={{ fontWeight: 700, fontSize: 17, marginBottom: 10 }}
                >
                  {name}
                </div>
                {items.map((s, idx) => (
                  <div
                    key={s.id}
                    className="row-between"
                    style={{
                      padding: '6px 0',
                      borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <span>
                      Подход {idx + 1}:{' '}
                      <b>
                        {s.weight} кг x {s.reps}
                      </b>
                    </span>
                    <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                      {s.time}
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Цвет акцента</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Меняет цвет кнопок, индикаторов и активных вкладок
            </div>
            <div className="color-grid">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  title={a.name}
                  className={`color-swatch ${accentId === a.id ? 'selected' : ''}`}
                  style={{ background: a.grad }}
                  onClick={() => {
                    tg?.HapticFeedback?.impactOccurred?.('light');
                    setAccentId(a.id);
                  }}
                />
              ))}
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Тема фона</div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--muted)',
                marginBottom: 12,
              }}
            >
              Оттенок основного экрана и карточек
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {BACKGROUNDS.map((b) => (
                <button
                  key={b.id}
                  className={bgId === b.id ? 'btn' : 'btn-sec'}
                  style={{ flex: 1, fontSize: 13 }}
                  onClick={() => {
                    tg?.HapticFeedback?.impactOccurred?.('light');
                    setBgId(b.id);
                  }}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              Таймер отдыха по умолчанию
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--muted)',
                marginBottom: 12,
              }}
            >
              Автоматически запускается после записи подхода
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {REST_OPTIONS.map((sec) => (
                <button
                  key={sec}
                  className={restSec === sec ? 'btn' : 'btn-sec'}
                  style={{ flex: 1, fontSize: 13 }}
                  onClick={() => {
                    tg?.HapticFeedback?.impactOccurred?.('light');
                    setRestSec(sec);
                  }}
                >
                  {sec} с
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bottom-nav">
        {[
          { id: 'workout', label: 'Зал', icon: '🏋️' },
          { id: 'goals', label: 'Цели', icon: '🎯' },
          { id: 'history', label: 'История', icon: '📅' },
        ].map((item) => (
          <button
            key={item.id}
            className={`nav-item ${tab === item.id ? 'active' : ''}`}
            onClick={() => {
              tg?.HapticFeedback?.impactOccurred?.('light');
              setTab(item.id as 'workout' | 'goals' | 'history');
            }}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default App;

import { useEffect, useState } from 'react';
import '../styles.css';
import { Exercise, Goal, SetItem } from '../types';
import { WorkoutPage } from './WorkoutPage';
import { GoalsPage } from './GoalsPage';
import { HistoryPage } from './HistoryPage';

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

  const [workoutDays, setWorkoutDays] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [daySets, setDaySets] = useState<SetItem[]>([]);

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
    tg?.setHeaderColor?.('#0f1115');
    tg?.setBackgroundColor?.('#0f1115');
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

  const addEx = async (name: string, group: string) => {
    const created = await api('/api/exercises', {
      method: 'POST',
      body: JSON.stringify({ name, muscle_group: group }),
    });
    tg?.HapticFeedback?.notificationOccurred?.('success');
    await loadData();
    setSelectedEx(created.id);
  };

  const updateEx = async (id: number, name: string, group: string) => {
    await api(`/api/exercises/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, muscle_group: group }),
    });
    tg?.HapticFeedback?.notificationOccurred?.('success');
    loadData();
  };

  const deleteEx = async (id: number, name: string) => {
    if (!window.confirm(`Удалить «${name}»?`)) return;
    await api(`/api/exercises/${id}`, { method: 'DELETE' });
    tg?.HapticFeedback?.notificationOccurred?.('warning');
    loadData();
  };

  const addGoal = async (targetWeight: number, targetReps: number) => {
    await api('/api/goals', {
      method: 'POST',
      body: JSON.stringify({
        exercise_id: selectedEx,
        target_weight: targetWeight,
        target_reps: targetReps,
      }),
    });
    tg?.HapticFeedback?.notificationOccurred?.('success');
    loadData();
  };

  if (loading) {
    return (
      <div className="loader-screen">
        <div className="spinner" />
        <div style={{ fontSize: 18, fontWeight: 700 }}>GYM TRACKER</div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>Синхронизация тренировок...</div>
      </div>
    );
  }

  if (error) {
    return <div className="app-wrap" style={{ color: '#ff6b6b' }}>{error}</div>;
  }

  return (
    <div className="app-wrap">
      {timer > 0 && (
        <div className="card row-between" style={{ borderColor: 'var(--accent)' }}>
          <span style={{ fontSize: 16 }}>
            Отдых: <b style={{ color: 'var(--accent)', fontSize: 18 }}>{Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}</b>
          </span>
          <button className="btn-sec btn-sm" onClick={() => setTimer(0)}>
            Сброс
          </button>
        </div>
      )}

      {tab === 'workout' && (
        <WorkoutPage
          exercises={exercises}
          selectedEx={selectedEx}
          onSelectEx={setSelectedEx}
          weight={weight}
          onChangeWeight={(w) => {
            tg?.HapticFeedback?.impactOccurred?.('light');
            setWeight(w);
          }}
          reps={reps}
          onChangeReps={setReps}
          onSaveSet={saveSet}
          onAddEx={addEx}
          onUpdateEx={updateEx}
          onDeleteEx={deleteEx}
        />
      )}

      {tab === 'goals' && (
        <GoalsPage
          exercises={exercises}
          goals={goals}
          selectedEx={selectedEx}
          onSelectEx={setSelectedEx}
          onAddGoal={addGoal}
        />
      )}

      {tab === 'history' && (
        <HistoryPage
          workoutDays={workoutDays}
          selectedDay={selectedDay}
          daySets={daySets}
          onSelectDay={selectDay}
        />
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

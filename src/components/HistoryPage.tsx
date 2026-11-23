import { useState } from 'react';
import { SetItem } from '../types';

interface Props {
  workoutDays: string[];
  selectedDay: string;
  daySets: SetItem[];
  onSelectDay: (day: string) => void;
}

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function HistoryPage({
  workoutDays,
  selectedDay,
  daySets,
  onSelectDay,
}: Props) {
  const [showCal, setShowCal] = useState(true);
  const parts = selectedDay ? selectedDay.split('-') : [];
  const [year, setYear] = useState(
    parts.length === 3 ? Number(parts.at(0)) : new Date().getFullYear()
  );
  const [month, setMonth] = useState(
    parts.length === 3 ? Number(parts.at(1)) - 1 : new Date().getMonth()
  );

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
        <button key={dateStr} className={cls} onClick={() => onSelectDay(dateStr)}>
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

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 14 }}>
        <h2 className="page-title" style={{ margin: 0 }}>История</h2>
        <button className="btn-sec btn-sm" onClick={() => setShowCal((v) => !v)}>
          {showCal ? 'Скрыть календарь' : 'Календарь'}
        </button>
      </div>

      {showCal && (
        <div className="card">
          <div className="row-between" style={{ marginBottom: 12 }}>
            <button className="btn-sec btn-sm" onClick={() => shiftMonth(-1)}>{'<'}</button>
            <b style={{ fontSize: 16 }}>{MONTHS[month]} {year}</b>
            <button className="btn-sec btn-sm" onClick={() => shiftMonth(1)}>{'>'}</button>
          </div>

          <div className="cal-grid" style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
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
            onClick={() => onSelectDay(workoutDays[dayIdx + 1])}
            style={{ opacity: dayIdx === -1 || dayIdx >= workoutDays.length - 1 ? 0.4 : 1 }}
          >
            Пред. день
          </button>
          <b>{selectedDay || 'Выберите дату'}</b>
          <button
            className="btn-sec btn-sm"
            disabled={dayIdx <= 0}
            onClick={() => onSelectDay(workoutDays[dayIdx - 1])}
            style={{ opacity: dayIdx <= 0 ? 0.4 : 1 }}
          >
            След. день
          </button>
        </div>
      )}

      {Object.keys(grouped).length === 0 ? (
        <div className="card" style={{ color: 'var(--muted)', textAlign: 'center' }}>
          За выбранный день тренировок не найдено
        </div>
      ) : (
        Object.entries(grouped).map(([name, items]) => (
          <div key={name} className="card">
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 10 }}>{name}</div>
            {items.map((s, idx) => (
              <div
                key={s.id}
                className="row-between"
                style={{
                  padding: '6px 0',
                  borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                }}
              >
                <span>Подход {idx + 1}: <b>{s.weight} кг x {s.reps}</b></span>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>{s.time}</span>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

export interface Exercise {
  id: number;
  user_id: number | null;
  name: string;
  muscle_group: string;
}

export interface Goal {
  id: number;
  exercise_id: number;
  exercise_name: string;
  target_weight: number;
  target_reps: number;
  is_completed: boolean;
}

export interface SetItem {
  id: number;
  exercise_name: string;
  muscle_group: string;
  weight: number;
  reps: number;
  time: string;
}

export const GROUPS = ['Грудь', 'Спина', 'Ноги', 'Плечи', 'Руки', 'Пресс'];

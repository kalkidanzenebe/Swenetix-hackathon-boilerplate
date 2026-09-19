import type { TaskStatus } from '../types/task.types';

interface ColumnTheme {
  bg: string;
  header: string;
  cardAccent: string;
}

export const COLUMN_COLORS: Record<TaskStatus, ColumnTheme> = {
  'todo': {
    bg: 'bg-slate-100',
    header: 'text-slate-600',
    cardAccent: 'border-l-4 border-slate-400',
  },
  'in-progress': {
    bg: 'bg-blue-50',
    header: 'text-blue-700',
    cardAccent: 'border-l-4 border-blue-400',
  },
  'done': {
    bg: 'bg-emerald-50',
    header: 'text-emerald-700',
    cardAccent: 'border-l-4 border-emerald-400',
  },
};
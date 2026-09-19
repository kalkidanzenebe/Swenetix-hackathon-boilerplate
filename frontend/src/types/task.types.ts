export const COLUMNS = ['todo', 'in-progress', 'done'] as const;
export type Column = (typeof COLUMNS)[number];
export type TaskStatus = Column;

export type Priority = 'low' | 'medium' | 'high';

export interface ColumnDef {
  id: Column;
  title: string;
}

export const BOARD_COLUMNS: ColumnDef[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
];

export interface Task {
  _id: string;
  id?: string;
  title: string;
  description: string;
  column: Column;
  order: number;
  priority?: Priority;
  createdBy: string;
  assignedTo?: string;
  lockedBy?: string | null;
  lockedAt?: string | null;
  version: number;
  clientId?: string;
  label?: string;
  dueDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTaskDTO {
  title: string;
  description?: string;
  column: Column;
  order: number;
  priority?: Priority;
  createdBy?: string;
  assignedTo?: string;
  clientId?: string;
  label?: string;
  dueDate?: string | null;
}

export interface UpdateTaskDTO {
  title?: string;
  description?: string;
  column?: Column;
  order?: number;
  priority?: Priority;
  assignedTo?: string;
  lockedBy?: string | null;
  lockedAt?: string | null;
  version: number;
  label?: string;
  dueDate?: string | null;
  updatedBy?: string;
}
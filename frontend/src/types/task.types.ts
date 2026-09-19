export const STATUSES = ['todo', 'in-progress', 'done'] as const;
export type Status = (typeof STATUSES)[number];
export type TaskStatus = Status;

export const COLUMNS = STATUSES;
export type Column = Status;

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const LOCK_TTL_MS = 15_000;

export interface ColumnDef {
  id: TaskStatus;
  title: string;
}

export const BOARD_COLUMNS: ColumnDef[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
];

export interface Task {
  _id?: string;
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  order: number;
  priority: Priority;
  createdBy: string;
  assignedTo: string | null;
  lockedBy: string | null;
  lockedAt: string | Date | null;
  version: number;
  clientId?: string;
  labels: string[];
  label?: string;
  dueDate: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CreateTaskDTO {
  title: string;
  description?: string;
  status: TaskStatus;
  order?: number;
  priority?: Priority;
  createdBy?: string;
  assignedTo?: string | null;
  labels?: string[];
  label?: string;
  dueDate?: string | Date | null;
  clientId?: string;
}

export interface UpdateTaskDTO {
  version: number;
  title?: string;
  description?: string;
  status?: TaskStatus;
  order?: number;
  priority?: Priority;
  assignedTo?: string | null;
  labels?: string[];
  label?: string;
  dueDate?: string | Date | null;
  updatedBy?: string;
}

export interface MoveTaskDTO {
  id: string;
  status: TaskStatus;
  order?: number;
  version?: number;
  updatedBy?: string;
}

export interface ActiveLock {
  taskId: string;
  socketId: string;
  user: {
    id: string;
    displayName: string;
    color: string;
  };
  lockedAt: number;
}
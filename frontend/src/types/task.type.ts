export type TaskStatus = 'To Do' | 'In Progress' | 'Done';

export interface Task {
  _id: string;
  title: string;
  description: string;
  status: TaskStatus;
  order: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskDTO {
  title: string;
  description?: string;
  status?: TaskStatus;
  createdBy?: string;
}

export interface UpdateTaskDTO {
  title?: string;
  description?: string;
  status?: TaskStatus;
}
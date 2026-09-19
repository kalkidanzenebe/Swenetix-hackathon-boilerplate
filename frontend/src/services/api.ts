import axios from 'axios';
import {
  Task,
  CreateTaskDTO,
  UpdateTaskDTO,
  TaskStatus,
} from '../types/task.types';

const API_BASE =
  process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getTasks = async (): Promise<Task[]> => {
  const response = await apiClient.get<Task[]>('/tasks');
  return response.data;
};

export const createTask = async (
  payload: CreateTaskDTO
): Promise<Task> => {
  const response = await apiClient.post<Task>('/tasks', payload);
  return response.data;
};

export const updateTask = async (
  id: string,
  updates: UpdateTaskDTO
): Promise<Task> => {
  const response = await apiClient.put<Task>(
    `/tasks/${id}`,
    updates
  );
  return response.data;
};

export const moveTask = async (
  id: string,
  status: TaskStatus
): Promise<Task> => {
  const response = await apiClient.patch<Task>(
    `/tasks/${id}/move`,
    { status }
  );
  return response.data;
};

export const deleteTask = async (
  id: string
): Promise<string> => {
  await apiClient.delete(`/tasks/${id}`);
  return id;
};
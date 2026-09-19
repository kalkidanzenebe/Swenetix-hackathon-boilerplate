import axios from 'axios';
import { Task, CreateTaskDTO, UpdateTaskDTO } from '../types/task.types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('kanban_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
export const api = {
  getTasks: async (): Promise<Task[]> => {
    const response = await apiClient.get<any>('/tasks');
    return response.data?.data || response.data || [];
  },

  createTask: async (data: CreateTaskDTO): Promise<Task> => {
    const response = await apiClient.post<any>('/tasks', data);
    return response.data?.data || response.data;
  },

  updateTask: async (id: string, updates: UpdateTaskDTO): Promise<Task> => {
    const response = await apiClient.patch<any>(`/tasks/${id}`, updates);
    return response.data?.data || response.data;
  },

  moveTask: async (id: string, payload: { status: string; order?: number }): Promise<Task> => {
    const response = await apiClient.patch<any>(`/tasks/${id}/move`, payload);
    return response.data?.data || response.data;
  },

  deleteTask: async (id: string): Promise<void> => {
    await apiClient.delete(`/tasks/${id}`);
  },

  registerUser: async (displayName: string) => {
    const response = await apiClient.post<any>('/auth/register', { displayName });
    return response.data?.data || response.data;
  },
};

export default api;

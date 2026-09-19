import { createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api';
import { Task, CreateTaskDTO, UpdateTaskDTO, TaskStatus } from '../../types/task.types';

export const fetchTasksAsync = createAsyncThunk<Task[], void, { rejectValue: string }>(
  'tasks/fetchTasks',
  async (_, { rejectWithValue }) => {
    try {
      return await api.getTasks();
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch tasks from server'
      );
    }
  }
);

export const createTaskAsync = createAsyncThunk<Task, CreateTaskDTO, { rejectValue: string }>(
  'tasks/createTask',
  async (taskData, { rejectWithValue }) => {
    try {
      return await api.createTask(taskData);
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || 'Failed to create task'
      );
    }
  }
);

export const updateTaskAsync = createAsyncThunk<
  Task,
  { id: string; updates: UpdateTaskDTO },
  { rejectValue: string }
>(
  'tasks/updateTask',
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      return await api.updateTask(id, updates);
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || 'Failed to update task'
      );
    }
  }
);

export const moveTaskAsync = createAsyncThunk<
  Task,
  { id: string; status: TaskStatus; order?: number },
  { rejectValue: string }
>(
  'tasks/moveTask',
  async ({ id, status, order }, { rejectWithValue }) => {
    try {
      return await api.moveTask(id, { status, order });
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || 'Failed to persist task movement'
      );
    }
  }
);

export const deleteTaskAsync = createAsyncThunk<string, string, { rejectValue: string }>(
  'tasks/deleteTask',
  async (id, { rejectWithValue }) => {
    try {
      await api.deleteTask(id);
      return id;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || 'Failed to delete task'
      );
    }
  }
);
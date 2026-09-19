import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  CreateTaskDTO,
  UpdateTaskDTO,
  TaskStatus,
} from '../../types/task.types';
import * as api from '../../services/api';

// Fetch all tasks from MongoDB via Express backend
export const fetchTasksAsync = createAsyncThunk(
  'tasks/fetchTasks',
  async (_, { rejectWithValue }) => {
    try {
      return await api.getTasks();
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch tasks'
      );
    }
  }
);

// Create a new task
export const createTaskAsync = createAsyncThunk(
  'tasks/createTask',
  async (data: CreateTaskDTO, { rejectWithValue }) => {
    try {
      return await api.createTask(data);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to create task'
      );
    }
  }
);

// Update task details (title, description, status)
export const updateTaskAsync = createAsyncThunk(
  'tasks/updateTask',
  async (
    { id, updates }: { id: string; updates: UpdateTaskDTO },
    { rejectWithValue }
  ) => {
    try {
      return await api.updateTask(id, updates);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to update task'
      );
    }
  }
);

// Move task to another column status
export const moveTaskAsync = createAsyncThunk(
  'tasks/moveTask',
  async (
    { id, status }: { id: string; status: TaskStatus },
    { rejectWithValue }
  ) => {
    try {
      return await api.moveTask(id, status);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to move task'
      );
    }
  }
);

// Delete task by ID
export const deleteTaskAsync = createAsyncThunk(
  'tasks/deleteTask',
  async (id: string, { rejectWithValue }) => {
    try {
      return await api.deleteTask(id);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to delete task'
      );
    }
  }
);

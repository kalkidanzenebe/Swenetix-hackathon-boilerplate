import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Task, TaskStatus } from '../../types/task.types';
import {
  fetchTasksAsync,
  createTaskAsync,
  updateTaskAsync,
  moveTaskAsync,
  deleteTaskAsync,
} from './tasksThunks';

interface TasksState {
  items: Task[];
  loading: boolean;
  error: string | null;
}

const initialState: TasksState = {
  items: [],
  loading: false,
  error: null,
};

export const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    moveTaskOptimistic: (
      state,
      action: PayloadAction<{ id: string; status: TaskStatus; order?: number }>
    ) => {
      const task = state.items.find((t) => (t._id || t.id) === action.payload.id);
      if (task) {
        task.status = action.payload.status;
        if (action.payload.order !== undefined) {
          task.order = action.payload.order;
        }
      }
    },

    setLockOptimistic: (
      state,
      action: PayloadAction<{ id: string; lockedBy: string | null; lockedAt?: string | null }>
    ) => {
      const task = state.items.find((t) => (t._id || t.id) === action.payload.id);
      if (task) {
        task.lockedBy = action.payload.lockedBy;
        task.lockedAt = action.payload.lockedAt || null;
      }
    },

    taskCreatedRemote: (state, action: PayloadAction<Task>) => {
      const targetId = action.payload._id || action.payload.id;
      const exists = state.items.some(
        (t) =>
          (t._id || t.id) === targetId ||
          (t.clientId && t.clientId === action.payload.clientId)
      );
      if (!exists) {
        state.items.push(action.payload);
      }
    },

    taskUpdatedRemote: (state, action: PayloadAction<Task>) => {
      const targetId = action.payload._id || action.payload.id;
      const index = state.items.findIndex((t) => (t._id || t.id) === targetId);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },

    taskDeletedRemote: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((t) => (t._id || t.id) !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTasksAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTasksAsync.fulfilled, (state, action: PayloadAction<Task[]>) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchTasksAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch tasks';
      });

    builder.addCase(createTaskAsync.fulfilled, (state, action: PayloadAction<Task>) => {
      const index = state.items.findIndex(
        (t) => t.clientId && t.clientId === action.payload.clientId
      );
      if (index !== -1) {
        state.items[index] = action.payload;
      } else {
        state.items.push(action.payload);
      }
    });

    builder.addCase(updateTaskAsync.fulfilled, (state, action: PayloadAction<Task>) => {
      const targetId = action.payload._id || action.payload.id;
      const index = state.items.findIndex((t) => (t._id || t.id) === targetId);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    });

    builder.addCase(moveTaskAsync.fulfilled, (state, action: PayloadAction<Task>) => {
      const targetId = action.payload._id || action.payload.id;
      const index = state.items.findIndex((t) => (t._id || t.id) === targetId);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    });

    builder.addCase(deleteTaskAsync.fulfilled, (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((t) => (t._id || t.id) !== action.payload);
    });
  },
});

export const {
  moveTaskOptimistic,
  setLockOptimistic,
  taskCreatedRemote,
  taskUpdatedRemote,
  taskDeletedRemote,
} = tasksSlice.actions;

export default tasksSlice.reducer;
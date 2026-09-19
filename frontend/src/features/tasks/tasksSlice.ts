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

const tasksSlice = createSlice({
  name: 'tasks',
  initialState,

  reducers: {
    // Immediate local optimistic state update during drag-and-drop
    moveTaskOptimistic: (
      state,
      action: PayloadAction<{ id: string; status: TaskStatus }>
    ) => {
      const task = state.items.find(
        (item) => item._id === action.payload.id
      );
      if (task) {
        task.status = action.payload.status;
      }
    },

    // Handlers for incoming real-time socket broadcasts (Milestone 2)
    taskCreatedRemote: (state, action: PayloadAction<Task>) => {
      const exists = state.items.some(
        (item) => item._id === action.payload._id
      );
      if (!exists) {
        state.items.push(action.payload);
      }
    },

    taskUpdatedRemote: (state, action: PayloadAction<Task>) => {
      const index = state.items.findIndex(
        (item) => item._id === action.payload._id
      );
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },

    taskDeletedRemote: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(
        (item) => item._id !== action.payload
      );
    },
  },

  extraReducers: (builder) => {
    builder
      // Fetch Tasks
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
        state.error = (action.payload as string) || 'Failed to load tasks';
      })

      // Create Task
      .addCase(createTaskAsync.fulfilled, (state, action: PayloadAction<Task>) => {
        state.items.push(action.payload);
      })
      .addCase(createTaskAsync.rejected, (state, action) => {
        state.error = (action.payload as string) || 'Failed to create task';
      })

      // Update Task Details
      .addCase(updateTaskAsync.fulfilled, (state, action: PayloadAction<Task>) => {
        const index = state.items.findIndex(
          (item) => item._id === action.payload._id
        );
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(updateTaskAsync.rejected, (state, action) => {
        state.error = (action.payload as string) || 'Failed to update task';
      })

      // Move Task (Server Confirmation)
      .addCase(moveTaskAsync.fulfilled, (state, action: PayloadAction<Task>) => {
        const index = state.items.findIndex(
          (item) => item._id === action.payload._id
        );
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(moveTaskAsync.rejected, (state, action) => {
        state.error = (action.payload as string) || 'Failed to move task';
      })

      // Delete Task
      .addCase(deleteTaskAsync.fulfilled, (state, action: PayloadAction<string>) => {
        state.items = state.items.filter(
          (item) => item._id !== action.payload
        );
      })
      .addCase(deleteTaskAsync.rejected, (state, action) => {
        state.error = (action.payload as string) || 'Failed to delete task';
      });
  },
});

export const {
  moveTaskOptimistic,
  taskCreatedRemote,
  taskUpdatedRemote,
  taskDeletedRemote,
} = tasksSlice.actions;

export default tasksSlice.reducer;
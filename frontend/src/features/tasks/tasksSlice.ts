import {
  createSlice,
  createAsyncThunk,
  PayloadAction,
} from '@reduxjs/toolkit';

import {
  Task,
  TaskStatus,
  CreateTaskDTO,
  UpdateTaskDTO,
} from '../../types/task.types';

import * as api from '../../services/api';

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

export const fetchTasksAsync = createAsyncThunk(
  'tasks/fetchTasks',
  async () => {
    return await api.getTasks();
  }
);

export const createTaskAsync = createAsyncThunk(
  'tasks/createTask',
  async (data: CreateTaskDTO) => {
    return await api.createTask(data);
  }
);

export const updateTaskAsync = createAsyncThunk(
  'tasks/updateTask',
  async ({
    id,
    updates,
  }: {
    id: string;
    updates: UpdateTaskDTO;
  }) => {
    return await api.updateTask(id, updates);
  }
);

export const moveTaskAsync = createAsyncThunk(
  'tasks/moveTask',
  async ({
    id,
    status,
  }: {
    id: string;
    status: TaskStatus;
  }) => {
    return await api.moveTask(id, status);
  }
);

export const deleteTaskAsync = createAsyncThunk(
  'tasks/deleteTask',
  async (id: string) => {
    return await api.deleteTask(id);
  }
);

const tasksSlice = createSlice({
  name: 'tasks',
  initialState,

  reducers: {
    moveTaskOptimistic: (
      state,
      action: PayloadAction<{
        id: string;
        status: TaskStatus;
      }>
    ) => {
      const task = state.items.find(
        (item) => item._id === action.payload.id
      );

      if (task) {
        task.status = action.payload.status;
      }
    },

    taskCreatedRemote: (
      state,
      action: PayloadAction<Task>
    ) => {
      if (
        !state.items.some(
          (item) => item._id === action.payload._id
        )
      ) {
        state.items.push(action.payload);
      }
    },

    taskUpdatedRemote: (
      state,
      action: PayloadAction<Task>
    ) => {
      const index = state.items.findIndex(
        (item) => item._id === action.payload._id
      );

      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },

    taskDeletedRemote: (
      state,
      action: PayloadAction<string>
    ) => {
      state.items = state.items.filter(
        (item) => item._id !== action.payload
      );
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchTasksAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(
        fetchTasksAsync.fulfilled,
        (state, action) => {
          state.loading = false;
          state.items = action.payload;
        }
      )

      .addCase(
        fetchTasksAsync.rejected,
        (state, action) => {
          state.loading = false;
          state.error =
            action.error.message ||
            'Failed to load tasks';
        }
      )

      .addCase(
        createTaskAsync.fulfilled,
        (state, action) => {
          state.items.push(action.payload);
        }
      )

      .addCase(
        updateTaskAsync.fulfilled,
        (state, action) => {
          const index = state.items.findIndex(
            (item) =>
              item._id === action.payload._id
          );

          if (index !== -1) {
            state.items[index] = action.payload;
          }
        }
      )

      .addCase(
        deleteTaskAsync.fulfilled,
        (state, action) => {
          state.items = state.items.filter(
            (item) => item._id !== action.payload
          );
        }
      );
  },
});

export const {
  moveTaskOptimistic,
  taskCreatedRemote,
  taskUpdatedRemote,
  taskDeletedRemote,
} = tasksSlice.actions;

export default tasksSlice.reducer;
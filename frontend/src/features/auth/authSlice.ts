import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export interface AuthUser {
  _id: string;
  id?: string;
  displayName: string;
  email?: string;
  color?: string;
}

interface AuthResponse {
  user: AuthUser;
  token: string;
}

export interface AuthState {
  currentUser: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const loadStoredSession = () => {
  try {
    const rawUser = localStorage.getItem('kanban_user');
    const token = localStorage.getItem('kanban_token');
    return {
      currentUser: rawUser ? JSON.parse(rawUser) : null,
      token: token || null,
    };
  } catch {
    return { currentUser: null, token: null };
  }
};

const initialSession = loadStoredSession();

const initialState: AuthState = {
  currentUser: initialSession.currentUser,
  token: initialSession.token,
  loading: false,
  error: null,
};

// Async thunk for Signup
export const registerUserAsync = createAsyncThunk<
  AuthResponse,
  { displayName: string; email: string; password: string },
  { rejectValue: string }
>('auth/signup', async (credentials, { rejectWithValue }) => {
  try {
    const res = await axios.post<AuthResponse>(`${API_URL}/auth/signup`, credentials);
    return res.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Failed to sign up');
  }
});

// Async thunk for Login
export const loginUserAsync = createAsyncThunk<
  AuthResponse,
  { email: string; password: string },
  { rejectValue: string }
>('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const res = await axios.post<AuthResponse>(`${API_URL}/auth/login`, credentials);
    return res.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Invalid email or password');
  }
});

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.currentUser = null;
      state.token = null;
      state.error = null;
      localStorage.removeItem('kanban_user');
      localStorage.removeItem('kanban_token');
    },
    clearAuthError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Signup
    builder
      .addCase(registerUserAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUserAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUser = action.payload.user;
        state.token = action.payload.token;
        localStorage.setItem('kanban_user', JSON.stringify(action.payload.user));
        localStorage.setItem('kanban_token', action.payload.token);
      })
      .addCase(registerUserAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Signup failed';
      });

    // Login
    builder
      .addCase(loginUserAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUserAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUser = action.payload.user;
        state.token = action.payload.token;
        localStorage.setItem('kanban_user', JSON.stringify(action.payload.user));
        localStorage.setItem('kanban_token', action.payload.token);
      })
      .addCase(loginUserAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Login failed';
      });
  },
});

export const { logout, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
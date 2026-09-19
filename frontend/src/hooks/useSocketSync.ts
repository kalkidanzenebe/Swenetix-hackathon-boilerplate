import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { getSocket, resetSocket } from '../services/socket';
import {
  taskCreatedRemote,
  taskUpdatedRemote,
  taskDeletedRemote,
  setLockOptimistic,
} from '../features/tasks/tasksSlice';
import type { Task, ActiveLock } from '../types/task.types';

export interface Collaborator {
  id: string;
  name: string;
  color: string;
}

export const useSocketSync = () => {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const [isConnected, setIsConnected] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [activeLocks, setActiveLocks] = useState<Record<string, ActiveLock>>({});

  useEffect(() => {
    if (!token) {
      setIsConnected(false);
      return;
    }

    const socket = resetSocket();

    const onConnect = () => {
      setIsConnected(true);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onBoardHello = (data: {
      users?: { id: string; displayName?: string; name?: string; color: string }[];
      locks?: Record<string, any>;
    }) => {
      setIsConnected(true);
      if (data.users) {
        setCollaborators(
          data.users.map((u) => ({
            id: u.id,
            name: u.displayName || u.name || 'Anonymous',
            color: u.color || '#3b82f6',
          }))
        );
      }
      if (data.locks) {
        setActiveLocks(data.locks);
      }
    };

    const onPresenceUpdate = (data: {
      users?: { id: string; displayName?: string; name?: string; color: string }[];
    }) => {
      if (data.users) {
        setCollaborators(
          data.users.map((u) => ({
            id: u.id,
            name: u.displayName || u.name || 'Anonymous',
            color: u.color || '#3b82f6',
          }))
        );
      }
    };

    const onEditingUpdate = (data: { locks?: Record<string, any> }) => {
      if (data.locks) {
        setActiveLocks(data.locks);
        // Also reflect lock status on tasks
        Object.entries(data.locks).forEach(([taskId, lockInfo]: [string, any]) => {
          dispatch(
            setLockOptimistic({
              id: taskId,
              lockedBy: lockInfo?.user?.displayName || lockInfo?.user?.name || null,
              lockedAt: lockInfo?.lockedAt || null,
            })
          );
        });
      }
    };

    const onTaskCreated = (data: { task: Task }) => {
      if (data.task) dispatch(taskCreatedRemote(data.task));
    };

    const onTaskUpdated = (data: { task: Task }) => {
      if (data.task) dispatch(taskUpdatedRemote(data.task));
    };

    const onTaskMoved = (data: { task: Task }) => {
      if (data.task) dispatch(taskUpdatedRemote(data.task));
    };

    const onTaskDeleted = (data: { id: string }) => {
      if (data.id) dispatch(taskDeletedRemote(data.id));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('board:hello', onBoardHello);
    socket.on('presence:update', onPresenceUpdate);
    socket.on('editing:update', onEditingUpdate);
    socket.on('task:created', onTaskCreated);
    socket.on('task:updated', onTaskUpdated);
    socket.on('task:moved', onTaskMoved);
    socket.on('task:deleted', onTaskDeleted);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('board:hello', onBoardHello);
      socket.off('presence:update', onPresenceUpdate);
      socket.off('editing:update', onEditingUpdate);
      socket.off('task:created', onTaskCreated);
      socket.off('task:updated', onTaskUpdated);
      socket.off('task:moved', onTaskMoved);
      socket.off('task:deleted', onTaskDeleted);
    };
  }, [token, dispatch]);

  return { isConnected, collaborators, activeLocks };
};
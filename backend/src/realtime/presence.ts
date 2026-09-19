export interface Member {
  id: string;
  displayName: string;
  color: string;
}

export interface PresenceEntry extends Member {
  connections: number;
}

export interface EditLock {
  taskId: string;
  user: Member;
  socketId: string;
  touchedAt: number;
}

export const LOCK_TTL_MS = 15_000;

const sockets = new Map<string, Member>();
const locks = new Map<string, EditLock>();

export const addSocket = (socketId: string, member: Member): void => {
  sockets.set(socketId, member);
};

export const removeSocket = (socketId: string): string[] => {
  sockets.delete(socketId);

  const released: string[] = [];
  locks.forEach((lock, taskId) => {
    if (lock.socketId === socketId) {
      locks.delete(taskId);
      released.push(taskId);
    }
  });
  return released;
};

export const roster = (): PresenceEntry[] => {
  const byUser = new Map<string, PresenceEntry>();

  sockets.forEach((member) => {
    const existing = byUser.get(member.id);
    if (existing) {
      existing.connections += 1;
    } else {
      byUser.set(member.id, { ...member, connections: 1 });
    }
  });

  return [...byUser.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
};

export const acquireLock = (taskId: string, socketId: string, user: Member): boolean => {
  const existing = locks.get(taskId);
  const stale = existing && Date.now() - existing.touchedAt > LOCK_TTL_MS;

  if (existing && !stale && existing.socketId !== socketId) return false;

  locks.set(taskId, { taskId, user, socketId, touchedAt: Date.now() });
  return true;
};

export const releaseLock = (taskId: string, socketId: string): boolean => {
  const existing = locks.get(taskId);
  if (!existing || existing.socketId !== socketId) return false;

  locks.delete(taskId);
  return true;
};

export const dropLockForTask = (taskId: string): void => {
  locks.delete(taskId);
};

export const sweepLocks = (): boolean => {
  const cutoff = Date.now() - LOCK_TTL_MS;
  let changed = false;

  locks.forEach((lock, taskId) => {
    if (lock.touchedAt < cutoff) {
      locks.delete(taskId);
      changed = true;
    }
  });
  return changed;
};

export const activeLocks = (): Array<{ taskId: string; user: Member }> =>
  [...locks.values()]
    .filter((lock) => Date.now() - lock.touchedAt <= LOCK_TTL_MS)
    .map(({ taskId, user }) => ({ taskId, user }));

export const resetPresence = (): void => {
  sockets.clear();
  locks.clear();
};
export interface Member {
  id: string;
  displayName: string;
  color: string;
}

export interface PresenceEntry extends Member {
  /** How many tabs this person has open. */
  connections: number;
}

export interface EditLock {
  taskId: string;
  user: Member;
  socketId: string;
  touchedAt: number;
}

/** A lock is dropped if its owner stops sending heartbeats (tab crashed, network died). */
export const LOCK_TTL_MS = 15_000;

const sockets = new Map<string, Member>();
const locks = new Map<string, EditLock>();

export const addSocket = (socketId: string, member: Member): void => {
  sockets.set(socketId, member);
};

/** Removes the socket and returns the ids of tasks whose locks it was holding. */
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

/**
 * Claims the editing indicator for a task. Returns false when somebody else already
 * holds a live lock, which is what makes the "Sara is editing" badge trustworthy.
 */
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

/** Drops expired locks and reports whether anything changed. */
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

/** Test/reset helper. */
export const resetPresence = (): void => {
  sockets.clear();
  locks.clear();
};
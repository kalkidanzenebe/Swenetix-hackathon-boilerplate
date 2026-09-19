import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyToken } from "../utils/token";
import { BOARD, setIO } from "./io";
import {
  Member,
  acquireLock,
  activeLocks,
  addSocket,
  releaseLock,
  removeSocket,
  roster,
  sweepLocks,
} from "./presence";

const LOCK_SWEEP_MS = 5_000;

interface BoardSocket extends Socket {
  member?: Member;
}

export const attachRealtime = (httpServer: HttpServer, origin: string | string[]): Server => {
  const io = new Server(httpServer, {
    cors: { origin, methods: ["GET", "POST", "PATCH", "DELETE"] },
  });

  setIO(io);

  io.use((socket: BoardSocket, next) => {
    const token = (socket.handshake.auth?.token as string) || "";
    const user = verifyToken(token);

    if (!user) {
      next(new Error("unauthorised"));
      return;
    }

    socket.member = { id: user.id, displayName: user.displayName, color: 'green' };
    next();
  });

  const broadcastPresence = (): void => {
    io.to(BOARD).emit("presence:update", { users: roster() });
  };

  const broadcastLocks = (): void => {
    io.to(BOARD).emit("editing:update", { locks: activeLocks() });
  };

  io.on("connection", (socket: BoardSocket) => {
    const member = socket.member;
    if (!member) {
      socket.disconnect(true);
      return;
    }

    socket.join(BOARD);
    addSocket(socket.id, member);

    socket.emit("board:hello", {
      you: member,
      users: roster(),
      locks: activeLocks(),
    });
    broadcastPresence();
    broadcastLocks();

    socket.on("editing:start", (payload: { taskId?: string }, ack?: (ok: boolean) => void) => {
      const taskId = payload?.taskId;
      if (!taskId) {
        ack?.(false);
        return;
      }

      const granted = acquireLock(taskId, socket.id, member);
      ack?.(granted);
      if (granted) broadcastLocks();
    });

    socket.on("editing:ping", (payload: { taskId?: string }) => {
      if (payload?.taskId) acquireLock(payload.taskId, socket.id, member);
    });

    socket.on("editing:stop", (payload: { taskId?: string }) => {
      if (payload?.taskId && releaseLock(payload.taskId, socket.id)) broadcastLocks();
    });

    socket.on("disconnect", () => {
      const released = removeSocket(socket.id);
      broadcastPresence();
      if (released.length > 0) broadcastLocks();
    });
  });

  const sweeper = setInterval(() => {
    if (sweepLocks()) broadcastLocks();
  }, LOCK_SWEEP_MS);
  sweeper.unref();

  return io;
};
import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { serialise } from "../controllers/taskController";
import Task from "../models/Task";
import { claimLock, refreshLock, releaseLock, releaseLocks, sweepStaleLocks } from "../services/locks";
import { verifyToken } from "../utils/token";
import { BOARD, setIO } from "./io";
import { Member, addSocket, removeSocket, roster, trackHeld, untrackHeld } from "./presence";

const LOCK_SWEEP_MS = 5_000;

interface BoardSocket extends Socket {
  member?: Member;
}

export const attachRealtime = (httpServer: HttpServer, origin: string | string[]): Server => {
  const io = new Server(httpServer, {
    cors: { origin, methods: ["GET", "POST", "PATCH", "DELETE"] },
  });

  setIO(io);

  // The socket carries the same token as the REST calls, so presence cannot be spoofed
  // any more easily than the API itself.
  io.use((socket: BoardSocket, next) => {
    const token = (socket.handshake.auth?.token as string) || "";
    const user = verifyToken(token);

    if (!user) {
      next(new Error("unauthorised"));
      return;
    }

    socket.member = { id: user.id, displayName: user.displayName };
    next();
  });

  const broadcastPresence = (): void => {
    io.to(BOARD).emit("presence:update", { users: roster() });
  };

  io.on("connection", (socket: BoardSocket) => {
    const member = socket.member;
    if (!member) {
      socket.disconnect(true);
      return;
    }

    socket.join(BOARD);
    addSocket(socket.id, member);

    // Give the joiner the current picture before anyone else changes it.
    void Task.find()
      .sort({ order: 1, createdAt: 1 })
      .then((tasks) => {
        socket.emit("board:hello", {
          you: member,
          users: roster(),
          tasks: tasks.map(serialise),
        });
      })
      .catch(() => socket.emit("board:hello", { you: member, users: roster(), tasks: [] }));

    broadcastPresence();

    socket.on("editing:start", (payload: { taskId?: string }, ack?: (ok: boolean) => void) => {
      const taskId = payload?.taskId;
      if (!taskId) {
        ack?.(false);
        return;
      }

      void claimLock(taskId, member.displayName)
        .then((task) => {
          ack?.(Boolean(task));
          if (!task) return;

          trackHeld(socket.id, taskId);
          io.to(BOARD).emit("task:updated", {
            task: serialise(task),
            actor: member.displayName,
          });
        })
        .catch(() => ack?.(false));
    });

    // Heartbeat while a card's editor is open, so a dead tab's lock expires on its own.
    socket.on("editing:ping", (payload: { taskId?: string }) => {
      if (payload?.taskId) void refreshLock(payload.taskId, member.displayName).catch(() => {});
    });

    socket.on("editing:stop", (payload: { taskId?: string }) => {
      const taskId = payload?.taskId;
      if (!taskId) return;

      untrackHeld(socket.id, taskId);
      void releaseLock(taskId, member.displayName)
        .then((task) => {
          if (!task) return;
          io.to(BOARD).emit("task:updated", {
            task: serialise(task),
            actor: member.displayName,
          });
        })
        .catch(() => {});
    });

    socket.on("disconnect", () => {
      const abandoned = removeSocket(socket.id);
      broadcastPresence();

      if (abandoned.length === 0) return;
      void releaseLocks(abandoned, member.displayName)
        .then((tasks) => {
          tasks.forEach((task) => {
            io.to(BOARD).emit("task:updated", {
              task: serialise(task),
              actor: member.displayName,
            });
          });
        })
        .catch(() => {});
    });
  });

  const sweeper = setInterval(() => {
    void sweepStaleLocks()
      .then((tasks) => {
        tasks.forEach((task) => {
          io.to(BOARD).emit("task:updated", { task: serialise(task), actor: "system" });
        });
      })
      .catch(() => {});
  }, LOCK_SWEEP_MS);
  sweeper.unref();

  return io;
};

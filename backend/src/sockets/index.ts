import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import mongoose, { Types } from "mongoose";
import Task, { TASK_LOCK_TIMEOUT_MS } from "../models/Task";
import { User, colorForName } from "../models/User";
import { Action } from "../models/ActionLog";

export interface ActiveUserData {
  socketId: string;
  userId: string;
  boardId: string;
  name: string;
  color: string;
  joinedAt: Date;
}

export interface ActiveLockData {
  taskId: string;
  boardId: string;
  lockedBy: string;
  lockerName: string;
  lockerColor: string;
  lockedAt: Date;
}

// In-memory active users tracker: Map<socketId, ActiveUserData>
const activeUsers = new Map<string, ActiveUserData>();

// In-memory active locks tracker: Map<taskId, ActiveLockData>
const activeLocks = new Map<string, ActiveLockData>();

let ioInstance: Server | null = null;

export const getIO = (): Server | null => ioInstance;

const isDbConnected = (): boolean => mongoose.connection.readyState === 1;

export const initSockets = (server: HttpServer): Server => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      credentials: true,
    },
  });

  ioInstance = io;

  io.on("connection", (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // ==========================================
    // 1. PRESENCE & ONLINE USERS (Milestone 2)
    // ==========================================
    socket.on("join_board", async ({ boardId, userId, name, color }) => {
      try {
        if (!boardId) return;

        socket.join(boardId);

        let userName = name || "Anonymous User";
        let userColor = color;
        let resolvedUserId = userId || socket.id;

        // Try populating from DB asynchronously if connected
        if (userId && Types.ObjectId.isValid(userId) && isDbConnected()) {
          socket.join(`user:${userId}`);
          try {
            const dbUser = await User.findById(userId).exec();
            if (dbUser) {
              userName = dbUser.name || userName;
              userColor = dbUser.color || colorForName(userName);
              resolvedUserId = dbUser._id.toString();
              await User.findByIdAndUpdate(userId, { isOnline: true }).exec();
            }
          } catch {
            // Fallback to client provided data
          }
        }

        if (!userColor) {
          userColor = colorForName(userName);
        }

        const userData: ActiveUserData = {
          socketId: socket.id,
          userId: resolvedUserId,
          boardId,
          name: userName,
          color: userColor,
          joinedAt: new Date(),
        };

        activeUsers.set(socket.id, userData);

        // Instant broadcast to peers that user joined
        socket.to(boardId).emit("user_joined", userData);

        // Send active board collaborators to the newly joined client
        const usersInRoom = Array.from(activeUsers.values()).filter(
          (u) => u.boardId === boardId
        );
        socket.emit("active_users", usersInRoom);

        // Milestone 3: Send current active locks on this board to newcomer
        const now = Date.now();
        // Clean expired in-memory locks
        for (const [tid, lk] of activeLocks.entries()) {
          if (now - new Date(lk.lockedAt).getTime() >= TASK_LOCK_TIMEOUT_MS) {
            activeLocks.delete(tid);
          }
        }

        const boardLocks = Array.from(activeLocks.values()).filter(
          (lk) => lk.boardId === boardId
        );
        socket.emit("initial_locks", boardLocks);
      } catch (err) {
        console.error("Error in join_board:", err);
      }
    });

    socket.on("leave_board", async ({ boardId }) => {
      try {
        const userData = activeUsers.get(socket.id);
        if (userData && userData.boardId === boardId) {
          activeUsers.delete(socket.id);
          socket.leave(boardId);
          socket.to(boardId).emit("user_left", userData.userId);

          // Unlock any tasks held by this user
          releaseUserLocks(userData.userId, boardId, socket);
        }
      } catch (err) {
        console.error("Error in leave_board:", err);
      }
    });

    // Real-time cursor / selection presence
    socket.on("cursor_move", (data: { boardId: string; x: number; y: number; activeTaskId?: string }) => {
      const userData = activeUsers.get(socket.id);
      if (userData && data.boardId) {
        socket.to(data.boardId).emit("cursor_moved_live", {
          userId: userData.userId,
          name: userData.name,
          color: userData.color,
          x: data.x,
          y: data.y,
          activeTaskId: data.activeTaskId,
        });
      }
    });

    // ==========================================
    // 2. REAL-TIME CRUD & MOVEMENT (Milestone 2)
    // ==========================================
    socket.on("task_created", (data: { boardId: string; task: any }) => {
      if (data?.boardId) {
        socket.to(data.boardId).emit("task_created_live", data.task);
      }
    });

    socket.on("task_updated", (data: { boardId: string; task: any }) => {
      if (data?.boardId) {
        socket.to(data.boardId).emit("task_updated_live", data.task);
      }
    });

    socket.on(
      "task_moved",
      (data: {
        boardId: string;
        taskId: string;
        status: string;
        order: number;
        prevStatus?: string;
        prevOrder?: number;
      }) => {
        if (data?.boardId) {
          socket.to(data.boardId).emit("task_moved_live", data);
        }
      }
    );

    socket.on("task_deleted", (data: { boardId: string; taskId: string }) => {
      if (data?.boardId) {
        activeLocks.delete(data.taskId);
        socket.to(data.boardId).emit("task_deleted_live", data.taskId);
      }
    });

    // ==========================================
    // 3. CONCURRENT SAFETY & LOCKS (Milestone 3)
    // ==========================================
    socket.on("lock_task", async ({ taskId, boardId }, callback) => {
      try {
        const userData = activeUsers.get(socket.id);
        if (!userData) {
          if (callback) callback({ success: false, message: "User not connected to board" });
          return;
        }

        const now = Date.now();
        const existingLock = activeLocks.get(taskId);

        // Check if locked by someone else and not expired
        if (
          existingLock &&
          existingLock.lockedBy !== userData.userId &&
          now - new Date(existingLock.lockedAt).getTime() < TASK_LOCK_TIMEOUT_MS
        ) {
          const conflictResponse = {
            taskId,
            lockedBy: existingLock.lockedBy,
            lockerName: existingLock.lockerName,
            message: `Task is currently locked by ${existingLock.lockerName}`,
          };
          socket.emit("task_lock_rejected", conflictResponse);
          if (callback) callback({ success: false, ...conflictResponse });
          return;
        }

        // Acquire lock in memory for instant feedback
        const lockPayload: ActiveLockData = {
          taskId,
          boardId,
          lockedBy: userData.userId,
          lockerName: userData.name,
          lockerColor: userData.color,
          lockedAt: new Date(),
        };
        activeLocks.set(taskId, lockPayload);

        // Persist to DB asynchronously if DB is connected
        if (isDbConnected() && Types.ObjectId.isValid(taskId)) {
          Task.findByIdAndUpdate(taskId, {
            lockedBy: Types.ObjectId.isValid(userData.userId)
              ? userData.userId
              : new Types.ObjectId(),
            lockedAt: lockPayload.lockedAt,
          }).catch((e) => console.warn("Lock persistence skipped:", e.message));
        }

        // Broadcast to all board peers
        socket.to(boardId).emit("task_locked_live", lockPayload);
        socket.emit("task_lock_acquired", { taskId });
        if (callback) callback({ success: true, ...lockPayload });
      } catch (err: any) {
        console.error("Error in lock_task:", err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on("unlock_task", async ({ taskId, boardId }, callback) => {
      try {
        const userData = activeUsers.get(socket.id);
        const existingLock = activeLocks.get(taskId);

        if (existingLock) {
          const isLocker =
            !userData || existingLock.lockedBy === userData.userId;
          const isExpired =
            Date.now() - new Date(existingLock.lockedAt).getTime() >=
            TASK_LOCK_TIMEOUT_MS;

          if (isLocker || isExpired) {
            activeLocks.delete(taskId);

            if (isDbConnected() && Types.ObjectId.isValid(taskId)) {
              Task.findByIdAndUpdate(taskId, {
                lockedBy: null,
                lockedAt: null,
              }).catch(() => {});
            }

            socket.to(boardId).emit("task_unlocked_live", taskId);
            socket.emit("task_unlocked_live", taskId);
            if (callback) callback({ success: true });
            return;
          }
        } else {
          // If not in memory, ensure cleared
          if (isDbConnected() && Types.ObjectId.isValid(taskId)) {
            Task.findByIdAndUpdate(taskId, {
              lockedBy: null,
              lockedAt: null,
            }).catch(() => {});
          }
          socket.to(boardId).emit("task_unlocked_live", taskId);
          if (callback) callback({ success: true });
          return;
        }

        if (callback) callback({ success: false, message: "Could not release lock" });
      } catch (err: any) {
        console.error("Error in unlock_task:", err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on("renew_lock", ({ taskId }) => {
      const userData = activeUsers.get(socket.id);
      const lock = activeLocks.get(taskId);
      if (userData && lock && lock.lockedBy === userData.userId) {
        lock.lockedAt = new Date();
      }
    });

    // ==========================================
    // 4. OFFLINE SYNC REPLAY (Bonus Milestone)
    // ==========================================
    socket.on("sync_offline_actions", async ({ boardId, actions }, callback) => {
      try {
        const userData = activeUsers.get(socket.id);
        const results = [];

        if (Array.isArray(actions)) {
          for (const act of actions) {
            const { clientActionId, actionType, payload, timestamp } = act;
            let conflictResolved = false;
            let resultData: any = null;

            try {
              if (actionType === "CREATE_TASK") {
                resultData = {
                  _id: act.taskId || new Types.ObjectId().toString(),
                  ...payload,
                  boardId: boardId || payload.boardId,
                  clientId: clientActionId,
                  createdBy: userData?.userId || payload.createdBy,
                  createdAt: timestamp || new Date(),
                };

                if (isDbConnected()) {
                  const newTask = new Task(resultData);
                  await newTask.save();
                  resultData = newTask;
                }

                // Broadcast live creation to room
                socket.to(boardId).emit("task_created_live", resultData);
              } else if (actionType === "UPDATE_TASK") {
                resultData = payload;
                if (isDbConnected()) {
                  const existingTask = await Task.findById(payload._id || act.taskId);
                  if (existingTask) {
                    if (
                      typeof payload.version === "number" &&
                      existingTask.version > payload.version
                    ) {
                      conflictResolved = true;
                    }
                    Object.assign(existingTask, payload);
                    await existingTask.save();
                    resultData = existingTask;
                  }
                }
                socket.to(boardId).emit("task_updated_live", resultData);
              } else if (actionType === "MOVE_TASK") {
                const moveData = {
                  boardId,
                  taskId: act.taskId || payload.taskId,
                  status: payload.status,
                  order: payload.order,
                };
                if (isDbConnected()) {
                  await Task.findByIdAndUpdate(moveData.taskId, {
                    status: moveData.status,
                    order: moveData.order,
                  });
                }
                socket.to(boardId).emit("task_moved_live", moveData);
                resultData = moveData;
              } else if (actionType === "DELETE_TASK") {
                const taskId = act.taskId || payload.taskId;
                activeLocks.delete(taskId);
                if (isDbConnected()) {
                  await Task.findByIdAndDelete(taskId);
                }
                socket.to(boardId).emit("task_deleted_live", taskId);
                resultData = { taskId };
              }

              // Persist action log if DB is up
              if (isDbConnected() && userData?.userId && Types.ObjectId.isValid(userData.userId)) {
                await Action.create({
                  clientActionId,
                  userId: userData.userId,
                  taskId: act.taskId || resultData?._id,
                  actionType,
                  payload,
                  timestamp: timestamp ? new Date(timestamp) : new Date(),
                  status: "PROCESSED",
                  conflictResolved,
                }).catch(() => {});
              }

              results.push({
                clientActionId,
                status: "PROCESSED",
                conflictResolved,
                data: resultData,
              });
            } catch (actionErr: any) {
              results.push({
                clientActionId,
                status: "FAILED",
                error: actionErr.message,
              });
            }
          }
        }

        if (callback) callback({ success: true, results });
      } catch (err: any) {
        console.error("Error in sync_offline_actions:", err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ==========================================
    // 5. COMMENTS & FEEDBACK
    // ==========================================
    socket.on("new_comment", (data: { boardId: string; comment: any }) => {
      if (data?.boardId) {
        socket.to(data.boardId).emit("comment_created_live", data.comment);
      }
    });

    // ==========================================
    // 6. DISCONNECT CLEANUP
    // ==========================================
    socket.on("disconnect", async () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
      const userData = activeUsers.get(socket.id);

      if (userData) {
        activeUsers.delete(socket.id);

        // Tell board collaborators user left
        socket.to(userData.boardId).emit("user_left", userData.userId);

        // Release any locks held by this user
        releaseUserLocks(userData.userId, userData.boardId, socket);

        // Update online status in DB if connected
        if (isDbConnected() && Types.ObjectId.isValid(userData.userId)) {
          const otherSockets = Array.from(activeUsers.values()).some(
            (u) => u.userId === userData.userId
          );
          if (!otherSockets) {
            User.findByIdAndUpdate(userData.userId, { isOnline: false }).catch(() => {});
          }
        }
      }
    });
  });

  return io;
};

/**
 * Release all locks held by a user across active memory and DB
 */
function releaseUserLocks(userId: string, boardId: string, socket: Socket): void {
  try {
    if (!userId) return;

    // Release from in-memory active locks
    for (const [taskId, lock] of activeLocks.entries()) {
      if (lock.lockedBy === userId && (!boardId || lock.boardId === boardId)) {
        activeLocks.delete(taskId);
        socket.to(boardId).emit("task_unlocked_live", taskId);
      }
    }

    // Persist unlock to DB if connected
    if (isDbConnected()) {
      const query: any = { lockedBy: userId };
      if (boardId && Types.ObjectId.isValid(boardId)) {
        query.boardId = boardId;
      }
      Task.updateMany(query, { lockedBy: null, lockedAt: null }).catch(() => {});
    }
  } catch (err) {
    console.error("Error releasing user locks:", err);
  }
}
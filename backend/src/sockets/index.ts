import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import Task, { TASK_LOCK_TIMEOUT_MS } from "../models/Task";
import { User, colorForName } from "../models/User";
import { Action } from "../models/ActionLog";
import { Types } from "mongoose";

export interface ActiveUserData {
  socketId: string;
  userId: string;
  boardId: string;
  name: string;
  color: string;
  joinedAt: Date;
}

// In-memory active users tracker
// Map<socketId, ActiveUserData>
const activeUsers = new Map<string, ActiveUserData>();

let ioInstance: Server | null = null;

export const getIO = (): Server | null => ioInstance;

export const initSockets = (server: HttpServer): Server => {
  const io = new Server(server, {
    cors: {
      origin: "*", // Adjust to specific frontend URL in production
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

        if (userId && Types.ObjectId.isValid(userId)) {
          // Join private room for user-specific notifications
          socket.join(`user:${userId}`);

          const dbUser = await User.findById(userId);
          if (dbUser) {
            userName = dbUser.name || userName;
            userColor = dbUser.color || colorForName(userName);
            resolvedUserId = dbUser._id.toString();
            await User.findByIdAndUpdate(userId, { isOnline: true });
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

        // Broadcast to everyone else in this board that user joined
        socket.to(boardId).emit("user_joined", userData);

        // Send current list of active users in this board to joining client
        const usersInRoom = Array.from(activeUsers.values()).filter(
          (u) => u.boardId === boardId
        );
        socket.emit("active_users", usersInRoom);

        // Milestone 3: Send currently locked tasks on this board to the newcomer
        const now = new Date();
        const lockCutoff = new Date(now.getTime() - TASK_LOCK_TIMEOUT_MS);
        const lockedTasks = await Task.find({
          boardId: Types.ObjectId.isValid(boardId) ? boardId : null,
          lockedBy: { $ne: null },
          lockedAt: { $gt: lockCutoff },
        }).populate("lockedBy", "name color");

        const lockedSummary = lockedTasks.map((t) => {
          const locker = t.lockedBy as any;
          return {
            taskId: t._id,
            lockedBy: locker?._id || locker,
            lockerName: locker?.name || "Collaborator",
            lockerColor: locker?.color || "#2563eb",
            lockedAt: t.lockedAt,
          };
        });

        socket.emit("initial_locks", lockedSummary);
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
          await releaseUserLocks(userData.userId, boardId, socket);
        }
      } catch (err) {
        console.error("Error in leave_board:", err);
      }
    });

    // Real-time cursor / active selection sharing
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

        const task = await Task.findById(taskId);
        if (!task) {
          if (callback) callback({ success: false, message: "Task not found" });
          return;
        }

        // Check if already locked by someone else and lock is not expired
        const now = Date.now();
        const isLockedByOther =
          task.lockedBy &&
          task.lockedBy.toString() !== userData.userId.toString() &&
          task.lockedAt &&
          now - new Date(task.lockedAt).getTime() < TASK_LOCK_TIMEOUT_MS;

        if (isLockedByOther) {
          const conflictResponse = {
            taskId,
            lockedBy: task.lockedBy,
            message: "Task is currently locked by another collaborator",
          };
          socket.emit("task_lock_rejected", conflictResponse);
          if (callback) callback({ success: false, ...conflictResponse });
          return;
        }

        // Acquire lock in database
        task.lockedBy = new Types.ObjectId(
          Types.ObjectId.isValid(userData.userId)
            ? userData.userId
            : new Types.ObjectId()
        );
        task.lockedAt = new Date();
        await task.save();

        const lockPayload = {
          taskId,
          lockedBy: userData.userId,
          lockerName: userData.name,
          lockerColor: userData.color,
          lockedAt: task.lockedAt,
        };

        // Notify other clients to disable/tag this task as being edited
        socket.to(boardId).emit("task_locked_live", lockPayload);

        // Acknowledge requester
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
        const task = await Task.findById(taskId);

        if (task) {
          // Verify ownership or allow if lock has expired
          const isLocker =
            !userData ||
            !task.lockedBy ||
            task.lockedBy.toString() === userData.userId.toString();

          if (isLocker || !task.isLocked()) {
            task.lockedBy = null;
            task.lockedAt = null;
            await task.save();

            socket.to(boardId).emit("task_unlocked_live", taskId);
            socket.emit("task_unlocked_live", taskId);
            if (callback) callback({ success: true });
            return;
          }
        }

        if (callback) callback({ success: false, message: "Could not release lock" });
      } catch (err: any) {
        console.error("Error in unlock_task:", err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on("renew_lock", async ({ taskId }) => {
      try {
        const userData = activeUsers.get(socket.id);
        if (userData) {
          await Task.findOneAndUpdate(
            { _id: taskId, lockedBy: userData.userId },
            { lockedAt: new Date() }
          );
        }
      } catch (err) {
        console.error("Error in renew_lock:", err);
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

            // Idempotency: skip if already executed
            const existingAction = await Action.findOne({ clientActionId });
            if (existingAction) {
              results.push({
                clientActionId,
                status: "ALREADY_PROCESSED",
                conflictResolved: existingAction.conflictResolved,
              });
              continue;
            }

            let conflictResolved = false;
            let resultData: any = null;

            try {
              if (actionType === "CREATE_TASK") {
                const newTask = new Task({
                  ...payload,
                  boardId: boardId || payload.boardId,
                  clientId: clientActionId,
                  createdBy: userData?.userId || payload.createdBy,
                });
                await newTask.save();
                resultData = newTask;

                // Broadcast created task live to board
                socket.to(boardId).emit("task_created_live", newTask);
              } else if (actionType === "UPDATE_TASK") {
                const existingTask = await Task.findById(payload._id || act.taskId);
                if (existingTask) {
                  // Conflict check: if incoming version is stale, flag conflict resolution
                  if (
                    typeof payload.version === "number" &&
                    existingTask.version > payload.version
                  ) {
                    conflictResolved = true;
                  }
                  Object.assign(existingTask, payload);
                  await existingTask.save();
                  resultData = existingTask;

                  socket.to(boardId).emit("task_updated_live", existingTask);
                }
              } else if (actionType === "MOVE_TASK") {
                const movedTask = await Task.findByIdAndUpdate(
                  act.taskId || payload.taskId,
                  { status: payload.status, order: payload.order },
                  { new: true }
                );
                resultData = movedTask;

                socket.to(boardId).emit("task_moved_live", {
                  boardId,
                  taskId: act.taskId || payload.taskId,
                  status: payload.status,
                  order: payload.order,
                });
              } else if (actionType === "DELETE_TASK") {
                await Task.findByIdAndDelete(act.taskId || payload.taskId);
                socket
                  .to(boardId)
                  .emit("task_deleted_live", act.taskId || payload.taskId);
              }

              // Log action execution
              if (userData?.userId && Types.ObjectId.isValid(userData.userId)) {
                await Action.create({
                  clientActionId,
                  userId: userData.userId,
                  taskId: act.taskId || resultData?._id,
                  actionType,
                  payload,
                  timestamp: timestamp ? new Date(timestamp) : new Date(),
                  status: "PROCESSED",
                  conflictResolved,
                });
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

        // Tell the board this user left
        socket.to(userData.boardId).emit("user_left", userData.userId);

        // Release any tasks they locked
        await releaseUserLocks(userData.userId, userData.boardId, socket);

        // Update user online status if no other active sockets exist for this user
        const otherSockets = Array.from(activeUsers.values()).some(
          (u) => u.userId === userData.userId
        );
        if (!otherSockets && Types.ObjectId.isValid(userData.userId)) {
          await User.findByIdAndUpdate(userData.userId, { isOnline: false });
        }
      }
    });
  });

  return io;
};

/**
 * Helper to unlock orphaned tasks locked by a user
 */
async function releaseUserLocks(
  userId: string,
  boardId: string,
  socket: Socket
): Promise<void> {
  try {
    if (!userId) return;

    const query: any = { lockedBy: userId };
    if (boardId && Types.ObjectId.isValid(boardId)) {
      query.boardId = boardId;
    }

    const lockedTasks = await Task.find(query);
    if (lockedTasks.length > 0) {
      await Task.updateMany(query, { lockedBy: null, lockedAt: null });

      // Tell room to unlock these cards
      lockedTasks.forEach((task) => {
        socket.to(boardId).emit("task_unlocked_live", task._id.toString());
      });
    }
  } catch (err) {
    console.error("Error releasing user locks:", err);
  }
}
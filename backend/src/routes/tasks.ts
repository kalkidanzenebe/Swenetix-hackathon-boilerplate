import { Router, Request, Response } from "express";
import { Task, TASK_LOCK_TIMEOUT_MS } from "../models/Task";
import { Action } from "../models/ActionLog";
import { getIO } from "../sockets";
import { optionalAuth } from "../middleware/auth";
import { Types } from "mongoose";

const router = Router();

// ==========================================
// 1. GET ALL TASKS
// ==========================================
router.get("/", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { boardId, status, priority, search } = req.query;
    const query: any = {};

    if (boardId) {
      query.boardId = Types.ObjectId.isValid(boardId as string)
        ? new Types.ObjectId(boardId as string)
        : null;
    }

    if (status) {
      query.status = status;
    }

    if (priority) {
      query.priority = priority;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search as string, $options: "i" } },
        { description: { $regex: search as string, $options: "i" } },
      ];
    }

    const tasks = await Task.find(query)
      .sort({ order: 1, createdAt: 1 })
      .populate("assignedTo", "name email color avatarUrl")
      .populate("createdBy", "name email color avatarUrl")
      .populate("lockedBy", "name email color");

    res.status(200).json({ success: true, count: tasks.length, data: tasks });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 2. GET SINGLE TASK
// ==========================================
router.get("/:id", optionalAuth, async (req: Request, res: Response) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("assignedTo", "name email color avatarUrl")
      .populate("createdBy", "name email color avatarUrl")
      .populate("lockedBy", "name email color");

    if (!task) {
      res.status(404).json({ success: false, message: "Task not found" });
      return;
    }

    res.status(200).json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 3. CREATE TASK (Milestone 1 & 2 Live Broadcast)
// ==========================================
router.post("/", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { title, description, status, priority, dueDate, boardId, labels, clientId } = req.body;

    // Highest order index in the target status column
    const highestOrderTask = await Task.findOne({
      boardId: boardId || null,
      status: status || "To Do",
    }).sort({ order: -1 });

    const nextOrder = highestOrderTask ? highestOrderTask.order + 1 : 0;

    const task = new Task({
      title,
      description,
      status: status || "To Do",
      priority: priority || "Medium",
      order: nextOrder,
      dueDate: dueDate || null,
      boardId: boardId || null,
      labels: labels || [],
      clientId: clientId || undefined,
      createdBy: req.userId || undefined,
    });

    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate("createdBy", "name email color")
      .populate("assignedTo", "name email color");

    // Real-time broadcast to connected clients
    const io = getIO();
    if (io && boardId) {
      io.to(boardId.toString()).emit("task_created_live", populatedTask);
    }

    res.status(201).json({ success: true, data: populatedTask });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ==========================================
// 4. UPDATE TASK (Milestone 3 Concurrency Safe)
// ==========================================
router.put("/:id", optionalAuth, async (req: Request, res: Response) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      res.status(404).json({ success: false, message: "Task not found" });
      return;
    }

    // Concurrency Check: Is task locked by another collaborator?
    const currentUserId = req.userId?.toString();
    const now = Date.now();
    const isLockedByOther =
      task.lockedBy &&
      currentUserId &&
      task.lockedBy.toString() !== currentUserId &&
      task.lockedAt &&
      now - new Date(task.lockedAt).getTime() < TASK_LOCK_TIMEOUT_MS;

    if (isLockedByOther) {
      res.status(423).json({
        success: false,
        message: "Task is currently locked by another collaborator for editing",
        lockedBy: task.lockedBy,
      });
      return;
    }

    const updatableFields = [
      "title",
      "description",
      "status",
      "priority",
      "dueDate",
      "assignedTo",
      "labels",
      "order",
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        (task as any)[field] = req.body[field];
      }
    });

    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate("assignedTo", "name email color avatarUrl")
      .populate("createdBy", "name email color avatarUrl")
      .populate("lockedBy", "name email color");

    // Real-time broadcast
    const io = getIO();
    if (io && task.boardId) {
      io.to(task.boardId.toString()).emit("task_updated_live", updatedTask);
    }

    res.status(200).json({ success: true, data: updatedTask });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ==========================================
// 5. MOVE TASK (Milestone 1 & 2 Live Broadcast)
// ==========================================
router.patch("/:id/move", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { status, order, boardId } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
      res.status(404).json({ success: false, message: "Task not found" });
      return;
    }

    const prevStatus = task.status;
    const prevOrder = task.order;

    if (status) task.status = status;
    if (order !== undefined) task.order = Number(order);
    if (boardId) task.boardId = boardId;

    await task.save();

    const movePayload = {
      taskId: task._id.toString(),
      boardId: task.boardId?.toString() || boardId,
      status: task.status,
      order: task.order,
      prevStatus,
      prevOrder,
    };

    // Real-time broadcast to all board participants
    const io = getIO();
    if (io && movePayload.boardId) {
      io.to(movePayload.boardId).emit("task_moved_live", movePayload);
    }

    res.status(200).json({ success: true, data: movePayload });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ==========================================
// 6. DELETE TASK
// ==========================================
router.delete("/:id", optionalAuth, async (req: Request, res: Response) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      res.status(404).json({ success: false, message: "Task not found" });
      return;
    }

    const boardId = task.boardId?.toString();
    const taskId = task._id.toString();

    await Task.findByIdAndDelete(taskId);

    // Real-time broadcast
    const io = getIO();
    if (io && boardId) {
      io.to(boardId).emit("task_deleted_live", taskId);
    }

    res.status(200).json({ success: true, message: "Task deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 7. LOCK TASK (Milestone 3 Concurrent Safety)
// ==========================================
router.post("/:id/lock", optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId || req.body.userId;
    if (!userId) {
      res.status(400).json({ success: false, message: "User ID is required to lock task" });
      return;
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      res.status(404).json({ success: false, message: "Task not found" });
      return;
    }

    const acquired = await task.acquireLock(userId);
    if (!acquired) {
      res.status(409).json({
        success: false,
        message: "Task is currently locked by another collaborator",
        lockedBy: task.lockedBy,
      });
      return;
    }

    // Broadcast lock to board
    const io = getIO();
    if (io && task.boardId) {
      io.to(task.boardId.toString()).emit("task_locked_live", {
        taskId: task._id.toString(),
        lockedBy: userId,
        lockerName: req.user?.name || req.body.name || "Collaborator",
        lockerColor: req.user?.color || req.body.color || "#2563eb",
        lockedAt: task.lockedAt,
      });
    }

    res.status(200).json({ success: true, message: "Lock acquired", lockedAt: task.lockedAt });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 8. UNLOCK TASK (Milestone 3)
// ==========================================
router.post("/:id/unlock", optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId || req.body.userId;
    const task = await Task.findById(req.params.id);

    if (!task) {
      res.status(404).json({ success: false, message: "Task not found" });
      return;
    }

    await task.releaseLock(userId);

    // Broadcast unlock to board
    const io = getIO();
    if (io && task.boardId) {
      io.to(task.boardId.toString()).emit("task_unlocked_live", task._id.toString());
    }

    res.status(200).json({ success: true, message: "Lock released" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 9. OFFLINE SYNC BATCH REPLAY (Bonus Milestone)
// ==========================================
router.post("/sync", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { actions, boardId } = req.body;
    const userId = req.userId || req.body.userId;

    if (!Array.isArray(actions)) {
      res.status(400).json({ success: false, message: "Actions array is required" });
      return;
    }

    const results = [];
    const io = getIO();

    for (const act of actions) {
      const { clientActionId, actionType, payload, timestamp } = act;

      // Idempotency check: don't process duplicate action IDs
      const existing = await Action.findOne({ clientActionId });
      if (existing) {
        results.push({
          clientActionId,
          status: "ALREADY_PROCESSED",
          conflictResolved: existing.conflictResolved,
        });
        continue;
      }

      let conflictResolved = false;
      let resultDoc: any = null;

      try {
        if (actionType === "CREATE_TASK") {
          const newTask = new Task({
            ...payload,
            boardId: boardId || payload.boardId,
            clientId: clientActionId,
            createdBy: userId || payload.createdBy,
          });
          await newTask.save();
          resultDoc = newTask;

          if (io && (boardId || payload.boardId)) {
            io.to((boardId || payload.boardId).toString()).emit(
              "task_created_live",
              newTask
            );
          }
        } else if (actionType === "UPDATE_TASK") {
          const taskToUpdate = await Task.findById(act.taskId || payload._id);
          if (taskToUpdate) {
            if (
              typeof payload.version === "number" &&
              taskToUpdate.version > payload.version
            ) {
              conflictResolved = true;
            }
            Object.assign(taskToUpdate, payload);
            await taskToUpdate.save();
            resultDoc = taskToUpdate;

            if (io && taskToUpdate.boardId) {
              io.to(taskToUpdate.boardId.toString()).emit(
                "task_updated_live",
                taskToUpdate
              );
            }
          }
        } else if (actionType === "MOVE_TASK") {
          const moved = await Task.findByIdAndUpdate(
            act.taskId || payload.taskId,
            { status: payload.status, order: payload.order },
            { new: true }
          );
          resultDoc = moved;

          if (io && (boardId || moved?.boardId)) {
            io.to((boardId || moved?.boardId)!.toString()).emit(
              "task_moved_live",
              {
                boardId: boardId || moved?.boardId,
                taskId: act.taskId || payload.taskId,
                status: payload.status,
                order: payload.order,
              }
            );
          }
        } else if (actionType === "DELETE_TASK") {
          const toDelete = await Task.findByIdAndDelete(act.taskId || payload.taskId);
          if (io && (boardId || toDelete?.boardId)) {
            io.to((boardId || toDelete?.boardId)!.toString()).emit(
              "task_deleted_live",
              act.taskId || payload.taskId
            );
          }
        }

        if (userId && Types.ObjectId.isValid(userId)) {
          await Action.create({
            clientActionId,
            userId,
            taskId: act.taskId || resultDoc?._id,
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
          data: resultDoc,
        });
      } catch (err: any) {
        results.push({
          clientActionId,
          status: "FAILED",
          error: err.message,
        });
      }
    }

    res.status(200).json({ success: true, processed: results.length, results });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
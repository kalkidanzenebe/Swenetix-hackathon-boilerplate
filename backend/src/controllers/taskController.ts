import { Response } from "express";
import Task, { COLUMNS, TaskStatus, ITask } from "../models/Task";
import { emitToBoard } from "../realtime/io";
import { dropLockForTask } from "../realtime/presence";
import { AuthedRequest } from "../types";

const POSITION_GAP = 1000;

const isColumn = (value: unknown): value is TaskStatus =>
  typeof value === "string" && (COLUMNS as readonly string[]).includes(value);

const actorOf = (req: AuthedRequest): string => req.user?.displayName || "unknown";

const serialise = (task: ITask) => ({
  id: task._id.toString(),
  title: task.title,
  description: task.description,
  column: task.column,
  position: task.position,
  version: task.version,
  createdBy: task.createdBy,
  updatedBy: task.updatedBy,
  clientId: task.clientId,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
});

export type SerialisedTask = ReturnType<typeof serialise>;

/** Appends to the bottom of a column without renumbering its siblings. */
const nextPosition = async (column: TaskStatus): Promise<number> => {
  const last = await Task.findOne({ column }).sort({ position: -1 }).select("position").lean();
  return last ? last.position + POSITION_GAP : POSITION_GAP;
};

export const listTasks = async (_req: AuthedRequest, res: Response): Promise<void> => {
  const tasks = await Task.find().sort({ position: 1, createdAt: 1 });
  res.status(200).json({ success: true, data: tasks.map(serialise) });
};

export const createTask = async (req: AuthedRequest, res: Response): Promise<void> => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const description =
    typeof req.body?.description === "string" ? req.body.description.trim() : "";
  const column: TaskStatus = isColumn(req.body?.column) ? req.body.column : "todo";
  const clientId = typeof req.body?.clientId === "string" ? req.body.clientId : undefined;

  if (!title) {
    res.status(400).json({ success: false, message: "Title is required" });
    return;
  }

  // A create replayed from the offline queue must not produce a second card.
  if (clientId) {
    const existing = await Task.findOne({ clientId });
    if (existing) {
      res.status(200).json({ success: true, data: serialise(existing), deduplicated: true });
      return;
    }
  }

  const actor = actorOf(req);
  const position =
    typeof req.body?.position === "number" && Number.isFinite(req.body.position)
      ? req.body.position
      : await nextPosition(column);

  let task: ITask;
  try {
    task = await Task.create({
      title,
      description,
      column,
      position,
      createdBy: actor,
      updatedBy: actor,
      clientId,
    });
  } catch (err) {
    // Lost a race with a concurrent replay of the same offline op.
    if ((err as { code?: number }).code === 11000 && clientId) {
      const existing = await Task.findOne({ clientId });
      if (existing) {
        res.status(200).json({ success: true, data: serialise(existing), deduplicated: true });
        return;
      }
    }
    throw err;
  }

  const payload = serialise(task);
  emitToBoard("task:created", { task: payload, actor });
  res.status(201).json({ success: true, data: payload });
};

/**
 * Content edits are guarded by optimistic concurrency: the client sends the version it
 * started from, and a stale version is rejected with the current server copy so the UI
 * can resolve the conflict instead of silently clobbering someone's text.
 */
export const updateTask = async (req: AuthedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const version = Number(req.body?.version);

  if (!Number.isInteger(version)) {
    res.status(400).json({ success: false, message: "A numeric version is required" });
    return;
  }

  const updates: Partial<Pick<ITask, "title" | "description" | "column" | "updatedBy">> = {};

  if (typeof req.body?.title === "string") {
    const title = req.body.title.trim();
    if (!title) {
      res.status(400).json({ success: false, message: "Title cannot be empty" });
      return;
    }
    updates.title = title;
  }
if (typeof req.body?.description === "string") {
    updates.description = req.body.description.trim();
  }

  if (req.body?.column !== undefined) {
    if (!isColumn(req.body.column)) {
      res.status(400).json({ success: false, message: "Unknown column" });
      return;
    }
    updates.column = req.body.column;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ success: false, message: "Nothing to update" });
    return;
  }

  const actor = actorOf(req);
  updates.updatedBy = actor;

  const task = await Task.findOneAndUpdate(
    { _id: id, version },
    { $set: updates, $inc: { version: 1 } },
    { new: true, runValidators: true }
  );

  if (!task) {
    const current = await Task.findById(id);
    if (!current) {
      res.status(404).json({ success: false, message: "Task no longer exists" });
      return;
    }

    res.status(409).json({
      success: false,
      code: "VERSION_CONFLICT",
      message: `${current.updatedBy} changed this task while you were editing`,
      data: serialise(current),
    });
    return;
  }

  const payload = serialise(task);
  emitToBoard("task:updated", { task: payload, actor });
  res.status(200).json({ success: true, data: payload });
};

/**
 * Moves are deliberately version-free. Two people dragging the same card is a race with
 * no losing data — last drop wins — and blocking it would make the board feel broken.
 */
export const moveTask = async (req: AuthedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!isColumn(req.body?.column)) {
    res.status(400).json({ success: false, message: "Unknown column" });
    return;
  }

  const column: TaskStatus = req.body.column;
  const position =
    typeof req.body?.position === "number" && Number.isFinite(req.body.position)
      ? req.body.position
      : await nextPosition(column);

  const actor = actorOf(req);
  const task = await Task.findByIdAndUpdate(
    id,
    { $set: { column, position, updatedBy: actor }, $inc: { version: 1 } },
    { new: true, runValidators: true }
  );

  if (!task) {
    res.status(404).json({ success: false, message: "Task no longer exists" });
    return;
  }

  const payload = serialise(task);
  emitToBoard("task:moved", { task: payload, actor });
  res.status(200).json({ success: true, data: payload });
};

export const deleteTask = async (req: AuthedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const task = await Task.findByIdAndDelete(id);

  if (!task) {
    // Already gone: treat as success so an offline replay of the same delete settles.
    res.status(200).json({ success: true, data: { id }, alreadyDeleted: true });
    return;
  }

  dropLockForTask(id);
  emitToBoard("task:deleted", { id, actor: actorOf(req) });
  res.status(200).json({ success: true, data: { id } });
};
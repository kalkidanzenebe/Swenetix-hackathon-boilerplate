import { Response } from "express";
import Task, { ITask, Status } from "../models/Task";
import { emitToBoard } from "../realtime/io";
import {
  isPriority,
  isStatus,
  normaliseAssignee,
  normaliseLabels,
  parseDueDate,
} from "../utils/taskFields";
import { AuthedRequest } from "../types";

const ORDER_GAP = 1000;

const actorOf = (req: AuthedRequest): string => req.user?.displayName || "unknown";

export const serialise = (task: ITask) => ({
  id: task._id.toString(),
  title: task.title,
  description: task.description,
  order: task.order,
  priority: task.priority,
  createdBy: task.createdBy,
  assignedTo: task.assignedTo,
  lockedBy: task.lockedBy,
  lockedAt: task.lockedAt,
  version: task.version,
  clientId: task.clientId,
  labels: task.labels,
  dueDate: task.dueDate,
  status: task.status,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
});

export type SerialisedTask = ReturnType<typeof serialise>;

const nextOrder = async (status: Status): Promise<number> => {
  const last = await Task.findOne({ status }).sort({ order: -1 }).select("order").lean();
  return last ? last.order + ORDER_GAP : ORDER_GAP;
};

export const listTasks = async (_req: AuthedRequest, res: Response): Promise<void> => {
  const tasks = await Task.find().sort({ order: 1, createdAt: 1 });
  res.status(200).json({ success: true, data: tasks.map(serialise) });
};

export const createTask = async (req: AuthedRequest, res: Response): Promise<void> => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const description =
    typeof req.body?.description === "string" ? req.body.description.trim() : "";
  const status: Status = isStatus(req.body?.status) ? req.body.status : "todo";
  const clientId = typeof req.body?.clientId === "string" ? req.body.clientId : undefined;

  if (!title) {
    res.status(400).json({ success: false, message: "Title is required" });
    return;
  }

  if (clientId) {
    const existing = await Task.findOne({ clientId });
    if (existing) {
      res.status(200).json({ success: true, data: serialise(existing), deduplicated: true });
      return;
    }
  }

  const actor = actorOf(req);
  const order =
    typeof req.body?.order === "number" && Number.isFinite(req.body.order)
      ? req.body.order
      : await nextOrder(status);

  let task: ITask;
  try {
    task = await Task.create({
      title,
      description,
      order,
      priority: isPriority(req.body?.priority) ? req.body.priority : "medium",
      createdBy: actor,
      assignedTo: normaliseAssignee(req.body?.assignedTo),
      labels: normaliseLabels(req.body?.labels),
      dueDate: parseDueDate(req.body?.dueDate),
      status,
      clientId,
    });
  } catch (err) {
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

type Editable = Partial<
  Pick<ITask, "title" | "description" | "status" | "priority" | "assignedTo" | "labels" | "dueDate">
>;

export const updateTask = async (req: AuthedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const version = Number(req.body?.version);

  if (!Number.isInteger(version)) {
    res.status(400).json({ success: false, message: "A numeric version is required" });
    return;
  }

  const updates: Editable = {};

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

  if (req.body?.status !== undefined) {
    if (!isStatus(req.body.status)) {
      res.status(400).json({ success: false, message: "Unknown status" });
      return;
    }
    updates.status = req.body.status;
  }

  if (req.body?.priority !== undefined) {
    if (!isPriority(req.body.priority)) {
      res.status(400).json({ success: false, message: "Unknown priority" });
      return;
    }
    updates.priority = req.body.priority;
  }

  if ("assignedTo" in (req.body || {})) {
    updates.assignedTo = normaliseAssignee(req.body.assignedTo);
  }

  if ("labels" in (req.body || {})) {
    updates.labels = normaliseLabels(req.body.labels);
  }

  if ("dueDate" in (req.body || {})) {
    updates.dueDate = parseDueDate(req.body.dueDate);
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ success: false, message: "Nothing to update" });
    return;
  }

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
      message: "This task changed while you were editing",
      data: serialise(current),
    });
    return;
  }

  const payload = serialise(task);
  emitToBoard("task:updated", { task: payload, actor: actorOf(req) });
  res.status(200).json({ success: true, data: payload });
};

export const moveTask = async (req: AuthedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!isStatus(req.body?.status)) {
    res.status(400).json({ success: false, message: "Unknown status" });
    return;
  }

  const status: Status = req.body.status;
  const order =
    typeof req.body?.order === "number" && Number.isFinite(req.body.order)
      ? req.body.order
      : await nextOrder(status);

  const task = await Task.findByIdAndUpdate(
    id,
    { $set: { status, order }, $inc: { version: 1 } },
    { new: true, runValidators: true }
  );

  if (!task) {
    res.status(404).json({ success: false, message: "Task no longer exists" });
    return;
  }

  const payload = serialise(task);
  emitToBoard("task:moved", { task: payload, actor: actorOf(req) });
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

  emitToBoard("task:deleted", { id, actor: actorOf(req) });
  res.status(200).json({ success: true, data: { id } });
};

import { Schema, model, Document, Types } from "mongoose";

export const STATUSES = ["todo", "in-progress", "done"] as const;
export type Status = (typeof STATUSES)[number];

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** A held editing lock goes stale this long after its last heartbeat. */
export const LOCK_TTL_MS = 15_000;

export interface ITask extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  // Fractional index: a task sits between its neighbours without renumbering the column.
  order: number;
  priority: Priority;
  createdBy: string;
  assignedTo: string | null;
  // Who currently has the task open, refreshed by heartbeat while their editor is open.
  lockedBy: string | null;
  lockedAt: Date | null;
  // Bumped on every write; clients send the version they edited for conflict detection.
  version: number;
  // Client-generated id, set by the offline queue so a replayed create is not duplicated.
  clientId?: string;
  labels: string[];
  dueDate: Date | null;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    order: { type: Number, required: true },
    priority: { type: String, enum: PRIORITIES, default: "medium" },
    createdBy: { type: String, default: "unknown" },
    assignedTo: { type: String, default: null },
    lockedBy: { type: String, default: null },
    lockedAt: { type: Date, default: null },
    version: { type: Number, default: 1 },
    clientId: { type: String },
    labels: { type: [String], default: [] },
    dueDate: { type: Date, default: null },
    status: { type: String, enum: STATUSES, default: "todo", index: true },
  },
  { timestamps: true }
);

taskSchema.index({ status: 1, order: 1 });
taskSchema.index({ clientId: 1 }, { unique: true, sparse: true });

export default model<ITask>("Task", taskSchema);

import { Schema, model, Document, Types } from "mongoose";

export const COLUMNS = ["todo", "in-progress", "done"] as const;
export type TaskStatus = (typeof COLUMNS)[number];

export interface ITask extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  column: TaskStatus;
  // Fractional index: a task sits between its neighbours without renumbering the TaskStatus.
  position: number;
  // Bumped on every write; clients send the version they edited for conflict detection.
  version: number;
  createdBy: string;
  updatedBy: string;
  // Client-generated id, set by the offline queue so a replayed create is not duplicated.
  clientId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    column: { type: String, enum: COLUMNS, default: "todo", index: true },
    position: { type: Number, required: true },
    version: { type: Number, default: 1 },
    createdBy: { type: String, default: "unknown" },
    updatedBy: { type: String, default: "unknown" },
    clientId: { type: String },
  },
  { timestamps: true }
);

taskSchema.index({ TaskStatus: 1, position: 1 });
taskSchema.index({ clientId: 1 }, { unique: true, sparse: true });

export default model<ITask>("Task", taskSchema); 
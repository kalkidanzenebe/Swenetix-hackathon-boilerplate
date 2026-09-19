import mongoose, { Schema, model, Document, Types, Model } from "mongoose";

export type TaskStatus = "To Do" | "In Progress" | "Done";
export type TaskPriority = "Low" | "Medium" | "High" | "Urgent";

// Duration after which an active lock expires to prevent deadlocks from disconnected clients
export const TASK_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface ITask extends Document {
  _id: Types.ObjectId;
  boardId?: Types.ObjectId | null;
  title: string;
  description: string;
  status: TaskStatus;
  order: number;
  priority: TaskPriority;
  dueDate?: Date | null;
  createdBy?: Types.ObjectId | string;
  assignedTo?: Types.ObjectId | string | null;
  labels: string[];
  clientId?: string; // Client-generated UUID for offline sync idempotency
  lockedBy: Types.ObjectId | string | null;
  lockedAt?: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;

  // Helper methods
  isLocked(): boolean;
  acquireLock(userId: Types.ObjectId | string): Promise<boolean>;
  releaseLock(userId?: Types.ObjectId | string): Promise<boolean>;
}

export interface ITaskModel extends Model<ITask> {
  // Static model methods can be defined here
}

const taskSchema = new Schema<ITask, ITaskModel>(
  {
    boardId: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      required: false,
      index: true,
      default: null,
    },
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      minlength: [1, "Task title cannot be empty"],
      maxlength: [140, "Task title cannot exceed 140 characters"],
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    status: {
      type: String,
      enum: {
        values: ["To Do", "In Progress", "Done"],
        message: "Status must be either 'To Do', 'In Progress', or 'Done'",
      },
      default: "To Do",
      required: true,
      index: true,
    },
    order: {
      type: Number,
      default: 0,
      min: [0, "Order index cannot be negative"],
    },
    priority: {
      type: String,
      enum: {
        values: ["Low", "Medium", "High", "Urgent"],
        message: "Priority must be 'Low', 'Medium', 'High', or 'Urgent'",
      },
      default: "Medium",
    },
    dueDate: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    labels: {
      type: [String],
      default: [],
    },
    // Offline queue client-generated ID to prevent duplicate creations on replay
    clientId: {
      type: String,
      index: { unique: true, sparse: true },
    },
    // Milestone 3: Safe concurrent editing lock
    lockedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    // Versioning for optimistic concurrency control & offline sync conflict resolution
    version: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// High-performance query indexes
// 1. Board columns ordered by position (or global columns if boardId is null)
taskSchema.index({ boardId: 1, status: 1, order: 1 });
// 2. Global status + order index when querying without boardId
taskSchema.index({ status: 1, order: 1 });
// 3. Recent activity
taskSchema.index({ boardId: 1, createdAt: -1 });
// 4. Assignee filter
taskSchema.index({ assignedTo: 1, status: 1 });
// 5. Active locks
taskSchema.index({ lockedBy: 1, lockedAt: 1 });

/**
 * Check if the task is actively locked and the lock has not expired
 */
taskSchema.methods.isLocked = function (this: ITask): boolean {
  if (!this.lockedBy) return false;
  if (!this.lockedAt) return false;
  const elapsed = Date.now() - new Date(this.lockedAt).getTime();
  return elapsed < TASK_LOCK_TIMEOUT_MS;
};

/**
 * Safely acquire an edit lock on this task for a given user
 */
taskSchema.methods.acquireLock = async function (
  this: ITask,
  userId: Types.ObjectId | string
): Promise<boolean> {
  const currentUserIdStr = userId.toString();

  // If already locked by someone else and lock is still fresh, deny
  if (this.isLocked() && this.lockedBy?.toString() !== currentUserIdStr) {
    return false;
  }

  this.lockedBy = new Types.ObjectId(currentUserIdStr);
  this.lockedAt = new Date();
  await this.save();
  return true;
};

/**
 * Release edit lock on this task
 */
taskSchema.methods.releaseLock = async function (
  this: ITask,
  userId?: Types.ObjectId | string
): Promise<boolean> {
  if (!this.lockedBy) return true;

  // If userId provided, only release if owned by that user or lock expired
  if (userId) {
    const userStr = userId.toString();
    if (this.lockedBy.toString() !== userStr && this.isLocked()) {
      return false;
    }
  }

  this.lockedBy = null;
  this.lockedAt = null;
  await this.save();
  return true;
};

// Pre-save hook: auto-increment version for conflict resolution and clear expired locks
taskSchema.pre("save", function (next) {
  // If lock has expired, automatically release it
  if (this.lockedBy && this.lockedAt) {
    const elapsed = Date.now() - new Date(this.lockedAt).getTime();
    if (elapsed >= TASK_LOCK_TIMEOUT_MS) {
      this.lockedBy = null;
      this.lockedAt = null;
    }
  }

  // Increment version if document is modified and not new
  if (this.isModified() && !this.isNew) {
    this.version = (this.version || 0) + 1;
  }
  next();
});

// Guard against duplicate model compilation in hot-reload environments
export const Task =
  (mongoose.models.Task as ITaskModel) ||
  model<ITask, ITaskModel>("Task", taskSchema);

export default Task;

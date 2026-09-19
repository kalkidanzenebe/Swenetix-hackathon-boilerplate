import mongoose, { Schema, model, Document, Types, Model } from "mongoose";

export type NotificationType =
  | "TASK_ASSIGNED"
  | "TASK_MOVED"
  | "TASK_LOCKED"
  | "TASK_UNLOCKED"
  | "COMMENT_ADDED"
  | "USER_MENTIONED"
  | "SYSTEM";

export interface INotification extends Document {
  _id: Types.ObjectId;
  recipient: Types.ObjectId;
  sender?: Types.ObjectId | null;
  type: NotificationType;
  title: string;
  message: string;
  taskId?: Types.ObjectId | null;
  boardId?: Types.ObjectId | null;
  isRead: boolean;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationModel extends Model<INotification> {}

const notificationSchema = new Schema<INotification, INotificationModel>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recipient is required"],
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    type: {
      type: String,
      enum: {
        values: [
          "TASK_ASSIGNED",
          "TASK_MOVED",
          "TASK_LOCKED",
          "TASK_UNLOCKED",
          "COMMENT_ADDED",
          "USER_MENTIONED",
          "SYSTEM",
        ],
        message: "Invalid notification type",
      },
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    boardId: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
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

// Indexes for fast retrieval of unread and chronological user notifications
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export const Notification =
  (mongoose.models.Notification as INotificationModel) ||
  model<INotification, INotificationModel>("Notification", notificationSchema);

export default Notification;

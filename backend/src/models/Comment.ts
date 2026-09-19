import mongoose, { Schema, model, Document, Types, Model } from "mongoose";

export interface IComment extends Document {
  _id: Types.ObjectId;
  taskId: Types.ObjectId;
  author: Types.ObjectId;
  content: string;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICommentModel extends Model<IComment> {}

const commentSchema = new Schema<IComment, ICommentModel>(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: [true, "Task ID is required"],
      index: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Comment author is required"],
      index: true,
    },
    content: {
      type: String,
      required: [true, "Comment content cannot be empty"],
      trim: true,
      minlength: [1, "Comment content cannot be empty"],
      maxlength: [2000, "Comment cannot exceed 2000 characters"],
    },
    isEdited: {
      type: Boolean,
      default: false,
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

// Compound index for querying comments on a task chronologically
commentSchema.index({ taskId: 1, createdAt: 1 });

export const Comment =
  (mongoose.models.Comment as ICommentModel) ||
  model<IComment, ICommentModel>("Comment", commentSchema);

export default Comment;

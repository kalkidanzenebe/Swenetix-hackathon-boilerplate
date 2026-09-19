import mongoose, { Schema, model, Document, Types, Model } from "mongoose";

export interface IBoardColumn {
  id: string;
  title: string;
  order: number;
}

export interface IBoardMember {
  user: Types.ObjectId;
  role: "admin" | "member" | "viewer";
}

export interface IBoard extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  owner: Types.ObjectId;
  members: IBoardMember[];
  columns: IBoardColumn[];
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBoardModel extends Model<IBoard> {}

const boardColumnSchema = new Schema<IBoardColumn>(
  {
    id: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { _id: false }
);

const boardMemberSchema = new Schema<IBoardMember>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "member", "viewer"],
      default: "member",
    },
  },
  { _id: false }
);

const defaultColumns: IBoardColumn[] = [
  { id: "todo", title: "To Do", order: 0 },
  { id: "in-progress", title: "In Progress", order: 1 },
  { id: "done", title: "Done", order: 2 },
];

const boardSchema = new Schema<IBoard, IBoardModel>(
  {
    title: {
      type: String,
      required: [true, "Board title is required"],
      trim: true,
      maxlength: [100, "Board title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [1000, "Board description cannot exceed 1000 characters"],
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Board owner is required"],
      index: true,
    },
    members: {
      type: [boardMemberSchema],
      default: [],
    },
    columns: {
      type: [boardColumnSchema],
      default: defaultColumns,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
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

// Indexes
boardSchema.index({ owner: 1, isArchived: 1 });
boardSchema.index({ "members.user": 1 });

export const Board =
  (mongoose.models.Board as IBoardModel) ||
  model<IBoard, IBoardModel>("Board", boardSchema);

export default Board;
import { Schema, model, Document, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  displayName: string;
  color: string;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Stable palette so each member keeps a recognisable colour across sessions.
const PALETTE = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#059669",
  "#0891b2",
  "#c026d3",
  "#65a30d",
];

export const colorForName = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 100000;
  }
  return PALETTE[hash % PALETTE.length];
};

const userSchema = new Schema<IUser>(
  {
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 32,
    },
    color: { type: String, required: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Case-insensitive uniqueness: "Sara" and "sara" are the same person.
userSchema.index({ displayName: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

export default model<IUser>("User", userSchema);

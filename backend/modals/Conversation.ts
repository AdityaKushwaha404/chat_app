import { Schema, model } from "mongoose";
import type { ConversationProps } from "../types.js";

const ConversationSchema = new Schema<ConversationProps>(
  {
    type: {
      type: String,
      enum: ["direct", "group"],
      required: true,
    },
    name: String,
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: "Message",
    },
    avatar: {
      type: String,
      default: "",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    admins: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    moderators: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

ConversationSchema.pre("save", function (next: any) {
  // @ts-ignore
  this.updatedAt = new Date();
  if (typeof next === "function") next();
});

export default model<ConversationProps>("Conversation", ConversationSchema);

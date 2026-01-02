import mongoose, { Schema } from "mongoose";
import type { MessageProps } from "../types.js";

const messageSchema = new Schema<MessageProps>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: String,
    attachment: String,
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    deletedFor: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

const Message = mongoose.model<MessageProps>("Message", messageSchema);
export default Message;

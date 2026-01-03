import { Document, Types } from "mongoose";

export interface UserProps extends Document {
  email: string;
  password: string;
  name?: string;
  avatar?: string;
  created?: Date;
  fcmTokens?: string[];
}

export interface ConversationProps extends Document {
  _id: Types.ObjectId;
  type: "direct" | "group";
  name?: string;
  participants: Types.ObjectId[];
  lastMessage?: Types.ObjectId;
  createdBy?: Types.ObjectId;
  avatar?: string;
  admins?: Types.ObjectId[];
  moderators?: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageProps extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  content?: string;
  attachment?: string;
  readBy?: Types.ObjectId[];
  deletedFor?: Types.ObjectId[];
  isDeleted?: boolean;
  deletedAt?: Date;
  replyTo?: Types.ObjectId | null;
  forwardedFromUser?: Types.ObjectId | null;
  forwardedFromChatId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

import { Socket } from "socket.io";
import { Server as SocketIOServer } from "socket.io";
import User from "../modals/User.js";
import Message from "../modals/Message.js";
import Conversation from "../modals/Conversation.js";
import { signToken } from "../utils/token.js";
import { isUserOnline } from "../socket.js";
import { sendFcmToTokens, shouldSend } from "../utils/push.js";

export async function registerUserEvent(socket: Socket, io: SocketIOServer) {
  const userId = socket.data.userId as string;
  const name = socket.data.name as string;

  // Join a room for this user
  if (userId) socket.join(`user:${userId}`);

  // Notify the client that it's registered
  socket.emit("user:registered", { userId, name });

  // Broadcast to others that user is online
  socket.broadcast.emit("user:online", { userId, name });

  // Example test ping-pong
  socket.on("test:ping", (payload: any, cb?: (res: any) => void) => {
    const res = { ok: true, echo: payload || null, from: userId };
    if (typeof cb === "function") cb(res);
  });

  // updateProfile event: update name/avatar and return new token
  socket.on("updateProfile", async (data: { name?: string; avatar?: string }, cb?: (res: any) => void) => {
    if (!userId) {
      const resp = { success: false, msg: "Unauthorized" };
      if (typeof cb === "function") cb(resp);
      return;
    }

    try {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { name: data.name, avatar: data.avatar },
        { new: true }
      );

      if (!updatedUser) {
        const resp = { success: false, msg: "User not found" };
        if (typeof cb === "function") cb(resp);
        return;
      }

      // sign new token with updated user
      const token = signToken(updatedUser as any);

      const resp = { success: true, user: updatedUser, token };
      socket.emit("updateProfile", resp);
      if (typeof cb === "function") cb(resp);
    } catch (error) {
      console.error("Error updating profile:", error);
      const resp = { success: false, msg: "Error updating profile" };
      if (typeof cb === "function") cb(resp);
    }
  });

  // getContacts: return list of users (exclude current user)
  socket.on("getContacts", async (_payload: any, cb?: (res: any) => void) => {
    const currentUserId = socket.data.userId as string;
    if (!currentUserId) {
      const resp = { success: false, msg: "Unauthorized" };
      socket.emit("getContacts", resp);
      if (typeof cb === "function") cb(resp);
      return;
    }

    try {
      const users = await User.find({ _id: { $ne: currentUserId } }, { password: 0 }).lean();

      const contacts = users.map((user: any) => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar || "",
      }));

      const resp = { success: true, data: contacts };
      socket.emit("getContacts", resp);
      if (typeof cb === "function") cb(resp);
    } catch (e) {
      const resp = { success: false, msg: "Failed to fetch contacts" };
      socket.emit("getContacts", resp);
      if (typeof cb === "function") cb(resp);
    }
  });

  // Join a conversation room and send recent messages
  socket.on("joinConversation", async (payload: { conversationId: string }, cb?: (res: any) => void) => {
    const currentUserId = socket.data.userId as string;
    const { conversationId } = payload || {};
    if (!currentUserId) {
      const resp = { success: false, msg: "Unauthorized" };
      if (typeof cb === "function") cb(resp);
      return;
    }

    try {
      const conv = await Conversation.findById(conversationId)
        .populate({ path: "participants", select: "name avatar" })
        .lean();
      if (!conv) {
        const resp = { success: false, msg: "Conversation not found" };
        if (typeof cb === "function") cb(resp);
        return;
      }

      // join room
      socket.join(`conversation:${conversationId}`);

      // fetch recent messages and enrich with sender info
      const messages = await Message.find({ conversationId }).sort({ createdAt: 1 }).limit(200).lean();

      // build sender map
      const senderIds = Array.from(new Set(messages.map((m: any) => (m.senderId ? m.senderId.toString() : null)).filter(Boolean)));
      const senders = await User.find({ _id: { $in: senderIds } }, { name: 1, avatar: 1 }).lean();
      const senderMap: any = {};
      senders.forEach((s: any) => (senderMap[s._id.toString()] = { name: s.name, avatar: s.avatar || "" }));

      const enriched = messages.map((m: any) => ({
        ...m,
        senderId: m.senderId ? m.senderId.toString() : null,
        senderName: m.senderId ? (senderMap[m.senderId.toString()]?.name || null) : null,
        senderAvatar: m.senderId ? (senderMap[m.senderId.toString()]?.avatar || null) : null,
      }));

      const resp = { success: true, conversation: conv, messages: enriched };
      socket.emit("conversation:joined", resp);
      if (typeof cb === "function") cb(resp);
    } catch (e) {
      const resp = { success: false, msg: "Failed to join conversation" };
      socket.emit("conversation:joined", resp);
      if (typeof cb === "function") cb(resp);
    }
  });

  socket.on("leaveConversation", async (payload: { conversationId: string }, cb?: (res: any) => void) => {
    const { conversationId } = payload || {};
    try {
      socket.leave(`conversation:${conversationId}`);
      const resp = { success: true };
      if (typeof cb === "function") cb(resp);
    } catch (e) {
      const resp = { success: false };
      if (typeof cb === "function") cb(resp);
    }
  });

  // Typing indicators
  socket.on("typing", (payload: { conversationId: string }) => {
    const { conversationId } = payload || {};
    socket.to(`conversation:${conversationId}`).emit("typing", { userId, name });
  });

  socket.on("stop_typing", (payload: { conversationId: string }) => {
    const { conversationId } = payload || {};
    socket.to(`conversation:${conversationId}`).emit("stop_typing", { userId });
  });

  // Subscribe to conversation room without fetching data
  socket.on("conversation:subscribe", async (payload: { conversationId: string }, cb?: (res: any) => void) => {
    try {
      const { conversationId } = payload || {};
      if (!conversationId) {
        if (typeof cb === "function") cb({ success: false, msg: "Missing conversationId" });
        return;
      }
      socket.join(`conversation:${conversationId}`);
      if (typeof cb === "function") cb({ success: true });
    } catch (e) {
      if (typeof cb === "function") cb({ success: false });
    }
  });

  socket.on("conversation:unsubscribe", async (payload: { conversationId: string }, cb?: (res: any) => void) => {
    try {
      const { conversationId } = payload || {};
      if (!conversationId) {
        if (typeof cb === "function") cb({ success: false, msg: "Missing conversationId" });
        return;
      }
      socket.leave(`conversation:${conversationId}`);
      if (typeof cb === "function") cb({ success: true });
    } catch (e) {
      if (typeof cb === "function") cb({ success: false });
    }
  });

  // Send message
  socket.on("sendMessage", async (payload: { conversationId: string; content?: string; attachment?: string; clientId?: string; replyTo?: string | null }, cb?: (res: any) => void) => {
    const currentUserId = socket.data.userId as string;
    if (!currentUserId) {
      const resp = { success: false, msg: "Unauthorized" };
      if (typeof cb === "function") cb(resp);
      return;
    }

    try {
      const { conversationId, content, attachment, clientId, replyTo } = payload || {};
      const message = await Message.create({ conversationId, senderId: currentUserId, content, attachment, replyTo: replyTo || null } as any);

      // update conversation lastMessage
      await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id, updatedAt: new Date() });

      // enrich message with sender info
      const sender = await User.findById(currentUserId, { name: 1, avatar: 1 }).lean();
      let replyPreview: any = null;
      if (replyTo) {
        const ref = await Message.findById(replyTo).lean();
        if (ref) {
          const refSender = await User.findById(ref.senderId, { name: 1 }).lean();
          replyPreview = {
            _id: ref._id.toString(),
            content: ref.content || null,
            attachment: ref.attachment || null,
            senderName: refSender?.name || null,
          };
        }
      }
      const populated = {
        ...message.toObject(),
        senderId: currentUserId,
        senderName: sender?.name || null,
        senderAvatar: sender?.avatar || null,
        clientId: clientId || undefined,
        replyPreview,
      };

      // emit to all participants in the conversation room
      io.to(`conversation:${conversationId}`).emit("message:new", populated);

      // Push notifications: send to offline participants
      try {
        const conv = await Conversation.findById(conversationId, { participants: 1 }).lean();
        if (conv && Array.isArray((conv as any).participants)) {
          for (const pid of (conv as any).participants) {
            const uid = pid.toString();
            if (uid === currentUserId) continue;
            if (isUserOnline(uid)) continue;
            const u = await User.findById(uid, { fcmTokens: 1 }).lean();
            const tokens = (u?.fcmTokens || []).filter(Boolean);
            if (tokens.length === 0) continue;
            if (!shouldSend(uid, message._id.toString())) continue;
            const preview = content ? content : (attachment ? 'Sent a photo' : 'New message');
            await sendFcmToTokens(tokens, {
              title: sender?.name || 'New message',
              body: preview,
              data: { conversationId: conversationId.toString(), messageId: message._id.toString() },
              collapseKey: message._id.toString(),
            });
          }
        }
      } catch (e) {
        console.warn('Push notification send failed', e);
      }

      const resp = { success: true, data: populated };
      if (typeof cb === "function") cb(resp);
    } catch (e) {
      console.error("sendMessage error", e);
      const resp = { success: false, msg: "Failed to send message" };
      if (typeof cb === "function") cb(resp);
    }
  });

  // Forward message to another conversation
  socket.on(
    "message:forward",
    async (payload: { sourceMessageId: string; targetConversationId: string }, cb?: (res: any) => void) => {
      const currentUserId = socket.data.userId as string;
      if (!currentUserId) {
        const resp = { success: false, msg: "Unauthorized" };
        if (typeof cb === "function") cb(resp);
        return;
      }
      try {
        const { sourceMessageId, targetConversationId } = payload || {};
        const src = await Message.findById(sourceMessageId).lean();
        if (!src) {
          if (typeof cb === "function") cb({ success: false, msg: "Source message not found" });
          return;
        }
        // create new message in target conversation
        const fwd = await Message.create({
          conversationId: targetConversationId,
          senderId: currentUserId,
          content: src.content,
          attachment: src.attachment,
          forwardedFromUser: src.senderId,
          forwardedFromChatId: src.conversationId,
        } as any);

        await Conversation.findByIdAndUpdate(targetConversationId, { lastMessage: fwd._id, updatedAt: new Date() });

        const sender = await User.findById(currentUserId, { name: 1, avatar: 1 }).lean();
        const origSender = await User.findById(src.senderId, { name: 1 }).lean();
        const populated = {
          ...fwd.toObject(),
          senderId: currentUserId,
          senderName: sender?.name || null,
          senderAvatar: sender?.avatar || null,
          forwardedFromUserName: origSender?.name || null,
        };
        io.to(`conversation:${targetConversationId}`).emit("message:new", populated);
        if (typeof cb === "function") cb({ success: true, data: populated });

        // Push to offline participants of target conversation
        try {
          const conv = await Conversation.findById(targetConversationId, { participants: 1 }).lean();
          if (conv && Array.isArray((conv as any).participants)) {
            for (const pid of (conv as any).participants) {
              const uid = pid.toString();
              if (uid === currentUserId) continue;
              if (isUserOnline(uid)) continue;
              const u = await User.findById(uid, { fcmTokens: 1 }).lean();
              const tokens = (u?.fcmTokens || []).filter(Boolean);
              if (tokens.length === 0) continue;
              if (!shouldSend(uid, fwd._id.toString())) continue;
              const preview = populated.attachment ? 'Sent a photo' : (populated.content || 'New message');
              await sendFcmToTokens(tokens, {
                title: sender?.name || 'New message',
                body: preview,
                data: { conversationId: targetConversationId.toString(), messageId: fwd._id.toString() },
                collapseKey: fwd._id.toString(),
              });
            }
          }
        } catch (e) {
          console.warn('Push notification send failed (forward)', e);
        }
      } catch (e) {
        if (typeof cb === "function") cb({ success: false, msg: "Failed to forward" });
      }
    }
  );

  // Mark message as read
  socket.on("message:read", async (payload: { conversationId: string; messageId: string }, cb?: (res: any) => void) => {
    const currentUserId = socket.data.userId as string;
    if (!currentUserId) {
      const resp = { success: false, msg: "Unauthorized" };
      if (typeof cb === "function") cb(resp);
      return;
    }
    try {
      const { messageId, conversationId } = payload || {};
      if (!messageId) return;
      await Message.findByIdAndUpdate(messageId, { $addToSet: { readBy: currentUserId } });
      io.to(`conversation:${conversationId}`).emit("message:read", { messageId, userId: currentUserId });
      if (typeof cb === "function") cb({ success: true });
    } catch (e) {
      if (typeof cb === "function") cb({ success: false });
    }
  });

  // Mark all messages in a conversation as read for current user
  socket.on("conversation:markRead", async (payload: { conversationId: string }, cb?: (res: any) => void) => {
    const currentUserId = socket.data.userId as string;
    if (!currentUserId) {
      const resp = { success: false, msg: "Unauthorized" };
      if (typeof cb === "function") cb(resp);
      return;
    }
    try {
      const { conversationId } = payload || {};
      if (!conversationId) {
        if (typeof cb === "function") cb({ success: false, msg: "Missing conversationId" });
        return;
      }
      const res = await Message.updateMany(
        { conversationId, senderId: { $ne: currentUserId }, readBy: { $ne: currentUserId } },
        { $addToSet: { readBy: currentUserId } }
      );
      // notify participants in the room (optional)
      io.to(`conversation:${conversationId}`).emit("conversation:read", { conversationId, userId: currentUserId });
      if (typeof cb === "function") cb({ success: true, updated: (res as any)?.modifiedCount || (res as any)?.nModified || 0 });
    } catch (e) {
      if (typeof cb === "function") cb({ success: false });
    }
  });

  // Delete messages (for me or for everyone)
  socket.on(
    "message:delete",
    async (
      payload: { conversationId: string; messageIds: string[]; scope?: "me" | "everyone" },
      cb?: (res: any) => void
    ) => {
      const currentUserId = socket.data.userId as string;
      if (!currentUserId) {
        const resp = { success: false, msg: "Unauthorized" };
        if (typeof cb === "function") cb(resp);
        return;
      }
      try {
        const { conversationId, messageIds = [], scope = "me" } = payload || {};
        if (!conversationId || !Array.isArray(messageIds) || messageIds.length === 0) {
          if (typeof cb === "function") cb({ success: false, msg: "Invalid payload" });
          return;
        }

        if (scope === "me") {
          const res = await Message.updateMany(
            { _id: { $in: messageIds }, conversationId },
            { $addToSet: { deletedFor: currentUserId } }
          );
          // notify all devices in room; clients filter by userId
          io.to(`conversation:${conversationId}`).emit("message:deleted", { conversationId, messageIds, scope, userId: currentUserId });
          if (typeof cb === "function") cb({ success: true, updated: (res as any)?.modifiedCount || 0 });
        } else {
          // only allow sender to delete for everyone
          const msgs = await Message.find({ _id: { $in: messageIds }, conversationId, senderId: currentUserId }, { _id: 1, createdAt: 1 }).lean();
          const now = Date.now();
          const allowedIds = msgs
            .filter((m: any) => {
              const ts = new Date(m.createdAt).getTime();
              return now - ts <= 2 * 60 * 1000; // 2 minutes limit
            })
            .map((m: any) => m._id.toString());
          if (allowedIds.length === 0) {
            if (typeof cb === "function") cb({ success: false, msg: "Not allowed or time limit exceeded" });
            return;
          }
          await Message.updateMany(
            { _id: { $in: allowedIds }, conversationId },
            { $set: { isDeleted: true, deletedAt: new Date(), content: null, attachment: null } }
          );
          io.to(`conversation:${conversationId}`).emit("message:deleted", { conversationId, messageIds: allowedIds, scope, userId: currentUserId });
          if (typeof cb === "function") cb({ success: true, updated: allowedIds.length });
        }
      } catch (e) {
        if (typeof cb === "function") cb({ success: false });
      }
    }
  );

  // Undo delete-for-me (remove current user from deletedFor)
  socket.on(
    "message:undelete",
    async (payload: { conversationId: string; messageIds: string[] }, cb?: (res: any) => void) => {
      const currentUserId = socket.data.userId as string;
      if (!currentUserId) {
        const resp = { success: false, msg: "Unauthorized" };
        if (typeof cb === "function") cb(resp);
        return;
      }
      try {
        const { conversationId, messageIds = [] } = payload || {};
        if (!conversationId || !Array.isArray(messageIds) || messageIds.length === 0) {
          if (typeof cb === "function") cb({ success: false, msg: "Invalid payload" });
          return;
        }
        const res = await Message.updateMany(
          { _id: { $in: messageIds }, conversationId },
          { $pull: { deletedFor: currentUserId } }
        );
        io.to(`conversation:${conversationId}`).emit("message:undeleted", { conversationId, messageIds, userId: currentUserId });
        if (typeof cb === "function") cb({ success: true, updated: (res as any)?.modifiedCount || 0 });
      } catch (e) {
        if (typeof cb === "function") cb({ success: false });
      }
    }
  );

  // Handle disconnect
  socket.on("disconnect", (reason) => {
    socket.broadcast.emit("user:offline", { userId, name, reason });
  });
}

export default { registerUserEvent };

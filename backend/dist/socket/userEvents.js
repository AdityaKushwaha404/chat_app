import User from "../modals/User.js";
import Message from "../modals/Message.js";
import Conversation from "../modals/Conversation.js";
import { signToken } from "../utils/token.js";
export async function registerUserEvent(socket, io) {
    const userId = socket.data.userId;
    const name = socket.data.name;
    // Join a room for this user
    if (userId)
        socket.join(`user:${userId}`);
    // Notify the client that it's registered
    socket.emit("user:registered", { userId, name });
    // Broadcast to others that user is online
    socket.broadcast.emit("user:online", { userId, name });
    // Example test ping-pong
    socket.on("test:ping", (payload, cb) => {
        const res = { ok: true, echo: payload || null, from: userId };
        if (typeof cb === "function")
            cb(res);
    });
    // updateProfile event: update name/avatar and return new token
    socket.on("updateProfile", async (data, cb) => {
        if (!userId) {
            const resp = { success: false, msg: "Unauthorized" };
            if (typeof cb === "function")
                cb(resp);
            return;
        }
        try {
            const updatedUser = await User.findByIdAndUpdate(userId, { name: data.name, avatar: data.avatar }, { new: true });
            if (!updatedUser) {
                const resp = { success: false, msg: "User not found" };
                if (typeof cb === "function")
                    cb(resp);
                return;
            }
            // sign new token with updated user
            const token = signToken(updatedUser);
            const resp = { success: true, user: updatedUser, token };
            socket.emit("updateProfile", resp);
            if (typeof cb === "function")
                cb(resp);
        }
        catch (error) {
            console.error("Error updating profile:", error);
            const resp = { success: false, msg: "Error updating profile" };
            if (typeof cb === "function")
                cb(resp);
        }
    });
    // getContacts: return list of users (exclude current user)
    socket.on("getContacts", async (_payload, cb) => {
        const currentUserId = socket.data.userId;
        if (!currentUserId) {
            const resp = { success: false, msg: "Unauthorized" };
            socket.emit("getContacts", resp);
            if (typeof cb === "function")
                cb(resp);
            return;
        }
        try {
            const users = await User.find({ _id: { $ne: currentUserId } }, { password: 0 }).lean();
            const contacts = users.map((user) => ({
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                avatar: user.avatar || "",
            }));
            const resp = { success: true, data: contacts };
            socket.emit("getContacts", resp);
            if (typeof cb === "function")
                cb(resp);
        }
        catch (e) {
            const resp = { success: false, msg: "Failed to fetch contacts" };
            socket.emit("getContacts", resp);
            if (typeof cb === "function")
                cb(resp);
        }
    });
    // Join a conversation room and send recent messages
    socket.on("joinConversation", async (payload, cb) => {
        const currentUserId = socket.data.userId;
        const { conversationId } = payload || {};
        if (!currentUserId) {
            const resp = { success: false, msg: "Unauthorized" };
            if (typeof cb === "function")
                cb(resp);
            return;
        }
        try {
            const conv = await Conversation.findById(conversationId)
                .populate({ path: "participants", select: "name avatar" })
                .lean();
            if (!conv) {
                const resp = { success: false, msg: "Conversation not found" };
                if (typeof cb === "function")
                    cb(resp);
                return;
            }
            // join room
            socket.join(`conversation:${conversationId}`);
            // fetch recent messages and enrich with sender info
            const messages = await Message.find({ conversationId }).sort({ createdAt: 1 }).limit(200).lean();
            // build sender map
            const senderIds = Array.from(new Set(messages.map((m) => (m.senderId ? m.senderId.toString() : null)).filter(Boolean)));
            const senders = await User.find({ _id: { $in: senderIds } }, { name: 1, avatar: 1 }).lean();
            const senderMap = {};
            senders.forEach((s) => (senderMap[s._id.toString()] = { name: s.name, avatar: s.avatar || "" }));
            const enriched = messages.map((m) => ({
                ...m,
                senderId: m.senderId ? m.senderId.toString() : null,
                senderName: m.senderId ? (senderMap[m.senderId.toString()]?.name || null) : null,
                senderAvatar: m.senderId ? (senderMap[m.senderId.toString()]?.avatar || null) : null,
            }));
            const resp = { success: true, conversation: conv, messages: enriched };
            socket.emit("conversation:joined", resp);
            if (typeof cb === "function")
                cb(resp);
        }
        catch (e) {
            const resp = { success: false, msg: "Failed to join conversation" };
            socket.emit("conversation:joined", resp);
            if (typeof cb === "function")
                cb(resp);
        }
    });
    socket.on("leaveConversation", async (payload, cb) => {
        const { conversationId } = payload || {};
        try {
            socket.leave(`conversation:${conversationId}`);
            const resp = { success: true };
            if (typeof cb === "function")
                cb(resp);
        }
        catch (e) {
            const resp = { success: false };
            if (typeof cb === "function")
                cb(resp);
        }
    });
    // Typing indicators
    socket.on("typing", (payload) => {
        const { conversationId } = payload || {};
        socket.to(`conversation:${conversationId}`).emit("typing", { userId, name });
    });
    socket.on("stop_typing", (payload) => {
        const { conversationId } = payload || {};
        socket.to(`conversation:${conversationId}`).emit("stop_typing", { userId });
    });
    // Subscribe to conversation room without fetching data
    socket.on("conversation:subscribe", async (payload, cb) => {
        try {
            const { conversationId } = payload || {};
            if (!conversationId) {
                if (typeof cb === "function")
                    cb({ success: false, msg: "Missing conversationId" });
                return;
            }
            socket.join(`conversation:${conversationId}`);
            if (typeof cb === "function")
                cb({ success: true });
        }
        catch (e) {
            if (typeof cb === "function")
                cb({ success: false });
        }
    });
    socket.on("conversation:unsubscribe", async (payload, cb) => {
        try {
            const { conversationId } = payload || {};
            if (!conversationId) {
                if (typeof cb === "function")
                    cb({ success: false, msg: "Missing conversationId" });
                return;
            }
            socket.leave(`conversation:${conversationId}`);
            if (typeof cb === "function")
                cb({ success: true });
        }
        catch (e) {
            if (typeof cb === "function")
                cb({ success: false });
        }
    });
    // Send message
    socket.on("sendMessage", async (payload, cb) => {
        const currentUserId = socket.data.userId;
        if (!currentUserId) {
            const resp = { success: false, msg: "Unauthorized" };
            if (typeof cb === "function")
                cb(resp);
            return;
        }
        try {
            const { conversationId, content, attachment, clientId } = payload || {};
            const message = await Message.create({ conversationId, senderId: currentUserId, content, attachment });
            // update conversation lastMessage
            await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id, updatedAt: new Date() });
            // enrich message with sender info
            const sender = await User.findById(currentUserId, { name: 1, avatar: 1 }).lean();
            const populated = {
                ...message.toObject(),
                senderId: currentUserId,
                senderName: sender?.name || null,
                senderAvatar: sender?.avatar || null,
                clientId: clientId || undefined,
            };
            // emit to all participants in the conversation room
            io.to(`conversation:${conversationId}`).emit("message:new", populated);
            const resp = { success: true, data: populated };
            if (typeof cb === "function")
                cb(resp);
        }
        catch (e) {
            console.error("sendMessage error", e);
            const resp = { success: false, msg: "Failed to send message" };
            if (typeof cb === "function")
                cb(resp);
        }
    });
    // Mark message as read
    socket.on("message:read", async (payload, cb) => {
        const currentUserId = socket.data.userId;
        if (!currentUserId) {
            const resp = { success: false, msg: "Unauthorized" };
            if (typeof cb === "function")
                cb(resp);
            return;
        }
        try {
            const { messageId, conversationId } = payload || {};
            if (!messageId)
                return;
            await Message.findByIdAndUpdate(messageId, { $addToSet: { readBy: currentUserId } });
            io.to(`conversation:${conversationId}`).emit("message:read", { messageId, userId: currentUserId });
            if (typeof cb === "function")
                cb({ success: true });
        }
        catch (e) {
            if (typeof cb === "function")
                cb({ success: false });
        }
    });
    // Mark all messages in a conversation as read for current user
    socket.on("conversation:markRead", async (payload, cb) => {
        const currentUserId = socket.data.userId;
        if (!currentUserId) {
            const resp = { success: false, msg: "Unauthorized" };
            if (typeof cb === "function")
                cb(resp);
            return;
        }
        try {
            const { conversationId } = payload || {};
            if (!conversationId) {
                if (typeof cb === "function")
                    cb({ success: false, msg: "Missing conversationId" });
                return;
            }
            const res = await Message.updateMany({ conversationId, senderId: { $ne: currentUserId }, readBy: { $ne: currentUserId } }, { $addToSet: { readBy: currentUserId } });
            // notify participants in the room (optional)
            io.to(`conversation:${conversationId}`).emit("conversation:read", { conversationId, userId: currentUserId });
            if (typeof cb === "function")
                cb({ success: true, updated: res?.modifiedCount || res?.nModified || 0 });
        }
        catch (e) {
            if (typeof cb === "function")
                cb({ success: false });
        }
    });
    // Handle disconnect
    socket.on("disconnect", (reason) => {
        socket.broadcast.emit("user:offline", { userId, name, reason });
    });
}
export default { registerUserEvent };
//# sourceMappingURL=userEvents.js.map
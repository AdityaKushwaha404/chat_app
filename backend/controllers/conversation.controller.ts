import { Request, Response } from "express";
import Conversation from "../modals/Conversation.js";
import Message from "../modals/Message.js";
import mongoose from "mongoose";

export const createConversation = async (req: Request & { user?: any }, res: Response) => {
  try {
    const payload = req.body;
    const currentUserId = req.user?.id || null;

    if (!payload || !payload.participants || !Array.isArray(payload.participants)) {
      return res.status(400).json({ success: false, msg: "Invalid payload" });
    }

    const participants = Array.from(new Set([...(payload.participants || []), ...(currentUserId ? [currentUserId] : [])]));

    if (payload.type === "direct") {
      // ensure two participants for direct
      if (participants.length < 2) return res.status(400).json({ success: false, msg: "Need two participants" });

      // try to find existing direct conversation with same members
      // Match conversations that contain both participant ids; then ensure it's exactly 2 members
      const existing = await Conversation.findOne({ type: "direct", participants: { $all: participants } }).lean();
      if (existing && Array.isArray(existing.participants) && existing.participants.length === 2) {
        return res.json({ success: true, data: existing });
      }
    }

    const conv = await Conversation.create({
      type: payload.type,
      name: payload.name || (payload.type === "group" ? "New Group" : null),
      participants,
      avatar: payload.avatar || "",
      createdBy: currentUserId || undefined,
      admins: currentUserId ? [currentUserId] : [],
    } as any);

    return res.json({ success: true, data: conv });
  } catch (err) {
    console.error("createConversation error", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

export const listMyConversations = async (req: Request & { user?: any }, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) return res.status(401).json({ success: false, msg: "Unauthorized" });

    const convs = await Conversation.find({ participants: currentUserId })
      .populate({ path: "participants", select: "name avatar" })
      .populate({ path: "lastMessage" })
      .sort({ updatedAt: -1 })
      .lean();

    // Aggregate unread counts for all conversations in one query for performance
    const convIds = convs.map((c: any) => c._id);
    const userObjId = new mongoose.Types.ObjectId(currentUserId);
    const counts = await Message.aggregate([
      { $match: { conversationId: { $in: convIds }, senderId: { $ne: userObjId }, readBy: { $ne: userObjId } } },
      { $group: { _id: "$conversationId", unreadCount: { $sum: 1 } } },
    ]);
    const countsMap: Record<string, number> = {};
    counts.forEach((c: any) => {
      countsMap[c._id?.toString?.() || c._id] = c.unreadCount || 0;
    });

    const mapped = convs.map((c: any) => {
      const last = c.lastMessage
        ? { content: c.lastMessage.content || "", createdAt: c.lastMessage.createdAt?.toISOString?.() || c.lastMessage.createdAt, readBy: c.lastMessage.readBy || [] }
        : null;
      let name = c.name || "";
      let avatar = c.avatar || "";
      if (c.type === "direct") {
        const others = (c.participants || []).filter((p: any) => p && p._id && p._id.toString() !== currentUserId);
        if (others.length > 0) {
          name = others[0].name || name || "Direct Chat";
          avatar = others[0].avatar || "";
        }
      }
      return {
        _id: c._id.toString(),
        type: c.type,
        name,
        avatar,
        lastMessage: last,
        unreadCount: countsMap[c._id.toString()] || 0,
      };
    });

    return res.json({ success: true, data: mapped });
  } catch (err) {
    console.error("listMyConversations error", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

export default { createConversation, listMyConversations };

export const getConversation = async (req: Request & { user?: any }, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, msg: "Missing id" });
    const conv = await Conversation.findById(id)
      .populate({ path: "participants", select: "name avatar email" })
      .populate({ path: "createdBy", select: "name _id" })
      .lean();
    if (!conv) return res.status(404).json({ success: false, msg: "Conversation not found" });
    // include admins/moderators arrays for role-aware UI
    const data = { ...conv, admins: (conv as any).admins || [], moderators: (conv as any).moderators || [] } as any;
    return res.json({ success: true, data });
  } catch (err) {
    console.error("getConversation error", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

export const updateConversation = async (req: Request & { user?: any }, res: Response) => {
  try {
    const id = req.params.id;
    const payload = req.body || {};
    const currentUserId = req.user?.id;
    if (!id) return res.status(400).json({ success: false, msg: "Missing id" });
    const conv: any = await Conversation.findById(id);
    if (!conv) return res.status(404).json({ success: false, msg: "Conversation not found" });
    // only creator or admins can update group meta
    const isAdmin = conv.admins && Array.isArray(conv.admins) && currentUserId && conv.admins.map((a: any) => a.toString()).includes(currentUserId.toString());
    const isCreator = conv.createdBy && currentUserId && conv.createdBy.toString() === currentUserId.toString();
    if (conv.type === "group" && !isCreator && !isAdmin) {
      return res.status(403).json({ success: false, msg: "Not allowed" });
    }
    if (payload.name) conv.name = payload.name;
    if (payload.avatar) conv.avatar = payload.avatar;
    await conv.save();
    const updated = await Conversation.findById(id).populate({ path: "participants", select: "name avatar email" }).populate({ path: "createdBy", select: "name _id" }).lean();
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("updateConversation error", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

import User from "../modals/User.js";
export const addMembers = async (req: Request & { user?: any }, res: Response) => {
  try {
    const id = req.params.id;
    const { members, emails } = req.body || {};
    const currentUserId = req.user?.id;
    if (!id) return res.status(400).json({ success: false, msg: "Missing id" });
    const conv: any = await Conversation.findById(id);
    if (!conv) return res.status(404).json({ success: false, msg: "Conversation not found" });
    // only group allowed
    if (conv.type !== "group") return res.status(400).json({ success: false, msg: "Cannot add members to direct conversation" });

    // only creator or admins can add members
    const isAdmin = conv.admins && Array.isArray(conv.admins) && currentUserId && conv.admins.map((a: any) => a.toString()).includes(currentUserId.toString());
    const isCreator = conv.createdBy && currentUserId && conv.createdBy.toString() === currentUserId.toString();
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ success: false, msg: "Not allowed" });
    }

    const toAdd: string[] = Array.isArray(members) ? members.slice() : [];
    if (Array.isArray(emails) && emails.length > 0) {
      // resolve emails to user ids where possible
      const users = await User.find({ email: { $in: emails.map((e: string) => (e || "").toLowerCase().trim()) } }).lean();
      users.forEach((u: any) => toAdd.push(u._id.toString()));
    }

    // merge unique
    const existing = (conv.participants || []).map((p: any) => p.toString());
    const merged = Array.from(new Set([...existing, ...toAdd]));

    const before = existing.slice();
    conv.participants = merged;
    await conv.save();
    const updated = await Conversation.findById(id).populate({ path: "participants", select: "name avatar email" }).populate({ path: "createdBy", select: "name _id" }).lean();

    // notify via sockets
    try {
      const socketModule = require('../socket');
      const io = socketModule && socketModule.getIO ? socketModule.getIO() : null;
      const added = merged.filter((m: any) => !before.includes(m));
      if (io) {
        io.to(`conversation:${id}`).emit('conversation:members:added', { conversationId: id, added });
        added.forEach((uid: string) => {
          io.to(`user:${uid}`).emit('invited:conversation', { conversationId: id, conversation: updated });
        });
      }
    } catch (e) {
      console.warn('Failed to emit socket notifications on addMembers', e);
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("addMembers error", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

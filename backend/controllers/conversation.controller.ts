import { Request, Response } from "express";
import Conversation from "../modals/Conversation.js";

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

    const mapped = convs.map((c: any) => {
      const last = c.lastMessage
        ? { content: c.lastMessage.content || "", createdAt: c.lastMessage.createdAt?.toISOString?.() || c.lastMessage.createdAt }
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
      };
    });

    return res.json({ success: true, data: mapped });
  } catch (err) {
    console.error("listMyConversations error", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

export default { createConversation, listMyConversations };

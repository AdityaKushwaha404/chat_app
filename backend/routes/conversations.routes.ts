import { Router } from "express";
import { createConversation, listMyConversations, getConversation, updateConversation, addMembers } from "../controllers/conversation.controller.js";
import requireAuth from "../middleware/auth.middleware.js";

const router = Router();

// attach optional auth so controller can use req.user if present
router.post("/", requireAuth, createConversation);
router.get("/", requireAuth, listMyConversations);
router.get("/:id", requireAuth, getConversation);
router.put("/:id", requireAuth, updateConversation);
router.post("/:id/members", requireAuth, addMembers);

export default router;

import { Router } from "express";
import { createConversation, listMyConversations } from "../controllers/conversation.controller.js";
import requireAuth from "../middleware/auth.middleware.js";

const router = Router();

// attach optional auth so controller can use req.user if present
router.post("/", requireAuth, createConversation);
router.get("/", requireAuth, listMyConversations);

export default router;

import { Router } from "express";
import { listUsers, getUser, savePushToken } from "../controllers/user.controller.js";
import requireAuth from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, listUsers);
router.get("/:id", getUser);
router.post("/push-token", requireAuth, savePushToken);

export default router;

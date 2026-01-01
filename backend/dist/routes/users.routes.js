import { Router } from "express";
import { listUsers, getUser } from "../controllers/user.controller.js";
import requireAuth from "../middleware/auth.middleware.js";
const router = Router();
router.get("/", requireAuth, listUsers);
router.get("/:id", getUser);
export default router;
//# sourceMappingURL=users.routes.js.map
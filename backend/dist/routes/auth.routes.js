import { Router } from "express";
import { registerUser, loginUser, verifyTokenHandler } from "../controllers/auth.controller.js";
const router = Router();
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/verify", verifyTokenHandler);
export default router;
//# sourceMappingURL=auth.routes.js.map
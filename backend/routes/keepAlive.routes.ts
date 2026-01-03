import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

/**
 * GET /api/keep-alive
 * Performs a lightweight DB operation to keep MongoDB Atlas awake.
 * Does not return any real data.
 */
router.get("/", async (req, res) => {
  try {
    // Use the low-level admin ping if available for a minimal operation
    const admin = mongoose.connection.db.admin();
    // ping returns { ok: 1 }
    await admin.ping();

    return res.json({ status: "ok", message: "Database is alive" });
  } catch (err) {
    // Log error server-side, but return a generic message
    console.error("Keep-alive ping failed:", err);
    return res.status(503).json({ status: "error", message: "Database ping failed" });
  }
});

export default router;

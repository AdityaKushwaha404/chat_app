import { Request, Response } from "express";
import User from "../modals/User.js";

export const listUsers = async (req: Request & { user?: any }, res: Response) => {
  try {
    const q = (req.query.search as string) || "";
    const filter: any = {};
    if (q) filter.$or = [{ name: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }];

    // Exclude current user if authenticated
    const currentUserId = req.user?.id;
    if (currentUserId) filter._id = { $ne: currentUserId } as any;

    const users = await User.find(filter, { password: 0 }).lean();
    const mapped = users.map((u: any) => ({ _id: u._id.toString(), name: u.name, email: u.email, avatar: u.avatar || "" }));
    res.json(mapped);
  } catch (err) {
    console.error("listUsers error", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

export const getUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const user = await User.findById(id, { password: 0 }).lean();
    if (!user) return res.status(404).json({ success: false, msg: "Not found" });
    res.json({ _id: user._id.toString(), name: user.name, email: user.email, avatar: user.avatar || "" });
  } catch (err) {
    console.error("getUser error", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

export default { listUsers, getUser };

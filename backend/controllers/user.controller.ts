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

export const savePushToken = async (req: Request & { user?: any }, res: Response) => {
  try {
    const userId = req.user?.id;
    const { token } = (req.body || {}) as { token?: string };
    if (!userId) return res.status(401).json({ success: false, msg: 'Unauthorized' });
    if (!token) return res.status(400).json({ success: false, msg: 'Missing token' });
    const updated = await User.findByIdAndUpdate(userId, { $addToSet: { fcmTokens: token } }, { new: true }).lean();
    return res.json({ success: true, tokens: updated?.fcmTokens || [] });
  } catch (err) {
    console.error('savePushToken error', err);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
};
 
// Register or remove device FCM token for current user
export const registerFcmToken = async (req: Request & { user?: any }, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const { token, action } = req.body || {};
    if (!currentUserId || !token) return res.status(400).json({ success: false, msg: 'Missing token or user' });
    const update: any = {};
    if (action === 'remove') update.$pull = { fcmTokens: token };
    else update.$addToSet = { fcmTokens: token };
    await User.findByIdAndUpdate(currentUserId, update, { new: true });
    res.json({ success: true });
  } catch (err) {
    console.error('registerFcmToken error', err);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
};

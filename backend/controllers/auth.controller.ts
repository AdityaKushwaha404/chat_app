import { Request, Response } from "express";
import User from "../modals/User.js";
import bcrypt from "bcryptjs";
import { signToken } from "../utils/token.js";

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password, avatar } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, msg: "Missing required fields" });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, msg: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const user = new User({ name, email: email.toLowerCase().trim(), password: hashed, avatar });
    await user.save();

    const token = signToken(user);

    return res.status(201).json({ success: true, data: { token } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, msg: "Missing credentials" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ success: false, msg: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, msg: "Invalid credentials" });
    }

    const token = signToken(user);
    return res.json({ success: true, data: { token } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

export const verifyTokenHandler = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, msg: "No token provided" });
    const parts = authHeader.split(" ");
    const token = parts.length === 2 ? parts[1] : authHeader;
    try {
      const payload: any = await import("../utils/token.js").then((m) => m.verifyToken(token as string));
      return res.json({ success: true, data: { user: payload.user } });
    } catch (err) {
      return res.status(401).json({ success: false, msg: "Invalid or expired token" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
};

export default { registerUser, loginUser };

import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/token.js";

export interface AuthRequest extends Request {
  user?: any;
}

export const requireAuth = (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const authHeader = (req.headers.authorization as string) || req.cookies?.token || "";
    if (!authHeader) return next();
    let raw = authHeader;
    if (raw.startsWith("Bearer ")) raw = raw.split(" ")[1];
    try {
      const payload: any = verifyToken(raw as string);
      if (payload && payload.user) {
        req.user = payload.user;
      }
    } catch (e) {
      // invalid token: ignore and continue as anonymous
    }
    return next();
  } catch (err) {
    return next();
  }
};

export default requireAuth;

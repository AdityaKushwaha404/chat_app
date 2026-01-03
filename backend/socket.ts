import dotenv from "dotenv";
import { Server as SocketIOServer, Socket } from "socket.io";
import http from "http";
import { registerUserEvent } from "./socket/userEvents.js";
import { verifyToken } from "./utils/token.js";

dotenv.config();

let ioInstance: SocketIOServer | null = null;
const presence = new Map<string, number>(); // userId -> connection count

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

export function isUserOnline(userId: string): boolean {
  return (presence.get(userId) || 0) > 0;
}

export function initializeSocket(server: http.Server) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
    },
  });

  // JWT Authentication Middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
      let raw = token as string | undefined;
      if (!raw) return next(new Error("Authentication error: no token provided"));
      // support `Bearer <token>`
      if (raw.startsWith("Bearer ")) raw = raw.split(" ")[1];
      try {
        const payload: any = verifyToken(raw as string);
        if (!payload) return next(new Error("Authentication error: invalid token"));
        const user = payload.user;
        socket.data.userId = user.id;
        socket.data.name = user.name;
        socket.data.email = user.email;
        return next();
      } catch (err) {
        return next(new Error("Authentication error: invalid token"));
      }
    } catch (err) {
      return next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket: Socket) => {
    try {
      const uid = (socket as any).data?.userId as string | undefined;
      if (uid) presence.set(uid, (presence.get(uid) || 0) + 1);
      registerUserEvent(socket, io);
    } catch (err) {
      console.error("Socket connection error:", err);
    }
    socket.on("disconnect", () => {
      const uid = (socket as any).data?.userId as string | undefined;
      if (uid) {
        const n = (presence.get(uid) || 1) - 1;
        if (n <= 0) presence.delete(uid);
        else presence.set(uid, n);
      }
    });
  });

  ioInstance = io;
  return io;
}

export default initializeSocket;

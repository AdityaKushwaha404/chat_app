import dotenv from "dotenv";
import { Server as SocketIOServer, Socket } from "socket.io";
import http from "http";
import { registerUserEvent } from "./socket/userEvents.js";
import { verifyToken } from "./utils/token.js";

dotenv.config();

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
      registerUserEvent(socket, io);
    } catch (err) {
      console.error("Socket connection error:", err);
    }
  });

  return io;
}

export default initializeSocket;

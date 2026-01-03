import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import conversationsRoutes from "./routes/conversations.routes.js";
import keepAliveRoutes from "./routes/keepAlive.routes.js";
import { initializeSocket } from "./socket.js";
import { scheduleKeepAlive } from "./utils/keepAlive.js";

dotenv.config();

const app = express();

/* Middlewares */
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server is running");
});

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

connectDB().then(() => {
    server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);

  // initialize socket server
  try {
    const io = initializeSocket(server as any);
    console.log("Socket server initialized");
  } catch (err) {
    console.warn("Failed to initialize socket server:", err);
  }

  // Schedule keep-alive ping job to keep MongoDB Atlas from sleeping
  try {
    const endpoint = process.env.KEEP_ALIVE_ENDPOINT || `http://localhost:${PORT}/api/keep-alive`;
    scheduleKeepAlive(endpoint);
  } catch (err) {
    console.warn("Failed to schedule keep-alive job:", err);
  }

});
}).catch((error) => {
    console.error("Failed to connect to the database:", error);
    process.exit(1);
});

// Mount auth routes
app.use('/api/auth', authRoutes);

// Mount keep-alive route (simple DB ping)
app.use('/api/keep-alive', keepAliveRoutes);

// Mount users and conversations
app.use('/api/users', usersRoutes);
app.use('/api/conversations', conversationsRoutes);





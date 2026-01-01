import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import conversationsRoutes from "./routes/conversations.routes.js";
import { initializeSocket } from "./socket.js";

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

});
}).catch((error) => {
    console.error("Failed to connect to the database:", error);
    process.exit(1);
});

// Mount auth routes
app.use('/api/auth', authRoutes);

// Mount users and conversations
app.use('/api/users', usersRoutes);
app.use('/api/conversations', conversationsRoutes);





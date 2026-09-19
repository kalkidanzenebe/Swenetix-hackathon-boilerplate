import express, { Express, Request, Response } from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import { conn } from "./config/db";
import { initSockets } from "./sockets";
import authRoutes from "./routes/auth";
import taskRoutes from "./routes/tasks";
import { notFound, errorHandler } from "./middleware/miscellaneous";

const app: Express = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
conn();

// Middleware
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create HTTP server for both Express and Socket.IO
const server = http.createServer(app);

// Initialize Socket.IO
const io = initSockets(server);
app.set("io", io);

// Health check route
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Real-time Collaborative Task Board API running",
    sockets: true,
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

// Listen on HTTP server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server active and ready`);
});

export default app;

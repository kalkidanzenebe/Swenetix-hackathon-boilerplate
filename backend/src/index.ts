import http from "http";
import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import { conn } from "./config/db";
import authRoutes from "./routes/auth";
import taskRoutes from "./routes/tasks";
import { errorHandler, notFound } from "./middleware/miscellaneous";
import { attachRealtime } from "./realtime/socket";

const app: Express = express();
const PORT = Number(process.env.PORT) || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: "Task board API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);

app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
attachRealtime(server, CLIENT_ORIGIN);

const start = async (): Promise<void> => {
  try {
    await conn();
  } catch (err) {
    console.error("Could not reach MongoDB:", (err as Error).message);
    process.exit(1);
  }

  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Realtime board accepting clients from ${CLIENT_ORIGIN}`);
  });
};

void start();

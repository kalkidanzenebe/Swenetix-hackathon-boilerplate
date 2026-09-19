import { Response, NextFunction } from "express";
import { verifyToken } from "../utils/token";
import { AuthedRequest } from "../types";

export const requireAuth = (
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const user = token ? verifyToken(token) : null;

  if (!user) {
    res.status(401).json({ success: false, message: "Sign in with a display name first" });
    return;
  }

  req.user = user;
  next();
};

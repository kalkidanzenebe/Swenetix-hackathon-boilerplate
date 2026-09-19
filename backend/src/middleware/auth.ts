import { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized: No token provided" });
  }
  return next();
};
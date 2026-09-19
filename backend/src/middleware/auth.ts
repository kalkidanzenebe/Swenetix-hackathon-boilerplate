import { Response, NextFunction } from "express";
import { verifyToken as verifyDisplayToken, createToken, TokenPayload } from "../utils/token";
import { AuthedRequest } from "../types";

export { createToken, TokenPayload };
export type AuthRequest = AuthedRequest;

export const generateToken = (userId: string, name?: string, color?: string): string => {
  return createToken({
    id: userId,
    displayName: name || "User",
    color: color || "#2563eb",
  });
};

export const verifyToken = (token: string): any => {
  const payload = verifyDisplayToken(token);
  if (payload) {
    return { userId: payload.id, ...payload };
  }
  return null;
};

export const requireAuth = (
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const guestUserId = req.headers["x-user-id"] as string | undefined;

    if (!token && !guestUserId) {
      res.status(401).json({ success: false, message: "Please sign in first" });
      return;
    }

    let userPayload: any = null;
    if (token) {
      userPayload = verifyToken(token);
      if (!userPayload) {
        res.status(401).json({ success: false, message: "Invalid or expired token" });
        return;
      }
    } else if (guestUserId) {
      userPayload = { id: guestUserId, userId: guestUserId, displayName: "Guest", color: "#2563eb" };
    }

    req.user = userPayload;
    req.userId = userPayload.id || userPayload.userId;
    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = (
  req: AuthedRequest,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const guestUserId = req.headers["x-user-id"] as string | undefined;

    let userPayload: any = null;
    if (token) {
      userPayload = verifyToken(token);
    } else if (guestUserId) {
      userPayload = { id: guestUserId, userId: guestUserId, displayName: "Guest", color: "#2563eb" };
    }

    if (userPayload) {
      req.user = userPayload;
      req.userId = userPayload.id || userPayload.userId;
    }
    next();
  } catch {
    next();
  }
};

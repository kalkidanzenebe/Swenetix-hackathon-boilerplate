import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { User, IUser } from "../models/User";

const JWT_SECRET = process.env.JWT_SECRET || "hackathon-secret-jwt-key-2026";

declare global {
  namespace Express {
    interface User extends IUser {}
    interface Request {
      user?: IUser;
      userId?: string;
    }
  }
}

export type AuthRequest = Request;

// Generate simple HMAC signed token for session
export const generateToken = (userId: string): string => {
  const payload = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
};

// Verify HMAC signed token
export const verifyToken = (token: string): { userId: string } | null => {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(payload).digest("base64url");
    if (signature !== expectedSig) return null;

    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data;
  } catch {
    return null;
  }
};

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    // Also support passing guest user ID directly in header for simple hackathon integration
    const guestUserId = req.headers["x-user-id"] as string | undefined;

    if (!token && !guestUserId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    let userId: string | undefined;

    if (token) {
      const decoded = verifyToken(token);
      if (!decoded) {
        res.status(401).json({ success: false, message: "Invalid or expired token" });
        return;
      }
      userId = decoded.userId;
    } else if (guestUserId) {
      userId = guestUserId;
    }

    if (!userId) {
      res.status(401).json({ success: false, message: "User identification missing" });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(401).json({ success: false, message: "User not found" });
      return;
    }

    req.user = user;
    req.userId = user._id.toString();
    next();
  } catch (error) {
    next(error);
  }
};

// Optional auth middleware for guest actions
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const guestUserId = req.headers["x-user-id"] as string | undefined;

    let userId = guestUserId;
    if (token) {
      const decoded = verifyToken(token);
      if (decoded) userId = decoded.userId;
    }

    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        req.user = user;
        req.userId = user._id.toString();
      }
    }
    next();
  } catch {
    next();
  }
};
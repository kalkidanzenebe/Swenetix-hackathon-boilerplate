import { Router, Request, Response } from "express";
import { User, colorForName } from "../models/User";
import { generateToken, requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// ==========================================
// 1. GUEST LOGIN (Milestone 3 - Simple display name)
// ==========================================
router.post("/guest", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const displayName = (name || "Guest").trim();

    // Check if user already exists or create new guest user
    const guestEmail = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@guest.local`;
    const user = new User({
      name: displayName,
      email: guestEmail,
      color: colorForName(displayName),
      authProvider: "email",
      isEmailVerified: true,
      password: "GuestPassword123!", // Dummy valid password satisfying model regex
      isOnline: true,
    });

    await user.save();
    const token = generateToken(user._id.toString());

    res.status(201).json({
      success: true,
      message: "Guest session started",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        color: user.color,
        isOnline: user.isOnline,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 2. REGISTER USER
// ==========================================
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ success: false, message: "Name, email and password are required" });
      return;
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({ success: false, message: "Email is already registered" });
      return;
    }

    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      color: colorForName(name),
      isOnline: true,
    });

    await user.save();
    const token = generateToken(user._id.toString());

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        color: user.color,
        isOnline: user.isOnline,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ==========================================
// 3. LOGIN USER
// ==========================================
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: "Email and password are required" });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    if (user.isAccountLocked()) {
      res.status(403).json({ success: false, message: "Account is temporarily locked due to failed attempts" });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incrementFailedAttempts();
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    await user.resetFailedAttempts();
    user.isOnline = true;
    await user.save();

    const token = generateToken(user._id.toString());

    res.status(200).json({
      success: true,
      message: "Logged in successfully",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        color: user.color,
        isOnline: user.isOnline,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 4. GET CURRENT USER
// ==========================================
router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        color: user.color,
        isOnline: user.isOnline,
        settings: user.settings,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
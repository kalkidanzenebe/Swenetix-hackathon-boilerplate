import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { User } from "../models/User";
import { createToken } from "../utils/token";
import { AuthedRequest } from "../types";

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

// Generate a simple color for new users
const generateColor = (): string => {
  const colors = [
    "#2563eb",
    "#7c3aed",
    "#db2777",
    "#ea580c",
    "#059669",
    "#0891b2",
    "#c026d3",
    "#65a30d",
  ];

  return colors[Math.floor(Math.random() * colors.length)];
};

/**
 * Signup with email and password
 */
export const signup = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
      return;
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      color: generateColor(),
      isOnline: true,
      authProvider: "email",
      isEmailVerified: false,
      failedLoginAttempts: 0,
      settings: {
        theme: "light",
        fontSize: 16,
        notificationsEnabled: true,
      },
    });

    const token = createToken({
        id: user._id.toString(),
        displayName: user.name,
        color: user.color,
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          color: user.color,
          avatarUrl: user.avatarUrl,
          isEmailVerified: user.isEmailVerified,
        },
      },
    });
  } catch (error) {
    console.error("Signup error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create account",
    });
  }
};

/**
 * Login with email and password
 */
export const login = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    if (user.isAccountLocked()) {
      res.status(423).json({
        success: false,
        message: "Account is temporarily locked. Please try again later.",
      });
      return;
    }

    const passwordCorrect = await user.comparePassword(password);

    if (!passwordCorrect) {
      await user.incrementFailedAttempts();

      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    await user.resetFailedAttempts();

    user.isOnline = true;
    await user.save();

        const token = createToken({
        id: user._id.toString(),
        displayName: user.name,
        color: user.color,
        });
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          color: user.color,
          avatarUrl: user.avatarUrl,
          isEmailVerified: user.isEmailVerified,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to login",
    });
  }
};

/**
 * Login with Google
 *
 * Frontend sends the Google ID token.
 */
export const googleLogin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { credential } = req.body;

    if (!credential) {
      res.status(400).json({
        success: false,
        message: "Google credential is required",
      });
      return;
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.sub || !payload.email) {
      res.status(401).json({
        success: false,
        message: "Invalid Google account",
      });
      return;
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();

    let user = await User.findOne({
      $or: [
        { googleId },
        { email },
      ],
    });

    if (!user) {
      user = await User.create({
        name: payload.name || email.split("@")[0],
        email,
        googleId,
        color: generateColor(),
        isOnline: true,
        authProvider: "google",
        avatarUrl: payload.picture,
        isEmailVerified: payload.email_verified === true,
        emailVerifiedAt:
          payload.email_verified === true
            ? new Date()
            : undefined,
        failedLoginAttempts: 0,
        settings: {
          theme: "light",
          fontSize: 16,
          notificationsEnabled: true,
        },
      });
    } else {
      user.googleId = googleId;
      user.isOnline = true;
      user.authProvider = "google";

      if (payload.picture && !user.avatarUrl) {
        user.avatarUrl = payload.picture;
      }

      if (payload.email_verified) {
        user.isEmailVerified = true;
        user.emailVerifiedAt =
          user.emailVerifiedAt || new Date();
      }

      await user.save();
    }

        const token = createToken({
        id: user._id.toString(),
        displayName: user.name,
        color: user.color,
        });
    res.status(200).json({
      success: true,
      message: "Google login successful",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          color: user.color,
          avatarUrl: user.avatarUrl,
          isEmailVerified: user.isEmailVerified,
        },
      },
    });
  } catch (error) {
    console.error("Google login error:", error);

    res.status(401).json({
      success: false,
      message: "Google authentication failed",
    });
  }
};

/**
 * Logout
 */
export const logout = async (
  req: AuthedRequest,
  res: Response
): Promise<void> => {
  try {
    if (req.user?.id) {
      await User.findByIdAndUpdate(req.user.id, {
        isOnline: false,
      });
    }

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to logout",
    });
  }
};

/**
 * Get currently authenticated user
 */
export const getMe = async (
  req: AuthedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
      return;
    }

    const user = await User.findById(req.user.id).select(
      "-password -resetPasswordToken"
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        color: user.color,
        isOnline: user.isOnline,
        authProvider: user.authProvider,
        avatarUrl: user.avatarUrl,
        isEmailVerified: user.isEmailVerified,
        settings: user.settings,
      },
    });
  } catch (error) {
    console.error("Get me error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get user",
    });
  }
};
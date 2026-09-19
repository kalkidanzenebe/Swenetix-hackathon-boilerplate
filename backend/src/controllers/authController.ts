import { Response } from "express";
import { Request } from "express";
import User, { colorForName } from "../models/User";
import { createToken } from "../utils/token";
import { AuthedRequest } from "../types";

/**
 * Display-name login: no passwords. An unseen name creates the member, a known name
 * (any casing) signs back into the same identity so their colour stays stable.
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  const raw = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";

  if (raw.length < 2 || raw.length > 32) {
    res.status(400).json({
      success: false,
      message: "Display name must be between 2 and 32 characters",
    });
    return;
  }

  let user = await User.findOne({ displayName: raw }).collation({
    locale: "en",
    strength: 2,
  });

  if (!user) {
    try {
      user = await User.create({ displayName: raw, color: colorForName(raw.toLowerCase()) });
    } catch (err) {
      // Two tabs signed in with the same new name at once; the loser reads the winner's row.
      if ((err as { code?: number }).code !== 11000) throw err;
      user = await User.findOne({ displayName: raw }).collation({
        locale: "en",
        strength: 2,
      });
    }
  }

  if (!user) {
    res.status(500).json({ success: false, message: "Could not sign in" });
    return;
  }

  user.lastSeenAt = new Date();
  await user.save();

  const payload = {
    id: user._id.toString(),
    displayName: user.displayName,
    color: user.color,
  };

  res.status(200).json({ success: true, data: { token: createToken(payload), user: payload } });
};

export const me = async (req: AuthedRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: { user: req.user } });
};

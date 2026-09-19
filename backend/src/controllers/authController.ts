import { Request, Response } from "express";
import User from "../models/User";
import { createToken } from "../utils/token";
import { describePasswordProblem, hashPassword, verifyPassword } from "../utils/password";
import { AuthedRequest } from "../types";

const nameCollation = { locale: "en", strength: 2 } as const;

const readCredentials = (
  req: Request
): { displayName: string; password: string; problem: string | null } => {
  const displayName =
    typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (displayName.length < 2 || displayName.length > 32) {
    return {
      displayName,
      password,
      problem: "Display name must be between 2 and 32 characters",
    };
  }

  return { displayName, password, problem: describePasswordProblem(password) };
};

const sessionFor = (user: { _id: { toString(): string }; displayName: string }) => {
  const payload = {
    id: user._id.toString(),
    displayName: user.displayName,
  };
  return { token: createToken(payload), user: payload };
};

export const signup = async (req: Request, res: Response): Promise<void> => {
  const { displayName, password, problem } = readCredentials(req);

  if (problem) {
    res.status(400).json({ success: false, message: problem });
    return;
  }

  const taken = await User.findOne({ displayName }).collation(nameCollation);
  if (taken) {
    res.status(409).json({
      success: false,
      message: "That display name is taken — sign in instead",
    });
    return;
  }

  try {
    const user = await User.create({
      displayName,
      passwordHash: await hashPassword(password),
    });

    res.status(201).json({ success: true, data: sessionFor(user) });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      const field = Object.keys((err as { keyPattern?: Record<string, unknown> }).keyPattern || {})[0];

      // Two people claimed the same new name at once; the loser is told to sign in.
      if (!field || field === "displayName") {
        res.status(409).json({
          success: false,
          message: "That display name is taken — sign in instead",
        });
        return;
      }
      throw new Error(
        `Signup was rejected by a unique index on "${field}". The users collection has ` +
          `indexes this app does not define; point MONGO_URI at a database of its own.`
      );
    }
    throw err;
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { displayName, password, problem } = readCredentials(req);

  if (problem) {
    res.status(400).json({ success: false, message: problem });
    return;
  }

  const user = await User.findOne({ displayName })
    .collation(nameCollation)
    .select("+passwordHash");

  const rejection = { success: false, message: "Wrong display name or password" };

  if (!user) {
    res.status(401).json(rejection);
    return;
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json(rejection);
    return;
  }

  user.lastSeenAt = new Date();
  await user.save();

  res.status(200).json({ success: true, data: sessionFor(user) });
};

export const me = async (req: AuthedRequest, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: { user: req.user } });
};

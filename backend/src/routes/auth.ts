import { Router } from "express";
import { login, me } from "../controllers/authController";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.post("/login", asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(me));

export default router;

import { Router } from "express";
import {
  listTasks,
  createTask,
  updateTask,
  moveTask,
  deleteTask,
} from "../controllers/taskController";
// import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// router.use(requireAuth);

router.get("/", asyncHandler(listTasks));
router.post("/", asyncHandler(createTask));
router.patch("/:id", asyncHandler(updateTask));
router.patch("/:id/move", asyncHandler(moveTask));
router.delete("/:id", asyncHandler(deleteTask));

export default router;
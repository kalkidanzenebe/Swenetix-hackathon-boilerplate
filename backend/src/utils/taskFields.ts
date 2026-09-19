import { PRIORITIES, Priority, STATUSES, Status } from "../models/Task";

export const isStatus = (value: unknown): value is Status =>
  typeof value === "string" && (STATUSES as readonly string[]).includes(value);

export const isPriority = (value: unknown): value is Priority =>
  typeof value === "string" && (PRIORITIES as readonly string[]).includes(value);

/** A person field is either a trimmed display name or explicitly nobody. */
export const normaliseAssignee = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 32) : null;
};

/** Trimmed, de-duplicated, capped — labels come straight from a free-text field. */
export const normaliseLabels = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  const seen: string[] = [];
  value.forEach((entry) => {
    if (typeof entry !== "string") return;
    const label = entry.trim().slice(0, 24);
    if (label && seen.indexOf(label) === -1) seen.push(label);
  });

  return seen.slice(0, 8);
};

/** Accepts an ISO string or null; anything unparseable is treated as no due date. */
export const parseDueDate = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number") return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** API response helpers */
export function apiOk<T>(data: T, status = 200): Response {
  return Response.json({ ok: true, data }, { status });
}

export function apiError(message: string, status = 400): Response {
  return Response.json({ ok: false, error: message }, { status });
}

/** Slugify org names */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Format dates for display */
export function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    import { clsx, type ClassValue } from "clsx";

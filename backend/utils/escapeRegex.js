/**
 * Escape special regex characters in a string before using it in a MongoDB
 * $regex query.  This prevents NoSQL Regex Injection (ReDoS, data exfiltration)
 * when the value originates from user input (query-string search params, etc.).
 *
 * Usage:
 *   import escapeRegex from "../utils/escapeRegex.js";
 *   const filter = { name: { $regex: escapeRegex(search), $options: "i" } };
 */
export default function escapeRegex(str) {
  return String(str ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

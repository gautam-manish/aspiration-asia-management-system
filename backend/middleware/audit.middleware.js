import AuditLog from "../models/audit-log.model.js";

const SENSITIVE_KEYS = new Set(["password", "token", "authorization", "slip"]);

function sanitize(value, depth = 0) {
  if (depth > 4) return "[MaxDepth]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, val]) => [
      key,
      SENSITIVE_KEYS.has(String(key).toLowerCase()) ? "[Redacted]" : sanitize(val, depth + 1),
    ]),
  );
}

export const auditAction = (action, entity) => (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    const responseEntityId = payload?.data?._id || payload?.data?.id || payload?._id || "";
    if (responseEntityId) res.locals.auditEntityId = String(responseEntityId);
    return originalJson(payload);
  };
  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 400) return;
    AuditLog.create({
      actor: {
        username: req.user?.username || "",
        role: req.user?.role || "",
      },
      action,
      entity,
      entityId: String(req.params?.id || req.params?.advanceId || res.locals.auditEntityId || ""),
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      ip: req.ip || req.socket?.remoteAddress || "",
      params: sanitize(req.params || {}),
      query: sanitize(req.query || {}),
      body: sanitize(req.body || {}),
    }).catch((error) => console.error("auditAction error:", error));
  });
  next();
};

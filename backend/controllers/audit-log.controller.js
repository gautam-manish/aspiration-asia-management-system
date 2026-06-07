import AuditLog from "../models/audit-log.model.js";
import escapeRegex from "../utils/escapeRegex.js";

export const getAuditLogs = async (req, res) => {
  try {
    const { search = "", entity = "", entityId = "", action = "", from = "", to = "", page = 1, limit = 50 } = req.query;
    const filter = {};

    if (entity) filter.entity = String(entity);
    if (entityId) filter.entityId = String(entityId);
    if (action) filter.action = String(action);
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
    }
    if (search) {
      const escaped = escapeRegex(search);
      filter.$or = [
        { "actor.username": { $regex: escaped, $options: "i" } },
        { "actor.role": { $regex: escaped, $options: "i" } },
        { action: { $regex: escaped, $options: "i" } },
        { entity: { $regex: escaped, $options: "i" } },
        { entityId: { $regex: escaped, $options: "i" } },
        { path: { $regex: escaped, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;
    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      AuditLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: logs,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (error) {
    console.error("getAuditLogs error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch audit logs.", data: null });
  }
};

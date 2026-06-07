import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      username: { type: String, trim: true, default: "" },
      role: { type: String, trim: true, default: "" },
    },
    action: { type: String, trim: true, required: true, index: true },
    entity: { type: String, trim: true, required: true, index: true },
    entityId: { type: String, trim: true, default: "", index: true },
    method: { type: String, trim: true, default: "" },
    path: { type: String, trim: true, default: "" },
    statusCode: { type: Number, default: 0 },
    ip: { type: String, trim: true, default: "" },
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    query: { type: mongoose.Schema.Types.Mixed, default: {} },
    body: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ "actor.username": 1, createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);

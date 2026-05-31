// Disk-storage uploader for payment slips.
//
// Where files go:
// - If UPLOAD_DIR is set in the environment, that path is used as the root
//   (e.g. /var/data/aspiration-uploads on a Vultr VPS — outside the repo so
//   `git pull` / fresh deploys can never wipe receipts).
// - Otherwise we fall back to ./uploads inside the project (dev default).
//
// Why disk and not GridFS / Mongo:
// - Streamed from disk by the OS; memory usage stays flat regardless of file size.
// - Backups are simpler (just include the uploads folder).
// - Database stays fast and small.

import multer from "multer";
import path   from "path";
import fs     from "fs";
import crypto from "crypto";

const UPLOAD_BASE = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve("uploads");

// Where payment-slip files live specifically.
const UPLOAD_ROOT = path.join(UPLOAD_BASE, "payment-slips");
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg", // covers .jpg and .jpeg
  "image/jpg",  // some clients still send this nonstandard type
]);
const ALLOWED_EXT = /\.(pdf|jpe?g)$/i;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_ROOT),
  filename: (_req, file, cb) => {
    // Random + timestamp prefix avoids collisions and obscures the original name.
    const rand = crypto.randomBytes(6).toString("hex");
    const ext  = path.extname(file.originalname || "").toLowerCase() || ".bin";
    cb(null, `${Date.now()}-${rand}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const okMime = ALLOWED_MIMES.has(file.mimetype);
  const okExt  = ALLOWED_EXT.test(file.originalname || "");
  if (!okMime || !okExt) {
    return cb(new Error("Only PDF, JPG, or JPEG files are allowed"));
  }
  cb(null, true);
};

export const uploadPaymentSlip = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB upper bound (frontend already compresses images)
  },
});

export { UPLOAD_BASE, UPLOAD_ROOT };

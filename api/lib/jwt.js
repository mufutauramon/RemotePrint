
import jwt from "jsonwebtoken";
import crypto from "crypto";

const SECRET = process.env.JWT_SECRET || "dev-secret"; // set in Azure!

export function signJwt(payload, { expiresInSeconds = 60 * 60 * 24 * 30 } = {}) {
  return jwt.sign(payload, SECRET, { expiresIn: expiresInSeconds });
}

export function getUser(req) {
  const hdr = req.headers?.authorization || req.headers?.Authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(hdr);
  if (!m) { const e = new Error("missing_bearer"); e.status = 401; throw e; }
  try {
    return jwt.verify(m[1], SECRET);
  } catch (err) {
    const e = new Error("invalid_token");
    e.status = 401;
    throw e;
  }
}

export function secretFingerprint() {
  return crypto.createHash("sha256").update(SECRET).digest("hex").slice(0, 8);
}

// ⬇️ add these for diagnostics
export function secretRaw() {
  return SECRET;
}
export function secretInfo() {
  const s = SECRET;
  return {
    len: s.length,
    start5: s.slice(0, 5),
    end5: s.slice(-5),
    hex10: Buffer.from(s, "utf8").toString("hex").slice(0, 20)
  };
}

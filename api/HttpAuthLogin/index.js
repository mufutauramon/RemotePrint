// api/HttpAuthLogin/index.js
import { getPool, getSql } from "../lib/sql.js";
import jwt from "jsonwebtoken";
import { secretFingerprint } from "../lib/jwt.js";

function json(context, status, body) {
  context.res = { status, headers: { "content-type": "application/json" }, body };
}

export default async function (context, req) {
  try {
    const b = req.body || {};
    const email = String(b.email || "").trim().toLowerCase();
    const password = String(b.password || "");
    if (!email || !password) return json(context, 400, { error: "email and password are required" });

    const attemptHash = `sha1:${Buffer.from(password).toString("base64")}`;
    const sql = getSql();
    const pool = await getPool();

    const r = await pool.request()
      .input("email", sql.NVarChar(256), email)
      .query(`
        SELECT TOP 1 id, email, pwd_hash, is_operator, full_name, phone, subscription_tier
        FROM dbo.Users WHERE email=@email
      `);

    if (!r.recordset?.length || r.recordset[0].pwd_hash !== attemptHash) {
      return json(context, 401, { error: "invalid credentials" });
    }

    const u = r.recordset[0];

    // FORCE 7 DAYS (604800 seconds) — unambiguous
    const SECRET = process.env.JWT_SECRET || "dev-secret";
    const token = jwt.sign(
      { sub: String(u.id), email: u.email, is_operator: !!u.is_operator },
      SECRET,
      { expiresIn: 604800 }   // 7 days in seconds
    );

    // Decode once to prove the lifetime we just minted
    const decoded = jwt.decode(token);
    const now = Math.floor(Date.now()/1000);
    const expSeconds = decoded?.exp ? (decoded.exp - now) : null;

    return json(context, 200, {
      token,
      secret_fp: secretFingerprint(),
      exp_seconds: expSeconds,           // 👈 you should see ~604800 here
      user: {
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        phone: u.phone,
        plan: u.subscription_tier
      }
    });
  } catch (err) {
    context.log.error("login error", err);
    return json(context, 500, { error: "login_failed", detail: String(err?.message || err) });
  }
}

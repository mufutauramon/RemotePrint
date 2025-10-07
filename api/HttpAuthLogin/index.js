// api/HttpAuthLogin/index.js
import { getPool, getSql } from "../lib/sql.js";
import { signJwt, secretFingerprint } from "../lib/jwt.js";

function json(context, status, body) {
  context.res = { status, headers: { "content-type": "application/json" }, body };
}

export default async function (context, req) {
  try {
    const b = req.body || {};
    const email = String(b.email || "").trim().toLowerCase();
    const password = String(b.password || "");
    if (!email || !password) {
      return json(context, 400, { error: "email and password are required" });
    }

    // MUST match the hashing used by signup
    const attemptHash = `sha1:${Buffer.from(password).toString("base64")}`;

    const sql = getSql();
    const pool = await getPool();

    const r = await pool.request()
      .input("email", sql.NVarChar(256), email)
      .query(`
        SELECT TOP 1
          id, email, pwd_hash, is_operator, full_name, phone, subscription_tier
        FROM dbo.Users
        WHERE email=@email
      `);

    if (!r.recordset?.length || r.recordset[0].pwd_hash !== attemptHash) {
      return json(context, 401, { error: "invalid credentials" });
    }

    const u = r.recordset[0];

    const token = signJwt(
      { sub: String(u.id), email: u.email, is_operator: !!u.is_operator },
      { expiresInSeconds: 60 * 60 * 12 }
    );

    return json(context, 200, {
      token,
      // keep this so we can compare with whoami
      secret_fp: secretFingerprint(),
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

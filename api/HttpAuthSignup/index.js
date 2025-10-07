
import { getPool, getSql } from "../lib/sql.js";
import { signJwt } from "../lib/jwt.js";

function json(context, status, body) {
  context.res = { status, headers: { "content-type": "application/json" }, body };
}

export default async function (context, req) {
  try {
    const b = req.body || {};
    const email = String(b.email || "").trim().toLowerCase();
    const password = String(b.password || "");
    const fullName = String(b.fullName || "");
    const phone = String(b.phone || "");
    const plan = String(b.plan || "Basic");

    if (!email || !password) return json(context, 400, { error: "email and password required" });

    const pwd_hash = `sha1:${Buffer.from(password).toString("base64")}`;

    const sql = getSql();
    const pool = await getPool();

    const exists = await pool.request().input("email", sql.NVarChar(256), email)
      .query("SELECT 1 FROM Users WHERE email=@email");
    if (exists.recordset.length) return json(context, 409, { error: "email_exists" });

    const ins = await pool.request()
      .input("email", sql.NVarChar(256), email)
      .input("pwd", sql.NVarChar(256), pwd_hash)
      .input("name", sql.NVarChar(200), fullName || null)
      .input("phone", sql.NVarChar(40), phone || null)
      .query(`
        INSERT INTO Users(email, pwd_hash, full_name, phone)
        OUTPUT inserted.id, inserted.email
        VALUES(@email, @pwd, @name, @phone);
      `);

    const user = ins.recordset[0];
    const token = signJwt({ sub: user.id, email });

    json(context, 200, { token, user: { id: user.id, email, fullName, phone, plan } });
  } catch (e) {
    context.log.error("signup error", e);
    json(context, 500, { error: "signup_failed", detail: String(e?.message || e) });
  }
}

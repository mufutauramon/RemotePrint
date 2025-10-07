
import { getUser } from "../lib/jwt.js";
import { getPool, getSql } from "../lib/sql.js";

export default async function (context, req) {
  try {
    const user = getUser(req);
    const pool = await getPool();
    const sql = getSql();
    const sub = await pool.request().input("uid", sql.Int, user.sub).query(`
      SELECT TOP 1 s.pages_remaining, p.name AS plan, p.quota_pages
      FROM Subscriptions s JOIN Plans p ON p.id=s.plan_id
      WHERE s.user_id=@uid AND s.active=1
      ORDER BY s.start_at DESC
    `);
    context.res = { status: 200, body: { user: { id: user.sub, email: user.email }, subscription: sub.recordset[0] || null } };
  } catch (e) {
    context.res = { status: e.status || 401, body: { error: "auth_failed" } };
  }
}

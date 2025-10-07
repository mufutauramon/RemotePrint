
import { getUser } from "../lib/jwt.js";
import { getPool, getSql } from "../lib/sql.js";

export default async function (context, req) {
  try {
    const user = getUser(req);
    const planName = String(req.body?.planName || "");
    if (!planName) return (context.res = { status: 400, body: { error: "plan_required" } });

    const pool = await getPool();
    const sql = getSql();

    const plan = await pool.request().input("name", sql.NVarChar(40), planName)
      .query(`SELECT TOP 1 id, quota_pages FROM Plans WHERE name=@name`);
    if (!plan.recordset.length) return (context.res = { status: 404, body: { error: "plan_not_found" } });

    await pool.request().input("uid", sql.Int, user.sub)
      .query(`UPDATE Subscriptions SET active=0 WHERE user_id=@uid AND active=1`);

    await pool.request()
      .input("uid", sql.Int, user.sub)
      .input("pid", sql.Int, plan.recordset[0].id)
      .input("remain", sql.Int, plan.recordset[0].quota_pages)
      .query(`INSERT INTO Subscriptions(user_id, plan_id, pages_remaining, active) VALUES(@uid,@pid,@remain,1)`);

    await pool.request()
      .input("uid", sql.Int, user.sub)
      .input("tier", sql.NVarChar(40), planName)
      .query(`UPDATE Users SET subscription_tier=@tier WHERE id=@uid`);

    context.res = { status: 200, body: { ok: true } };
  } catch (e) {
    context.res = { status: e.status || 500, body: { error: "subscribe_failed", detail: String(e?.message || e) } };
  }
}

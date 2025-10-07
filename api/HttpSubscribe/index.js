// POST /api/subscribe  { planName: "Basic"|"Standard"|"Pro" }
import { getPool, getSql } from "../lib/sql.js";
import { getUser } from "../lib/jwt.js";

const PLANS = {
  Basic:    { pages: 100, price: 2000 },
  Standard: { pages: 250, price: 4000 },
  Pro:      { pages: 600, price: 8000 },
};

function json(context, status, body) {
  context.res = { status, headers: { "content-type": "application/json" }, body };
}

export default async function (context, req) {
  try {
    // 1) auth
    let user;
    try { user = getUser(req); } catch { return json(context, 401, { error: "auth_failed" }); }

    // 2) input
    const planName = String(req.body?.planName || "").trim();
    const plan = PLANS[planName];
    if (!plan) return json(context, 400, { error: "invalid_plan" });

    // 3) db
    const sql = getSql();
    const pool = await getPool();

    // Make sure Plans table has the rows; create if missing (idempotent)
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM Plans WHERE name = 'Basic')
        INSERT INTO Plans (name, quota_pages, price_naira) VALUES ('Basic', 100, 2000);
      IF NOT EXISTS (SELECT 1 FROM Plans WHERE name = 'Standard')
        INSERT INTO Plans (name, quota_pages, price_naira) VALUES ('Standard', 250, 4000);
      IF NOT EXISTS (SELECT 1 FROM Plans WHERE name = 'Pro')
        INSERT INTO Plans (name, quota_pages, price_naira) VALUES ('Pro', 600, 8000);
    `);

    // Upsert subscription: deactivate old, insert new active
    await pool.request()
      .input("uid", sql.Int, user.sub || user.id)
      .query(`
        UPDATE Subscriptions SET active = 0 WHERE user_id=@uid AND active=1;
      `);

    const ins = await pool.request()
      .input("uid",  sql.Int,            user.sub || user.id)
      .input("plan", sql.NVarChar(32),   planName)
      .query(`
        DECLARE @plan_id INT = (SELECT id FROM Plans WHERE name=@plan);
        INSERT INTO Subscriptions (user_id, plan_id, pages_remaining, active, start_at)
        SELECT @uid, @plan_id, p.quota_pages, 1, SYSUTCDATETIME()
        FROM Plans p WHERE p.id=@plan_id;

        SELECT TOP 1 s.id, p.name AS plan, p.quota_pages, s.pages_remaining
        FROM Subscriptions s JOIN Plans p ON p.id=s.plan_id
        WHERE s.user_id=@uid AND s.active=1
        ORDER BY s.start_at DESC;
      `);

    const sub = ins.recordset?.[0] || null;
    return json(context, 200, { ok: true, subscription: sub });
  } catch (e) {
    context.log.error("subscribe error", e);
    return json(context, 500, { error: "subscribe_failed", detail: String(e?.message || e) });
  }
}

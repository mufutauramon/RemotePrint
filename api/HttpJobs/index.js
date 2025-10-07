
import { getUser } from "../lib/jwt.js";
import { getPool, getSql } from "../lib/sql.js";

function send(context, status, body) {
  context.res = { status, headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) };
}

export default async function (context, req) {
  try {
    const user = getUser(req);
    const pool = await getPool();
    const sql = getSql();

    if (req.method.toUpperCase() === "GET") {
      const r = await pool.request().input("uid", sql.Int, user.sub)
        .query(`SELECT TOP 50 * FROM Jobs WHERE user_id=@uid ORDER BY created_at DESC`);
      return send(context, 200, r.recordset);
    }

    const b = req.body || {};
    const fileName = String(b.fileName || b.file_name || b.filename || "");
    const blobUrl  = String(b.blobUrl  || b.blob_url  || b.url  || b.readUrl || "");
    const pages    = Number(b.pages || b.pagesEstimate || b.page_count || 0);
    const colorRaw = b.color ?? b?.meta?.color;
    const duplexRaw= b.duplex ?? b?.meta?.duplex;

    if (!fileName || !blobUrl || !Number.isFinite(pages) || pages <= 0) {
      return send(context, 400, { error: "bad_request", detail: "fileName, blobUrl, pages required" });
    }

    const normColor = String(colorRaw ?? "").toLowerCase().includes("color") || String(colorRaw) === "1" || String(colorRaw) === "true" ? 1 : 0;
    const normDuplex = (() => {
      const s = String(duplexRaw ?? "").toLowerCase();
      return s.startsWith("y") || s === "true" || s === "1" ? 1 : 0;
    })();

    const pickup = Math.floor(100000 + Math.random() * 900000).toString();

    const ins = await pool.request()
      .input("uid", sql.Int, user.sub)
      .input("fn",  sql.NVarChar(260),  fileName)
      .input("url", sql.NVarChar(2048), blobUrl)
      .input("pg",  sql.Int,            pages)
      .input("clr", sql.Bit,            normColor)
      .input("dx",  sql.Bit,            normDuplex)
      .input("pc",  sql.VarChar(12),    pickup)
      .query(`
        INSERT INTO Jobs (user_id, file_name, storage_url, pages, color, duplex, pickup_code, status, created_at)
        OUTPUT inserted.id, inserted.user_id, inserted.file_name, inserted.storage_url,
               inserted.pages, inserted.color, inserted.duplex, inserted.status,
               inserted.pickup_code, inserted.created_at
        VALUES (@uid, @fn, @url, @pg, @clr, @dx, @pc, 'Queued', SYSUTCDATETIME());
      `);

    return send(context, 201, { ok: true, job: ins.recordset[0] });
  } catch (e) {
    return send(context, e.status || 401, { error: e.status === 401 ? "auth_failed" : "server_error", detail: String(e?.message || e) });
  }
}

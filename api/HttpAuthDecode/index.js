import jwt from "jsonwebtoken";
import { secretFingerprint } from "../lib/jwt.js";

export default async function (context, req) {
  const raw = req.headers?.authorization ?? req.headers?.Authorization ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(raw);
  const token = m ? m[1] : null;

  let decoded = null, err = null;
  try { decoded = token ? jwt.decode(token, { complete: true }) : null; }
  catch (e) { err = e?.message || String(e); }

  context.res = {
    status: 200,
    headers: { "content-type": "application/json" },
    body: {
      ok: !!decoded,
      error: err,
      token_len: token ? token.length : 0,
      header: decoded?.header || null,   // { alg, typ }
      payload: decoded?.payload || null, // { sub, email, iat, exp, ... }
      now: Math.floor(Date.now()/1000),
      secret_fp: secretFingerprint()
    }
  };
}

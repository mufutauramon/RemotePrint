// api/HttpAuthWhoAmI/index.js
import jwt from "jsonwebtoken";
import { secretFingerprint } from "../lib/jwt.js";

export default async function (context, req) {
  const SECRET = process.env.JWT_SECRET || "dev-secret";

  // read header exactly as Functions sees it
  const raw =
    req.headers?.authorization ??
    req.headers?.Authorization ??
    "";

  // extract token if present
  const m = /^Bearer\s+(.+)$/i.exec(raw);
  const token = m ? m[1] : null;

  // try decode (no signature check) and verify (with signature)
  let decoded = null;
  let verifyErr = null;
  let alg = null;

  if (token) {
    try {
      const d = jwt.decode(token, { complete: true });
      decoded = d || null;
      alg = d?.header?.alg || null;
    } catch (e) {
      // ignore
    }
    try {
      jwt.verify(token, SECRET); // <-- this is what fails; we want message
    } catch (e) {
      verifyErr = e?.message || String(e);
    }
  } else {
    verifyErr = "missing_bearer";
  }

  const ok = !verifyErr;
  context.res = {
    status: ok ? 200 : 401,
    headers: { "content-type": "application/json" },
    body: {
      ok,
      // tiny breadcrumbs so we can see what's happening (safe to share)
      saw_header: raw ? raw.slice(0, 32) + "..." : null,
      token_len: token ? token.length : 0,
      decoded_alg: alg,
      verify_error: verifyErr,     // <--- key detail we need
      secret_fp: secretFingerprint()
    }
  };
}

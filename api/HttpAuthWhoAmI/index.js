// Minimal whoami: never throws 500, always returns JSON with a clear status.
import { getUser, secretFingerprint } from "../lib/jwt.js";

export default async function (context, req) {
  try {
    const u = getUser(req); // reads Authorization: Bearer <token>
    context.res = {
      status: 200,
      headers: { "content-type": "application/json" },
      body: { ok: true, user: u, secret_fp: secretFingerprint() }
    };
  } catch (e) {
    context.res = {
      status: 401,
      headers: { "content-type": "application/json" },
      body: { ok: false, error: "invalid_token", secret_fp: secretFingerprint() }
    };
  }
}

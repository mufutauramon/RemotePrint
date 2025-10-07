// ---------- tiny DOM helpers ----------
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ---------- toast ----------
function toast(msg, type = "success") {
  const wrap = $("#toast");
  if (!wrap) return alert(msg);
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ---------- HTTP helpers ----------
async function postJson(url, body = {}, { auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const t = localStorage.getItem("rp_token");
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await r.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { ok: r.ok, status: r.status, data };
}

async function getJson(url, { auth = false } = {}) {
  const headers = {};
  if (auth) {
    const t = localStorage.getItem("rp_token");
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const r = await fetch(url, { headers });
  const text = await r.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { ok: r.ok, status: r.status, data };
}

// ---------- UI state ----------
function setSignedIn(email) {
  $("#authStatus").textContent = email ? `Signed in as ${email}` : "Not signed in";
  $("#signOutBtn").classList.toggle("hidden", !email);

  // hide ONLY login card so Plans stays visible for subscribe
  const loginCard = $("#loginCard");
  if (loginCard) loginCard.classList.toggle("hidden", !!email);

  // dashboard visible only when signed in
  $("#dash").classList.toggle("hidden", !email);

  // enable/disable subscribe button
  const subBtn = $("#subscribeBtn");
  if (subBtn) subBtn.disabled = !email;

  // try loading quota/jobs but DO NOT toast on 401 here
  if (email) { refreshQuota({ quiet401: true }); refreshJobs(); }
}

// ---------- plan helpers ----------
const planRadios = $$('.plans input[name="plan"]');
function currentPlan() {
  const r = planRadios.find(r => r.checked);
  return r ? r.value : "Basic";
}

// ---------- auth ----------
$("#signUpBtn").addEventListener("click", async () => {
  const email = $("#email").value.trim().toLowerCase();
  const password = $("#password").value;
  if (!email || !password) return toast("Enter email and password first.", "info");

  const res = await postJson("/api/auth/signup", { email, password, fullName: "", phone: "", plan: currentPlan() });
  if (res.ok) {
    localStorage.setItem("rp_email", email);
    localStorage.setItem("rp_token", res.data.token || "");
    setSignedIn(email);
    toast("Account created.", "success");
  } else {
    toast(res.data?.error || `Signup failed (${res.status})`, "error");
  }
});

$("#signInBtn").addEventListener("click", async () => {
  const email = $("#email").value.trim().toLowerCase();
  const password = $("#password").value;
  if (!email || !password) return toast("Enter email and password.", "info");

  const res = await postJson("/api/auth/login", { email, password });
  if (res.ok) {
    localStorage.setItem("rp_email", email);
    localStorage.setItem("rp_token", res.data.token || "");
    setSignedIn(email);
    toast("Signed in.", "success");
  } else {
    toast(res.data?.error || `Login failed (${res.status})`, "error");
  }
});

$("#signOutBtn").addEventListener("click", () => {
  localStorage.removeItem("rp_token");
  localStorage.removeItem("rp_email");
  setSignedIn(null);
  toast("Signed out.", "success");
});

// ---------- subscribe ----------
$("#subscribeBtn").addEventListener("click", async () => {
  if (!localStorage.getItem("rp_token")) return toast("Please sign in first.", "info");
  const planName = currentPlan();
  const res = await postJson("/api/subscribe", { planName }, { auth: true });
  if (res.ok) {
    toast(`Subscription set to ${planName}.`, "success");
    await refreshQuota({ quiet401: true });
  } else if (res.status === 401) {
    // session mismatch — clear and let user sign back in
    localStorage.removeItem("rp_token");
    localStorage.removeItem("rp_email");
    setSignedIn(null);
    toast("Session expired. Please sign in again.", "info");
  } else {
    toast(res.data?.error || `Subscribe failed (${res.status})`, "error");
  }
});

// ---------- quota + jobs ----------
async function refreshQuota({ quiet401 = false } = {}) {
  const res = await getJson("/api/me", { auth: true });
  if (!res.ok) {
    if (res.status === 401 && !quiet401) {
      localStorage.removeItem("rp_token"); localStorage.removeItem("rp_email");
      setSignedIn(null);
      toast("Session expired. Please sign in again.", "info");
    }
    // leave plan/remaining as is
    return;
  }
  const sub = res.data?.subscription || null;
  $("#planName").textContent = sub?.plan || "—";
  const remain = Number(sub?.pages_remaining || 0);
  const total  = Number(sub?.quota_pages || 0);
  $("#remaining").textContent = String(remain);
  $("#quotaFill").style.width = total ? `${Math.round((remain / total) * 100)}%` : "0%";

  // only nudge if we actually fetched successfully and there is no sub
  if (!sub) toast("No active plan. Choose a plan and click Subscribe.", "info");
}

async function refreshJobs() {
  const res = await getJson("/api/jobs", { auth: true });
  if (!res.ok) return;
  const list = Array.isArray(res.data) ? res.data : (res.data.jobs || []);
  const body = $("#jobsTable tbody"); body.innerHTML = "";
  for (const j of list) {
    const created = j.created_at || j.createdAt;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${created ? new Date(created).toLocaleString() : "—"}</td>
      <td>${j.file_name || j.filename || "—"}</td>
      <td>${j.pages ?? "—"}</td>
      <td>${(j.color ? "Color" : "B/W")} • ${(j.duplex ? "Duplex" : "Simplex")}</td>
      <td>${j.status || "Queued"}</td>
      <td>${j.pickup_code || ""}</td>
    `;
    body.appendChild(tr);
  }
}

// ---------- price (client estimate) ----------
$("#priceBtn")?.addEventListener("click", () => {
  const pages = parseInt($("#pages").value || "0", 10);
  const perSide = ($("#color").value === "color") ? 70 : 25;
  $("#priceOut").textContent = pages ? `₦ ${(perSide * pages).toLocaleString()}` : "—";
});

// ---------- upload: SAS → PUT → queue job ----------
$("#sendBtn")?.addEventListener("click", async () => {
  try {
    if (!localStorage.getItem("rp_token")) return toast("Please sign in first.", "info");
    const file = $("#fileInput").files[0];
    const pages = parseInt($("#pages").value || "0", 10);
    if (!file || !pages) return toast("Choose a file and enter pages.", "info");

    const r1 = await postJson("/api/blob/sas", {
      fileName: file.name,
      contentType: file.type || "application/octet-stream"
    });
    if (!r1.ok) return toast(r1.data?.error || "Could not get upload URL.", "error");

    const put = await fetch(r1.data.uploadUrl, {
      method: "PUT",
      headers: { "x-ms-blob-type": "BlockBlob", "content-type": file.type || "application/octet-stream" },
      body: file
    });
    if (!put.ok) return toast("Blob upload failed.", "error");

    const color  = $("#color").value;            // "bw" | "color"
    const duplex = $("#duplex").value === "true";
    const r2 = await postJson("/api/jobs", {
      fileName: file.name,
      blobUrl: r1.data.blobUrl,
      pages,
      color,
      duplex
    }, { auth: true });

    if (!r2.ok) {
      if (r2.status === 402) return toast("Insufficient quota. Choose a plan or lower pages.", "error");
      if (r2.status === 401) {
        localStorage.removeItem("rp_token"); localStorage.removeItem("rp_email");
        setSignedIn(null);
        return toast("Session expired. Please sign in again.", "info");
      }
      return toast(r2.data?.error || "Unable to queue job.", "error");
    }

    toast("Uploaded and queued.", "success");
    await refreshQuota({ quiet401: true });
    await refreshJobs();
  } catch (e) {
    console.error(e);
    toast(e.message || "Upload error.", "error");
  }
});

// ---------- boot ----------
(function init() {
  const email = localStorage.getItem("rp_email");
  const token = localStorage.getItem("rp_token");
  setSignedIn(email && token ? email : null);
})();

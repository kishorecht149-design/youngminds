require("dotenv").config();

const express  = require("express");
const fs       = require("fs");
const path     = require("path");
const mongoose = require("mongoose");
const cors     = require("cors");
const crypto   = require("crypto");
const { createAuthToken, verifyAuthToken, DEFAULT_TTL_SECONDS } = require("./auth");
const { getAiAssistReply, getPasswordCoachReply } = require("./ai-assist");

const app = express();
const REMEMBER_ME_TTL_SECONDS = 60 * 60 * 24 * 30;
const ADMIN_ACCOUNT_KEY = "primary";
const MAX_SUBMISSION_FILE_BYTES = 50 * 1024 * 1024;
const realtimeClients = new Set();
const SERVICE_SLUGS = [
  "web-development",
  "graphic-design",
  "social-media",
  "ai-solutions",
  "video-editing",
  "content-writing"
];
const SERVICE_ICON_SET = ["01", "02", "03", "04", "05", "06"];

/* ══════════════════════════════════════════
   CORS
══════════════════════════════════════════ */
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

/* ══════════════════════════════════════════
   BODY PARSERS
══════════════════════════════════════════ */
app.use(express.json({ limit: "80mb" }));
app.use(express.urlencoded({ extended: true, limit: "80mb" }));

/* ══════════════════════════════════════════
   SERVE FRONTEND FILES
══════════════════════════════════════════ */
const rootDir = path.join(__dirname, "..");
const uploadsDir = path.join(rootDir, "uploads");
const submissionUploadsDir = path.join(uploadsDir, "project-submissions");
const FRONTEND_BUILD_TAG = "services-fix-2026-04-21";

function adminServicesHotfixScript() {
  return `<script>
(function(){
  if (window.__ymAdminServicesHotfixApplied) return;
  window.__ymAdminServicesHotfixApplied = true;

  const SESSION_KEY = "ym_admin_session";

  function currentAdminPage() {
    const pathname = String(window.location.pathname || "").replace(/\\/+$/, "");
    if (pathname === "/admin/services") return "services";
    if (pathname === "/admin/packages-pricing") return "packages";
    return String(window.activeAdminView || "");
  }

  function fallbackServices() {
    try {
      if (typeof window.defaultServiceEntries === "function") {
        return window.defaultServiceEntries().map(function(item){
          return Object.assign({}, item, { id: item._id || item.id || item.slug });
        });
      }
    } catch (err) {}
    return [];
  }

  function normalizeServices(items) {
    try {
      if (typeof window.normalizeServiceEntries === "function") {
        return window.normalizeServiceEntries(items);
      }
    } catch (err) {}
    return Array.isArray(items) ? items : fallbackServices();
  }

  function getAdminToken() {
    return sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || "";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatINR(amount) {
    return "₹" + Number(amount || 0).toLocaleString("en-IN");
  }

  const state = {
    entries: [],
    slug: "web-development",
    loading: false,
    saving: false,
    error: ""
  };

  function ensureEntries(items) {
    const normalized = normalizeServices(items);
    return Array.isArray(normalized)
      ? normalized.map(function(item){
          return Object.assign({}, item, { id: item._id || item.id || item.slug });
        })
      : [];
  }

  function getCurrentEntry() {
    if (!Array.isArray(state.entries) || !state.entries.length) return null;
    const found = state.entries.find(function(item){ return item.slug === state.slug; });
    if (found) return found;
    state.slug = state.entries[0].slug;
    return state.entries[0];
  }

  function isCoreServiceSlug(slug) {
    return ['web-development','graphic-design','social-media','ai-solutions','video-editing','content-writing'].indexOf(String(slug || '').trim()) !== -1;
  }

  function getSectorDrafts(current) {
    const sectors = Array.isArray(current && current.sectors) ? current.sectors.slice(0, 8) : [];
    if (sectors.length) return sectors;
    return [{
      title: "Core Packages",
      description: "Package groups for this service.",
      packages: [{ name: "Basic", price_inr: 0, price_usd: 0, delivery: "", revisions: "", duration: "", isPopular: false, features: [""] }]
    }];
  }

  function renderStandalone() {
    const mount = document.getElementById("services-admin-content");
    if (!mount || currentAdminPage() !== "services") return;

    if (state.loading && !state.entries.length) {
      mount.innerHTML = '<div class="empty"><div class="empty-icon">◌</div><div class="empty-title">Loading services</div><div class="empty-sub">Fetching the latest service configuration from the backend.</div></div>';
      return;
    }

    const current = getCurrentEntry();
    if (!current) {
      mount.innerHTML = '<div class="empty"><div class="empty-icon">◫</div><div class="empty-title">Services unavailable</div><div class="empty-sub">' + escapeHtml(state.error || "We could not load the service list right now.") + '</div><div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button class="btn-sm primary" type="button" onclick="window.__ymStandaloneServicesReload()">Retry Services</button><button class="btn-sm" type="button" onclick="window.__ymStandaloneServicesLoadDefaults()">Load Defaults</button></div></div>';
      return;
    }

    const deliverables = Array.isArray(current.deliverables) ? current.deliverables.slice(0, 6) : [];
    while (deliverables.length < 6) deliverables.push("");
    mount.innerHTML = '<div class="view-hdr"><span class="view-hdr-title">Services</span><span class="view-hdr-count">' + state.entries.length + ' service lines' + (state.saving ? ' · saving…' : '') + '</span><div class="vhdr-right"><button class="btn-sm primary" type="button" onclick="window.__ymStandaloneServicesCreate()" ' + (state.saving ? 'disabled' : '') + '>+ Add Service</button><button class="btn-sm" type="button" onclick="window.__ymStandaloneServicesReload()" ' + (state.loading ? 'disabled' : '') + '>Refresh Services</button></div></div><div class="service-admin-layout"><div class="service-admin-card"><div class="service-admin-head"><div><div class="service-admin-title">Service list</div><div class="service-admin-sub">Choose a service to edit the deep-dive page copy and public messaging. Packages and pricing now live on their own page.</div></div></div><div class="service-admin-list">' + state.entries.map(function(item){
      return '<button class="service-admin-item ' + (item.slug === current.slug ? 'active' : '') + '" type="button" onclick="window.__ymStandaloneServicesSelect(\\'' + escapeHtml(item.slug) + '\\')"><div class="service-admin-item-top"><div class="service-admin-item-name">' + escapeHtml(item.name || "Service") + '</div><div class="service-admin-item-price">' + escapeHtml(String(Array.isArray(item.sectors) ? item.sectors.length : 0) + " sectors") + '</div></div><div class="service-admin-meta"><span class="service-admin-pill">' + escapeHtml(item.shortLabel || "Service") + '</span><span class="service-admin-pill">' + escapeHtml(item.slug || "service") + '</span></div><div class="service-admin-item-copy" style="margin-top:10px">' + escapeHtml(item.valueProp || "No value proposition added yet.") + '</div></button>';
    }).join("") + '</div></div><div class="service-admin-card"><div class="service-admin-head"><div><div class="service-admin-title">Edit ' + escapeHtml(current.name || "service") + '</div><div class="service-admin-sub">Changes publish to the homepage service section and the /services/[slug] page. Use the dedicated Packages & Pricing screen for sectors, packages, and price cards.</div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn-sm" href="' + ('https://youngmindsagency.vercel.app' + (['web-development','graphic-design','social-media','ai-solutions','video-editing','content-writing'].indexOf(current.slug) !== -1 ? ('/services/' + encodeURIComponent(current.slug) + '/') : ('/packages-pricing/?service=' + encodeURIComponent(current.slug || '')))) + '" target="_blank" rel="noopener">Open Page</a><a class="btn-sm" href="/admin/packages-pricing" rel="noopener">Packages & Pricing</a></div></div>' + (state.error ? '<div class="service-admin-note" style="margin-bottom:10px;color:var(--orange)">' + escapeHtml(state.error) + '</div>' : '') + '<div class="service-admin-form"><div class="service-admin-form-row"><div class="form-field"><label>Service Name</label><input id="service-name" type="text" value="' + escapeHtml(current.name || "") + '"></div><div class="form-field"><label>Short Label</label><input id="service-short-label" type="text" value="' + escapeHtml(current.shortLabel || "") + '"></div></div><div class="form-row full"><div class="form-field"><label>Value Proposition</label><textarea id="service-value-prop" placeholder="One-line promise for the hero block and homepage card">' + escapeHtml(current.valueProp || "") + '</textarea></div></div><div class="form-row full"><div class="form-field"><label>Meta Description</label><textarea id="service-meta-description" placeholder="Used for SEO description and social preview copy">' + escapeHtml(current.meta_description || "") + '</textarea></div></div><div class="form-row full"><div class="form-field"><label>Open Graph Image URL</label><input id="service-og-image" type="text" placeholder="/static/assets/logo-ym.jpg" value="' + escapeHtml(current.og_image_url || "") + '"></div></div><div><div class="dp-sec-title" style="margin-bottom:14px">What You Get</div><div class="service-admin-deliverables">' + deliverables.map(function(item, index){
      return '<div class="service-admin-deliverable"><div class="service-admin-deliverable-num">' + String(index + 1).padStart(2, "0") + '</div><div class="form-field" style="margin:0;flex:1"><label>Deliverable ' + (index + 1) + '</label><input type="text" data-service-deliverable value="' + escapeHtml(item) + '"></div></div>';
    }).join("") + '</div></div><div class="service-admin-note">Keep package tables, sectors, and price ranges in the separate Packages & Pricing screen so service content stays simple and easier to edit.</div><div class="service-admin-actions"><button class="btn-sm" type="button" onclick="window.__ymStandaloneServicesRender()">Reset</button><button class="btn-sm" type="button" onclick="window.__ymStandaloneServicesDelete()" ' + ((state.saving || isCoreServiceSlug(current.slug)) ? 'disabled' : '') + '>Delete Service</button><button class="btn-sm primary" type="button" onclick="window.__ymStandaloneServicesSave()" ' + (state.saving ? 'disabled' : '') + '>' + (state.saving ? 'Saving…' : 'Save Service') + '</button></div>' + (isCoreServiceSlug(current.slug) ? '<div class="service-admin-note">Core services stay locked so the main catalogue never loses the agency service foundation.</div>' : '') + '</div></div></div></div>';
  }

  async function syncAdminServices(render, forceFallback) {
    state.loading = true;
    state.error = "";
    if (render !== false) renderStandalone();
    try {
      let entries = [];
      if (forceFallback) {
        entries = fallbackServices();
      } else {
        const response = await fetch(window.location.origin + "/api/services", { cache: "no-store" });
        const data = await response.json().catch(function(){ return []; });
        entries = Array.isArray(data) && data.length ? data : fallbackServices();
      }
      state.entries = ensureEntries(entries);
      window.serviceEntries = state.entries.slice();
      state.error = state.entries.length ? "" : "Service list is empty.";
      return state.entries;
    } catch (err) {
      state.entries = ensureEntries(fallbackServices());
      window.serviceEntries = state.entries.slice();
      state.error = "Could not load service configuration right now.";
      return state.entries;
    } finally {
      state.loading = false;
      if (render !== false) renderStandalone();
    }
  }

  async function saveStandalone() {
    const current = getCurrentEntry();
    if (!current) return;
    const token = getAdminToken();
    if (!token) {
      if (typeof window.showToast === "function") window.showToast("Admin session expired. Please sign in again.");
      return;
    }
    const payload = {
      name: document.getElementById("service-name") ? document.getElementById("service-name").value.trim() : "",
      shortLabel: document.getElementById("service-short-label") ? document.getElementById("service-short-label").value.trim() : "",
      valueProp: document.getElementById("service-value-prop") ? document.getElementById("service-value-prop").value.trim() : "",
      meta_description: document.getElementById("service-meta-description") ? document.getElementById("service-meta-description").value.trim() : "",
      og_image_url: document.getElementById("service-og-image") ? document.getElementById("service-og-image").value.trim() : "",
      deliverables: Array.prototype.slice.call(document.querySelectorAll("[data-service-deliverable]")).map(function(input){
        return String(input.value || "").trim();
      }).filter(Boolean)
    };
    state.saving = true;
    state.error = "";
    renderStandalone();
    try {
      const response = await fetch(window.location.origin + "/api/services/" + encodeURIComponent(current.slug), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(function(){ return {}; });
      if (!response.ok) throw new Error(data.error || "Could not save service");
      state.entries = state.entries.map(function(item){
        return item.slug === data.slug ? Object.assign({}, data, { id: data._id || data.id || data.slug }) : item;
      });
      window.serviceEntries = state.entries.slice();
      state.slug = data.slug || state.slug;
      if (typeof window.showToast === "function") window.showToast("Service updated");
    } catch (err) {
      state.error = err && err.message ? err.message : "Could not save service";
      if (typeof window.showToast === "function") window.showToast(state.error);
    } finally {
      state.saving = false;
      renderStandalone();
    }
  }

  window.__ymStandaloneServicesRender = renderStandalone;
  window.__ymStandaloneServicesReload = function(){ return syncAdminServices(true, false); };
  window.__ymStandaloneServicesLoadDefaults = function(){ return syncAdminServices(true, true); };
  window.__ymStandaloneServicesSave = saveStandalone;
  window.__ymStandaloneServicesCreate = async function(){
    const token = getAdminToken();
    if (!token) {
      if (typeof window.showToast === "function") window.showToast("Admin session expired. Please sign in again.");
      return;
    }
    const name = window.prompt("Enter the new service name");
    if (!name || !String(name).trim()) return;
    try {
      const response = await fetch(window.location.origin + "/api/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({ name: String(name).trim() })
      });
      const data = await response.json().catch(function(){ return {}; });
      if (!response.ok) throw new Error(data.error || "Could not create service");
      state.entries = ensureEntries(state.entries.concat([data]));
      window.serviceEntries = state.entries.slice();
      state.slug = data.slug || state.slug;
      if (typeof window.showToast === "function") window.showToast("Service added");
      renderStandalone();
    } catch (err) {
      if (typeof window.showToast === "function") window.showToast(err && err.message ? err.message : "Could not create service");
    }
  };
  window.__ymStandaloneServicesDelete = async function(){
    const current = getCurrentEntry();
    const token = getAdminToken();
    if (!current) return;
    if (!token) {
      if (typeof window.showToast === "function") window.showToast("Admin session expired. Please sign in again.");
      return;
    }
    if (isCoreServiceSlug(current.slug)) {
      if (typeof window.showToast === "function") window.showToast("Core services cannot be deleted");
      return;
    }
    if (!window.confirm("Delete " + (current.name || "this service") + "? This removes it from the admin list and public catalogue.")) return;
    state.saving = true;
    state.error = "";
    renderStandalone();
    try {
      const response = await fetch(window.location.origin + "/api/services/" + encodeURIComponent(current.slug), {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + token
        }
      });
      const data = await response.json().catch(function(){ return {}; });
      if (!response.ok) throw new Error(data.error || "Could not delete service");
      state.entries = ensureEntries(state.entries.filter(function(item){ return item.slug !== current.slug; }));
      window.serviceEntries = state.entries.slice();
      state.slug = state.entries[0] ? state.entries[0].slug : 'web-development';
      if (typeof window.showToast === "function") window.showToast("Service deleted");
    } catch (err) {
      state.error = err && err.message ? err.message : "Could not delete service";
      if (typeof window.showToast === "function") window.showToast(state.error);
    } finally {
      state.saving = false;
      renderStandalone();
    }
  };
  window.__ymStandaloneServicesSelect = function(slug){
    state.slug = slug;
    renderStandalone();
  };

  window.renderServicesManager = renderStandalone;
  window.loadServicesData = function(options){
    const render = !options || options.render !== false;
    const preferFallback = !!(options && options.preferFallback);
    return syncAdminServices(render, preferFallback);
  };
  window.selectServiceSlug = window.__ymStandaloneServicesSelect;
  window.reloadServicesManager = window.__ymStandaloneServicesReload;
  window.saveServiceConfig = saveStandalone;

  const originalLoadAll = typeof window.loadAll === "function" ? window.loadAll : null;
  if (originalLoadAll) {
    window.loadAll = async function(){
      const result = await originalLoadAll.apply(this, arguments);
      await syncAdminServices(currentAdminPage() === "services", false);
      return result;
    };
  }

  const originalRefreshAdminData = typeof window.refreshAdminData === "function" ? window.refreshAdminData : null;
  window.refreshAdminData = async function(){
    if (originalRefreshAdminData) {
      await originalRefreshAdminData.apply(this, arguments);
    } else if (typeof window.loadAll === "function") {
      await window.loadAll();
    }
    if (currentAdminPage() === "services") {
      await syncAdminServices(true, false);
    }
  };

  const originalNav = typeof window.nav === "function" ? window.nav : null;
  if (originalNav) {
    window.nav = function(page, options){
      const result = originalNav.apply(this, arguments);
      if (String(page || "") === "services") {
        setTimeout(function(){ syncAdminServices(true, false); }, 0);
      }
      return result;
    };
  }

  function boot() {
    if (currentAdminPage() === "services") {
      setTimeout(function(){ syncAdminServices(true, false); }, 20);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
</script>`;
}

function sendShellFile(res, fileName) {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
    "X-YoungMinds-Build": FRONTEND_BUILD_TAG
  });
  const fullPath = path.join(rootDir, fileName);
  if (fileName === "n.html") {
    try {
      const html = fs.readFileSync(fullPath, "utf8");
      return res.send(html.replace("</body>", `${adminServicesHotfixScript()}</body>`));
    } catch (err) {
      console.error("❌ Admin shell inject failed:", err.message);
    }
  }
  return res.sendFile(fullPath);
}

app.get("/admin",  (req, res) => sendShellFile(res, "n.html"));
app.get("/admin/services",  (req, res) => sendShellFile(res, "n.html"));
app.get("/admin/packages-pricing",  (req, res) => sendShellFile(res, "n.html"));
app.get("/member", (req, res) => sendShellFile(res, "s.html"));
app.get("/portal/projects", (req, res) => sendShellFile(res, "s.html"));
app.get("/hire",   (req, res) => sendShellFile(res, "p.html"));
app.get("/pricing-calculator", (req, res) => res.redirect("/packages-pricing"));
app.use("/static", express.static(rootDir));
app.use("/uploads", express.static(uploadsDir));

/* ══════════════════════════════════════════
   HEALTH CHECK
══════════════════════════════════════════ */
app.get("/", (req, res) => sendShellFile(res, "p.html"));
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    ts: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

/* ══════════════════════════════════════════
   MONGODB CONNECTION
══════════════════════════════════════════ */
mongoose.set("strictQuery", false);

let dbReadyPromise = Promise.resolve(false);

function connectToDatabase() {
  if (!process.env.MONGO_URI) {
    console.warn("⚠️  MONGO_URI not set. API will start without MongoDB connection.");
    return Promise.resolve(false);
  }

  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return Promise.resolve(true);
  }

  dbReadyPromise = mongoose.connect(process.env.MONGO_URI)
    .then(() => {
      console.log("✅ MongoDB Connected");
      return true;
    })
    .catch(err => {
      console.error("❌ MongoDB Error:", err.message);
      if (require.main === module) {
        process.exit(1);
      }
      return false;
    });

  return dbReadyPromise;
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function normalizeEmail(raw) {
  return (raw || "").trim().toLowerCase();
}
function normalizePhone(raw) {
  return (raw || "").replace(/[^0-9]/g, "");
}
function normalizeAdminUsername(raw) {
  return String(raw || "").trim().toLowerCase();
}
function hashPassword(pw) {
  return crypto.createHash("sha256").update(pw + "ym-salt-2026").digest("hex");
}
function getTokenTtlSeconds(remember) {
  return remember ? REMEMBER_ME_TTL_SECONDS : DEFAULT_TTL_SECONDS;
}
function readBearerToken(req) {
  const header = String(req.get("Authorization") || "");
  const [scheme, token] = header.split(/\s+/);
  if (/^Bearer$/i.test(scheme || "") && token) {
    return token;
  }
  if (typeof req.query?.token === "string" && req.query.token.trim()) {
    return req.query.token.trim();
  }
  return null;
}
function getDefaultAdminUsername() {
  return normalizeAdminUsername(process.env.ADMIN_USERNAME || "admin") || "admin";
}
function getDefaultAdminPasswordHash() {
  return hashPassword(process.env.ADMIN_PASSWORD || "youngminds2026");
}
function sanitizeFilename(input) {
  return String(input || "file")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "file";
}
function normalizeProjectDeliveryStage(raw, fallback = "inprogress") {
  const stage = String(raw || fallback).trim().toLowerCase();
  return ["inprogress", "review", "delivered"].includes(stage) ? stage : fallback;
}
function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
}
async function ensureSubmissionUploadDir() {
  await fs.promises.mkdir(submissionUploadsDir, { recursive: true });
}
async function saveSubmissionFile(file) {
  const parsed = parseDataUrl(file?.dataUrl);
  if (!parsed) throw new Error("Invalid file payload");
  if (!file?.name) throw new Error("File name is required");
  if (parsed.buffer.length > MAX_SUBMISSION_FILE_BYTES) {
    throw new Error("File exceeds 50MB limit");
  }

  await ensureSubmissionUploadDir();
  const ext = path.extname(String(file.name || "")).slice(0, 15);
  const base = sanitizeFilename(path.basename(String(file.name || "submission"), ext));
  const fileName = `${Date.now()}-${crypto.randomUUID()}-${base}${ext}`;
  const absPath = path.join(submissionUploadsDir, fileName);
  await fs.promises.writeFile(absPath, parsed.buffer);
  return {
    fileName: file.name,
    mimeType: file.type || parsed.mimeType || "application/octet-stream",
    fileSize: parsed.buffer.length,
    filePath: `/uploads/project-submissions/${fileName}`
  };
}
function emitRealtimeEvent(type, payload, audience = {}) {
  const body = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of realtimeClients) {
    const roleMatch = !audience.roles || audience.roles.includes(client.role);
    const memberMatch = !audience.memberIds || audience.memberIds.includes(client.memberId);
    if (roleMatch && memberMatch) {
      client.res.write(body);
    }
  }
}
function toWhatsAppE164(raw, defaultCountryCode = "91") {
  const digits = normalizePhone(raw || "");
  if (!digits) return "";
  if (digits.length === 10) return `+${defaultCountryCode}${digits}`;
  if (digits.length === 12) return `+${digits}`;
  const lastTen = digits.slice(-10);
  if (lastTen.length === 10) return `+${defaultCountryCode}${lastTen}`;
  return "";
}
function canSendHiringWhatsApp() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);
}
async function sendHiringWhatsApp(member) {
  if (!canSendHiringWhatsApp()) return { skipped: true, reason: "twilio_not_configured" };
  const to = toWhatsAppE164(member?.phone);
  if (!to) return { skipped: true, reason: "missing_phone" };

  const body =
    `Hi ${member?.name || "there"}, congratulations! ` +
    `You are hired as a member of YoungMinds Agency.`;

  const params = new URLSearchParams();
  params.set("From", process.env.TWILIO_WHATSAPP_FROM);
  params.set("To", `whatsapp:${to}`);
  params.set("Body", body);

  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio error ${res.status}: ${text}`);
  }

  return { ok: true };
}

/** Last 10 digits match, or last-4 match when user enters 4 digits */
function memberPhoneMatches(verifyInput, storedPhone) {
  const v = normalizePhone(verifyInput || "");
  const s = normalizePhone(storedPhone || "");
  if (v.length < 4 || s.length < 4) return false;
  if (v.length >= 10) return v.slice(-10) === s.slice(-10);
  if (v.length === 4) return s.slice(-4) === v;
  return s.endsWith(v) || v.slice(-10) === s.slice(-10);
}

/* ══════════════════════════════════════════
   SCHEMA: APPLICATION
   Status flow: new → reviewing → hired | rejected
              (accepted is kept for backward compat but new flow is strict)
══════════════════════════════════════════ */
const applicationSchema = new mongoose.Schema({
  type:         { type: String, default: "application" },
  name:         { type: String, required: true },
  phone:        String,
  email:        String,
  college:      String,
  year:         String,
  city:         String,
  skill:        String,
  experience:   String,
  portfolio:    String,
  achievements: { type: Array, default: [] },
  achievementTitle: String,
  achievementLink:  String,
  availability: String,
  why:          String,
  status:       { type: String, default: "new", enum: ["new","reviewing","accepted","hired","inwork","rejected"] },
  timestamp:    { type: Date, default: Date.now },
  // Auth fields
  password:     String,   // hashed
  gmail:        String,   // Gmail used for login (same as email but explicit)
  profilePic:   String,   // base64 data URL or URL
  // Password reset
  resetToken:   String,
  resetExpiry:  Date,
}, { strict: false, timestamps: false });

const Application = mongoose.model("Application", applicationSchema);

/* ══════════════════════════════════════════
   SCHEMA: BOARD OF MEMBERS
══════════════════════════════════════════ */
const boardMemberSchema = new mongoose.Schema({
  applicationId: { type: String, default: "" },
  name:        { type: String, required: true },
  designation: { type: String, default: "" },
  skills:      { type: [String], default: [] },
  bio:         { type: String, default: "" },
  photo:       { type: String, default: "" },
  order:       { type: Number, default: 0 },
  active:      { type: Boolean, default: true }
}, { timestamps: true });

const BoardMember = mongoose.model("BoardMember", boardMemberSchema);

function inrToUsd(amount) {
  return Math.max(0, Math.round(Number(amount || 0) / 83));
}

function createCataloguePackage(name, priceInr, options = {}) {
  return {
    name,
    price_inr: Math.max(0, Number(priceInr || 0)),
    price_usd: Math.max(0, Number(options.price_usd || inrToUsd(priceInr))),
    delivery: String(options.delivery || "").trim(),
    revisions: String(options.revisions || "").trim(),
    duration: String(options.duration || "").trim(),
    isPopular: Boolean(options.isPopular),
    features: Array.isArray(options.features) ? options.features.map(item => String(item || "").trim()).filter(Boolean).slice(0, 12) : []
  };
}

function createCatalogueSector(title, description, packages = []) {
  return {
    title: String(title || "").trim(),
    description: String(description || "").trim(),
    packages
  };
}

const SERVICE_DEFAULTS = [
  {
    slug: "web-development",
    name: "Web Development",
    shortLabel: "Web",
    valueProp: "Conversion-focused websites and digital products built fast, clean, and ready to scale.",
    meta_description: "YoungMinds Agency builds responsive websites, landing pages, and internal tools for modern Indian businesses.",
    og_image_url: "/static/assets/logo-ym.jpg",
    pricing_min_inr: 5000,
    pricing_max_inr: 50000,
    deliverables: [
      "Responsive website design",
      "Landing page build",
      "CMS or admin integration",
      "Speed and SEO basics",
      "Form and lead capture setup",
      "Launch support and QA"
    ],
    sectors: [
      createCatalogueSector("School Websites", "Clean admission-first websites for schools that need trust, clarity, and enquiry flow.", [
        createCataloguePackage("Basic", 4999, { delivery: "4-6 days", revisions: "1 round", duration: "4-5 pages", features: ["Home, about, academics, contact", "Mobile responsive layout", "Admission enquiry form", "WhatsApp integration", "Google Maps and contact block", "Basic SEO setup"] }),
        createCataloguePackage("Standard", 8999, { delivery: "7-10 days", revisions: "2 rounds", duration: "6-8 pages", isPopular: true, features: ["Everything in Basic", "Faculty and facilities pages", "Gallery and announcements", "Downloadable forms section", "Photo optimization", "Admin-editable notices block"] }),
        createCataloguePackage("Premium", 14999, { delivery: "12-16 days", revisions: "Unlimited", duration: "10+ pages", features: ["Everything in Standard", "Admission workflow pages", "Events and achievements section", "Custom UI system", "Advanced speed tuning", "Full admin panel"] })
      ]),
      createCatalogueSector("Tuition & Coaching Websites", "Lead-focused sites for institutes, trainers, and academy operators.", [
        createCataloguePackage("Basic", 5999, { delivery: "4-6 days", revisions: "1 round", duration: "4-5 pages", features: ["Course showcase pages", "Lead form and CTA blocks", "Class timing section", "Student testimonial block", "WhatsApp click-to-chat", "Responsive design"] }),
        createCataloguePackage("Standard", 9999, { delivery: "8-11 days", revisions: "2 rounds", duration: "6-8 pages", isPopular: true, features: ["Everything in Basic", "Faculty intro section", "Lead segmentation forms", "Results and gallery pages", "Basic admin updates", "SEO-ready page structure"] }),
        createCataloguePackage("Premium", 16999, { delivery: "12-18 days", revisions: "Unlimited", duration: "10+ pages", features: ["Everything in Standard", "Student dashboard-ready flow", "Online batch listing", "Custom branding and sections", "Integrated enquiry CRM handoff", "Priority support"] })
      ]),
      createCatalogueSector("Business Websites", "Professional business sites for agencies, consultants, and local brands.", [
        createCataloguePackage("Basic", 6999, { delivery: "5-7 days", revisions: "1 round", duration: "5 pages", features: ["Business profile pages", "Services overview", "Lead form and CTA", "Mobile responsive build", "Basic analytics", "Google business integration"] }),
        createCataloguePackage("Standard", 12999, { delivery: "9-13 days", revisions: "2 rounds", duration: "8 pages", isPopular: true, features: ["Everything in Basic", "Case study or testimonial sections", "Custom contact funnels", "Blog-ready CMS", "Basic admin panel", "Conversion-focused page structure"] }),
        createCataloguePackage("Premium", 24999, { delivery: "14-20 days", revisions: "Unlimited", duration: "12+ pages", features: ["Everything in Standard", "Custom UI direction", "Advanced landing sections", "CRM-ready forms", "Offer and campaign blocks", "Expanded admin control"] })
      ]),
      createCatalogueSector("E-Commerce Websites", "Online stores built for product display, enquiry, and checkout-ready growth.", [
        createCataloguePackage("Basic", 14999, { delivery: "8-12 days", revisions: "1 round", duration: "Up to 25 products", features: ["Storefront setup", "Product pages", "Cart and checkout", "Payment gateway integration", "Mobile commerce layout", "Order email flow"] }),
        createCataloguePackage("Standard", 27999, { delivery: "14-20 days", revisions: "2 rounds", duration: "Up to 80 products", isPopular: true, features: ["Everything in Basic", "Collection filtering", "Coupon setup", "Basic inventory workflow", "Admin dashboard", "Shipping rule setup"] }),
        createCataloguePackage("Premium", 49999, { delivery: "20-28 days", revisions: "Unlimited", duration: "100+ products", features: ["Everything in Standard", "Custom storefront UI", "Upsell and cross-sell blocks", "Advanced catalog filters", "Marketing automation hooks", "Priority launch support"] })
      ]),
      createCatalogueSector("Portfolio Websites", "Simple, sharp portfolio sites for freelancers, creators, and personal brands.", [
        createCataloguePackage("Basic", 3999, { delivery: "3-4 days", revisions: "1 round", duration: "Single-page", features: ["Single-page profile site", "Project gallery", "Contact CTA", "Mobile responsive", "Social links", "Fast deploy"] }),
        createCataloguePackage("Standard", 7499, { delivery: "5-7 days", revisions: "2 rounds", duration: "4-5 pages", isPopular: true, features: ["Everything in Basic", "Case study pages", "Services and testimonials", "Contact form", "Resume download", "Basic SEO"] }),
        createCataloguePackage("Premium", 11999, { delivery: "8-10 days", revisions: "Unlimited", duration: "6+ pages", features: ["Everything in Standard", "Custom animations", "Premium gallery layout", "Blog or writing section", "Lead capture CTA", "Priority polishing"] })
      ]),
      createCatalogueSector("Custom & AI-Powered Websites", "Custom platforms with automation, AI workflows, and business logic baked in.", [
        createCataloguePackage("Basic", 24999, { delivery: "12-16 days", revisions: "1 round", duration: "Custom scope", features: ["Custom build foundation", "Dynamic content setup", "API-ready architecture", "Admin controls", "Core automation hooks", "Technical QA"] }),
        createCataloguePackage("Standard", 44999, { delivery: "18-25 days", revisions: "2 rounds", duration: "Custom scope", isPopular: true, features: ["Everything in Basic", "AI assistant workflow", "Lead qualification automation", "CRM or Sheets sync", "Custom dashboard views", "Improved scalability"] }),
        createCataloguePackage("Premium", 74999, { delivery: "25-35 days", revisions: "Unlimited", duration: "Advanced custom scope", features: ["Everything in Standard", "Multi-step AI flows", "Custom integrations", "Team roles and permissions", "Priority launch and support", "Ongoing optimisation handoff"] })
      ])
    ],
    pricing_packages: [
      {
        name: "Basic",
        price_inr: 4999,
        price_usd: inrToUsd(4999),
        delivery: "4-6 days",
        revisions: "1 round",
        duration: "4-5 pages",
        features: ["4 pages","Template design","Mobile responsive","Contact form","WhatsApp chat button","Google Maps embed"]
      },
      {
        name: "Standard",
        price_inr: 9499,
        price_usd: inrToUsd(9499),
        delivery: "9-13 days",
        revisions: "2 rounds",
        duration: "6-8 pages",
        isPopular: true,
        features: ["8 pages","Semi-custom branding","Booking or enquiry form","Gallery and testimonials","Pricing section","Basic admin panel"]
      },
      {
        name: "Premium",
        price_inr: 17999,
        price_usd: inrToUsd(17999),
        delivery: "16-22 days",
        revisions: "Unlimited",
        duration: "10+ pages",
        features: ["12+ pages","100% custom UI","Online booking system","Service catalogue filters","Offer banners","Full admin panel"]
      }
    ]
  },
  {
    slug: "graphic-design",
    name: "Graphic Design",
    shortLabel: "Design",
    valueProp: "Brand visuals that look sharp, feel consistent, and work across digital and print touchpoints.",
    meta_description: "YoungMinds Agency creates logos, launch creatives, brand systems, and everyday design assets for growing brands.",
    og_image_url: "/static/assets/logo-ym.jpg",
    pricing_min_inr: 2000,
    pricing_max_inr: 25000,
    deliverables: [
      "Logo and identity concepts",
      "Brand color and type direction",
      "Social and ad creatives",
      "Print-ready collateral",
      "Presentation and deck design",
      "Design source files handoff"
    ],
    sectors: [
      createCatalogueSector("Graphic Design Packages", "Design support across brand, campaign, and launch needs with clean, editable asset delivery.", [
        createCataloguePackage("Basic", 2000, { delivery: "2-3 days", revisions: "1 round", duration: "1 creative set", features: ["One branded creative set", "Template-led design", "Export-ready files", "Social post sizing", "Brand colour alignment", "Basic support"] }),
        createCataloguePackage("Standard", 7999, { delivery: "4-6 days", revisions: "2 rounds", duration: "Multi-asset pack", isPopular: true, features: ["Multiple campaign assets", "Semi-custom design system", "Presentation or flyer support", "Print-ready exports", "Source file handoff", "Stronger brand consistency"] }),
        createCataloguePackage("Premium", 15999, { delivery: "7-10 days", revisions: "Unlimited", duration: "Full campaign suite", features: ["Brand identity suite", "Custom visual language", "Launch campaign graphics", "Print and digital formats", "Design source files", "Priority support"] })
      ])
    ],
    pricing_packages: [
      {
        name: "Basic",
        price_inr: 2000,
        price_usd: inrToUsd(2000),
        delivery: "2-3 days",
        revisions: "1 round",
        duration: "1 creative set",
        features: ["1 core creative set","Template-led design","Brand colour usage","Export-ready files","Social post sizing","Basic support"]
      },
      {
        name: "Standard",
        price_inr: 7999,
        price_usd: inrToUsd(7999),
        delivery: "4-6 days",
        revisions: "2 rounds",
        duration: "Multi-asset pack",
        isPopular: true,
        features: ["Multi-asset pack","Semi-custom design system","Social and ad creatives","Presentation slides","Print-ready files","Source handoff"]
      },
      {
        name: "Premium",
        price_inr: 15999,
        price_usd: inrToUsd(15999),
        delivery: "7-10 days",
        revisions: "Unlimited",
        duration: "Full campaign suite",
        features: ["Brand identity suite","Custom visual language","Campaign creative system","Print and digital formats","Design source files","Priority support"]
      }
    ]
  },
  {
    slug: "social-media",
    name: "Social Media",
    shortLabel: "Social",
    valueProp: "Consistent social content systems that turn scattered posting into a clear growth rhythm.",
    meta_description: "YoungMinds Agency manages social media content planning, creative production, and publishing support for brands in India.",
    og_image_url: "/static/assets/logo-ym.jpg",
    pricing_min_inr: 4000,
    pricing_max_inr: 30000,
    deliverables: [
      "Monthly content calendar",
      "Post and reel concepts",
      "Caption writing",
      "Creative asset coordination",
      "Publishing support",
      "Performance review summary"
    ],
    sectors: [
      createCatalogueSector("Social Media Management", "A consistent content engine for brands that need planning, execution, and reporting in one lane.", [
        createCataloguePackage("Basic", 4000, { delivery: "5-7 days setup", revisions: "1 round", duration: "1 platform / month", features: ["One-platform content plan", "8 post ideas", "Caption support", "Basic design direction", "Publishing checklist", "Monthly summary"] }),
        createCataloguePackage("Standard", 12000, { delivery: "7-10 days setup", revisions: "2 rounds", duration: "2 platforms / month", isPopular: true, features: ["Two-platform strategy", "Content calendar", "Reel concepts", "Caption writing", "Creative coordination", "Performance review"] }),
        createCataloguePackage("Premium", 24000, { delivery: "10-14 days setup", revisions: "Unlimited", duration: "3+ platforms / month", features: ["Multi-platform system", "Campaign planning", "Advanced reporting", "Trend and hook research", "Publishing workflows", "Priority support"] })
      ])
    ],
    pricing_packages: [
      {
        name: "Basic",
        price_inr: 4000,
        price_usd: inrToUsd(4000),
        delivery: "5-7 days setup",
        revisions: "1 round",
        duration: "1 platform / month",
        features: ["1 platform plan","8 post ideas","Caption support","Basic design guidance","Publishing checklist","Monthly summary"]
      },
      {
        name: "Standard",
        price_inr: 12000,
        price_usd: inrToUsd(12000),
        delivery: "7-10 days setup",
        revisions: "2 rounds",
        duration: "2 platforms / month",
        isPopular: true,
        features: ["2 platform strategy","Content calendar","Reel concepts","Caption writing","Creative coordination","Performance review"]
      },
      {
        name: "Premium",
        price_inr: 24000,
        price_usd: inrToUsd(24000),
        delivery: "10-14 days setup",
        revisions: "Unlimited",
        duration: "3+ platforms / month",
        features: ["3+ platform system","Campaign planning","Advanced reporting","Trend and hook research","Publishing workflows","Priority support"]
      }
    ]
  },
  {
    slug: "ai-solutions",
    name: "AI Solutions",
    shortLabel: "AI",
    valueProp: "Practical AI systems that automate repetitive work and make your team faster without extra complexity.",
    meta_description: "YoungMinds Agency designs automation flows, assistants, and lightweight AI tools for business workflows in India.",
    og_image_url: "/static/assets/logo-ym.jpg",
    pricing_min_inr: 8000,
    pricing_max_inr: 100000,
    deliverables: [
      "Workflow audit and use-case mapping",
      "Custom AI assistant setup",
      "Automation logic and prompts",
      "Tool integrations",
      "Testing and guardrails",
      "Team onboarding guidance"
    ],
    sectors: [
      createCatalogueSector("AI Chatbots", "FAQ, lead capture, and customer-support chatbots tailored to your workflow.", [
        createCataloguePackage("Basic", 7999, { delivery: "5-7 days", revisions: "1 round", duration: "Single assistant", features: ["Website or WhatsApp bot", "Up to 20 Q&A flows", "Lead capture setup", "Basic branding", "Google Sheets logging", "7 days support"] }),
        createCataloguePackage("Standard", 14999, { delivery: "10-14 days", revisions: "2 rounds", duration: "Multi-flow assistant", isPopular: true, features: ["Multi-step conversations", "Natural language responses", "Lead qualification logic", "CRM or Sheets sync", "Follow-up automations", "Analytics dashboard"] }),
        createCataloguePackage("Premium", 27999, { delivery: "18-25 days", revisions: "Unlimited", duration: "Advanced custom assistant", features: ["Custom trained assistant", "Unlimited intent flows", "CRM/email/Zapier integration", "Escalation routing", "Advanced analytics", "60 days support"] })
      ]),
      createCatalogueSector("Business Automation Systems", "Internal automations that remove repetitive manual work for ops and admin teams.", [
        createCataloguePackage("Basic", 9999, { delivery: "6-8 days", revisions: "1 round", duration: "1 workflow", features: ["One business workflow automation", "Sheets or form integration", "Task/status notifications", "Basic dashboard", "Error checks", "Deployment support"] }),
        createCataloguePackage("Standard", 18999, { delivery: "10-15 days", revisions: "2 rounds", duration: "2-3 workflows", isPopular: true, features: ["Multiple workflow automations", "CRM and email triggers", "Approval routing", "Status dashboard", "Role-aware notifications", "Documentation"] }),
        createCataloguePackage("Premium", 34999, { delivery: "18-28 days", revisions: "Unlimited", duration: "Cross-team automations", features: ["Advanced workflow engine", "Custom integrations", "Ops dashboard", "Escalation flows", "Team onboarding", "Priority support"] })
      ]),
      createCatalogueSector("Lead Generation & Conversion AI", "AI systems that qualify, route, and nurture enquiries faster.", [
        createCataloguePackage("Basic", 11999, { delivery: "7-10 days", revisions: "1 round", duration: "Single funnel", features: ["Lead capture assistant", "Qualification prompts", "Google Sheets sync", "Basic follow-up automation", "CRM-ready export", "Conversion notes"] }),
        createCataloguePackage("Standard", 21999, { delivery: "12-18 days", revisions: "2 rounds", duration: "Multi-step funnel", isPopular: true, features: ["Lead routing logic", "Automated reminders", "Channel attribution logging", "CRM integration", "Sales handoff support", "Dashboard reporting"] }),
        createCataloguePackage("Premium", 39999, { delivery: "20-30 days", revisions: "Unlimited", duration: "Advanced conversion engine", features: ["Custom AI lead scoring", "Channel-specific flows", "Email and WhatsApp follow-up", "Escalation routing", "Advanced analytics", "Priority optimization"] })
      ]),
      createCatalogueSector("AI Content & Marketing Automation", "Prompted content engines and campaign workflows for teams shipping regularly.", [
        createCataloguePackage("Basic", 8999, { delivery: "5-7 days", revisions: "1 round", duration: "Single content workflow", features: ["AI prompt system", "Content idea generation", "Basic review flow", "Sheets tracking", "One publishing workflow", "Team walkthrough"] }),
        createCataloguePackage("Standard", 16999, { delivery: "9-14 days", revisions: "2 rounds", duration: "Campaign workflow", isPopular: true, features: ["Campaign prompt library", "Approval workflow", "Asset tracking", "Publishing checklist", "Performance tracker", "Revision-ready setup"] }),
        createCataloguePackage("Premium", 29999, { delivery: "16-24 days", revisions: "Unlimited", duration: "Full marketing automation", features: ["Multi-channel content engine", "Repurposing workflows", "Lead magnet automation", "CRM sync", "Reporting dashboard", "Priority support"] })
      ]),
      createCatalogueSector("Custom AI Solutions", "Custom AI work for unique internal tools, client products, or advanced team workflows.", [
        createCataloguePackage("Basic", 19999, { delivery: "10-14 days", revisions: "1 round", duration: "Starter custom scope", features: ["Discovery and scoping", "One custom AI workflow", "Prototype build", "Basic integration", "Testing and guardrails", "Documentation"] }),
        createCataloguePackage("Standard", 39999, { delivery: "18-25 days", revisions: "2 rounds", duration: "Mid custom scope", isPopular: true, features: ["Custom use-case mapping", "Multiple AI flows", "API integration", "Dashboard layer", "Role permissions", "Launch support"] }),
        createCataloguePackage("Premium", 79999, { delivery: "28-40 days", revisions: "Unlimited", duration: "Advanced custom scope", features: ["End-to-end custom AI system", "Advanced integrations", "Scalable architecture", "Team onboarding", "Priority support", "Optimisation handoff"] })
      ])
    ],
    pricing_packages: [
      {
        name: "Basic",
        price_inr: 7999,
        price_usd: inrToUsd(7999),
        delivery: "5-7 days",
        revisions: "1 round",
        duration: "Single assistant",
        features: ["1 platform chatbot","FAQ response flows","Up to 20 Q&A pairs","Lead capture","Google Sheets logging","7 days support"]
      },
      {
        name: "Standard",
        price_inr: 14999,
        price_usd: inrToUsd(14999),
        delivery: "10-14 days",
        revisions: "2 rounds",
        duration: "Multi-flow assistant",
        isPopular: true,
        features: ["2 platform assistant","Natural language responses","Lead qualification","CRM or Sheets sync","Automated follow-ups","Analytics dashboard"]
      },
      {
        name: "Premium",
        price_inr: 27999,
        price_usd: inrToUsd(27999),
        delivery: "18-25 days",
        revisions: "Unlimited",
        duration: "Advanced custom assistant",
        features: ["3 platform AI assistant","Custom business training","Unlimited intent flows","CRM/email/Zapier integration","Sentiment routing","60 days support"]
      }
    ]
  },
  {
    slug: "video-editing",
    name: "Video Editing",
    shortLabel: "Video",
    valueProp: "Fast-moving edits for reels, explainers, and campaign content that feel current and watchable.",
    meta_description: "YoungMinds Agency edits reels, explainers, launch videos, and short-form content for brands and creators.",
    og_image_url: "/static/assets/logo-ym.jpg",
    pricing_min_inr: 2500,
    pricing_max_inr: 30000,
    deliverables: [
      "Short-form reel editing",
      "Motion graphics support",
      "Captions and text overlays",
      "Sound polish and pacing",
      "Multiple export formats",
      "Revision-ready project files"
    ],
    sectors: [
      createCatalogueSector("Short-Form Content", "Reels, shorts, and TikTok-style edits focused on speed, hooks, and retention.", [
        createCataloguePackage("Basic", 4999, { delivery: "3 working days", revisions: "1 round", duration: "3 videos / up to 60 sec", price_usd: 60, features: ["3 short-form videos", "Basic cuts and transitions", "Royalty-free music", "Simple text overlays", "1080p export", "Platform-ready formatting"] }),
        createCataloguePackage("Standard", 9999, { delivery: "5 working days", revisions: "2 rounds", duration: "6 videos / up to 90 sec", price_usd: 120, isPopular: true, features: ["6 short-form videos", "Subtitles", "Sound design", "Text animations", "Multi-platform exports", "Higher retention pacing"] }),
        createCataloguePackage("Premium", 18999, { delivery: "7 working days", revisions: "Unlimited", duration: "12 videos / advanced styling", price_usd: 229, features: ["12 short-form videos", "Cinematic pacing", "Styled subtitles", "Advanced colour grading", "Motion graphics", "Priority support"] })
      ]),
      createCatalogueSector("Long-Form Content", "YouTube, podcasts, and explainers edited for structure, pacing, and viewer retention.", [
        createCataloguePackage("Basic", 7999, { delivery: "4-6 working days", revisions: "1 round", duration: "Up to 10 min", price_usd: 96, features: ["Single long-form edit", "Clean cut-down", "Basic audio cleanup", "Simple lower thirds", "1080p export", "Thumbnail frame suggestions"] }),
        createCataloguePackage("Standard", 14999, { delivery: "6-8 working days", revisions: "2 rounds", duration: "Up to 20 min", price_usd: 181, isPopular: true, features: ["Everything in Basic", "Advanced pacing", "Subtitles", "Music mixing", "Section title cards", "YouTube-ready delivery"] }),
        createCataloguePackage("Premium", 24999, { delivery: "8-12 working days", revisions: "Unlimited", duration: "Up to 30 min", price_usd: 301, features: ["Everything in Standard", "Motion graphics", "Colour polish", "B-roll integration", "Multi-camera sync", "Priority turnaround"] })
      ]),
      createCatalogueSector("Monthly Social Media Content Packs", "Recurring content packs for brands and creators who need volume each month.", [
        createCataloguePackage("Basic", 11999, { delivery: "5-7 working days", revisions: "1 round", duration: "8 edits / month", price_usd: 145, features: ["8 edited videos", "Short-form formatting", "Captions", "Music and transitions", "Monthly delivery batch", "Basic creative consistency"] }),
        createCataloguePackage("Standard", 21999, { delivery: "7-10 working days", revisions: "2 rounds", duration: "16 edits / month", price_usd: 265, isPopular: true, features: ["16 edited videos", "Hook optimisation", "Subtitles and branding", "Audio polish", "Batch delivery management", "Reel-first strategy support"] }),
        createCataloguePackage("Premium", 34999, { delivery: "10-14 working days", revisions: "Unlimited", duration: "24 edits / month", price_usd: 422, features: ["24 edited videos", "Advanced visual system", "Motion graphics", "Repurposed cutdowns", "Priority scheduling", "High-volume creator support"] })
      ]),
      createCatalogueSector("Promotional & Advertisement Videos", "Campaign videos for launches, offers, and conversion-driven promotions.", [
        createCataloguePackage("Basic", 8999, { delivery: "4-6 working days", revisions: "1 round", duration: "30-60 sec ad", price_usd: 108, features: ["Single promo video", "Text overlays", "Basic pacing", "Music syncing", "Offer CTA framing", "1080p export"] }),
        createCataloguePackage("Standard", 16999, { delivery: "6-8 working days", revisions: "2 rounds", duration: "60-90 sec campaign edit", price_usd: 205, isPopular: true, features: ["Everything in Basic", "Brand graphics", "Faster cuts", "Sound design", "Multiple aspect ratios", "Ad-ready deliverables"] }),
        createCataloguePackage("Premium", 29999, { delivery: "8-12 working days", revisions: "Unlimited", duration: "High-end promo package", price_usd: 361, features: ["Everything in Standard", "Advanced motion graphics", "Colour grading", "Voiceover alignment", "Launch assets export", "Priority revisions"] })
      ]),
      createCatalogueSector("Advanced & Cinematic Editing", "Premium edits for campaigns, storytelling, and high-finish brand pieces.", [
        createCataloguePackage("Basic", 14999, { delivery: "5-7 working days", revisions: "1 round", duration: "Single cinematic edit", price_usd: 181, features: ["Narrative structure", "Colour correction", "Music and pacing", "Title cards", "1080p/4K export", "Creative polish"] }),
        createCataloguePackage("Standard", 26999, { delivery: "8-10 working days", revisions: "2 rounds", duration: "Cinematic campaign edit", price_usd: 325, isPopular: true, features: ["Everything in Basic", "Advanced colour grade", "Sound design", "Motion text", "Stylised subtitles", "Higher-end polish"] }),
        createCataloguePackage("Premium", 44999, { delivery: "10-14 working days", revisions: "Unlimited", duration: "Full premium package", price_usd: 542, features: ["Everything in Standard", "Complex motion graphics", "Multi-format exports", "Priority turnaround", "Creative direction support", "Premium finish"] })
      ])
    ],
    pricing_packages: [
      {
        name: "Basic",
        price_inr: 4999,
        price_usd: 60,
        delivery: "3 working days",
        revisions: "1 round",
        duration: "3 videos / up to 60 sec",
        features: ["3 short-form videos","Up to 60 seconds each","Basic cuts and transitions","Royalty-free music","Simple text overlays","1080p export"]
      },
      {
        name: "Standard",
        price_inr: 9999,
        price_usd: 120,
        delivery: "5 working days",
        revisions: "2 rounds",
        duration: "6 videos / up to 90 sec",
        isPopular: true,
        features: ["6 short-form videos","Up to 90 seconds each","Subtitles","Sound design","Text animations","Multi-platform formats"]
      },
      {
        name: "Premium",
        price_inr: 18999,
        price_usd: 229,
        delivery: "7 working days",
        revisions: "Unlimited",
        duration: "12 videos / advanced styling",
        features: ["12 short-form videos","Cinematic pacing","Styled subtitles","Advanced colour grading","Motion graphics","Priority support"]
      }
    ]
  },
  {
    slug: "content-writing",
    name: "Content Writing",
    shortLabel: "Content",
    valueProp: "Clear, persuasive writing for websites, campaigns, and content engines that need a stronger voice.",
    meta_description: "YoungMinds Agency writes website copy, blogs, product messaging, and social content for modern businesses.",
    og_image_url: "/static/assets/logo-ym.jpg",
    pricing_min_inr: 1500,
    pricing_max_inr: 20000,
    deliverables: [
      "Website and landing copy",
      "Brand messaging direction",
      "Blog and article writing",
      "Product or service descriptions",
      "Campaign content support",
      "Editing and proofreading"
    ],
    sectors: [
      createCatalogueSector("Content Writing Packages", "Clear website, campaign, and content-system writing with SEO-ready structure and revision room.", [
        createCataloguePackage("Basic", 1500, { delivery: "2-3 days", revisions: "1 round", duration: "2 pages / short copy set", features: ["Up to 2 pages of copy", "Basic brand tone", "Service descriptions", "CTA refinement", "Editing pass", "Delivery-ready copy"] }),
        createCataloguePackage("Standard", 6500, { delivery: "4-6 days", revisions: "2 rounds", duration: "Website + article support", isPopular: true, features: ["Website copy set", "Brand messaging direction", "Blog or article draft", "SEO-friendly structure", "Product descriptions", "Proofreading"] }),
        createCataloguePackage("Premium", 14000, { delivery: "7-10 days", revisions: "Unlimited", duration: "Multi-page content system", features: ["Multi-page copy system", "Campaign messaging", "Long-form content", "Voice and tone guide", "Content engine planning", "Priority support"] })
      ])
    ],
    pricing_packages: [
      {
        name: "Basic",
        price_inr: 1500,
        price_usd: inrToUsd(1500),
        delivery: "2-3 days",
        revisions: "1 round",
        duration: "2 pages / short copy set",
        features: ["Up to 2 pages","Basic brand tone","Service descriptions","CTA refinement","Editing pass","Delivery-ready copy"]
      },
      {
        name: "Standard",
        price_inr: 6500,
        price_usd: inrToUsd(6500),
        delivery: "4-6 days",
        revisions: "2 rounds",
        duration: "Website + article support",
        isPopular: true,
        features: ["Website copy set","Brand messaging direction","Blog/article draft","SEO-friendly structure","Product descriptions","Proofreading"]
      },
      {
        name: "Premium",
        price_inr: 14000,
        price_usd: inrToUsd(14000),
        delivery: "7-10 days",
        revisions: "Unlimited",
        duration: "Multi-page content system",
        features: ["Multi-page copy system","Campaign messaging","Long-form content","Voice and tone guide","Content engine planning","Priority support"]
      }
    ]
  }
];

const adminAccountSchema = new mongoose.Schema({
  key:      { type: String, default: ADMIN_ACCOUNT_KEY, unique: true },
  username: { type: String, required: true },
  password: { type: String, required: true },
  updatedAt:{ type: Date, default: Date.now }
}, { timestamps: false });

const AdminAccount = mongoose.model("AdminAccount", adminAccountSchema);

const servicePackageSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  price_inr:  { type: Number, default: 0 },
  price_usd:  { type: Number, default: 0 },
  delivery:   { type: String, default: "" },
  revisions:  { type: String, default: "" },
  duration:   { type: String, default: "" },
  isPopular:  { type: Boolean, default: false },
  features:   { type: [String], default: [] }
}, { _id: false });

const serviceSectorSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, default: "" },
  packages:    { type: [servicePackageSchema], default: [] }
}, { _id: false });

const serviceSchema = new mongoose.Schema({
  slug:              { type: String, required: true, unique: true },
  name:              { type: String, required: true },
  shortLabel:        String,
  valueProp:         String,
  meta_description:  String,
  og_image_url:      String,
  pricing_min_inr:   { type: Number, default: 0 },
  pricing_max_inr:   { type: Number, default: 0 },
  deliverables:      { type: [String], default: [] },
  sectors:           { type: [serviceSectorSchema], default: [] },
  pricing_packages:  { type: [mongoose.Schema.Types.Mixed], default: [] },
  updatedAt:         { type: Date, default: Date.now }
}, { timestamps: false });

const leadSchema = new mongoose.Schema({
  type:        { type: String, default: "service-quote" },
  name:        { type: String, required: true },
  phone:       { type: String, required: true },
  service:     { type: String, required: true },
  slug:        String,
  source:      String,
  note:        String,
  createdAt:   { type: Date, default: Date.now }
}, { timestamps: false });

const Service = mongoose.model("Service", serviceSchema);
const Lead = mongoose.model("Lead", leadSchema);

function sanitizeAdminAccount(admin) {
  return {
    username: admin?.username || getDefaultAdminUsername()
  };
}

function serviceFallback(slug) {
  return SERVICE_DEFAULTS.find(item => item.slug === slug) || null;
}

function slugifyServiceName(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleFromSlug(slug) {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Service";
}

function createEmptyServiceRecord(input = {}) {
  const slug = slugifyServiceName(input.slug || input.name || "");
  const title = String(input.name || titleFromSlug(slug)).trim() || "Service";
  const shortLabel = String(input.shortLabel || title.split(/\s+/).slice(0, 2).join(" ")).trim() || "Service";
  const sectorTitle = `${title} Packages`;
  const defaultSector = createCatalogueSector(sectorTitle, `Package options for ${title.toLowerCase()}.`, [
    createCataloguePackage("Basic", 0, { delivery: "", revisions: "", duration: "", features: [""] }),
    createCataloguePackage("Standard", 0, { delivery: "", revisions: "", duration: "", isPopular: true, features: [""] }),
    createCataloguePackage("Premium", 0, { delivery: "", revisions: "", duration: "", features: [""] })
  ]);
  return {
    slug,
    name: title,
    shortLabel,
    valueProp: String(input.valueProp || `Custom ${title.toLowerCase()} support built around your exact scope.`).trim(),
    meta_description: String(input.meta_description || `YoungMinds Agency offers ${title.toLowerCase()} services with sector-specific packages and pricing.`).trim(),
    og_image_url: String(input.og_image_url || "/static/assets/logo-ym.jpg").trim(),
    pricing_min_inr: 0,
    pricing_max_inr: 0,
    deliverables: ["Discovery and planning", "Scope mapping", "Execution workflow", "Delivery handoff", "Revision support", "Launch guidance"],
    sectors: [defaultSector],
    pricing_packages: flattenSectorPackages([defaultSector])
  };
}

function normalizeSectorPackages(items, fallbackPackages = []) {
  const base = Array.isArray(fallbackPackages) ? fallbackPackages : [];
  const source = Array.isArray(items) && items.length ? items : base;
  return source.map((item, index) => {
    const fallback = base[index] || {};
    const featureSource = Array.isArray(item?.features) && item.features.length ? item.features : (fallback.features || []);
    const priceInr = Math.max(0, Number(item?.price_inr ?? fallback.price_inr ?? 0));
    return {
      name: String(item?.name || fallback.name || `Package ${index + 1}`).trim(),
      price_inr: priceInr,
      price_usd: Math.max(0, Number(item?.price_usd ?? fallback.price_usd ?? inrToUsd(priceInr))),
      delivery: String(item?.delivery || item?.delivery_time || fallback.delivery || fallback.delivery_time || "").trim(),
      revisions: String(item?.revisions || fallback.revisions || "").trim(),
      duration: String(item?.duration || item?.note || fallback.duration || fallback.note || "").trim(),
      isPopular: Boolean(item?.isPopular ?? fallback.isPopular ?? false),
      features: featureSource.map(feature => String(feature || "").trim()).filter(Boolean).slice(0, 12)
    };
  }).filter(item => item.name || item.price_inr || item.features.length);
}

function normalizeServicePackages(items, fallbackPackages = []) {
  return normalizeSectorPackages(items, fallbackPackages);
}

function normalizeServiceSectors(items, fallbackSectors = []) {
  const base = Array.isArray(fallbackSectors) ? fallbackSectors : [];
  const source = Array.isArray(items) && items.length ? items : base;
  return source.map((item, index) => {
    const fallback = base[index] || {};
    return {
      title: String(item?.title || fallback.title || `Sector ${index + 1}`).trim(),
      description: String(item?.description || fallback.description || "").trim(),
      packages: normalizeSectorPackages(item?.packages, fallback.packages || [])
    };
  }).filter(item => item.title || item.description || item.packages.length);
}

function flattenSectorPackages(sectors = []) {
  return sectors.flatMap(sector => Array.isArray(sector?.packages) ? sector.packages : []).slice(0, 18);
}

function derivePricingBoundsFromSectors(sectors = []) {
  const prices = flattenSectorPackages(sectors).map(item => Number(item?.price_inr || 0)).filter(item => item > 0);
  if (!prices.length) return { min: 0, max: 0 };
  return {
    min: Math.min(...prices),
    max: Math.max(...prices)
  };
}

function deriveDeliverablesFromSectors(sectors = []) {
  const seen = new Set();
  const values = [];
  for (const sector of sectors) {
    for (const pkg of Array.isArray(sector?.packages) ? sector.packages : []) {
      for (const feature of Array.isArray(pkg?.features) ? pkg.features : []) {
        const clean = String(feature || "").trim();
        if (!clean) continue;
        const key = clean.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        values.push(clean);
        if (values.length >= 6) return values;
      }
    }
  }
  return values;
}

function normalizeServiceRecord(record) {
  const fallback = serviceFallback(record?.slug) || {};
  const merged = { ...fallback, ...(record || {}) };
  merged.sectors = normalizeServiceSectors(
    Array.isArray(merged.sectors) && merged.sectors.length
      ? merged.sectors
      : (Array.isArray(merged.pricing_packages) && merged.pricing_packages.length
          ? [{ title: `${merged.name || fallback.name || "Service"} Packages`, description: merged.valueProp || fallback.valueProp || "", packages: merged.pricing_packages }]
          : (fallback.sectors || [])),
    fallback.sectors || []
  );
  merged.pricing_packages = flattenSectorPackages(merged.sectors);
  const bounds = derivePricingBoundsFromSectors(merged.sectors);
  const fallbackBounds = derivePricingBoundsFromSectors(fallback.sectors || []);
  merged.pricing_min_inr = Math.max(0, Number(merged.pricing_min_inr ?? bounds.min ?? fallback.pricing_min_inr ?? fallbackBounds.min ?? 0)) || bounds.min || fallback.pricing_min_inr || fallbackBounds.min || 0;
  merged.pricing_max_inr = Math.max(
    merged.pricing_min_inr,
    Number(merged.pricing_max_inr ?? bounds.max ?? fallback.pricing_max_inr ?? fallbackBounds.max ?? merged.pricing_min_inr)
  ) || bounds.max || fallback.pricing_max_inr || fallbackBounds.max || merged.pricing_min_inr;
  const derivedDeliverables = deriveDeliverablesFromSectors(merged.sectors);
  merged.deliverables = Array.isArray(merged.deliverables) && merged.deliverables.length
    ? merged.deliverables.slice(0, 6)
    : (derivedDeliverables.length ? derivedDeliverables : (fallback.deliverables || [])).slice(0, 6);
  return merged;
}

async function getServiceRecords() {
  if (mongoose.connection.readyState !== 1) {
    return SERVICE_DEFAULTS.map(item => normalizeServiceRecord({ ...item }));
  }

  const seededRecords = await Promise.all(SERVICE_DEFAULTS.map(async item => {
    const doc = await Service.findOneAndUpdate(
      { slug: item.slug },
      { $setOnInsert: { ...item, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return normalizeServiceRecord(doc.toObject ? doc.toObject() : { ...doc });
  }));
  const extraDocs = await Service.find({ slug: { $nin: SERVICE_SLUGS } }).sort({ updatedAt: -1, name: 1 });
  const extraRecords = extraDocs.map(doc => normalizeServiceRecord(doc.toObject ? doc.toObject() : { ...doc }));
  return [...seededRecords, ...extraRecords].sort((a, b) => {
    const aIndex = SERVICE_SLUGS.indexOf(a.slug);
    const bIndex = SERVICE_SLUGS.indexOf(b.slug);
    if (aIndex === -1 && bIndex === -1) return String(a.name || "").localeCompare(String(b.name || ""));
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

async function getServiceRecord(slug) {
  if (!slug) return null;
  if (mongoose.connection.readyState !== 1) {
    const fallback = serviceFallback(slug);
    return fallback ? normalizeServiceRecord({ ...fallback }) : null;
  }
  const fallback = serviceFallback(slug);
  const doc = fallback
    ? await Service.findOneAndUpdate(
        { slug },
        { $setOnInsert: { ...fallback, updatedAt: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    : await Service.findOne({ slug });
  return doc ? normalizeServiceRecord(doc?.toObject ? doc.toObject() : doc) : null;
}

function formatInr(value) {
  const amount = Number(value || 0);
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatUsd(value) {
  const amount = Number(value || 0);
  return `$${amount.toLocaleString("en-US")}`;
}

function serviceMatchValue(raw) {
  return String(raw || "").trim().toLowerCase();
}

function serviceMatchesProject(service, project) {
  const slug = serviceMatchValue(service.slug);
  const projectValue = serviceMatchValue(project.service);
  const fallbackName = serviceMatchValue(service.name);
  return projectValue === slug || projectValue === fallbackName;
}

function buildAbsoluteAssetUrl(req, rawUrl) {
  if (!rawUrl) return `${req.protocol}://${req.get("host")}/static/assets/logo-ym.jpg`;
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  return `${req.protocol}://${req.get("host")}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;
}

function escapeHtml(raw) {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderServicePageHtml(req, service, recentWork) {
  service = normalizeServiceRecord(service);
  const ogImage = buildAbsoluteAssetUrl(req, service.og_image_url);
  const serviceTitle = escapeHtml(service.name);
  const description = escapeHtml(service.meta_description || service.valueProp || "");
  const deliverables = Array.isArray(service.deliverables) && service.deliverables.length
    ? service.deliverables.slice(0, 6)
    : (serviceFallback(service.slug)?.deliverables || []).slice(0, 6);
  const sectors = Array.isArray(service.sectors) ? service.sectors : [];
  const quoteServiceName = escapeHtml(service.name);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${serviceTitle} Agency India | YoungMinds Agency</title>
<meta name="description" content="${description}">
<meta property="og:title" content="${serviceTitle} Agency India | YoungMinds Agency">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#070808;--bg2:#101214;--bg3:#17191b;--panel:#0f1112;--text:#f4f4f4;--muted:#9a9fa6;--border:rgba(255,255,255,.09);--accent:#e8c547;--accent-soft:rgba(232,197,71,.12);--green:#3ecf8e;--amber:#fb923c;--shadow:0 18px 60px rgba(0,0,0,.35)}
*{box-sizing:border-box} html{scroll-behavior:smooth} body{margin:0;font-family:"DM Sans",system-ui,sans-serif;background:radial-gradient(circle at top right,rgba(232,197,71,.08),transparent 26%),linear-gradient(180deg,#060707,#0d0f11 35%,#060707);color:var(--text)}
a{text-decoration:none;color:inherit} button,input,textarea{font:inherit}
.page{min-height:100vh}
.topbar{position:sticky;top:0;z-index:50;background:rgba(7,8,8,.82);backdrop-filter:blur(14px);border-bottom:1px solid var(--border)}
.topbar-inner{max-width:1180px;margin:0 auto;padding:14px 22px;display:flex;align-items:center;justify-content:space-between;gap:14px}
.brand{display:flex;align-items:center;gap:10px;font-weight:800}.brand-dot{width:26px;height:26px;border-radius:8px;background:var(--accent);color:#000;display:grid;place-items:center;font-size:12px}
.top-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:12px 18px;border:1px solid var(--border);font-weight:700;cursor:pointer}
.btn-primary{background:var(--accent);color:#000;border-color:var(--accent)}
.btn-ghost{background:transparent;color:var(--text)}
.shell{max-width:1180px;margin:0 auto;padding:26px 22px 90px}
.hero{padding:46px 0 28px;display:grid;grid-template-columns:1.3fr .9fr;gap:18px;align-items:end}
.hero-card{background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01));border:1px solid var(--border);border-radius:28px;padding:32px;box-shadow:var(--shadow)}
.eyebrow{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border-radius:999px;background:var(--accent-soft);color:var(--accent);font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.hero h1{font-family:"Space Grotesk",system-ui,sans-serif;font-size:clamp(2.4rem,5vw,4.6rem);line-height:.97;letter-spacing:-.05em;margin:18px 0 12px}
.hero p{font-size:15px;line-height:1.8;color:var(--muted);max-width:58ch}
.hero-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.kpi{background:var(--panel);border:1px solid var(--border);border-radius:22px;padding:18px}
.kpi-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;font-weight:700}
.kpi-value{margin-top:8px;font-size:24px;font-weight:800}
.section{padding:20px 0}
.section-head{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:18px}
.section-title{font-family:"Space Grotesk",system-ui,sans-serif;font-size:clamp(1.6rem,3vw,2.5rem);letter-spacing:-.04em;margin:0}
.section-copy{font-size:14px;color:var(--muted);line-height:1.8;max-width:48ch}
.deliverables{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.tile{background:var(--panel);border:1px solid var(--border);border-radius:22px;padding:18px}
.tile-num{width:36px;height:36px;border-radius:12px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;font-weight:800;font-size:12px}
.tile-title{margin-top:14px;font-size:15px;font-weight:700;line-height:1.5}
.process{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.step{background:var(--panel);border:1px solid var(--border);border-radius:24px;padding:20px;position:relative;overflow:hidden}
.step::after{content:"";position:absolute;top:0;right:0;width:90px;height:90px;background:radial-gradient(circle,rgba(232,197,71,.16),transparent 70%)}
.step-num{font-size:12px;color:var(--accent);font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.step-title{margin-top:12px;font-size:20px;font-weight:800}
.step-copy{margin-top:8px;font-size:13px;line-height:1.7;color:var(--muted)}
.pricing{display:grid;grid-template-columns:1.05fr .95fr;gap:16px}
.pricing-card,.portfolio-wrap,.cta-card{background:var(--panel);border:1px solid var(--border);border-radius:26px;padding:24px}
.price-range{font-family:"Space Grotesk",system-ui,sans-serif;font-size:clamp(2rem,4vw,3.3rem);letter-spacing:-.05em;margin:10px 0}
.pricing-note{font-size:13px;line-height:1.8;color:var(--muted)}
.catalogue-sector{margin-top:18px}
.catalogue-sector:first-child{margin-top:0}
.catalogue-sector-head{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:16px}
.catalogue-sector-copy{font-size:13px;line-height:1.8;color:var(--muted);max-width:54ch}
.package-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.package-card{background:var(--panel);border:1px solid var(--border);border-radius:24px;padding:22px;display:flex;flex-direction:column;gap:14px}
.package-card.featured{border-color:rgba(232,197,71,.3);box-shadow:0 16px 42px rgba(0,0,0,.24)}
.package-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.package-name{font-size:21px;font-weight:800;letter-spacing:-.04em}
.package-price{font-family:"Space Grotesk",system-ui,sans-serif;font-size:2rem;font-weight:700;letter-spacing:-.05em}
.package-currency{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.package-usd{font-size:12px;font-weight:800;color:var(--muted);letter-spacing:.08em;text-transform:uppercase}
.package-meta{display:flex;gap:8px;flex-wrap:wrap}
.package-chip{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid var(--border);font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.package-features{display:grid;gap:10px}
.package-feature{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.65;color:var(--text)}
.package-feature::before{content:"✓";color:var(--accent);font-weight:900}
.portfolio-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.portfolio-card{border:1px solid var(--border);border-radius:20px;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.02),transparent)}
.portfolio-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.portfolio-badge{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;background:var(--accent-soft);color:var(--accent);font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
.portfolio-title{font-size:18px;font-weight:800}
.portfolio-copy{margin-top:8px;font-size:13px;line-height:1.7;color:var(--muted)}
.empty-card{display:grid;place-items:center;min-height:210px;text-align:center;color:var(--muted)}
.cta-card{display:flex;align-items:center;justify-content:space-between;gap:18px}
.quote-fab{position:fixed;right:18px;bottom:18px;z-index:60;background:var(--accent);color:#000;border:none;border-radius:999px;padding:14px 18px;font-weight:800;box-shadow:0 16px 40px rgba(0,0,0,.35);display:none}
.quote-modal-wrap{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:none;align-items:flex-end;justify-content:center;z-index:61;padding:18px}
.quote-modal-wrap.open{display:flex}
.quote-modal{width:min(420px,100%);background:#0f1113;border:1px solid var(--border);border-radius:26px;padding:20px;box-shadow:var(--shadow)}
.quote-title{font-size:20px;font-weight:800}
.quote-copy{margin-top:6px;color:var(--muted);font-size:13px;line-height:1.7}
.field{margin-top:14px}.field label{display:block;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.field input{width:100%;background:#17191b;border:1px solid var(--border);border-radius:14px;color:var(--text);padding:13px 14px;outline:none}
.field input:focus{border-color:rgba(232,197,71,.4)}
.quote-actions{display:flex;gap:10px;margin-top:16px}
.quote-status{margin-top:12px;font-size:12px;color:var(--muted)}
@media (max-width: 980px){.hero,.pricing,.deliverables,.process,.portfolio-grid,.cta-card,.package-grid{grid-template-columns:1fr}.hero-kpis{grid-template-columns:1fr 1fr 1fr}}
@media (max-width: 700px){.shell{padding:18px 16px 86px}.hero-card,.pricing-card,.portfolio-wrap,.cta-card,.package-card{padding:20px}.deliverables,.process,.portfolio-grid,.hero-kpis,.package-grid{grid-template-columns:1fr}.topbar-inner{padding:12px 16px}.quote-fab{display:inline-flex}.top-actions .btn-primary{display:none}}
</style>
</head>
<body>
<div class="page">
  <div class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="/"><span class="brand-dot">Y</span><span>YoungMinds Agency</span></a>
      <div class="top-actions">
        <a class="btn btn-ghost" href="/#services">All Services</a>
        <a class="btn btn-primary" href="/hire">Hire Us</a>
      </div>
    </div>
  </div>
  <main class="shell">
    <section class="hero">
      <div class="hero-card">
        <span class="eyebrow">${escapeHtml(service.shortLabel || "Service")} Deep Dive</span>
        <h1>${serviceTitle}</h1>
        <p>${escapeHtml(service.valueProp || "")}</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">
          <a class="btn btn-primary" href="/hire">Ready to start? Hire us</a>
          <a class="btn btn-ghost" href="/packages-pricing?service=${encodeURIComponent(service.slug || "")}">Packages & Pricing</a>
        </div>
      </div>
      <div class="hero-kpis">
        <div class="kpi"><div class="kpi-label">Pricing Range</div><div class="kpi-value">${escapeHtml(formatInr(service.pricing_min_inr))}</div></div>
        <div class="kpi"><div class="kpi-label">To</div><div class="kpi-value">${escapeHtml(formatInr(service.pricing_max_inr))}</div></div>
        <div class="kpi"><div class="kpi-label">Process</div><div class="kpi-value">4 Steps</div></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><h2 class="section-title">What You Get</h2></div>
        <div class="section-copy">A focused scope with tangible deliverables, so you know exactly what the engagement includes.</div>
      </div>
      <div class="deliverables">
        ${deliverables.map((item, idx) => `<div class="tile"><div class="tile-num">${SERVICE_ICON_SET[idx] || String(idx + 1).padStart(2, "0")}</div><div class="tile-title">${escapeHtml(item)}</div></div>`).join("")}
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><h2 class="section-title">Our Process</h2></div>
        <div class="section-copy">A clear 4-step flow keeps planning tight, execution visible, and delivery on track.</div>
      </div>
      <div class="process">
        ${[
          ["Brief", "We understand goals, constraints, timeline, and what success should look like."],
          ["Strategy", "We shape the approach, scope, priorities, and direction before production starts."],
          ["Execution", "The right YoungMinds specialist builds, designs, writes, edits, or automates the work."],
          ["Delivery", "You receive final outputs, revisions if needed, and a clean handoff."]
        ].map((step, idx) => `<div class="step"><div class="step-num">Step ${String(idx + 1).padStart(2, "0")}</div><div class="step-title">${step[0]}</div><div class="step-copy">${step[1]}</div></div>`).join("")}
      </div>
    </section>

    <section class="section">
      <div class="pricing">
        <div class="pricing-card">
          <div class="eyebrow">Pricing Range</div>
          <div class="price-range">${escapeHtml(formatInr(service.pricing_min_inr))} – ${escapeHtml(formatInr(service.pricing_max_inr))}</div>
          <div class="pricing-note">Final price depends on scope. Review packages and pricing first, then we can tailor the exact scope.</div>
          <div style="margin-top:18px"><a class="btn btn-primary" href="/packages-pricing?service=${encodeURIComponent(service.slug || "")}">Open packages & pricing</a></div>
        </div>
        <div class="portfolio-wrap">
          <div class="eyebrow">Why Teams Choose This</div>
          <div class="pricing-note" style="margin-top:16px">YoungMinds keeps specialist-led execution, fast communication, and clear handoff standards in every service line. You get focused delivery instead of generic agency sprawl.</div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><h2 class="section-title">Recent Work</h2></div>
        <div class="section-copy">A quick look at recent project records that match this service area.</div>
      </div>
      <div class="portfolio-grid">
        ${recentWork.length ? recentWork.map(item => `<article class="portfolio-card"><div class="portfolio-meta"><span class="portfolio-badge">${escapeHtml(item.service || service.name)}</span><span style="font-size:12px;color:var(--muted)">${escapeHtml(item.city || "India")}</span></div><div class="portfolio-title">${escapeHtml(item.business || item.name || "Project")}</div><div class="portfolio-copy">${escapeHtml(item.description || item.notes || "Completed work delivered by the YoungMinds team.")}</div></article>`).join("") : `<div class="empty-card">Recent completed work for this service will appear here once matching portfolio-ready projects are marked completed.</div>`}
      </div>
    </section>

    <section class="section">
      <div class="cta-card">
        <div>
          <div class="eyebrow">Ready to start?</div>
          <h2 class="section-title" style="margin-top:10px">Let YoungMinds handle your ${serviceTitle.toLowerCase()}.</h2>
          <div class="section-copy">Tell us the scope, budget, and timeline. We’ll take it from there.</div>
        </div>
        <a class="btn btn-primary" href="/hire">Hire us</a>
      </div>
    </section>
  </main>
</div>

<button class="quote-fab" type="button" onclick="toggleQuoteModal(true)">Get a Quote</button>
<div class="quote-modal-wrap" id="quoteModalWrap" onclick="if(event.target===this)toggleQuoteModal(false)">
  <div class="quote-modal">
    <div class="quote-title">Quick Quote</div>
    <div class="quote-copy">A lighter version of the hire form for fast WhatsApp follow-up.</div>
    <div class="field"><label>Name</label><input id="lead-name" type="text" placeholder="Your name"></div>
    <div class="field"><label>WhatsApp</label><input id="lead-phone" type="tel" placeholder="+91 90000 00000"></div>
    <div class="field"><label>Service</label><input id="lead-service" type="text" value="${quoteServiceName}" readonly></div>
    <div class="quote-actions">
      <button class="btn btn-ghost" type="button" onclick="toggleQuoteModal(false)">Cancel</button>
      <button class="btn btn-primary" type="button" onclick="submitQuickLead()">Send</button>
    </div>
    <div class="quote-status" id="quoteStatus">We usually reply on WhatsApp within 24 hours.</div>
  </div>
</div>
<script>
function toggleQuoteModal(open){document.getElementById('quoteModalWrap').classList.toggle('open',!!open);}
async function submitQuickLead(){
  const name=document.getElementById('lead-name').value.trim();
  const phone=document.getElementById('lead-phone').value.trim();
  const service=document.getElementById('lead-service').value.trim();
  const status=document.getElementById('quoteStatus');
  if(!name||!phone){status.textContent='Enter your name and WhatsApp number.';return;}
  status.textContent='Sending...';
  try{
    const res=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,phone,service,slug:'${escapeHtml(service.slug)}',source:'service-page'})});
    if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error(err.error||'Could not submit');}
    status.textContent='Thanks — we will reach out on WhatsApp soon.';
    document.getElementById('lead-name').value='';
    document.getElementById('lead-phone').value='';
  }catch(err){status.textContent=err.message||'Could not submit right now.';}
}
</script>
</body>
</html>`;
}

function renderPackagesPricingPageHtml(req, services, activeSlug = "") {
  const normalizedServices = (Array.isArray(services) ? services : []).map(item => normalizeServiceRecord(item));
  const filters = normalizedServices.map(item => `
    <a class="filter-chip ${item.slug === activeSlug ? "active" : ""}" href="/packages-pricing${item.slug ? `?service=${encodeURIComponent(item.slug)}` : ""}">${escapeHtml(item.name || "Service")}</a>
  `).join("");
  const filteredServices = activeSlug
    ? normalizedServices.filter(item => item.slug === activeSlug)
    : normalizedServices;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Packages & Pricing | YoungMinds Agency</title>
<meta name="description" content="Explore YoungMinds Agency service packages and pricing across web development, AI, video editing, social media, design, and content.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#070808;--bg2:#101214;--panel:#0f1112;--text:#f4f4f4;--muted:#9a9fa6;--border:rgba(255,255,255,.09);--accent:#e8c547;--accent-soft:rgba(232,197,71,.12);--shadow:0 18px 60px rgba(0,0,0,.35)}
*{box-sizing:border-box}body{margin:0;font-family:"DM Sans",system-ui,sans-serif;background:radial-gradient(circle at top right,rgba(232,197,71,.08),transparent 26%),linear-gradient(180deg,#060707,#0d0f11 35%,#060707);color:var(--text)}a{text-decoration:none;color:inherit}
.topbar{position:sticky;top:0;z-index:50;background:rgba(7,8,8,.82);backdrop-filter:blur(14px);border-bottom:1px solid var(--border)}
.topbar-inner{max-width:1180px;margin:0 auto;padding:14px 22px;display:flex;align-items:center;justify-content:space-between;gap:14px}
.brand{display:flex;align-items:center;gap:10px;font-weight:800}.brand-dot{width:26px;height:26px;border-radius:8px;background:var(--accent);color:#000;display:grid;place-items:center;font-size:12px}
.top-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.btn{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:12px 18px;border:1px solid var(--border);font-weight:700}.btn-primary{background:var(--accent);color:#000;border-color:var(--accent)}
.shell{max-width:1180px;margin:0 auto;padding:28px 22px 90px}
.hero{padding:30px 0 16px}.eyebrow{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border-radius:999px;background:var(--accent-soft);color:var(--accent);font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
h1{font-family:"Space Grotesk",system-ui,sans-serif;font-size:clamp(2.2rem,5vw,4.2rem);line-height:.96;letter-spacing:-.05em;margin:18px 0 12px}.hero-copy{font-size:15px;line-height:1.8;color:var(--muted);max-width:58ch}
.filters{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0 8px}.filter-chip{display:inline-flex;align-items:center;padding:10px 14px;border-radius:999px;border:1px solid var(--border);background:rgba(255,255,255,.02);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}.filter-chip.active,.filter-chip:hover{color:var(--text);border-color:rgba(232,197,71,.34);background:rgba(232,197,71,.08)}
.service-block{margin-top:28px}.service-head{display:flex;align-items:end;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:16px}.service-title{font-family:"Space Grotesk",system-ui,sans-serif;font-size:clamp(1.8rem,3vw,2.5rem);letter-spacing:-.04em}.service-copy{font-size:14px;line-height:1.8;color:var(--muted);max-width:46ch}
.sector{margin-top:18px;background:var(--panel);border:1px solid var(--border);border-radius:24px;padding:22px;box-shadow:var(--shadow)}.sector:first-child{margin-top:0}.sector-head{display:flex;align-items:end;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:16px}.sector-title{font-size:1.3rem;font-weight:800;letter-spacing:-.03em}.sector-copy{font-size:13px;line-height:1.8;color:var(--muted);max-width:50ch}
.package-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.package-card{background:#141618;border:1px solid var(--border);border-radius:22px;padding:20px;display:flex;flex-direction:column;gap:14px}.package-card.featured{border-color:rgba(232,197,71,.3);box-shadow:0 16px 42px rgba(0,0,0,.24)}.package-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.package-price{font-family:"Space Grotesk",system-ui,sans-serif;font-size:2rem;font-weight:700;letter-spacing:-.05em}.package-usd{font-size:12px;font-weight:800;color:var(--muted);letter-spacing:.08em;text-transform:uppercase}.package-currency{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.package-meta{display:flex;gap:8px;flex-wrap:wrap}.chip{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid var(--border);font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}.chip.popular{color:var(--accent);border-color:rgba(232,197,71,.24)}.package-features{display:grid;gap:10px}.package-feature{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.65}.package-feature::before{content:"✓";color:var(--accent);font-weight:900}
@media (max-width:980px){.package-grid{grid-template-columns:1fr}} @media (max-width:700px){.topbar-inner,.shell{padding-left:16px;padding-right:16px}.top-actions .btn-primary{display:none}}
</style>
</head>
<body>
<div class="topbar"><div class="topbar-inner"><a class="brand" href="/"><span class="brand-dot">Y</span><span>YoungMinds Agency</span></a><div class="top-actions"><a class="btn" href="/#services">Services</a><a class="btn btn-primary" href="/hire">Hire Us</a></div></div></div>
<main class="shell">
  <section class="hero">
    <span class="eyebrow">Packages & Pricing</span>
    <h1>Choose the right package before we scope the work.</h1>
    <div class="hero-copy">Services explain what we do. Packages & pricing makes the commercial side easy to compare. Filter by service, review sector-specific packages, then move to hire when you're ready.</div>
    <div class="filters"><a class="filter-chip ${!activeSlug ? "active" : ""}" href="/packages-pricing">All Services</a>${filters}</div>
  </section>
  ${filteredServices.map(service => `
    <section class="service-block">
      <div class="service-head">
        <div>
          <div class="eyebrow">${escapeHtml(service.shortLabel || "Service")}</div>
          <div class="service-title">${escapeHtml(service.name || "Service")}</div>
        </div>
        <div class="service-copy">${escapeHtml(service.valueProp || "")}</div>
      </div>
      ${(Array.isArray(service.sectors) ? service.sectors : []).map(sector => `
        <div class="sector">
          <div class="sector-head">
            <div class="sector-title">${escapeHtml(sector.title || "Sector")}</div>
            <div class="sector-copy">${escapeHtml(sector.description || "")}</div>
          </div>
          <div class="package-grid">
            ${(Array.isArray(sector.packages) ? sector.packages : []).map((pkg, index) => `
              <article class="package-card ${(pkg.isPopular || index === 1) ? "featured" : ""}">
                <div class="package-head">
                  <div>
                    <div class="eyebrow">${escapeHtml(pkg.name || `Package ${index + 1}`)}</div>
                    <div class="package-currency"><div class="package-price">${escapeHtml(formatInr(pkg.price_inr || 0))}</div><div class="package-usd">${escapeHtml(formatUsd(pkg.price_usd || 0))}</div></div>
                  </div>
                  ${(pkg.isPopular || index === 1) ? `<span class="chip popular">Most Popular</span>` : ``}
                </div>
                <div class="package-meta">
                  ${pkg.delivery ? `<span class="chip">${escapeHtml(pkg.delivery)}</span>` : ``}
                  ${pkg.duration ? `<span class="chip">${escapeHtml(pkg.duration)}</span>` : ``}
                  ${pkg.revisions ? `<span class="chip">${escapeHtml(pkg.revisions)}</span>` : ``}
                </div>
                <div class="package-features">${(Array.isArray(pkg.features) ? pkg.features : []).map(feature => `<div class="package-feature">${escapeHtml(feature)}</div>`).join("")}</div>
              </article>
            `).join("")}
          </div>
        </div>
      `).join("")}
    </section>
  `).join("")}
</main>
</body>
</html>`;
}

async function getOrCreateAdminAccount() {
  if (mongoose.connection.readyState !== 1) {
    return {
      key: ADMIN_ACCOUNT_KEY,
      username: getDefaultAdminUsername(),
      password: getDefaultAdminPasswordHash(),
      isFallback: true
    };
  }

  return AdminAccount.findOneAndUpdate(
    { key: ADMIN_ACCOUNT_KEY },
    {
      $setOnInsert: {
        username: getDefaultAdminUsername(),
        password: getDefaultAdminPasswordHash(),
        updatedAt: new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function getAdminSessionFromToken(req) {
  const payload = verifyAuthToken(readBearerToken(req));
  if (!payload || payload.role !== "admin" || payload.sub !== ADMIN_ACCOUNT_KEY) {
    return null;
  }

  const admin = await getOrCreateAdminAccount();
  return { payload, admin };
}

async function requireAdminSession(req, res) {
  const session = await getAdminSessionFromToken(req);
  if (!session) {
    res.status(401).json({ error: "Admin session expired" });
    return null;
  }
  return session;
}

async function getMemberSessionFromToken(req) {
  const payload = verifyAuthToken(readBearerToken(req));
  if (!payload || payload.role !== "member" || !payload.sub) {
    return null;
  }

  const member = await Application.findById(payload.sub);
  if (!member || !["hired", "inwork", "accepted"].includes(member.status)) {
    return null;
  }

  return { payload, member };
}

app.get("/api/events", async (req, res) => {
  try {
    const adminSession = await getAdminSessionFromToken(req);
    const memberSession = adminSession ? null : await getMemberSessionFromToken(req);
    if (!adminSession && !memberSession) {
      return res.status(401).json({ error: "Session required" });
    }

    const client = {
      id: crypto.randomUUID(),
      res,
      role: adminSession ? "admin" : "member",
      memberId: memberSession ? String(memberSession.member._id) : null
    };

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true, role: client.role })}\n\n`);

    realtimeClients.add(client);
    const keepAlive = setInterval(() => {
      res.write("event: ping\ndata: {}\n\n");
    }, 25000);

    req.on("close", () => {
      clearInterval(keepAlive);
      realtimeClients.delete(client);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function normalizeBoardSkills(raw) {
  const values = Array.isArray(raw) ? raw : String(raw || "").split(/[,\n]/);
  return values
    .map(item => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

function sanitizeBoardMember(doc) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.skills = normalizeBoardSkills(obj.skills);
  return obj;
}

function compactBoardBio(value) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > 220 ? `${clean.slice(0, 217).trim()}...` : clean;
}

function hydrateBoardEntry(entry, member) {
  const safeEntry = sanitizeBoardMember(entry);
  return {
    ...safeEntry,
    applicationId: String(safeEntry.applicationId || member?._id || "").trim(),
    name: String(safeEntry.name || member?.name || "YoungMinds Member").trim(),
    designation: String(safeEntry.designation || member?.skill || "YoungMinds Member").trim(),
    skills: normalizeBoardSkills(safeEntry.skills || []),
    bio: compactBoardBio(safeEntry.bio || ""),
    photo: String(safeEntry.photo || "").trim()
  };
}

async function buildBoardEntries(includeDrafts = false) {
  const query = includeDrafts ? {} : { active: true };
  const entries = await BoardMember.find(query).sort({ order: 1, createdAt: 1 });
  const linkedIds = entries.map(item => String(item.applicationId || "").trim()).filter(Boolean);
  const linkedMembers = linkedIds.length
    ? await Application.find({ _id: { $in: linkedIds } })
    : [];
  const memberMap = new Map(linkedMembers.map(member => [String(member._id), member]));
  return entries.map((entry, index) => {
    const member = memberMap.get(String(entry.applicationId || "").trim()) || null;
    const hydrated = hydrateBoardEntry(entry, member);
    if (!Number.isFinite(Number(hydrated.order))) hydrated.order = index;
    return hydrated;
  });
}

// Allowed next-status transitions for applications
const APP_TRANSITIONS = {
  new:       ["reviewing", "rejected"],
  reviewing: ["hired", "rejected"],
  hired:     ["inwork"],   // only via project assignment
  inwork:    ["hired"],
  rejected:  [],
  accepted:  ["hired", "rejected"] // legacy
};

// ── POST: submit new application ──
app.post("/api/applications", async (req, res) => {
  try {
    if (!req.body.name) return res.status(400).json({ error: "name is required" });
    // Hash password if provided
    const body = { ...req.body, type: "application", status: "new" };
    if (body.password) body.password = hashPassword(body.password);
    if (body.email) body.gmail = normalizeEmail(body.email);
    const doc = new Application(body);
    await doc.save();
    res.status(201).json(sanitizeApp(doc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET: list all applications ──
app.get("/api/applications", async (req, res) => {
  try {
    const data = await Application.find().sort({ timestamp: -1 });
    res.json(data.map(doc => sanitizeApp(doc, { includeProfilePic: false })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET: single application ──
app.get("/api/applications/:id", async (req, res) => {
  try {
    const doc = await Application.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(sanitizeApp(doc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET: login credential summary (admin UI — never exposes password or hash) ──
app.get("/api/applications/:id/auth-summary", async (req, res) => {
  try {
    const doc = await Application.findById(req.params.id).select("password resetToken resetExpiry");
    if (!doc) return res.status(404).json({ error: "Not found" });
    const resetPending = !!(doc.resetToken && doc.resetExpiry && doc.resetExpiry > new Date());
    res.json({
      hasPassword: !!(doc.password && String(doc.password).length > 0),
      resetPending
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Strip password from responses
function sanitizeApp(doc, options = {}) {
  const { includeProfilePic = true } = options;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj.password;
  delete obj.resetToken;
  delete obj.resetExpiry;
  if (!includeProfilePic) delete obj.profilePic;
  return obj;
}

// ── PUT: update status or profile fields ──
app.put("/api/applications/:id", async (req, res) => {
  try {
    const doc = await Application.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Application not found" });
    const wasHired = doc.status === "hired";

    // Enforce status transition rules (admin can override with force:true)
    if (req.body.status && req.body.status !== doc.status && !req.body.force) {
      const allowed = APP_TRANSITIONS[doc.status] || [];
      if (!allowed.includes(req.body.status)) {
        return res.status(400).json({
          error: `Cannot transition from '${doc.status}' to '${req.body.status}'. Allowed: ${allowed.join(", ") || "none"}`
        });
      }
    }

    const allowed = ["status","name","city","skill","availability","portfolio","achievements","achievementTitle","achievementLink","why","experience","phone","email","gmail","profilePic"];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    if (req.body.email) updates.gmail = normalizeEmail(req.body.email);

    const updated = await Application.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: false }
    );

    if (!wasHired && updated?.status === "hired") {
      try {
        await Notification.create({
          title: "You have been hired",
          message: "Congratulations! Your YoungMinds application is now marked as hired. Please sign in to the member portal with your registered Gmail and password.",
          type: "direct",
          targetId: String(updated._id),
          targetName: updated.name || ""
        });
      } catch (err) {
        console.warn("Failed to create hire notification:", err.message);
      }

      try {
        await sendHiringWhatsApp(updated);
      } catch (err) {
        console.warn("Failed to send hiring WhatsApp:", err.message);
      }
    }

    res.json(sanitizeApp(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE ──
app.delete("/api/applications/:id", async (req, res) => {
  try {
    await Application.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════
   BOARD OF MEMBERS
══════════════════════════════════════════ */
app.get("/api/board-members", async (req, res) => {
  try {
    const list = await buildBoardEntries(false);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/board-members/admin", async (req, res) => {
  try {
    const list = await buildBoardEntries(true);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/board-members", async (req, res) => {
  try {
    if (!req.body.name) return res.status(400).json({ error: "name is required" });
    const doc = await BoardMember.create({
      applicationId: String(req.body.applicationId || "").trim(),
      name: String(req.body.name || "").trim(),
      designation: String(req.body.designation || "").trim(),
      skills: normalizeBoardSkills(req.body.skills),
      bio: String(req.body.bio || "").trim(),
      photo: String(req.body.photo || "").trim(),
      order: Number.isFinite(Number(req.body.order)) ? Number(req.body.order) : 0,
      active: req.body.active !== undefined ? !!req.body.active : true
    });
    res.status(201).json(sanitizeBoardMember(doc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/board-members/:id", async (req, res) => {
  try {
    const updates = {};
    if (req.body.applicationId !== undefined) updates.applicationId = String(req.body.applicationId || "").trim();
    if (req.body.name !== undefined) updates.name = String(req.body.name || "").trim();
    if (req.body.designation !== undefined) updates.designation = String(req.body.designation || "").trim();
    if (req.body.skills !== undefined) updates.skills = normalizeBoardSkills(req.body.skills);
    if (req.body.bio !== undefined) updates.bio = String(req.body.bio || "").trim();
    if (req.body.photo !== undefined) updates.photo = String(req.body.photo || "").trim();
    if (req.body.order !== undefined) updates.order = Number.isFinite(Number(req.body.order)) ? Number(req.body.order) : 0;
    if (req.body.active !== undefined) updates.active = !!req.body.active;

    const doc = await BoardMember.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ error: "Board member not found" });
    res.json(sanitizeBoardMember(doc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/board-members/:id", async (req, res) => {
  try {
    await BoardMember.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/services", async (req, res) => {
  try {
    const records = await getServiceRecords();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/services/:slug", async (req, res) => {
  try {
    const service = await getServiceRecord(req.params.slug);
    if (!service) return res.status(404).json({ error: "Service not found" });
    res.json(service);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/services", async (req, res) => {
  try {
    const adminSession = await requireAdminSession(req, res);
    if (!adminSession) return;

    const draft = createEmptyServiceRecord(req.body || {});
    if (!draft.slug) {
      return res.status(400).json({ error: "Service name is required" });
    }

    const existing = await getServiceRecord(draft.slug);
    if (existing) {
      return res.status(409).json({ error: "A service with this slug already exists" });
    }

    const doc = await Service.create({ ...draft, updatedAt: new Date() });
    res.status(201).json(normalizeServiceRecord(doc.toObject ? doc.toObject() : doc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/services/:slug", async (req, res) => {
  try {
    const adminSession = await requireAdminSession(req, res);
    if (!adminSession) return;

    const slug = String(req.params.slug || "").trim();
    if (!slug) {
      return res.status(400).json({ error: "Service slug is required" });
    }

    if (SERVICE_SLUGS.includes(slug)) {
      return res.status(400).json({ error: "Core services cannot be deleted" });
    }

    const deleted = await Service.findOneAndDelete({ slug });
    if (!deleted) {
      return res.status(404).json({ error: "Service not found" });
    }

    res.json({ ok: true, slug });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/services/:slug", async (req, res) => {
  try {
    const adminSession = await requireAdminSession(req, res);
    if (!adminSession) return;

    const slug = req.params.slug;
    const defaultService = serviceFallback(slug) || createEmptyServiceRecord({ slug });
    const currentService = await getServiceRecord(slug) || normalizeServiceRecord({ ...defaultService });
    const hasDeliverablesInput = Array.isArray(req.body?.deliverables) || typeof req.body?.deliverables === "string";
    const deliverablesRaw = hasDeliverablesInput
      ? (Array.isArray(req.body?.deliverables) ? req.body.deliverables : String(req.body?.deliverables || "").split(/\n|,/))
      : (currentService.deliverables || defaultService.deliverables || []);
    const deliverables = deliverablesRaw
      .map(item => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 6);
    if (deliverables.length < 6) {
      const deliverableFallback = currentService.deliverables || defaultService.deliverables || [];
      while (deliverables.length < 6) {
        deliverables.push(deliverableFallback[deliverables.length] || `Deliverable ${deliverables.length + 1}`);
      }
    }
    const hasSectorsInput = Array.isArray(req.body?.sectors);
    const sectors = hasSectorsInput
      ? normalizeServiceSectors(req.body?.sectors, currentService.sectors || defaultService.sectors || [])
      : normalizeServiceSectors(currentService.sectors, defaultService.sectors || []);
    const pricingPackages = flattenSectorPackages(sectors);
    const bounds = derivePricingBoundsFromSectors(sectors);
    const hasField = field => Object.prototype.hasOwnProperty.call(req.body || {}, field);

    const updates = {
      name: String(hasField("name") ? req.body?.name : (currentService.name || defaultService.name)).trim() || currentService.name || defaultService.name,
      shortLabel: String(hasField("shortLabel") ? req.body?.shortLabel : (currentService.shortLabel || defaultService.shortLabel || "")).trim() || currentService.shortLabel || defaultService.shortLabel,
      valueProp: String(hasField("valueProp") ? req.body?.valueProp : (currentService.valueProp || defaultService.valueProp || "")).trim() || currentService.valueProp || defaultService.valueProp,
      meta_description: String(hasField("meta_description") ? req.body?.meta_description : (currentService.meta_description || defaultService.meta_description || "")).trim() || currentService.meta_description || defaultService.meta_description,
      og_image_url: String(hasField("og_image_url") ? req.body?.og_image_url : (currentService.og_image_url || defaultService.og_image_url || "")).trim() || currentService.og_image_url || defaultService.og_image_url,
      pricing_min_inr: Math.max(0, Number(hasField("pricing_min_inr") ? req.body?.pricing_min_inr : (currentService.pricing_min_inr || bounds.min || defaultService.pricing_min_inr || 0))),
      pricing_max_inr: Math.max(0, Number(hasField("pricing_max_inr") ? req.body?.pricing_max_inr : (currentService.pricing_max_inr || bounds.max || defaultService.pricing_max_inr || 0))),
      deliverables,
      sectors,
      pricing_packages: pricingPackages,
      updatedAt: new Date()
    };

    const doc = await Service.findOneAndUpdate(
      { slug },
      { $set: { slug, ...updates } },
      { new: true, upsert: true, runValidators: false, setDefaultsOnInsert: true }
    );
    res.json(normalizeServiceRecord(doc?.toObject ? doc.toObject() : doc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/leads", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const phone = String(req.body?.phone || "").trim();
    const service = String(req.body?.service || "").trim();
    if (!name || !phone || !service) {
      return res.status(400).json({ error: "name, phone, and service are required" });
    }

    const doc = new Lead({
      name,
      phone,
      service,
      slug: String(req.body?.slug || "").trim(),
      source: String(req.body?.source || "service-page").trim(),
      note: String(req.body?.note || "").trim()
    });
    await doc.save();
    res.status(201).json({ success: true, lead: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════
   AUTH: Admin Login / Session
══════════════════════════════════════════ */
app.post("/api/admin/auth/login", async (req, res) => {
  try {
    const { username, password, remember } = req.body || {};
    const admin = await getOrCreateAdminAccount();
    const normalizedUsername = normalizeAdminUsername(username);

    if (!normalizedUsername || !password) {
      return res.status(400).json({ error: "username and password required" });
    }

    if (normalizedUsername !== admin.username || hashPassword(password) !== admin.password) {
      return res.status(401).json({ error: "Invalid admin credentials" });
    }

    res.json({
      admin: sanitizeAdminAccount(admin),
      token: createAuthToken(
        { role: "admin", sub: ADMIN_ACCOUNT_KEY, username: admin.username },
        { ttlSeconds: getTokenTtlSeconds(Boolean(remember)) }
      )
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/auth/session", async (req, res) => {
  try {
    const session = await getAdminSessionFromToken(req);
    if (!session) {
      return res.status(401).json({ error: "Admin session expired" });
    }

    res.json({ admin: sanitizeAdminAccount(session.admin) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/auth/change-credentials", async (req, res) => {
  try {
    const session = await getAdminSessionFromToken(req);
    if (!session) {
      return res.status(401).json({ error: "Admin session expired" });
    }
    if (session.admin.isFallback) {
      return res.status(503).json({ error: "Admin credentials cannot be changed while the database is unavailable" });
    }

    const { currentPassword, newUsername, newPassword, remember } = req.body || {};
    if (!currentPassword) {
      return res.status(400).json({ error: "Current password is required" });
    }
    if (hashPassword(currentPassword) !== session.admin.password) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const nextUsername = String(newUsername || "").trim()
      ? normalizeAdminUsername(newUsername)
      : session.admin.username;
    if (!/^[a-z0-9._-]{3,32}$/.test(nextUsername)) {
      return res.status(400).json({ error: "Username must be 3-32 characters and use letters, numbers, dot, underscore, or dash" });
    }

    const passwordInput = String(newPassword || "");
    if (!passwordInput && nextUsername === session.admin.username) {
      return res.status(400).json({ error: "Add a new username or password to update admin credentials" });
    }
    if (passwordInput && passwordInput.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }

    const update = {
      username: nextUsername,
      updatedAt: new Date()
    };
    if (passwordInput) {
      update.password = hashPassword(passwordInput);
    }

    const admin = await AdminAccount.findOneAndUpdate(
      { key: ADMIN_ACCOUNT_KEY },
      { $set: update },
      { new: true }
    );

    res.json({
      success: true,
      admin: sanitizeAdminAccount(admin),
      token: createAuthToken(
        { role: "admin", sub: ADMIN_ACCOUNT_KEY, username: admin.username },
        { ttlSeconds: getTokenTtlSeconds(Boolean(remember)) }
      )
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════
   AUTH: Member Login (Gmail + Password)
══════════════════════════════════════════ */
app.post("/api/auth/login", async (req, res) => {
  try {
    const { gmail, password, remember } = req.body || {};
    if (!gmail || !password) return res.status(400).json({ error: "gmail and password required" });
    const email = normalizeEmail(gmail);
    const hashed = hashPassword(password);

    const member = await Application.findOne({
      $or: [{ gmail: email }, { email: email }],
      password: hashed,
      status: { $in: ["hired", "inwork", "accepted"] }
    });

    if (!member) return res.status(401).json({ error: "Invalid credentials or account not active" });
    const payload = sanitizeApp(member);
    res.json({
      member: payload,
      token: createAuthToken(
        { role: "member", sub: String(member._id), gmail: payload.gmail || payload.email || "" },
        { ttlSeconds: getTokenTtlSeconds(Boolean(remember)) }
      )
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/session", async (req, res) => {
  try {
    const session = await getMemberSessionFromToken(req);
    if (!session) {
      return res.status(401).json({ error: "Member session expired" });
    }

    res.json({ member: sanitizeApp(session.member) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════
   AUTH: Set / Change Password
══════════════════════════════════════════ */
// Change password (knows old password)
app.post("/api/auth/change-password", async (req, res) => {
  try {
    const { memberId, oldPassword, newPassword } = req.body;
    if (!memberId || !oldPassword || !newPassword) return res.status(400).json({ error: "Missing fields" });
    const np = String(newPassword);
    if (np.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters" });
    if (np === String(oldPassword)) return res.status(400).json({ error: "New password must be different from your current password" });
    const member = await Application.findById(memberId);
    if (!member) return res.status(404).json({ error: "Member not found" });
    if (!member.password) return res.status(400).json({ error: "No password on file yet — ask admin to set one" });
    if (member.password !== hashPassword(oldPassword)) return res.status(401).json({ error: "Current password is incorrect" });
    member.password = hashPassword(newPassword);
    await member.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Request password reset — identity checks (no anonymous Gmail-only spam)
// - If member enters currentPassword and it MATCHES: they know the password → must use self-service change after login (no admin token).
// - If currentPassword is WRONG: rejected (prevents guessing).
// - If currentPassword omitted: require verifyPhone matching profile so only the real member can queue admin help.
app.post("/api/auth/request-reset", async (req, res) => {
  try {
    const { gmail, currentPassword, verifyPhone } = req.body || {};
    const email = normalizeEmail(gmail);
    if (!email) return res.status(400).json({ error: "Gmail is required" });

    const member = await Application.findOne({
      $or: [{ gmail: email }, { email: email }],
      status: { $in: ["hired", "inwork", "accepted"] }
    });
    if (!member) return res.status(404).json({ error: "No active member found with that Gmail" });

    const cp = currentPassword != null ? String(currentPassword).trim() : "";
    if (cp.length > 0) {
      if (!member.password) {
        return res.status(400).json({
          error: "This account has no password stored yet. Verify with WhatsApp below or contact admin.",
          code: "NO_PASSWORD_ON_FILE"
        });
      }
      if (member.password === hashPassword(cp)) {
        return res.status(400).json({
          error: "That is your correct password. Sign in with Gmail and this password, then open Profile → Password to change it. No admin reset is needed.",
          code: "USE_SELF_SERVICE"
        });
      }
      return res.status(401).json({
        error: "That password does not match this Gmail. If you forgot your password, clear the password field and verify with your registered WhatsApp number instead."
      });
    }

    const phone = verifyPhone != null ? String(verifyPhone).trim() : "";
    if (!phone) {
      return res.status(400).json({
        error: "Enter the WhatsApp number on your YoungMinds profile so we can verify it is you, or use Current password instead."
      });
    }
    if (!memberPhoneMatches(phone, member.phone)) {
      return res.status(401).json({
        error: "WhatsApp number does not match our records for this Gmail. Use the same number you used when you joined (full number, last 10 digits, or last 4 digits)."
      });
    }

    const token = crypto.randomBytes(20).toString("hex");
    member.resetToken = token;
    member.resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await member.save();
    res.json({
      success: true,
      message: "Verified. Admin can now set a new password from Pending Password Resets.",
      memberId: member._id,
      memberName: member.name
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin resets password for a member
app.post("/api/auth/admin-reset", async (req, res) => {
  try {
    const { memberId, newPassword } = req.body;
    if (!memberId || !newPassword) return res.status(400).json({ error: "Missing fields" });
    const member = await Application.findById(memberId);
    if (!member) return res.status(404).json({ error: "Member not found" });
    member.password = hashPassword(newPassword);
    member.resetToken = undefined;
    member.resetExpiry = undefined;
    await member.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get pending reset requests
app.get("/api/auth/reset-requests", async (req, res) => {
  try {
    const requests = await Application.find({
      resetToken: { $exists: true, $ne: null },
      resetExpiry: { $gt: new Date() }
    }).select("name email gmail resetToken resetExpiry status");
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════
   SCHEMA: PROJECT
   Status flow: new → reviewing → rejected
               reviewing → accepted → assigning → assigned → inprogress → completed
               (reassign: inprogress → assigning)
══════════════════════════════════════════ */
const PRJ_TRANSITIONS = {
  new:        ["reviewing", "rejected"],
  reviewing:  ["accepted", "rejected"],
  accepted:   ["assigning"],
  assigning:  ["assigned", "rejected"],
  assigned:   ["inprogress", "assigning"],  // member accept → inprogress, reject → assigning
  inprogress: ["completed", "assigning"],   // reassign goes back to assigning
  completed:  [],
  rejected:   []
};

const projectSchema = new mongoose.Schema({
  type:              { type: String, default: "project" },
  name:              String,
  title:             String,
  clientName:        String,
  business:          String,
  phone:             String,
  email:             String,
  city:              String,
  source:            String,
  service:           String,
  serviceSlug:       String,
  serviceSector:     String,
  packageName:       String,
  quotedPriceInr:    Number,
  quotedPriceLabel:  String,
  budget:            String,
  timeline:          String,
  description:       String,
  notes:             String,
  status:            { type: String, default: "new" },
  assignedMemberIds: { type: [String], default: [] },
  assignedGroupId:   String,
  paymentAdvance:    Number,
  paymentFinal:      Number,
  paymentStatus:     { type: String, default: "pending" },
  deadlineAt:        Date,
  progressPercent:   { type: Number, default: 0 },
  briefPdfUrl:       String,
  briefPdfName:      String,
  deliveryStage:     { type: String, default: "inprogress" },
  lastSubmissionAt:  Date,
  timestamp:         { type: Date, default: Date.now }
}, { strict: false, timestamps: false });

const Project = mongoose.model("Project", projectSchema);

// ── POST ──
app.post("/api/projects", async (req, res) => {
  try {
    const serviceSlug = String(req.body?.serviceSlug || slugifyServiceName(req.body?.service || "")).trim();
    const service = await getServiceRecord(serviceSlug);
    const selectedSector = (Array.isArray(service?.sectors) ? service.sectors : []).find(item => item.title === String(req.body?.serviceSector || "").trim());
    const selectedPackage = (Array.isArray(selectedSector?.packages) ? selectedSector.packages : []).find(item => item.name === String(req.body?.packageName || "").trim());
    const quotedPriceInr = Math.max(0, Number(req.body?.quotedPriceInr || selectedPackage?.price_inr || 0));
    const payload = {
      ...req.body,
      type: "project",
      status: "new",
      service: String(req.body?.service || service?.name || "").trim(),
      serviceSlug,
      serviceSector: String(req.body?.serviceSector || selectedSector?.title || "").trim(),
      packageName: String(req.body?.packageName || selectedPackage?.name || "").trim(),
      quotedPriceInr,
      quotedPriceLabel: String(req.body?.quotedPriceLabel || (quotedPriceInr ? formatInr(quotedPriceInr) : "")).trim(),
      budget: String(req.body?.budget || (quotedPriceInr ? formatInr(quotedPriceInr) : "")).trim()
    };
    const doc = new Project(payload);
    await doc.save();
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET all ──
app.get("/api/projects", async (req, res) => {
  try {
    const data = await Project.find().sort({ timestamp: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET single ──
app.get("/api/projects/:id", async (req, res) => {
  try {
    const doc = await Project.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/services/:slug", async (req, res) => {
  try {
    const service = await getServiceRecord(req.params.slug);
    if (!service) return res.status(404).send("Service not found");
    let recentWork = [];
    if (mongoose.connection.readyState === 1) {
      const projects = await Project.find({ status: "completed" }).sort({ timestamp: -1 }).limit(40);
      recentWork = projects.filter(project => serviceMatchesProject(service, project)).slice(0, 2);
    }
    res.send(renderServicePageHtml(req, service, recentWork));
  } catch (err) {
    res.status(500).send("Could not load service page");
  }
});

app.get("/packages-pricing", async (req, res) => {
  try {
    const services = await getServiceRecords();
    const activeSlug = String(req.query?.service || "").trim();
    res.send(renderPackagesPricingPageHtml(req, services, activeSlug));
  } catch (err) {
    res.status(500).send("Could not load packages page");
  }
});

// ── PUT ──
app.put("/api/projects/:id", async (req, res) => {
  try {
    const doc = await Project.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Project not found" });

    if (req.body.status && req.body.status !== doc.status && !req.body.force) {
      const allowed = PRJ_TRANSITIONS[doc.status] || [];
      if (!allowed.includes(req.body.status)) {
        return res.status(400).json({
          error: `Cannot transition from '${doc.status}' to '${req.body.status}'. Allowed: ${allowed.join(", ") || "none"}`
        });
      }
    }

    const allowed = ["status","notes","paymentAdvance","paymentFinal","paymentStatus",
                     "assignedMemberIds","assignedGroupId","deadlineAt","progressPercent",
                     "briefPdfUrl","briefPdfName","deliveryStage","lastSubmissionAt",
                     "title","clientName","service","serviceSlug","serviceSector","packageName","quotedPriceInr","quotedPriceLabel","budget","timeline","description"];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const updated = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: false }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH: assign members ──
app.patch("/api/projects/:id/assign", async (req, res) => {
  try {
    const { memberIds, status } = req.body;
    if (!Array.isArray(memberIds)) return res.status(400).json({ error: "memberIds must be an array" });
    const newStatus = status || "assigned";
    const doc = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: { assignedMemberIds: memberIds, status: newStatus } },
      { new: true, runValidators: false }
    );
    if (!doc) return res.status(404).json({ error: "Project not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE ──
app.delete("/api/projects/:id", async (req, res) => {
  try {
    await Project.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════
   SCHEMA: PAYMENT
══════════════════════════════════════════ */
const paymentSchema = new mongoose.Schema({
  type:      { type: String, enum: ["member", "project"], required: true },
  refId:     { type: String, required: true },
  refName:   String,
  amount:    { type: Number, required: true },
  note:      String,
  status:    { type: String, enum: ["pending", "paid"], default: "pending" },
  date:      { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const Payment = mongoose.model("Payment", paymentSchema);

async function syncProjectPaymentStatus(projectId) {
  if (!projectId) return;

  const projectPayments = await Payment.find({ type: "project", refId: String(projectId) }).sort({ date: 1, createdAt: 1 });
  if (projectPayments.length === 0) {
    await Project.findByIdAndUpdate(projectId, {
      $set: { paymentStatus: "pending", paymentAdvance: 0, paymentFinal: 0 }
    });
    return;
  }

  const paidPayments = projectPayments.filter(payment => payment.status === "paid");
  const pendingPayments = projectPayments.filter(payment => payment.status !== "paid");
  const firstPaid = paidPayments[0];
  const lastPaid = paidPayments.length ? paidPayments[paidPayments.length - 1] : null;
  const lastPending = pendingPayments.length ? pendingPayments[pendingPayments.length - 1] : null;
  const lastEntry = projectPayments[projectPayments.length - 1];

  await Project.findByIdAndUpdate(projectId, {
    $set: {
      paymentStatus: pendingPayments.length > 0 ? "pending" : "paid",
      paymentAdvance: firstPaid ? firstPaid.amount : 0,
      paymentFinal: lastPaid?.amount ?? lastPending?.amount ?? lastEntry?.amount ?? 0
    }
  });
}

app.post("/api/payments", async (req, res) => {
  try {
    const body = { ...req.body };
    body.amount = Number(body.amount);
    if (!Number.isFinite(body.amount)) return res.status(400).json({ error: "Invalid amount" });
    if (body.date) body.date = new Date(body.date);
    const doc = new Payment(body);
    await doc.save();
    if (doc.type === "project") {
      await syncProjectPaymentStatus(doc.refId);
    }
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/payments", async (req, res) => {
  try {
    const data = await Payment.find().sort({ date: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/payments/member/:memberId", async (req, res) => {
  try {
    const data = await Payment.find({ type: "member", refId: req.params.memberId }).sort({ date: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/payments/:id", async (req, res) => {
  try {
    const allowed = ["status","note","amount","date"];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const doc = await Payment.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!doc) return res.status(404).json({ error: "Payment not found" });
    if (doc.type === "project") {
      await syncProjectPaymentStatus(doc.refId);
    }
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/payments/:id", async (req, res) => {
  try {
    const doc = await Payment.findByIdAndDelete(req.params.id);
    if (doc?.type === "project") {
      await syncProjectPaymentStatus(doc.refId);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════
   SCHEMA: NOTIFICATION / CIRCULAR
   Sent by admin → received by all members (or specific member)
══════════════════════════════════════════ */
const notificationSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  message:     { type: String, required: true },
  type:        { type: String, enum: ["circular", "direct"], default: "circular" },
  targetId:    String,  // memberId for direct, null for all
  targetName:  String,
  readBy:      { type: [String], default: [] }, // array of memberIds who read it
  createdAt:   { type: Date, default: Date.now }
});

const Notification = mongoose.model("Notification", notificationSchema);

// ── POST: admin sends circular/notification ──
app.post("/api/notifications", async (req, res) => {
  try {
    const doc = new Notification(req.body);
    await doc.save();
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET: all notifications (admin) ──
app.get("/api/notifications", async (req, res) => {
  try {
    const data = await Notification.find().sort({ createdAt: -1 }).limit(100);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET: notifications for a specific member ──
app.get("/api/notifications/member/:memberId", async (req, res) => {
  try {
    const memberId = String(req.params.memberId);
    const data = await Notification.find({
      $or: [
        { type: { $ne: "direct" } },
        { type: "direct", targetId: memberId }
      ]
    }).sort({ createdAt: -1 }).limit(50);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH: mark notification as read by member ──
app.patch("/api/notifications/:id/read", async (req, res) => {
  try {
    const { memberId } = req.body || {};
    if (!memberId) return res.status(400).json({ error: "memberId required" });
    await Notification.findByIdAndUpdate(req.params.id, { $addToSet: { readBy: String(memberId) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE ──
app.delete("/api/notifications/:id", async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════
   SCHEMA: PROJECT SUBMISSION
══════════════════════════════════════════ */
const projectSubmissionSchema = new mongoose.Schema({
  projectId:      { type: String, required: true, index: true },
  memberId:       { type: String, required: true, index: true },
  memberName:     String,
  projectTitle:   String,
  type:           { type: String, enum: ["file", "link"], required: true },
  linkUrl:        String,
  fileName:       String,
  filePath:       String,
  fileSize:       Number,
  mimeType:       String,
  note:           String,
  adminFeedback:  String,
  createdAt:      { type: Date, default: Date.now }
}, { timestamps: false });

const ProjectSubmission = mongoose.model("ProjectSubmission", projectSubmissionSchema);

function getProjectDisplayTitle(project) {
  return project?.title || project?.name || "Untitled Project";
}

function getProjectClientName(project) {
  return project?.clientName || project?.business || project?.name || "";
}

function getProjectBriefUrl(project) {
  return project?.briefPdfUrl || project?.briefUrl || project?.briefPdf || "";
}

async function requireAssignedMemberProject(req, res) {
  const session = await getMemberSessionFromToken(req);
  if (!session) {
    res.status(401).json({ error: "Member session expired" });
    return null;
  }

  const project = await Project.findById(req.params.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return null;
  }

  const memberId = String(session.member._id);
  const assigned = Array.isArray(project.assignedMemberIds) && project.assignedMemberIds.map(String).includes(memberId);
  if (!assigned) {
    res.status(403).json({ error: "You do not have access to this project" });
    return null;
  }

  return { session, project, memberId };
}

app.get("/api/member/projects", async (req, res) => {
  try {
    const session = await getMemberSessionFromToken(req);
    if (!session) {
      return res.status(401).json({ error: "Member session expired" });
    }

    const memberId = String(session.member._id);
    const projects = await Project.find({ assignedMemberIds: memberId }).sort({ timestamp: -1 });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/member/project-submissions", async (req, res) => {
  try {
    const session = await getMemberSessionFromToken(req);
    if (!session) {
      return res.status(401).json({ error: "Member session expired" });
    }

    const memberId = String(session.member._id);
    const projects = await Project.find({ assignedMemberIds: memberId }).select("_id");
    const allowedProjectIds = projects.map(project => String(project._id));
    const submissions = await ProjectSubmission.find({
      memberId,
      projectId: { $in: allowedProjectIds }
    }).sort({ createdAt: -1 });
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/projects/:id/submissions", async (req, res) => {
  try {
    const adminSession = await requireAdminSession(req, res);
    if (!adminSession) return;
    const project = await Project.findById(req.params.id).select("_id");
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    const submissions = await ProjectSubmission.find({ projectId: String(project._id) }).sort({ createdAt: -1 });
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/project-submissions/:id/feedback", async (req, res) => {
  try {
    const adminSession = await requireAdminSession(req, res);
    if (!adminSession) return;

    const adminFeedback = String(req.body?.adminFeedback || "").trim().slice(0, 4000);
    const submission = await ProjectSubmission.findByIdAndUpdate(
      req.params.id,
      { $set: { adminFeedback } },
      { new: true, runValidators: false }
    );
    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    if (submission.memberId) {
      await Notification.create({
        title: "Project feedback added",
        message: `Admin added feedback on your ${submission.projectTitle || "project"} submission.`,
        type: "direct",
        targetId: String(submission.memberId),
        targetName: submission.memberName || ""
      });
      emitRealtimeEvent("project-feedback", {
        submissionId: String(submission._id),
        projectId: submission.projectId,
        projectTitle: submission.projectTitle || "",
        adminFeedback
      }, { roles: ["member"], memberIds: [String(submission.memberId)] });
    }

    res.json(submission);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/member/projects/:id/stage", async (req, res) => {
  try {
    const auth = await requireAssignedMemberProject(req, res);
    if (!auth) return;

    const nextStage = normalizeProjectDeliveryStage(req.body?.stage);
    const updates = {
      deliveryStage: nextStage
    };

    if (nextStage === "delivered") {
      updates.status = "completed";
    } else if (auth.project.status === "assigned") {
      updates.status = "inprogress";
    }

    const updated = await Project.findByIdAndUpdate(
      auth.project._id,
      { $set: updates },
      { new: true, runValidators: false }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/member/projects/:id/status", async (req, res) => {
  try {
    const auth = await requireAssignedMemberProject(req, res);
    if (!auth) return;

    const nextStatus = String(req.body?.status || "").trim().toLowerCase();
    const allowed = PRJ_TRANSITIONS[auth.project.status] || [];
    if (!allowed.includes(nextStatus)) {
      return res.status(400).json({
        error: `Cannot transition from '${auth.project.status}' to '${nextStatus}'. Allowed: ${allowed.join(", ") || "none"}`
      });
    }

    const updated = await Project.findByIdAndUpdate(
      auth.project._id,
      {
        $set: {
          status: nextStatus,
          deliveryStage: nextStatus === "completed" ? "delivered" : normalizeProjectDeliveryStage(auth.project.deliveryStage, "inprogress")
        }
      },
      { new: true, runValidators: false }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/member/projects/:id/submissions", async (req, res) => {
  try {
    const auth = await requireAssignedMemberProject(req, res);
    if (!auth) return;

    const mode = String(req.body?.mode || "").trim().toLowerCase();
    const note = String(req.body?.note || "").trim().slice(0, 4000);
    if (!["file", "link"].includes(mode)) {
      return res.status(400).json({ error: "mode must be file or link" });
    }

    const submissionData = {
      projectId: String(auth.project._id),
      memberId: auth.memberId,
      memberName: auth.session.member.name || "",
      projectTitle: getProjectDisplayTitle(auth.project),
      type: mode,
      note
    };

    if (mode === "link") {
      const linkUrl = String(req.body?.linkUrl || "").trim();
      if (!/^https?:\/\//i.test(linkUrl)) {
        return res.status(400).json({ error: "Enter a valid http(s) link" });
      }
      submissionData.linkUrl = linkUrl.slice(0, 2000);
    } else {
      const savedFile = await saveSubmissionFile(req.body?.file || {});
      Object.assign(submissionData, savedFile);
    }

    const submission = await ProjectSubmission.create(submissionData);

    const projectUpdates = {
      deliveryStage: "review",
      lastSubmissionAt: new Date()
    };
    if (auth.project.status === "assigned") {
      projectUpdates.status = "inprogress";
    }

    const updatedProject = await Project.findByIdAndUpdate(
      auth.project._id,
      { $set: projectUpdates },
      { new: true, runValidators: false }
    );

    await Notification.create({
      title: "Deliverable submitted",
      message: `${auth.session.member.name || "A member"} submitted a ${mode} deliverable for ${getProjectDisplayTitle(auth.project)}.`,
      type: "direct",
      targetId: "admin",
      targetName: "Admin"
    });

    emitRealtimeEvent("project-submission", {
      projectId: String(auth.project._id),
      projectTitle: getProjectDisplayTitle(auth.project),
      clientName: getProjectClientName(auth.project),
      memberId: auth.memberId,
      memberName: auth.session.member.name || "",
      mode,
      createdAt: submission.createdAt
    }, { roles: ["admin"] });

    res.status(201).json({
      success: true,
      submission,
      project: updatedProject
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════
   SCHEMA: CHAT MESSAGE
   Supports:
     - "team" chat: all members
     - "admin-{memberId}": DM between admin and a member
     - "member-{projectId}": project team chat
══════════════════════════════════════════ */
const chatSchema = new mongoose.Schema({
  room:       { type: String, required: true }, // "team", "admin-{memberId}", "project-{projId}"
  senderId:   { type: String, required: true }, // memberId or "admin"
  senderName: { type: String, required: true },
  message:    { type: String, required: true },
  createdAt:  { type: Date, default: Date.now }
});
chatSchema.index({ room: 1, createdAt: 1 });

const Chat = mongoose.model("Chat", chatSchema);

// ── POST: send message ──
app.post("/api/chat", async (req, res) => {
  try {
    const { room, senderId, senderName, message } = req.body;
    if (!room || !senderId || !message) return res.status(400).json({ error: "room, senderId and message required" });
    const doc = new Chat({ room, senderId, senderName: senderName || "Unknown", message });
    await doc.save();
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET: all rooms that have messages involving a member ──
app.get("/api/chat/rooms/member/:memberId", async (req, res) => {
  try {
    const mid = String(req.params.memberId);
    const rooms = await Chat.distinct("room", {
      $or: [
        { senderId: mid },
        { room: "team" },
        { room: `admin-${mid}` },
        { room: /^project-/, senderId: mid }
      ]
    });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET: latest message per admin-DM room (for admin sidebar) ──
app.get("/api/chat/rooms/admin-dms", async (req, res) => {
  try {
    const rooms = await Chat.aggregate([
      { $match: { room: /^admin-/ } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$room", lastMsg: { $first: "$message" }, lastTime: { $first: "$createdAt" }, lastSender: { $first: "$senderName" } } },
      { $sort: { lastTime: -1 } }
    ]);
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET: messages in a room (last 100) — keep after /api/chat/rooms/* routes ──
app.get("/api/chat/:room", async (req, res) => {
  try {
    const room = String(req.params.room || "");
    const data = await Chat.find({ room }).sort({ createdAt: 1 }).limit(100);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/chat/:id", async (req, res) => {
  try {
    const senderId = String(req.body?.senderId || req.query?.senderId || "");
    if (!senderId) return res.status(400).json({ error: "senderId required" });

    const doc = await Chat.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Message not found" });
    if (String(doc.senderId) !== senderId) {
      return res.status(403).json({ error: "You can delete only your own messages" });
    }

    await Chat.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════
   AI ASSIST (all frontends — local brain + optional OpenAI)
══════════════════════════════════════════ */
app.post("/api/ai/assist", async (req, res) => {
  try {
    const { role, message, context } = req.body || {};
    const allowed = new Set(["landing", "member", "admin"]);
    if (!allowed.has(role)) {
      return res.status(400).json({ error: "role must be landing, member, or admin" });
    }
    const reply = await getAiAssistReply({
      role,
      message: String(message || "").slice(0, 4000),
      context: context && typeof context === "object" && !Array.isArray(context) ? context : {}
    });
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/ai/password-coach", async (req, res) => {
  try {
    const reply = await getPasswordCoachReply(String(req.body?.message || ""));
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════
   404 CATCH-ALL
══════════════════════════════════════════ */
app.use((req, res) => {
  res.status(404).json({ error: "Route not found: " + req.method + " " + req.path });
});

/* ══════════════════════════════════════════
   START SERVER
══════════════════════════════════════════ */
const PORT = process.env.PORT || 5501;
let serverInstance = null;

async function startServer() {
  await connectToDatabase();
  serverInstance = app.listen(PORT, () => {
    console.log("🚀 YoungMinds server running on http://localhost:" + PORT);
  });
  return serverInstance;
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, connectToDatabase, normalizeEmail, normalizePhone };

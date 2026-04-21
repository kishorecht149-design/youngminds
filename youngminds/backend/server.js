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
app.get("/admin",  (req, res) => res.sendFile(path.join(rootDir, "n.html")));
app.get("/member", (req, res) => res.sendFile(path.join(rootDir, "s.html")));
app.get("/portal/projects", (req, res) => res.sendFile(path.join(rootDir, "s.html")));
app.get("/hire",   (req, res) => res.sendFile(path.join(rootDir, "p.html")));
app.use("/static", express.static(rootDir));
app.use("/uploads", express.static(uploadsDir));

/* ══════════════════════════════════════════
   HEALTH CHECK
══════════════════════════════════════════ */
app.get("/", (req, res) => res.sendFile(path.join(rootDir, "p.html")));
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
  name:        { type: String, required: true },
  designation: { type: String, default: "" },
  skills:      { type: [String], default: [] },
  bio:         { type: String, default: "" },
  photo:       { type: String, default: "" },
  order:       { type: Number, default: 0 },
  active:      { type: Boolean, default: true }
}, { timestamps: true });

const BoardMember = mongoose.model("BoardMember", boardMemberSchema);

const adminAccountSchema = new mongoose.Schema({
  key:      { type: String, default: ADMIN_ACCOUNT_KEY, unique: true },
  username: { type: String, required: true },
  password: { type: String, required: true },
  updatedAt:{ type: Date, default: Date.now }
}, { timestamps: false });

const AdminAccount = mongoose.model("AdminAccount", adminAccountSchema);

function sanitizeAdminAccount(admin) {
  return {
    username: admin?.username || getDefaultAdminUsername()
  };
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
    res.json(data.map(sanitizeApp));
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
function sanitizeApp(doc) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj.password;
  delete obj.resetToken;
  delete obj.resetExpiry;
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
    const list = await BoardMember.find({ active: true }).sort({ order: 1, createdAt: 1 });
    res.json(list.map(sanitizeBoardMember));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/board-members/admin", async (req, res) => {
  try {
    const list = await BoardMember.find().sort({ order: 1, createdAt: 1 });
    res.json(list.map(sanitizeBoardMember));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/board-members", async (req, res) => {
  try {
    if (!req.body.name) return res.status(400).json({ error: "name is required" });
    const doc = await BoardMember.create({
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
    const doc = new Project({ ...req.body, type: "project", status: "new" });
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
                     "title","clientName"];
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

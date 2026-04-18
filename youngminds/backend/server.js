require("dotenv").config();

const express  = require("express");
const path     = require("path");
const mongoose = require("mongoose");
const cors     = require("cors");
const crypto   = require("crypto");
const { createAuthToken } = require("./auth");
const { getAiAssistReply, getPasswordCoachReply } = require("./ai-assist");

const app = express();

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
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ══════════════════════════════════════════
   SERVE FRONTEND FILES
══════════════════════════════════════════ */
const rootDir = path.join(__dirname, "..");
app.get("/admin",  (req, res) => res.sendFile(path.join(rootDir, "n.html")));
app.get("/member", (req, res) => res.sendFile(path.join(rootDir, "s.html")));
app.get("/hire",   (req, res) => res.sendFile(path.join(rootDir, "p.html")));
app.use("/static", express.static(rootDir));

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
function hashPassword(pw) {
  return crypto.createHash("sha256").update(pw + "ym-salt-2026").digest("hex");
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
   AUTH: Member Login (Gmail + Password)
══════════════════════════════════════════ */
app.post("/api/auth/login", async (req, res) => {
  try {
    const { gmail, password } = req.body;
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
      token: createAuthToken({ role: "member", sub: String(member._id), gmail: payload.gmail || payload.email || "" })
    });
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
                     "assignedMemberIds","assignedGroupId"];
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

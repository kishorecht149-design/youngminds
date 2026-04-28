const mongoose = require("mongoose");

function registerSalesPortal(app, deps) {
  const {
    crypto,
    createAuthToken,
    verifyAuthToken,
    DEFAULT_TTL_SECONDS,
    REMEMBER_ME_TTL_SECONDS,
    normalizeEmail,
    normalizePhone,
    hashPassword,
    readBearerToken,
    requireAdminSession,
    sendShellFile,
    emitRealtimeEvent,
    Application
  } = deps;

  const SALES_STATUS_ACTIVE = "active";
  const SALES_DAILY_EMAIL_LIMIT = Math.max(1, Number(process.env.SALES_DAILY_EMAIL_LIMIT || 200));
  const SALES_DAILY_WHATSAPP_LIMIT = Math.max(1, Number(process.env.SALES_DAILY_WHATSAPP_LIMIT || 120));
  const SALES_DELAY_MIN_SECONDS = 5;
  const SALES_DELAY_MAX_SECONDS = 10;
  const SALES_ALLOWED_MEMBER_STATUSES = ["accepted", "hired", "inwork"];
  const salesJobs = new Map();

  const salesLeadSchema = new mongoose.Schema({
    ownerId: { type: String, required: true, index: true },
    name: { type: String, required: true, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    company: { type: String, default: "" },
    status: { type: String, default: "new", enum: ["new", "contacted", "replied", "converted", "lost"] },
    source: { type: String, default: "manual" },
    tags: { type: [String], default: [] },
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastContactedAt: Date,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }, { timestamps: false });

  const salesCampaignSchema = new mongoose.Schema({
    ownerId: { type: String, required: true, index: true },
    name: { type: String, required: true, default: "" },
    channel: { type: String, default: "email", enum: ["email", "whatsapp", "both"] },
    subject: { type: String, default: "" },
    messageTemplate: { type: String, default: "" },
    selectedLeadIds: { type: [String], default: [] },
    delaySeconds: { type: Number, default: SALES_DELAY_MIN_SECONDS },
    status: { type: String, default: "draft", enum: ["draft", "sending", "completed", "scheduled", "failed"] },
    analytics: {
      total: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 }
    },
    scheduledAt: Date,
    startedAt: Date,
    completedAt: Date,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }, { timestamps: false });

  const salesMessageLogSchema = new mongoose.Schema({
    ownerId: { type: String, required: true, index: true },
    campaignId: { type: String, required: true, index: true },
    leadId: { type: String, required: true, index: true },
    channel: { type: String, required: true, enum: ["email", "whatsapp"] },
    status: { type: String, default: "queued", enum: ["queued", "sent", "failed", "skipped"] },
    subject: { type: String, default: "" },
    message: { type: String, default: "" },
    toEmail: { type: String, default: "" },
    toPhone: { type: String, default: "" },
    error: { type: String, default: "" },
    providerId: { type: String, default: "" },
    sentAt: Date,
    createdAt: { type: Date, default: Date.now }
  }, { timestamps: false });

  const salesNotificationSchema = new mongoose.Schema({
    ownerId: { type: String, required: true, index: true },
    title: { type: String, default: "" },
    message: { type: String, default: "" },
    type: { type: String, default: "info", enum: ["info", "success", "warning", "error"] },
    readAt: Date,
    createdAt: { type: Date, default: Date.now }
  }, { timestamps: false });

  const SalesLead = mongoose.models.SalesLead || mongoose.model("SalesLead", salesLeadSchema);
  const SalesCampaign = mongoose.models.SalesCampaign || mongoose.model("SalesCampaign", salesCampaignSchema);
  const SalesMessageLog = mongoose.models.SalesMessageLog || mongoose.model("SalesMessageLog", salesMessageLogSchema);
  const SalesNotification = mongoose.models.SalesNotification || mongoose.model("SalesNotification", salesNotificationSchema);

  function getSalesTokenTtlSeconds(remember) {
    return remember ? REMEMBER_ME_TTL_SECONDS : Math.min(DEFAULT_TTL_SECONDS, 60 * 60 * 12);
  }

  function isSalesApplication(doc) {
    return Boolean(doc?.salesAccess) && SALES_ALLOWED_MEMBER_STATUSES.includes(String(doc?.status || ""));
  }

  function isSalesExecutiveActive(doc) {
    return isSalesApplication(doc) && String(doc?.salesStatus || SALES_STATUS_ACTIVE) !== "inactive";
  }

  function sanitizeSalesExecutive(doc) {
    return {
      id: String(doc?._id || doc?.id || ""),
      applicationId: String(doc?._id || doc?.id || ""),
      name: doc?.name || "",
      email: doc?.gmail || doc?.email || "",
      phone: doc?.phone || "",
      designation: doc?.salesDesignation || "Sales Executive",
      city: doc?.city || "",
      notes: doc?.salesNotes || "",
      role: "sales",
      status: String(doc?.salesStatus || SALES_STATUS_ACTIVE) === "inactive" ? "inactive" : "active",
      applicationStatus: doc?.status || "new",
      lastLoginAt: doc?.salesLastLoginAt || null
    };
  }

  function sanitizeSalesLead(doc) {
    return {
      id: String(doc?._id || doc?.id || ""),
      ownerId: String(doc?.ownerId || ""),
      name: doc?.name || "",
      email: doc?.email || "",
      phone: doc?.phone || "",
      company: doc?.company || "",
      status: doc?.status || "new",
      source: doc?.source || "manual",
      tags: Array.isArray(doc?.tags) ? doc.tags : [],
      customFields: doc?.customFields || {},
      lastContactedAt: doc?.lastContactedAt || null,
      createdAt: doc?.createdAt || null,
      updatedAt: doc?.updatedAt || null
    };
  }

  function sanitizeSalesCampaign(doc) {
    return {
      id: String(doc?._id || doc?.id || ""),
      ownerId: String(doc?.ownerId || ""),
      name: doc?.name || "",
      channel: doc?.channel || "email",
      subject: doc?.subject || "",
      messageTemplate: doc?.messageTemplate || "",
      selectedLeadIds: Array.isArray(doc?.selectedLeadIds) ? doc.selectedLeadIds.map(String) : [],
      delaySeconds: Number(doc?.delaySeconds || SALES_DELAY_MIN_SECONDS),
      status: doc?.status || "draft",
      analytics: {
        total: Number(doc?.analytics?.total || 0),
        sent: Number(doc?.analytics?.sent || 0),
        delivered: Number(doc?.analytics?.delivered || 0),
        failed: Number(doc?.analytics?.failed || 0),
        skipped: Number(doc?.analytics?.skipped || 0)
      },
      scheduledAt: doc?.scheduledAt || null,
      startedAt: doc?.startedAt || null,
      completedAt: doc?.completedAt || null,
      createdAt: doc?.createdAt || null,
      updatedAt: doc?.updatedAt || null
    };
  }

  function sanitizeSalesLog(doc) {
    return {
      id: String(doc?._id || doc?.id || ""),
      ownerId: String(doc?.ownerId || ""),
      campaignId: String(doc?.campaignId || ""),
      leadId: String(doc?.leadId || ""),
      channel: doc?.channel || "email",
      status: doc?.status || "queued",
      subject: doc?.subject || "",
      message: doc?.message || "",
      toEmail: doc?.toEmail || "",
      toPhone: doc?.toPhone || "",
      error: doc?.error || "",
      providerId: doc?.providerId || "",
      sentAt: doc?.sentAt || null,
      createdAt: doc?.createdAt || null
    };
  }

  function sanitizeSalesNotification(doc) {
    return {
      id: String(doc?._id || doc?.id || ""),
      title: doc?.title || "",
      message: doc?.message || "",
      type: doc?.type || "info",
      readAt: doc?.readAt || null,
      createdAt: doc?.createdAt || null
    };
  }

  function renderTemplate(template, lead = {}, executive = {}) {
    const data = {
      name: lead?.name || "",
      email: lead?.email || "",
      phone: lead?.phone || "",
      company: lead?.company || "",
      status: lead?.status || "",
      executive_name: executive?.name || "",
      executive_email: executive?.email || ""
    };
    return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => String(data[key] ?? ""));
  }

  async function createSalesNotification(ownerId, title, message, type = "info") {
    if (!ownerId) return null;
    const doc = await SalesNotification.create({
      ownerId: String(ownerId),
      title: String(title || "").trim(),
      message: String(message || "").trim(),
      type
    });
    emitRealtimeEvent("sales-notification", { ownerId: String(ownerId), notification: sanitizeSalesNotification(doc) }, { roles: ["admin", "sales"], memberIds: [String(ownerId)] });
    return doc;
  }

  async function getSalesExecutiveSessionFromToken(req) {
    const payload = verifyAuthToken(readBearerToken(req));
    if (!payload || payload.role !== "sales" || !payload.sub || !payload.sid) return null;
    const executive = await Application.findById(payload.sub);
    if (!executive || !isSalesExecutiveActive(executive)) return null;
    if (String(executive.salesSessionNonce || "") !== String(payload.sid || "")) return null;
    return { payload, executive };
  }

  async function requireSalesExecutiveSession(req, res) {
    const session = await getSalesExecutiveSessionFromToken(req);
    if (!session) {
      res.status(401).json({ error: "Sales session expired" });
      return null;
    }
    return session;
  }

  async function getSalesDashboard(ownerId) {
    const [leads, campaigns, logs, notifications, team] = await Promise.all([
      SalesLead.find({ ownerId }).sort({ updatedAt: -1 }).limit(500),
      SalesCampaign.find({ ownerId }).sort({ updatedAt: -1 }).limit(100),
      SalesMessageLog.find({ ownerId }).sort({ createdAt: -1 }).limit(300),
      SalesNotification.find({ ownerId }).sort({ createdAt: -1 }).limit(30),
      Application.find({ salesAccess: true, status: { $in: SALES_ALLOWED_MEMBER_STATUSES }, salesStatus: { $ne: "inactive" } }).sort({ name: 1 }).limit(100)
    ]);
    const totalSent = logs.filter(item => item.status === "sent").length;
    const totalFailed = logs.filter(item => item.status === "failed").length;
    return {
      leads: leads.map(sanitizeSalesLead),
      campaigns: campaigns.map(sanitizeSalesCampaign),
      logs: logs.map(sanitizeSalesLog),
      notifications: notifications.map(sanitizeSalesNotification),
      team: team.map(sanitizeSalesExecutive),
      analytics: {
        totalLeads: leads.length,
        activeCampaigns: campaigns.filter(item => item.status === "sending").length,
        totalCampaigns: campaigns.length,
        totalSent,
        totalDelivered: totalSent,
        totalFailed,
        converted: leads.filter(item => item.status === "converted").length,
        replied: leads.filter(item => item.status === "replied").length
      }
    };
  }

  function normalizeLeadInput(raw) {
    const item = raw && typeof raw === "object" ? raw : {};
    return {
      name: String(item.name || "").trim(),
      email: normalizeEmail(item.email || ""),
      phone: normalizePhone(item.phone || ""),
      company: String(item.company || "").trim(),
      source: String(item.source || "upload").trim() || "upload",
      tags: Array.isArray(item.tags) ? item.tags.map(tag => String(tag || "").trim()).filter(Boolean).slice(0, 8) : [],
      customFields: item.customFields && typeof item.customFields === "object" ? item.customFields : {}
    };
  }

  function getCampaignDelaySeconds(raw) {
    return Math.max(SALES_DELAY_MIN_SECONDS, Math.min(SALES_DELAY_MAX_SECONDS, Number(raw || SALES_DELAY_MIN_SECONDS)));
  }

  async function sendEmailMessage({ to, subject, html, text }) {
    let nodemailer = null;
    try {
      nodemailer = require("nodemailer");
    } catch {
      return { ok: false, error: "nodemailer_not_installed" };
    }
    const user = process.env.SMTP_USER || process.env.GMAIL_SMTP_USER || "";
    const pass = process.env.SMTP_PASS || process.env.GMAIL_SMTP_PASS || "";
    if (!user || !pass) return { ok: false, error: "smtp_not_configured" };
    const transporter = nodemailer.createTransport(
      process.env.SMTP_HOST
        ? { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: String(process.env.SMTP_SECURE || "false") === "true", auth: { user, pass } }
        : { service: "gmail", auth: { user, pass } }
    );
    const info = await transporter.sendMail({
      from: process.env.SALES_EMAIL_FROM || user,
      to,
      subject,
      text,
      html
    });
    return { ok: true, providerId: info?.messageId || "" };
  }

  async function sendWhatsAppMessage({ to, body }) {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_WHATSAPP_FROM) {
      return { ok: false, error: "twilio_not_configured" };
    }
    if (!to) return { ok: false, error: "phone_missing" };
    const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
    const params = new URLSearchParams({
      From: process.env.TWILIO_WHATSAPP_FROM,
      To: to.startsWith("whatsapp:") ? to : `whatsapp:${to}`,
      Body: body
    });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: payload?.message || "twilio_send_failed" };
    return { ok: true, providerId: payload?.sid || "" };
  }

  async function countSentToday(ownerId, channel) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return SalesMessageLog.countDocuments({
      ownerId: String(ownerId),
      channel,
      status: "sent",
      sentAt: { $gte: start }
    });
  }

  async function recomputeCampaignAnalytics(campaignId) {
    const logs = await SalesMessageLog.find({ campaignId: String(campaignId) });
    const analytics = {
      total: logs.length,
      sent: logs.filter(item => item.status === "sent").length,
      delivered: logs.filter(item => item.status === "sent").length,
      failed: logs.filter(item => item.status === "failed").length,
      skipped: logs.filter(item => item.status === "skipped").length
    };
    await SalesCampaign.findByIdAndUpdate(campaignId, {
      $set: {
        analytics,
        updatedAt: new Date(),
        completedAt: analytics.total ? new Date() : null,
        status: "completed"
      }
    });
    return analytics;
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function runSalesCampaign(campaignId) {
    const normalizedId = String(campaignId || "");
    if (!normalizedId || salesJobs.has(normalizedId)) return;
    const job = (async () => {
      const campaign = await SalesCampaign.findById(normalizedId);
      if (!campaign) return;
      const executive = await Application.findById(campaign.ownerId);
      if (!executive || !isSalesExecutiveActive(executive)) return;
      campaign.status = "sending";
      campaign.startedAt = new Date();
      campaign.updatedAt = new Date();
      await campaign.save();
      const leads = await SalesLead.find({
        _id: { $in: (campaign.selectedLeadIds || []).map(id => new mongoose.Types.ObjectId(String(id))) },
        ownerId: String(campaign.ownerId)
      });

      for (const lead of leads) {
        const leadId = String(lead._id);
        if (["email", "both"].includes(campaign.channel)) {
          const renderedSubject = renderTemplate(campaign.subject, lead, sanitizeSalesExecutive(executive));
          const renderedMessage = renderTemplate(campaign.messageTemplate, lead, sanitizeSalesExecutive(executive));
          const existing = await SalesMessageLog.findOne({ campaignId: normalizedId, leadId, channel: "email", status: "sent" });
          if (existing) {
            await SalesMessageLog.create({ ownerId: String(campaign.ownerId), campaignId: normalizedId, leadId, channel: "email", status: "skipped", subject: renderedSubject, message: renderedMessage, toEmail: lead.email, error: "duplicate_prevented" });
          } else if (await countSentToday(campaign.ownerId, "email") >= SALES_DAILY_EMAIL_LIMIT) {
            await SalesMessageLog.create({ ownerId: String(campaign.ownerId), campaignId: normalizedId, leadId, channel: "email", status: "failed", subject: renderedSubject, message: renderedMessage, toEmail: lead.email, error: "daily_email_limit_reached" });
          } else if (!lead.email) {
            await SalesMessageLog.create({ ownerId: String(campaign.ownerId), campaignId: normalizedId, leadId, channel: "email", status: "failed", subject: renderedSubject, message: renderedMessage, toEmail: "", error: "lead_email_missing" });
          } else {
            const emailResult = await sendEmailMessage({ to: lead.email, subject: renderedSubject, text: renderedMessage, html: `<div style="font-family:Arial,sans-serif;white-space:pre-line">${renderedMessage}</div>` });
            await SalesMessageLog.create({ ownerId: String(campaign.ownerId), campaignId: normalizedId, leadId, channel: "email", status: emailResult.ok ? "sent" : "failed", subject: renderedSubject, message: renderedMessage, toEmail: lead.email, error: emailResult.ok ? "" : emailResult.error, providerId: emailResult.providerId || "", sentAt: emailResult.ok ? new Date() : null });
          }
        }

        if (["whatsapp", "both"].includes(campaign.channel)) {
          const renderedMessage = renderTemplate(campaign.messageTemplate, lead, sanitizeSalesExecutive(executive));
          const existing = await SalesMessageLog.findOne({ campaignId: normalizedId, leadId, channel: "whatsapp", status: "sent" });
          if (existing) {
            await SalesMessageLog.create({ ownerId: String(campaign.ownerId), campaignId: normalizedId, leadId, channel: "whatsapp", status: "skipped", message: renderedMessage, toPhone: lead.phone, error: "duplicate_prevented" });
          } else if (await countSentToday(campaign.ownerId, "whatsapp") >= SALES_DAILY_WHATSAPP_LIMIT) {
            await SalesMessageLog.create({ ownerId: String(campaign.ownerId), campaignId: normalizedId, leadId, channel: "whatsapp", status: "failed", message: renderedMessage, toPhone: lead.phone, error: "daily_whatsapp_limit_reached" });
          } else if (!lead.phone) {
            await SalesMessageLog.create({ ownerId: String(campaign.ownerId), campaignId: normalizedId, leadId, channel: "whatsapp", status: "failed", message: renderedMessage, toPhone: "", error: "lead_phone_missing" });
          } else {
            const result = await sendWhatsAppMessage({ to: lead.phone, body: renderedMessage });
            await SalesMessageLog.create({ ownerId: String(campaign.ownerId), campaignId: normalizedId, leadId, channel: "whatsapp", status: result.ok ? "sent" : "failed", message: renderedMessage, toPhone: lead.phone, error: result.ok ? "" : result.error, providerId: result.providerId || "", sentAt: result.ok ? new Date() : null });
          }
        }

        lead.lastContactedAt = new Date();
        lead.updatedAt = new Date();
        if (lead.status === "new") lead.status = "contacted";
        await lead.save();
        await wait(getCampaignDelaySeconds(campaign.delaySeconds) * 1000);
      }

      const analytics = await recomputeCampaignAnalytics(normalizedId);
      await createSalesNotification(campaign.ownerId, "Campaign completed", `${campaign.name} finished with ${analytics.sent} sent and ${analytics.failed} failed.`, analytics.failed ? "warning" : "success");
      emitRealtimeEvent("sales-campaign-completed", { campaignId: normalizedId, analytics }, { roles: ["admin", "sales"], memberIds: [String(campaign.ownerId)] });
    })().finally(() => {
      salesJobs.delete(normalizedId);
    });
    salesJobs.set(normalizedId, job);
  }

  app.get("/sales", (req, res) => sendShellFile(res, "youngminds/sales.html"));
  app.get("/portal/sales", (req, res) => sendShellFile(res, "youngminds/sales.html"));

  app.get("/api/sales/admin/executives", async (req, res) => {
    try {
      const session = await requireAdminSession(req, res);
      if (!session) return;
      const entries = await Application.find({ salesAccess: true }).sort({ timestamp: -1 });
      res.json(entries.map(sanitizeSalesExecutive));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/sales/admin/candidates", async (req, res) => {
    try {
      const session = await requireAdminSession(req, res);
      if (!session) return;
      const entries = await Application.find({
        status: { $in: SALES_ALLOWED_MEMBER_STATUSES },
        password: { $exists: true, $ne: "" },
        $or: [{ gmail: { $exists: true, $ne: "" } }, { email: { $exists: true, $ne: "" } }]
      }).sort({ timestamp: -1 }).limit(300);
      res.json(entries.map(item => ({
        id: String(item._id),
        name: item.name || "",
        email: item.gmail || item.email || "",
        phone: item.phone || "",
        city: item.city || "",
        skill: item.skill || "",
        status: item.status || "new",
        salesAccess: Boolean(item.salesAccess)
      })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/sales/admin/executives", async (req, res) => {
    try {
      const session = await requireAdminSession(req, res);
      if (!session) return;
      const applicationId = String(req.body?.applicationId || "").trim();
      if (!applicationId) return res.status(400).json({ error: "Select an existing application account to grant sales access" });
      const member = await Application.findById(applicationId);
      if (!member) return res.status(404).json({ error: "Application account not found" });
      if (!member.password || !(member.gmail || member.email)) return res.status(400).json({ error: "This member does not have a usable application login yet" });
      member.salesAccess = true;
      member.salesStatus = String(req.body?.status || SALES_STATUS_ACTIVE).trim() === "inactive" ? "inactive" : "active";
      member.salesDesignation = String(req.body?.designation || member.salesDesignation || "Sales Executive").trim() || "Sales Executive";
      member.salesNotes = String(req.body?.notes || member.salesNotes || "").trim();
      if (req.body?.city !== undefined) member.city = String(req.body.city || "").trim();
      member.salesSessionNonce = "";
      await member.save();
      res.status(201).json(sanitizeSalesExecutive(member));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/sales/admin/executives/:id", async (req, res) => {
    try {
      const session = await requireAdminSession(req, res);
      if (!session) return;
      const member = await Application.findById(req.params.id);
      if (!member || !member.salesAccess) return res.status(404).json({ error: "Sales access record not found" });
      member.name = String(req.body?.name || member.name || "").trim() || member.name;
      member.phone = normalizePhone(req.body?.phone || member.phone || "");
      member.city = String(req.body?.city || member.city || "").trim();
      member.salesDesignation = String(req.body?.designation || member.salesDesignation || "Sales Executive").trim() || "Sales Executive";
      member.salesNotes = String(req.body?.notes || member.salesNotes || "").trim();
      member.salesStatus = String(req.body?.status || SALES_STATUS_ACTIVE).trim() === "inactive" ? "inactive" : "active";
      await member.save();
      res.json(sanitizeSalesExecutive(member));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/sales/admin/executives/:id/reset-access", async (req, res) => {
    try {
      const session = await requireAdminSession(req, res);
      if (!session) return;
      const member = await Application.findById(req.params.id);
      if (!member || !member.salesAccess) return res.status(404).json({ error: "Sales access record not found" });
      const rawPassword = String(req.body?.password || "").trim();
      if (rawPassword.length < 8) return res.status(400).json({ error: "Sales portal reset password must be at least 8 characters" });
      member.salesPassword = hashPassword(rawPassword);
      member.salesSessionNonce = "";
      member.salesLastResetBy = session.admin.username;
      await member.save();
      res.json({
        success: true,
        memberId: String(member._id),
        memberName: member.name || "",
        email: member.gmail || member.email || "",
        password: rawPassword
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/sales/admin/executives/:id", async (req, res) => {
    try {
      const session = await requireAdminSession(req, res);
      if (!session) return;
      const member = await Application.findById(req.params.id);
      if (!member || !member.salesAccess) return res.status(404).json({ error: "Sales access record not found" });
      member.salesAccess = false;
      member.salesStatus = undefined;
      member.salesDesignation = undefined;
      member.salesNotes = undefined;
      member.salesPassword = undefined;
      member.salesSessionNonce = "";
      await member.save();
      res.json({ ok: true, id: String(member._id) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/sales/auth/login", async (req, res) => {
    try {
      const email = normalizeEmail(req.body?.email || "");
      const password = String(req.body?.password || "");
      const remember = Boolean(req.body?.remember);
      if (!email || !password) return res.status(400).json({ error: "email and password required" });
      const executive = await Application.findOne({ $or: [{ gmail: email }, { email }] });
      if (!executive || !isSalesExecutiveActive(executive)) {
        return res.status(401).json({ error: "Sales access is not enabled for this account" });
      }
      const expectedPassword = String(executive.salesPassword || executive.password || "");
      if (!expectedPassword) return res.status(403).json({ error: "This sales account does not have a valid password on file" });
      if (expectedPassword !== hashPassword(password)) {
        return res.status(401).json({ error: executive.salesPassword ? "Password does not match the latest sales reset password" : "Password does not match the application form password" });
      }
      const nonce = crypto.randomUUID();
      executive.salesSessionNonce = nonce;
      executive.salesLastLoginAt = new Date();
      await executive.save();
      res.json({
        executive: sanitizeSalesExecutive(executive),
        token: createAuthToken(
          { role: "sales", sub: String(executive._id), sid: nonce, email: executive.gmail || executive.email || "" },
          { ttlSeconds: getSalesTokenTtlSeconds(remember) }
        )
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/sales/auth/session", async (req, res) => {
    try {
      const session = await requireSalesExecutiveSession(req, res);
      if (!session) return;
      res.json({ executive: sanitizeSalesExecutive(session.executive) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/sales/bootstrap", async (req, res) => {
    try {
      const session = await requireSalesExecutiveSession(req, res);
      if (!session) return;
      const dashboard = await getSalesDashboard(String(session.executive._id));
      res.json({ executive: sanitizeSalesExecutive(session.executive), ...dashboard });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/sales/profile", async (req, res) => {
    try {
      const session = await requireSalesExecutiveSession(req, res);
      if (!session) return;
      const member = await Application.findById(session.executive._id);
      if (!member || !member.salesAccess) return res.status(404).json({ error: "Sales account not found" });
      member.name = String(req.body?.name || member.name || "").trim() || member.name;
      member.phone = normalizePhone(req.body?.phone || member.phone || "");
      member.city = String(req.body?.city || member.city || "").trim();
      member.salesDesignation = String(req.body?.designation || member.salesDesignation || "Sales Executive").trim() || "Sales Executive";
      member.salesNotes = String(req.body?.notes || member.salesNotes || "").trim();
      await member.save();
      res.json({ executive: sanitizeSalesExecutive(member) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/sales/team", async (req, res) => {
    try {
      const session = await requireSalesExecutiveSession(req, res);
      if (!session) return;
      const team = await Application.find({ salesAccess: true, status: { $in: SALES_ALLOWED_MEMBER_STATUSES }, salesStatus: { $ne: "inactive" } }).sort({ name: 1 });
      res.json(team.map(sanitizeSalesExecutive));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/sales/notifications", async (req, res) => {
    try {
      const session = await requireSalesExecutiveSession(req, res);
      if (!session) return;
      const rows = await SalesNotification.find({ ownerId: String(session.executive._id) }).sort({ createdAt: -1 }).limit(60);
      res.json(rows.map(sanitizeSalesNotification));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/sales/notifications/:id/read", async (req, res) => {
    try {
      const session = await requireSalesExecutiveSession(req, res);
      if (!session) return;
      const doc = await SalesNotification.findOneAndUpdate({ _id: req.params.id, ownerId: String(session.executive._id) }, { $set: { readAt: new Date() } }, { new: true });
      if (!doc) return res.status(404).json({ error: "Notification not found" });
      res.json(sanitizeSalesNotification(doc));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/sales/leads/import", async (req, res) => {
    try {
      const session = await requireSalesExecutiveSession(req, res);
      if (!session) return;
      const rows = Array.isArray(req.body?.leads) ? req.body.leads : [];
      if (!rows.length) return res.status(400).json({ error: "No leads provided" });
      const ownerId = String(session.executive._id);
      const saved = [];
      for (const raw of rows.slice(0, 1000)) {
        const item = normalizeLeadInput(raw);
        if (!item.name || (!item.email && !item.phone)) continue;
        const duplicate = await SalesLead.findOne({ ownerId, $or: [item.email ? { email: item.email } : null, item.phone ? { phone: item.phone } : null].filter(Boolean) });
        if (duplicate) continue;
        const doc = await SalesLead.create({ ownerId, ...item, updatedAt: new Date() });
        saved.push(sanitizeSalesLead(doc));
      }
      await createSalesNotification(ownerId, "Leads imported", `${saved.length} new lead${saved.length === 1 ? "" : "s"} added to your sales pipeline.`, saved.length ? "success" : "warning");
      res.status(201).json({ success: true, count: saved.length, leads: saved });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/sales/leads", async (req, res) => {
    try {
      const session = await requireSalesExecutiveSession(req, res);
      if (!session) return;
      const item = normalizeLeadInput(req.body || {});
      if (!item.name || (!item.email && !item.phone)) return res.status(400).json({ error: "Lead name plus email or phone is required" });
      const ownerId = String(session.executive._id);
      const duplicate = await SalesLead.findOne({ ownerId, $or: [item.email ? { email: item.email } : null, item.phone ? { phone: item.phone } : null].filter(Boolean) });
      if (duplicate) return res.status(409).json({ error: "Lead already exists with the same email or phone" });
      const doc = await SalesLead.create({ ownerId, ...item, source: item.source || "manual", updatedAt: new Date() });
      res.status(201).json(sanitizeSalesLead(doc));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/sales/leads", async (req, res) => {
    try {
      const session = await requireSalesExecutiveSession(req, res);
      if (!session) return;
      const rows = await SalesLead.find({ ownerId: String(session.executive._id) }).sort({ updatedAt: -1, createdAt: -1 });
      res.json(rows.map(sanitizeSalesLead));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/sales/leads/:id", async (req, res) => {
    try {
      const session = await requireSalesExecutiveSession(req, res);
      if (!session) return;
      const updates = normalizeLeadInput(req.body || {});
      const doc = await SalesLead.findOneAndUpdate(
        { _id: req.params.id, ownerId: String(session.executive._id) },
        { $set: { name: updates.name || undefined, email: updates.email || "", phone: updates.phone || "", company: updates.company || "", source: updates.source || "manual", tags: updates.tags, customFields: updates.customFields, status: String(req.body?.status || "new").trim() || "new", updatedAt: new Date() } },
        { new: true }
      );
      if (!doc) return res.status(404).json({ error: "Lead not found" });
      res.json(sanitizeSalesLead(doc));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/sales/leads/:id", async (req, res) => {
    try {
      const session = await requireSalesExecutiveSession(req, res);
      if (!session) return;
      const doc = await SalesLead.findOneAndDelete({ _id: req.params.id, ownerId: String(session.executive._id) });
      if (!doc) return res.status(404).json({ error: "Lead not found" });
      res.json({ ok: true, id: String(doc._id) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/sales/campaigns", async (req, res) => {
    try {
      const session = await requireSalesExecutiveSession(req, res);
      if (!session) return;
      const rows = await SalesCampaign.find({ ownerId: String(session.executive._id) }).sort({ updatedAt: -1 });
      res.json(rows.map(sanitizeSalesCampaign));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/sales/campaigns", async (req, res) => {
    try {
      const session = await requireSalesExecutiveSession(req, res);
      if (!session) return;
      const name = String(req.body?.name || "").trim();
      const messageTemplate = String(req.body?.messageTemplate || "").trim();
      const channel = ["email", "whatsapp", "both"].includes(String(req.body?.channel || "")) ? String(req.body.channel) : "email";
      const selectedLeadIds = Array.isArray(req.body?.selectedLeadIds) ? req.body.selectedLeadIds.map(String).filter(Boolean) : [];
      if (!name || !messageTemplate || !selectedLeadIds.length) return res.status(400).json({ error: "name, message template, and selected leads are required" });
      const doc = await SalesCampaign.create({
        ownerId: String(session.executive._id),
        name,
        channel,
        subject: String(req.body?.subject || "").trim(),
        messageTemplate,
        selectedLeadIds,
        delaySeconds: getCampaignDelaySeconds(req.body?.delaySeconds),
        status: req.body?.scheduledAt ? "scheduled" : "draft",
        scheduledAt: req.body?.scheduledAt ? new Date(req.body.scheduledAt) : null,
        updatedAt: new Date()
      });
      res.status(201).json(sanitizeSalesCampaign(doc));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/sales/campaigns/:id", async (req, res) => {
    try {
      const session = await requireSalesExecutiveSession(req, res);
      if (!session) return;
      const updates = {
        name: String(req.body?.name || "").trim(),
        channel: ["email", "whatsapp", "both"].includes(String(req.body?.channel || "")) ? String(req.body.channel) : "email",
        subject: String(req.body?.subject || "").trim(),
        messageTemplate: String(req.body?.messageTemplate || "").trim(),
        selectedLeadIds: Array.isArray(req.body?.selectedLeadIds) ? req.body.selectedLeadIds.map(String).filter(Boolean) : [],
        delaySeconds: getCampaignDelaySeconds(req.body?.delaySeconds),
        scheduledAt: req.body?.scheduledAt ? new Date(req.body.scheduledAt) : null,
        status: req.body?.scheduledAt ? "scheduled" : "draft",
        updatedAt: new Date()
      };
      const doc = await SalesCampaign.findOneAndUpdate({ _id: req.params.id, ownerId: String(session.executive._id) }, { $set: updates }, { new: true });
      if (!doc) return res.status(404).json({ error: "Campaign not found" });
      res.json(sanitizeSalesCampaign(doc));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/sales/campaigns/:id/send", async (req, res) => {
    try {
      const session = await requireSalesExecutiveSession(req, res);
      if (!session) return;
      const campaign = await SalesCampaign.findOne({ _id: req.params.id, ownerId: String(session.executive._id) });
      if (!campaign) return res.status(404).json({ error: "Campaign not found" });
      campaign.status = "sending";
      campaign.updatedAt = new Date();
      campaign.startedAt = new Date();
      await campaign.save();
      await createSalesNotification(String(session.executive._id), "Campaign started", `${campaign.name} is now sending ${campaign.channel} messages.`, "info");
      runSalesCampaign(String(campaign._id)).catch(err => console.warn("Sales campaign job failed:", err.message));
      res.json({ success: true, campaign: sanitizeSalesCampaign(campaign) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/sales/campaigns/:id", async (req, res) => {
    try {
      const session = await requireSalesExecutiveSession(req, res);
      if (!session) return;
      const doc = await SalesCampaign.findOneAndDelete({ _id: req.params.id, ownerId: String(session.executive._id) });
      if (!doc) return res.status(404).json({ error: "Campaign not found" });
      await SalesMessageLog.deleteMany({ ownerId: String(session.executive._id), campaignId: String(doc._id) });
      res.json({ ok: true, id: String(doc._id) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/sales/campaigns/:id/logs", async (req, res) => {
    try {
      const session = await requireSalesExecutiveSession(req, res);
      if (!session) return;
      const logs = await SalesMessageLog.find({ ownerId: String(session.executive._id), campaignId: String(req.params.id) }).sort({ createdAt: -1 });
      res.json(logs.map(sanitizeSalesLog));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/sales/activity", async (req, res) => {
    try {
      const session = await requireSalesExecutiveSession(req, res);
      if (!session) return;
      const logs = await SalesMessageLog.find({ ownerId: String(session.executive._id) }).sort({ createdAt: -1 }).limit(300);
      res.json(logs.map(sanitizeSalesLog));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/sales/analytics", async (req, res) => {
    try {
      const session = await requireSalesExecutiveSession(req, res);
      if (!session) return;
      const dashboard = await getSalesDashboard(String(session.executive._id));
      res.json(dashboard.analytics);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return {
    models: {
      SalesLead,
      SalesCampaign,
      SalesMessageLog,
      SalesNotification
    }
  };
}

module.exports = { registerSalesPortal };

/**
 * YoungMinds portal AI assist — local knowledge + optional OpenAI.
 */

function normalizeMessage(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\u0900-\u097f\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreKeywords(msg, keywords) {
  let score = 0;
  for (const kw of keywords) {
    if (msg.includes(kw)) score += kw.split(" ").length >= 2 ? 2 : 1;
  }
  return score;
}

function buildLocalAssistReply(role, message, context) {
  const msg = normalizeMessage(message);
  const ctx = context && typeof context === "object" ? context : {};

  if (!msg) {
    return "Ask a question in a few words — for example payouts, projects, passwords, or how to apply.";
  }

  const blocks = [];

  /* ── Shared small talk ── */
  if (
    /^(hi|hello|hey|namaste|good\s*(morning|afternoon|evening)|thanks|thank\s*you)\b/.test(msg) ||
    ["hi", "hello", "hey"].includes(msg) ||
    /^thank/.test(msg)
  ) {
    blocks.push(
      role === "landing"
        ? "Hi! I am the YoungMinds guide. I can explain joining as a student member, hiring us for a project, pricing bands, timelines, and what happens after you submit a form."
        : role === "member"
          ? `Hi${ctx.memberName ? ", " + ctx.memberName : ""}! I can help with New Requests, My Projects, Chats, Payouts, profile edits, passwords, and admin notices.`
          : "Hi! I can walk you through applications, project stages, assignments, payments, circulars, password resets, and team chat."
    );
  }

  const add = (text, keywords, minScore = 1) => {
    const s = scoreKeywords(msg, keywords);
    if (s >= minScore) blocks.push(typeof text === "function" ? text(ctx, s) : text);
  };

  if (role === "landing") {
    add(
      "To apply as a member: open Apply as member, complete all three steps (personal info including Gmail and password, your skill and portfolio, then review). Status flows new → reviewing → hired or rejected. After hire you get the member portal for projects, chats, and payouts.",
      ["join", "apply", "member", "application", "student", "career", "portal", "password", "gmail", "hire me as"]
    );
    add(
      "To hire YoungMinds: switch to Hire our team, describe your service, budget, and timeline. Typical flow: we review → accept → assign specialists → work in progress → delivered. A 50% advance is mentioned on this page to secure your slot before work begins.",
      ["hire", "client", "business", "project", "request", "company", "startup", "agency", "work", "brief"]
    );
    if (ctx.services && ctx.services.length > 0) {
      add(
        `Services and starting prices: ${ctx.services.join("; ")}. Final quotes depend on scope — the hire form captures budget so we can respond accurately.`,
        ["price", "pricing", "cost", "budget", "rupee", "how much", "quote", "affordable", "cheap", "expensive", "payment", "advance", "50", "website", "design", "package", "service", "social", "video", "ai"]
      );
    } else {
      add(
        "Services and starting prices (from the site): Web from ₹5,000; Graphic design from ₹2,000; Content from ₹1,500; AI solutions from ₹8,000; Social from ₹4,000/mo; Video editing from ₹2,500. Final quotes depend on scope — the hire form captures budget so we can respond accurately.",
        ["price", "pricing", "cost", "budget", "rupee", "how much", "quote", "affordable", "cheap", "expensive", "payment", "advance", "50", "website", "design", "package", "service", "social", "video", "ai"]
      );
    }
    if (ctx.process && ctx.process.length > 0) {
      add(
        `Process: ${ctx.process.join(" → ")}.`,
        ["process", "how it works", "steps", "timeline", "time", "how long", "whatsapp", "response", "deliver"]
      );
    } else {
      add(
        "Process: (1) Fill the form — under about 3 minutes. (2) We reach out on WhatsApp within about 24–48 hours. (3) 50% advance secures your slot. (4) We deliver and revise until you are satisfied.",
        ["process", "how it works", "steps", "timeline", "time", "how long", "whatsapp", "response", "deliver"]
      );
    }
    add(
      "YoungMinds highlights student-powered delivery, dedicated specialists per service (not random generalists), and roughly ~50% cost savings versus traditional agencies — as shown in the stats on this page.",
      ["who", "youngminds", "about", "why", "team", "student", "quality", "difference"]
    );
    add(
      "After you submit: data is saved to our system so admins can review. Keep your Gmail and phone accurate — that is how we contact you. If the page errors, confirm the backend server is running (default API port 5501).",
      ["submit", "after", "what next", "saved", "error", "server", "not working", "broken"]
    );
  }

  if (role === "member") {
    add(
      "Passwords: sign in with Gmail + password. To change while logged in use Profile → Password (current + new, new must be at least 8 characters and different). Forgot on the sign-in screen: enter Gmail; if you fill Current password and it matches, you are told to sign in and change it yourself—no admin spam. If you left Current password empty, enter your registered WhatsApp (full or last 10 digits, or last 4) so we can verify you before admin sees a reset request. Use Password coach in that modal for OpenAI tips when configured.",
      ["password", "forgot", "login", "sign", "gmail", "email", "reset", "change"]
    );
    add(
      () =>
        `Payouts: open Payouts in the sidebar. You will see each entry as Paid or Pending. Pending means admin recorded it but has not marked paid yet.${ctx.payoutPending != null ? ` Right now you have about ${ctx.payoutPending} pending total (if shown in your dashboard).` : ""}`,
      ["payout", "payment", "salary", "money", "paid", "pending", "rupee", "earn"]
    );
    add(
      () =>
        `New Requests lists projects assigned to you that need accept or reject. Accepting moves the project to in progress; rejecting sends it back to admin for reassignment.${ctx.pendingRequests != null ? ` You currently have ${ctx.pendingRequests} open request(s).` : ""}`,
      ["request", "assign", "accept", "reject", "new project", "assignment", "offer"]
    );
    add(
      "My Projects shows everything assigned to you across stages (assigned, in progress, completed). My Tasks is your personal checklist per project — stored in your browser for quick tracking.",
      ["project", "task", "progress", "status", "complete", "work"]
    );
    add(
      "Chats: Team Lounge is for everyone. Admin Direct is only you and admin. Project rooms appear for each assigned project so collaborators can coordinate. Use Refresh if messages look stale.",
      ["chat", "message", "dm", "team", "admin", "room", "lounge"]
    );
    add(
      "Notifications: the bell shows circulars from admin and unread counts. Mark all read clears local and server unread states where applicable.",
      ["notif", "notice", "circular", "bell", "announce"]
    );
    add(
      "Profile: My Profile → Edit updates name, city, skill, availability, portfolio link, experience, and your why YoungMinds text. For profile photo you can upload an image file (resized in the browser) or paste an image URL. Changes save to the server.",
      ["profile", "edit", "photo", "picture", "portfolio", "skill", "city"]
    );
    add(
      "Statistics shows charts for your assignment mix and task completion. My Team lists other active members and who you collaborate with on shared projects.",
      ["stat", "chart", "team", "collab", "member"]
    );
    add(
      "If data looks empty or stale, check the green/red API dot in the top bar — red means the browser could not reach the server. The app also refreshes data on a timer after login.",
      ["sync", "refresh", "api", "error", "load", "not showing", "empty", "broken"]
    );
  }

  if (role === "admin") {
    add(
      "Applications: statuses are new → reviewing → hired or rejected (strict flow). Hired and in-work members appear in workforce views. Accepted is legacy-compatible and still allowed to sign in to the member portal.",
      ["application", "hire", "review", "member", "status", "new", "reject", "accepted"]
    );
    add(
      "Projects: new → reviewing → accepted → assigning → assigned → in progress → completed (or rejected / reassigned from assigning). Use assignment tools to attach members or groups; members accept from New Requests in their portal.",
      ["project", "assign", "client", "pipeline", "stage", "in progress", "completed", "reassign"]
    );
    add(
      "Payments: Revenue & Payments supports member payouts and project payments. Creating or updating rows syncs summary fields on the project for paid vs pending. You can mark paid, mark pending again, or delete mistaken entries.",
      ["payment", "revenue", "payout", "paid", "pending", "rupee", "invoice"]
    );
    add(
      "Circulars: Notices & Resets → send a circular; every member sees it in their notification center. Direct notices can target a specific member when created with the right type and target id.",
      ["notice", "circular", "notification", "announce", "broadcast"]
    );
    add(
      "Password resets: pending requests list members who used forgot password. You can set a new password there, or open any member in the detail drawer → Member portal password to set one anytime (no request required). Passwords are hashed and cannot be viewed.",
      ["password", "reset", "forgot", "credential", "login"]
    );
    add(
      "Chats: Team Lounge plus one admin direct room per active member (hired, in work, or accepted). Messages are stored in MongoDB. Project-specific group rooms exist on the member side for assigned work.",
      ["chat", "message", "dm", "team", "lounge"]
    );
    add(
      () =>
        `Quick counts from your last dashboard load (may be zero if empty): about ${ctx.appsNew ?? "?"} new applications, ${ctx.projectsNew ?? "?"} new projects, ${ctx.resetPending ?? "?"} pending password resets.`,
      ["how many", "overview", "count", "summary", "dashboard", "kpi", "stats"]
    );
    add(
      "If lists look wrong after an action, use your refresh rhythm (the panel reloads on navigation) or reload the page. API health is shown near the top bar when implemented in your build.",
      ["bug", "error", "not working", "stale", "refresh"]
    );
  }

  /* ── Server / DB generic (all roles) ── */
  add(
    "The backend exposes /api/health with ok and MongoDB connection state. If db is disconnected, check MONGO_URI in the server .env and that MongoDB is reachable. Forms and portals need the API base URL (default http://localhost:5501) to match your running server.",
    ["mongo", "database", "server", "api", "health", "env", "5501", "connection", "backend"]
  );

  if (blocks.length === 0) {
    const hints =
      role === "landing"
        ? "Try: “How do I join?”, “What services and prices?”, “Hire flow and advance”, or “What happens after submit?”"
        : role === "member"
          ? "Try: “Payouts pending”, “Accept a project”, “Chat rooms”, “Change password”, or “Edit profile”."
          : "Try: “Application statuses”, “Project pipeline”, “Record a payment”, “Send circular”, or “Password reset”.";
    return `I did not match that to a specific YoungMinds topic. ${hints}`;
  }

  const unique = [...new Set(blocks)];
  return unique.slice(0, 4).join("\n\n");
}

function buildSystemPrompt(role, context) {
  return [
    "You are Yemi, the friendly and professional AI assistant for YoungMinds Agency — a student-powered creative agency.",
    "Answer clearly and warmly in plain English. Use short paragraphs. No markdown code blocks. Be concise but helpful.",
    "YoungMinds Agency offers web development, graphic design, AI solutions, content writing, social media management, and video editing.",
    "CRITICAL: The context JSON below contains the LIVE services, prices, and processes scraped directly from the website. ALWAYS use this data for pricing and service questions. Do not invent numbers.",
    "If asked something unrelated to YoungMinds, gently redirect to how you can help with agency services, joining, or hiring.",
    "Never claim you executed admin actions — only explain how to do them in the UI.",
    `Current portal role: ${role}.`,
    `Live page context: ${JSON.stringify(context || {}).slice(0, 2800)}`
  ].join(" ");
}

async function tryOpenAI(role, message, context) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.45,
        max_tokens: 600,
        messages: [
          { role: "system", content: buildSystemPrompt(role, context) },
          { role: "user", content: String(message).slice(0, 3500) }
        ]
      })
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text || typeof text !== "string") return null;
    return text.trim().slice(0, 4000);
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function tryGemini(role, message, context) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const model = "gemini-2.0-flash-lite"; // Most available free model
  const prompt = buildSystemPrompt(role, context) + "\n\nUser: " + String(message).slice(0, 3500);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.45, maxOutputTokens: 600 }
        })
      }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text || typeof text !== "string") return null;
    return text.trim().slice(0, 4000);
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function getAiAssistReply({ role, message, context }) {
  const allowed = new Set(["landing", "member", "admin"]);
  const r = allowed.has(role) ? role : "landing";
  // Try OpenAI first, then Gemini (free), then local keyword fallback
  const openai = await tryOpenAI(r, message, context);
  if (openai) return openai;
  const gemini = await tryGemini(r, message, context);
  if (gemini) return gemini;
  return buildLocalAssistReply(r, message, context);
}

const PASSWORD_COACH_LOCAL = [
  "YoungMinds stores passwords as one-way hashes: nobody can read your old password back.",
  "If you remember your password: sign in → Profile → Password (or Quick Actions). Enter current password, then a new password (at least 8 characters, different from the old one).",
  "Forgot password on the sign-in screen: enter your Gmail. If you type your current password and it is correct, the app will not send an admin request—you are expected to sign in and change it yourself. If you truly forgot it, leave Current password empty and enter the WhatsApp number from your profile so we can verify you; then admin can set a new password.",
  "The Password coach (OpenAI) on the server only runs when OPENAI_API_KEY is configured; otherwise you get this fixed guidance."
].join("\n\n");

async function tryOpenAIPasswordCoach(userMessage) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const system = [
    "You are a short, friendly password coach for the YoungMinds member portal only.",
    "Explain: (1) change password after login with current+new, min 8 chars; (2) forgot flow: Gmail + optional current password—if correct, user must self-serve not admin; if wrong password entered, error; if no password field filled, WhatsApp on file must match for admin reset queue;",
    "Never ask for their actual password. Never claim you reset accounts. Keep under 180 words."
  ].join(" ");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 500,
        messages: [
          { role: "system", content: system },
          { role: "user", content: String(userMessage || "Explain password reset and change.").slice(0, 2000) }
        ]
      })
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text || typeof text !== "string") return null;
    return text.trim().slice(0, 3500);
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function getPasswordCoachReply(message) {
  const trimmed = String(message || "").trim();
  const ai = await tryOpenAIPasswordCoach(trimmed || "How do I change or reset my password?");
  if (ai) return ai;
  if (trimmed.length > 2) {
    return `${PASSWORD_COACH_LOCAL}\n\nAbout your question: I cannot access your account. Follow the steps above, or use the “Get AI tips” text on the forgot-password screen after the server has OPENAI_API_KEY set for richer answers.`;
  }
  return PASSWORD_COACH_LOCAL;
}

module.exports = { getAiAssistReply, buildLocalAssistReply, normalizeMessage, getPasswordCoachReply };

/**
 * YoungMinds Agency — AI Chatbot Frontend Logic
 * Handles: toggle, messaging, history, typing indicator, quick replies
 */

(function () {
  "use strict";

  // ── Config ────────────────────────────────────────────────────────────────
  const API_URL = "http://localhost:5000/api/chat"; // Change this when deploying

  const QUICK_REPLIES = [
    "💰 Pricing",
    "🌐 Website packages",
    "🎨 Design & branding",
    "🤖 AI solutions",
    "📱 Social media",
    "🎬 Video editing",
    "🚀 How to hire",
    "🎓 Join the team",
  ];

  const WELCOME_MSG =
    "Hey there! 👋 I'm Yemi, your YoungMinds assistant.\n\n" +
    "I can help you with pricing, services, how to hire us, or joining our team.\n\n" +
    "What can I help you with today?";

  // ── State ─────────────────────────────────────────────────────────────────
  let isOpen      = false;
  let isTyping    = false;
  let history     = [];   // [{role: "user"|"assistant", content: "..."}]
  let hasWelcomed = false;

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const toggleBtn    = document.getElementById("ym-toggle-btn");
  const chatWindow   = document.getElementById("ym-chatbot");
  const messagesEl   = document.getElementById("ym-messages");
  const inputEl      = document.getElementById("ym-input");
  const sendBtn      = document.getElementById("ym-send-btn");
  const typingEl     = document.getElementById("ym-typing");
  const quickReplies = document.getElementById("ym-quick-replies");
  const closeBtn     = document.getElementById("ym-close-btn");
  const clearBtn     = document.getElementById("ym-clear-btn");
  const dot          = document.querySelector(".ym-dot");

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    buildQuickReplies();
    bindEvents();
  }

  // ── Build quick-reply buttons ─────────────────────────────────────────────
  function buildQuickReplies() {
    quickReplies.innerHTML = "";
    QUICK_REPLIES.forEach((label) => {
      const btn = document.createElement("button");
      btn.className   = "ym-qr-btn";
      btn.textContent = label;
      btn.addEventListener("click", () => {
        // Strip emoji prefix for the actual message sent
        const text = label.replace(/^[\p{Emoji}\s]+/u, "").trim();
        sendMessage(text);
      });
      quickReplies.appendChild(btn);
    });
  }

  // ── Event bindings ────────────────────────────────────────────────────────
  function bindEvents() {
    toggleBtn.addEventListener("click", toggleChat);
    closeBtn.addEventListener("click",  closeChat);
    clearBtn.addEventListener("click",  clearChat);
    sendBtn.addEventListener("click",   handleSend);

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // Auto-resize textarea
    inputEl.addEventListener("input", () => {
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 110) + "px";
    });
  }

  // ── Toggle chat open / closed ─────────────────────────────────────────────
  function toggleChat() {
    isOpen ? closeChat() : openChat();
  }

  function openChat() {
    isOpen = true;
    chatWindow.classList.add("ym-open");

    // Hide notification dot
    if (dot) dot.style.display = "none";

    // Show welcome message once
    if (!hasWelcomed) {
      hasWelcomed = true;
      setTimeout(() => appendBotMessage(WELCOME_MSG), 300);
    }

    setTimeout(() => inputEl.focus(), 350);
  }

  function closeChat() {
    isOpen = false;
    chatWindow.classList.remove("ym-open");
  }

  // ── Clear conversation ────────────────────────────────────────────────────
  function clearChat() {
    history     = [];
    hasWelcomed = false;
    messagesEl.innerHTML = "";
    typingEl.style.display = "none";
    isTyping = false;
    unlockInput();
    setTimeout(() => appendBotMessage(WELCOME_MSG), 200);
  }

  // ── Handle send ───────────────────────────────────────────────────────────
  function handleSend() {
    const text = inputEl.value.trim();
    if (!text || isTyping) return;
    sendMessage(text);
  }

  async function sendMessage(text) {
    if (!text || isTyping) return;

    // Show user bubble
    appendUserMessage(text);
    history.push({ role: "user", content: text });

    // Reset input
    inputEl.value = "";
    inputEl.style.height = "auto";

    // Lock UI + show typing
    lockInput();
    showTyping();

    try {
      const res = await fetch(API_URL, {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({ message: text, history }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data  = await res.json();
      const reply = data.reply || "Sorry, I didn't catch that. Please try again.";

      hideTyping();
      appendBotMessage(reply);
      history.push({ role: "assistant", content: reply });

    } catch (err) {
      console.error("[Chatbot] API error:", err);
      hideTyping();
      appendBotMessage(
        "Oops! I'm having trouble connecting right now. 😓\n\n" +
        "Please try again in a moment, or reach us directly at " +
        "youngmindsagency.vercel.app"
      );
    }

    unlockInput();
    inputEl.focus();
  }

  // ── Render messages ───────────────────────────────────────────────────────
  function appendUserMessage(text) {
    const wrapper = createMsgWrapper("ym-user");
    wrapper.innerHTML = `
      <div class="ym-msg-avatar">👤</div>
      <div>
        <div class="ym-bubble">${escapeHtml(text)}</div>
        <div class="ym-time">${getTime()}</div>
      </div>
    `;
    insertBeforeTyping(wrapper);
    scrollToBottom();
  }

  function appendBotMessage(text) {
    const wrapper = createMsgWrapper("ym-bot");
    wrapper.innerHTML = `
      <div class="ym-msg-avatar">⚡</div>
      <div>
        <div class="ym-bubble">${formatBotText(text)}</div>
        <div class="ym-time">Yemi · ${getTime()}</div>
      </div>
    `;
    insertBeforeTyping(wrapper);
    scrollToBottom();
  }

  function createMsgWrapper(cls) {
    const div = document.createElement("div");
    div.className = `ym-msg ${cls}`;
    return div;
  }

  // Insert message before the typing indicator (keeps typing at bottom)
  function insertBeforeTyping(el) {
    messagesEl.insertBefore(el, typingEl);
  }

  // ── Typing indicator ──────────────────────────────────────────────────────
  function showTyping() {
    isTyping = true;
    typingEl.style.display = "flex";
    scrollToBottom();
  }

  function hideTyping() {
    typingEl.style.display = "none";
    isTyping = false;
  }

  // ── Input lock ────────────────────────────────────────────────────────────
  function lockInput() {
    sendBtn.disabled    = true;
    inputEl.disabled    = true;
  }

  function unlockInput() {
    sendBtn.disabled    = false;
    inputEl.disabled    = false;
  }

  // ── Scroll ────────────────────────────────────────────────────────────────
  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getTime() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Convert plain text bot replies → readable HTML
  // Handles: URLs as clickable links, line breaks
  function formatBotText(text) {
    // Escape HTML first
    let safe = escapeHtml(text);

    // Convert URLs to clickable links
    safe = safe.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener" ' +
      'style="color:var(--ym-yellow);text-decoration:underline;">$1</a>'
    );

    // Line breaks
    safe = safe.replace(/\n/g, "<br>");

    return safe;
  }

  // ── Start ─────────────────────────────────────────────────────────────────
  init();

})();

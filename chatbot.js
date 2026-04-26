/**
 * YoungMinds Agency — AI Chatbot Frontend Logic
 * Handles: toggle, messaging, history, typing indicator, quick replies
 */

(function () {
  "use strict";

  // ── Config ────────────────────────────────────────────────────────────────
  const API_URL = "https://youngminds-3rk5.onrender.com/api/ai/assist";

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

  // ── Icons (Professional SVGs) ─────────────────────────────────────────────
  const ICONS = {
    chat: `<svg viewBox="0 0 24 24"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg>`,
    close: `<svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>`,
    send: `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`,
    clear: `<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
    user: `<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
  };

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    setupInitialUI();
    buildQuickReplies();
    bindEvents();
  }

  function setupInitialUI() {
    toggleBtn.innerHTML = ICONS.chat;
    closeBtn.innerHTML = ICONS.close;
    clearBtn.innerHTML = ICONS.clear;
    sendBtn.innerHTML = ICONS.send;
  }

  // ── Build quick-reply buttons ─────────────────────────────────────────────
  function buildQuickReplies() {
    quickReplies.innerHTML = "";
    QUICK_REPLIES.forEach((label) => {
      const btn = document.createElement("button");
      btn.className   = "ym-qr-btn";
      btn.textContent = label;
      btn.addEventListener("click", () => {
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

    inputEl.addEventListener("input", () => {
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 110) + "px";
      
      // Toggle send button state
      sendBtn.disabled = !inputEl.value.trim() || isTyping;
    });
  }

  // ── Toggle chat open / closed ─────────────────────────────────────────────
  function toggleChat() {
    isOpen ? closeChat() : openChat();
  }

  function openChat() {
    isOpen = true;
    chatWindow.classList.add("ym-open");
    toggleBtn.classList.add("active");
    toggleBtn.innerHTML = ICONS.close;
    document.body.classList.add("ym-chat-open");

    if (dot) dot.style.display = "none";

    if (!hasWelcomed) {
      hasWelcomed = true;
      setTimeout(() => appendBotMessage(WELCOME_MSG), 400);
    }

    setTimeout(() => inputEl.focus(), 450);
  }

  function closeChat() {
    isOpen = false;
    chatWindow.classList.remove("ym-open");
    toggleBtn.classList.remove("active");
    toggleBtn.innerHTML = ICONS.chat;
    document.body.classList.remove("ym-chat-open");
  }

  // ── Clear conversation ────────────────────────────────────────────────────
  function clearChat() {
    if (!confirm("Clear this chat?")) return;
    history     = [];
    hasWelcomed = false;
    messagesEl.innerHTML = "";
    typingEl.style.display = "none";
    isTyping = false;
    unlockInput();
    setTimeout(() => appendBotMessage(WELCOME_MSG), 300);
  }

  // ── Handle send ───────────────────────────────────────────────────────────
  function handleSend() {
    const text = inputEl.value.trim();
    if (!text || isTyping) return;
    sendMessage(text);
  }

  async function sendMessage(text) {
    if (!text || isTyping) return;

    appendUserMessage(text);
    history.push({ role: "user", content: text });

    inputEl.value = "";
    inputEl.style.height = "auto";

    lockInput();
    showTyping();

    const ctx = { page: "hire", history: history.slice(-5) };
    const serviceEls = document.querySelectorAll('.svc-row');
    if (serviceEls.length > 0) {
      ctx.services = Array.from(serviceEls).map(el => {
        const name = el.querySelector('.svc-name')?.innerText || '';
        const price = el.querySelector('.svc-price')?.innerText || '';
        const desc = el.querySelector('.svc-desc')?.innerText || '';
        return `${name} (starts at ${price}): ${desc}`;
      });
    }

    const processEls = document.querySelectorAll('.proc-cell');
    if (processEls.length > 0) {
      ctx.process = Array.from(processEls).map(el => {
        const title = el.querySelector('.proc-title')?.innerText || '';
        const desc = el.querySelector('.proc-desc')?.innerText || '';
        return `${title}: ${desc}`;
      });
    }

    const hero = document.querySelector('h1')?.innerText;
    const subtitle = document.querySelector('.hero-p')?.innerText;
    if (hero || subtitle) {
      ctx.hero = `${hero || ''} - ${subtitle || ''}`;
    }

    try {
      const res = await fetch(API_URL, {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({ role: "landing", message: text, context: ctx }),
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
      <div class="ym-msg-avatar" style="background:var(--ym-accent); padding:6px; fill:var(--ym-black);">${ICONS.user}</div>
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
      <div class="ym-msg-avatar"><img src="/assets/logo.png" alt="Yemi"></div>
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
    inputEl.disabled = false;
    // Only enable send if there's text (though usually empty here)
    sendBtn.disabled = !inputEl.value.trim();
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

  function formatBotText(text) {
    let safe = escapeHtml(text);
    safe = safe.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener" ' +
      'style="color:var(--ym-accent);text-decoration:underline;">$1</a>'
    );
    safe = safe.replace(/\n/g, "<br>");
    return safe;
  }

  init();

})();

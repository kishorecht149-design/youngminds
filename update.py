import re

with open('index.html', 'r') as f:
    html = f.read()

css_to_add = """
/* Animated Icons CSS */
.anim-icon {
  width: 24px;
  height: 24px;
  color: var(--accent);
}
.anim-icon path, .anim-icon circle, .anim-icon ellipse, .anim-icon rect, .anim-icon polygon, .anim-icon polyline, .anim-icon line {
  transform-origin: center;
}

/* Pace: Lightning Bolt */
@keyframes bolt-flash {
  0%   { opacity: 0; transform: scale(0.5); }
  60%  { opacity: 1; transform: scale(1.2); }
  100% { opacity: 1; transform: scale(1); }
}
.icon-pace.play path {
  animation: bolt-flash 0.4s ease forwards;
  opacity: 0;
}

/* Trust: Checkmark */
@keyframes circle-draw {
  from { stroke-dashoffset: 63; }
  to { stroke-dashoffset: 0; }
}
@keyframes check-draw {
  from { stroke-dashoffset: 18; }
  to { stroke-dashoffset: 0; }
}
.icon-trust circle {
  stroke-dasharray: 63;
  stroke-dashoffset: 63;
}
.icon-trust path {
  stroke-dasharray: 18;
  stroke-dashoffset: 18;
}
.icon-trust.play circle {
  animation: circle-draw 0.6s ease forwards;
}
.icon-trust.play path {
  animation: check-draw 0.4s 0.3s ease forwards;
}

/* Craft: Star */
@keyframes star-scale {
  0% { transform: scale(0) rotate(-15deg); opacity: 0; }
  70% { transform: scale(1.2) rotate(5deg); opacity: 1; }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}
.icon-craft.play path {
  animation: star-scale 0.5s ease forwards;
  opacity: 0;
}

/* Value: Coins */
@keyframes coin-bounce {
  0% { transform: translateY(10px); opacity: 0; }
  50% { transform: translateY(-5px); opacity: 1; }
  100% { transform: translateY(0); opacity: 1; }
}
.icon-value.play .value-top-coin {
  animation: coin-bounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  opacity: 0;
}
.icon-value.play path, .icon-value.play ellipse:not(.value-top-coin) {
  animation: coin-bounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  opacity: 0;
}
.icon-value.play path:nth-child(2) { animation-delay: 0.1s; }
.icon-value.play path:nth-child(3) { animation-delay: 0.2s; }

/* Services Icons */
@keyframes term-type {
  from { stroke-dashoffset: 35; }
  to { stroke-dashoffset: 0; }
}
.icon-web polyline, .icon-web path { stroke-dasharray: 35; stroke-dashoffset: 35; }
.icon-web.play polyline, .icon-web.play path { animation: term-type 0.6s ease forwards; }

@keyframes pen-draw {
  0% { transform: translate(-5px, 5px) rotate(-10deg); opacity: 0; }
  100% { transform: translate(0, 0) rotate(0); opacity: 1; }
}
.icon-design.play {
  animation: pen-draw 0.5s ease forwards;
  opacity: 0;
}

@keyframes mega-pulse {
  0% { transform: scale(0.9) rotate(-5deg); opacity: 0; }
  50% { transform: scale(1.1) rotate(5deg); opacity: 1; }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}
.icon-social.play {
  animation: mega-pulse 0.5s ease forwards;
  opacity: 0;
}

@keyframes spark-spin {
  0% { transform: scale(0) rotate(0deg); opacity: 0; }
  100% { transform: scale(1) rotate(360deg); opacity: 1; }
}
.icon-ai.play {
  animation: spark-spin 0.6s ease forwards;
  opacity: 0;
}

@keyframes video-pop {
  0% { transform: scale(0); opacity: 0; }
  80% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
.icon-video.play {
  animation: video-pop 0.5s ease forwards;
  opacity: 0;
}

@keyframes doc-slide {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
.icon-content.play {
  animation: doc-slide 0.5s ease forwards;
  opacity: 0;
}
</style>
"""
html = html.replace("</style>", css_to_add)

# Replace the text inside .fc-icon with SVGs alongside text
pace_svg = '<svg class="anim-icon icon-pace" viewBox="0 0 24 24" width="16" height="16" style="margin-right:4px;"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor"/></svg>Pace'
html = html.replace('<div class="fc-icon">Pace</div>', f'<div class="fc-icon">{pace_svg}</div>')

craft_svg = '<svg class="anim-icon icon-craft" viewBox="0 0 24 24" width="16" height="16" style="margin-right:4px;" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>Craft'
html = html.replace('<div class="fc-icon">Craft</div>', f'<div class="fc-icon">{craft_svg}</div>')

trust_svg = '<svg class="anim-icon icon-trust" viewBox="0 0 24 24" width="16" height="16" style="margin-right:4px;" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg>Trust'
html = html.replace('<div class="fc-icon">Trust</div>', f'<div class="fc-icon">{trust_svg}</div>')

value_svg = '<svg class="anim-icon icon-value" viewBox="0 0 24 24" width="16" height="16" style="margin-right:4px;" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="18" rx="8" ry="3"/><path d="M4 14c0 1.66 3.58 3 8 3s8-1.34 8-3"/><path d="M4 10c0 1.66 3.58 3 8 3s8-1.34 8-3"/><ellipse cx="12" cy="6" rx="8" ry="3" class="value-top-coin"/></svg>Value'
html = html.replace('<div class="fc-icon">Value</div>', f'<div class="fc-icon">{value_svg}</div>')


js_to_add = """
const serviceIcons = {
  'web-development': `<svg class="anim-icon icon-web" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
  'graphic-design': `<svg class="anim-icon icon-design" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg>`,
  'social-media': `<svg class="anim-icon icon-social" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
  'ai-solutions': `<svg class="anim-icon icon-ai" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg>`,
  'video-editing': `<svg class="anim-icon icon-video" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`,
  'content-writing': `<svg class="anim-icon icon-content" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`
};

const iconObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('play');
    }
  });
}, { threshold: 0.1 });

function attachIconEvents() {
  document.querySelectorAll('.anim-icon').forEach(icon => {
    iconObserver.observe(icon);
    const card = icon.closest('.feature-card, .svc-row-link');
    if (card) {
      card.addEventListener('mouseenter', () => {
        icon.classList.remove('play');
        void icon.offsetWidth;
        icon.classList.add('play');
      });
    }
  });
}

function renderServices"""

html = html.replace("function renderServices", js_to_add)

svc_card_top_old = """        <div class="svc-card-top">
          <span class="svc-num">Service ${String(index+1).padStart(2,'0')}</span>
          <span class="svc-price">${formatInr(item.pricing_min_inr)}+</span>
        </div>"""

svc_card_top_new = """        <div class="svc-card-top" style="margin-bottom: 24px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="display:flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:12px; background:rgba(255,215,0,0.06); border:1px solid rgba(255,215,0,0.2); color:var(--accent);">
              ${serviceIcons[item.slug] || ''}
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <span class="svc-num" style="margin-bottom:0;">Service ${String(index+1).padStart(2,'0')}</span>
              <span class="svc-price" style="width:fit-content; padding:4px 8px; font-size:11px;">${formatInr(item.pricing_min_inr)}+</span>
            </div>
          </div>
        </div>"""

html = html.replace(svc_card_top_old, svc_card_top_new)

# Add attachIconEvents call at the end of renderServices and also on DOMContentLoaded
html = html.replace("}).join('');\n}", "}).join('');\n  setTimeout(attachIconEvents, 50);\n}")

# Also attach for the core value icons on load
html = html.replace("document.querySelectorAll('.reveal').forEach(el=>ro.observe(el));", "document.querySelectorAll('.reveal').forEach(el=>ro.observe(el));\nsetTimeout(attachIconEvents, 50);")

with open('index.html', 'w') as f:
    f.write(html)

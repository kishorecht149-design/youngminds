import re

with open('index.html', 'r') as f:
    html = f.read()

# 1. Update CSS
css_add = """
/* PARALLAX HERO */
.hero {
  height: 100vh;
  min-height: 100vh;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background: var(--bg);
}
.px-layer {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  will-change: transform, opacity;
}
.px-layer-5 {
  pointer-events: auto;
  align-items: center;
  padding: 0 80px;
}
.hero-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  z-index: 10;
}
.px-layer-1 {
  filter: blur(2px);
}
.geom-shape {
  position: absolute;
  border: 1px solid rgba(255, 215, 0, 0.05);
  border-radius: 50%;
}
.px-layer-2 {
  filter: blur(1.5px);
  background-image: radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px);
  background-size: 40px 40px;
}
.px-layer-3 {
  filter: blur(1px);
  font-size: 32vw;
  font-weight: 900;
  color: rgba(255, 215, 0, 0.02);
  user-select: none;
  line-height: 1;
  letter-spacing: -0.05em;
}
.px-layer-4 {
  filter: blur(0.5px);
}
.px-layer-6 {
  filter: blur(0px);
}
.px-badge {
  position: absolute;
  background: rgba(255, 215, 0, 0.06);
  border: 1px solid rgba(255, 215, 0, 0.2);
  color: var(--accent);
  padding: 10px 20px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 800;
  box-shadow: 0 12px 30px rgba(0,0,0,0.3);
  backdrop-filter: blur(8px);
}
.badge-1 { top: 15%; right: 10%; transform: rotate(6deg); }
.badge-2 { bottom: 20%; left: 8%; transform: rotate(-8deg); }
.badge-3 { top: 40%; right: 15%; transform: rotate(-4deg); }

.hero-features-container {
  padding: 0 80px 88px;
  background: var(--bg);
  position: relative;
  z-index: 20;
}

@media(max-width:860px){
  .hero-features-container { padding: 0 24px 60px; }
  .px-layer-5 { padding: 0 24px; }
}
@media(max-width:480px){
  .hero-features-container { padding: 0 20px 50px; }
  .px-layer-5 { padding: 0 20px; }
  .px-layer { filter: none !important; }
  .px-layer-1, .px-layer-2, .px-layer-3 { display: none !important; }
  .badge-3 { display: none; }
  .badge-1 { top: 10%; right: 5%; font-size: 10px; padding: 6px 12px; }
  .badge-2 { bottom: 15%; left: 5%; font-size: 10px; padding: 6px 12px; }
}
</style>
"""

html = html.replace("</style>", css_add)

# 2. Extract hero features
features_match = re.search(r'(<div class="hero-features">.*?</div>\s*)</section>', html, re.DOTALL)
features_html = features_match.group(1) if features_match else ""

# Remove features from hero temporarily
html = re.sub(r'<div class="hero-features">.*?</div>\s*</section>', '</section>', html, flags=re.DOTALL)

# 3. Build new parallax hero HTML
old_hero_start = '<section class="hero">'
old_hero_end = '</section>'
hero_content_match = re.search(r'<section class="hero">(.*?)</section>', html, re.DOTALL)
hero_inner = hero_content_match.group(1) if hero_content_match else ""

new_hero = f"""<section class="hero" id="hero-section">
  <!-- Layer 1: Geometric -->
  <div class="px-layer px-layer-1" id="px-layer-1">
    <div class="geom-shape" style="width: 60vw; height: 60vw; top: -10%; left: -10%;"></div>
    <div class="geom-shape" style="width: 40vw; height: 40vw; bottom: -5%; right: -5%;"></div>
  </div>
  
  <!-- Layer 2: Dots Grid -->
  <div class="px-layer px-layer-2" id="px-layer-2"></div>
  
  <!-- Layer 3: 2025 -->
  <div class="px-layer px-layer-3" id="px-layer-3">2025</div>
  
  <!-- Layer 4: Gradient Card -->
  <div class="px-layer px-layer-4" id="px-layer-4">
    <div class="hero-glow"></div>
  </div>
  
  <!-- Layer 5: Main Content -->
  <div class="px-layer px-layer-5" id="px-layer-5">
    <div class="hero-content">
{hero_inner}
    </div>
  </div>
  
  <!-- Layer 6: Badges -->
  <div class="px-layer px-layer-6" id="px-layer-6">
    <div class="px-badge badge-1">Now Hiring</div>
    <div class="px-badge badge-2">48h Response</div>
    <div class="px-badge badge-3">Specialist Led</div>
  </div>
</section>

<!-- Features extracted from hero -->
<div class="hero-features-container">
{features_html}
</div>"""

html = html.replace(f'<section class="hero">{hero_inner}</section>', new_hero)

# Ensure hero-glow is removed from hero_inner if it's there
html = html.replace('<div class="hero-content">\n  <div class="hero-glow"></div>', '<div class="hero-content">\n  ')

# 4. Add Parallax JS script
js_add = """
// PARALLAX CONTROLLER
let pxScrollY = window.scrollY;
let pxTicking = false;

function updateParallax() {
  const section = document.getElementById('hero-section');
  if(!section) return;
  const rect = section.getBoundingClientRect();
  const sectionBottom = rect.bottom;
  
  if (sectionBottom > 0) {
    const progress = Math.min(1, Math.max(0, pxScrollY / (window.innerHeight * 1.2)));
    const baseOpacity = 1 - progress;
    
    const speeds = { 1: 0.05, 2: 0.15, 3: 0.30, 4: 0.50, 5: 0.80, 6: 1.10 };
    
    for (let i = 1; i <= 6; i++) {
      const layer = document.getElementById('px-layer-' + i);
      if (layer) {
        const yPos = pxScrollY * speeds[i];
        layer.style.transform = `translate3d(0, ${yPos}px, 0)`;
        layer.style.opacity = Math.max(0, baseOpacity);
      }
    }
  }
  pxTicking = false;
}

window.addEventListener('scroll', () => {
  pxScrollY = window.scrollY;
  if (!pxTicking) {
    window.requestAnimationFrame(updateParallax);
    pxTicking = true;
  }
});
setTimeout(updateParallax, 50);

</script>
"""

html = html.replace("</script>\n</body>", js_add + "</body>")

with open('index.html', 'w') as f:
    f.write(html)

(function(){
  const API_BASE = "https://youngminds-3rk5.onrender.com";
  const slug = window.SERVICE_SLUG;
  const fallbackMap = {
    "web-development": {
      name: "Web Development",
      shortLabel: "Web",
      valueProp: "Conversion-focused websites and digital products built fast, clean, and ready to scale.",
      pricing_min_inr: 5000,
      pricing_max_inr: 50000,
      deliverables: ["Responsive website design","Landing page build","CMS or admin integration","Speed and SEO basics","Form and lead capture setup","Launch support and QA"]
    },
    "graphic-design": {
      name: "Graphic Design",
      shortLabel: "Design",
      valueProp: "Brand visuals that look sharp, feel consistent, and work across digital and print touchpoints.",
      pricing_min_inr: 2000,
      pricing_max_inr: 25000,
      deliverables: ["Logo and identity concepts","Brand color and type direction","Social and ad creatives","Print-ready collateral","Presentation and deck design","Design source files handoff"]
    },
    "social-media": {
      name: "Social Media",
      shortLabel: "Social",
      valueProp: "Consistent social content systems that turn scattered posting into a clear growth rhythm.",
      pricing_min_inr: 4000,
      pricing_max_inr: 30000,
      deliverables: ["Monthly content calendar","Post and reel concepts","Caption writing","Creative asset coordination","Publishing support","Performance review summary"]
    },
    "ai-solutions": {
      name: "AI Solutions",
      shortLabel: "AI",
      valueProp: "Practical AI systems that automate repetitive work and make your team faster without extra complexity.",
      pricing_min_inr: 8000,
      pricing_max_inr: 100000,
      deliverables: ["Workflow audit and use-case mapping","Custom AI assistant setup","Automation logic and prompts","Tool integrations","Testing and guardrails","Team onboarding guidance"]
    },
    "video-editing": {
      name: "Video Editing",
      shortLabel: "Video",
      valueProp: "Fast-moving edits for reels, explainers, and campaign content that feel current and watchable.",
      pricing_min_inr: 2500,
      pricing_max_inr: 30000,
      deliverables: ["Short-form reel editing","Motion graphics support","Captions and text overlays","Sound polish and pacing","Multiple export formats","Revision-ready project files"]
    },
    "content-writing": {
      name: "Content Writing",
      shortLabel: "Content",
      valueProp: "Clear, persuasive writing for websites, campaigns, and content engines that need a stronger voice.",
      pricing_min_inr: 1500,
      pricing_max_inr: 20000,
      deliverables: ["Website and landing copy","Brand messaging direction","Blog and article writing","Product or service descriptions","Campaign content support","Editing and proofreading"]
    }
  };

  function escapeHtml(value){
    return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
    }[char]));
  }

  function formatInr(amount){
    return "₹" + Number(amount || 0).toLocaleString("en-IN");
  }

  function serviceData(raw){
    return Object.assign({}, fallbackMap[slug] || {}, raw || {});
  }

  function serviceMatchesProject(service, project){
    const clean = value => String(value || "").trim().toLowerCase();
    const target = clean(service.slug);
    const targetName = clean(service.name);
    const current = clean(project.service);
    return current === target || current === targetName;
  }

  function renderRecentWork(service, projects){
    const items = (Array.isArray(projects) ? projects : [])
      .filter(item => String(item.status || "").toLowerCase() === "completed")
      .filter(item => serviceMatchesProject(service, item))
      .slice(0, 2);
    if (!items.length) {
      return '<div class="portfolio-card empty">Recent completed work for this service will appear here once matching projects are marked completed.</div>';
    }
    return items.map(item => `
      <article class="portfolio-card">
        <div class="portfolio-meta">
          <span class="badge">${escapeHtml(item.service || service.name)}</span>
          <span style="font-size:12px;color:var(--muted)">${escapeHtml(item.city || "India")}</span>
        </div>
        <div class="portfolio-title">${escapeHtml(item.business || item.name || "Project")}</div>
        <div class="portfolio-copy">${escapeHtml(item.description || item.notes || "Completed work delivered by the YoungMinds team.")}</div>
      </article>
    `).join("");
  }

  function renderPage(service, projects){
    const deliverables = (Array.isArray(service.deliverables) ? service.deliverables : []).slice(0, 6);
    while (deliverables.length < 6) {
      deliverables.push("YoungMinds service deliverable");
    }
    document.getElementById("service-root").innerHTML = `
      <section class="hero">
        <div class="hero-card">
          <span class="eyebrow">${escapeHtml(service.shortLabel || "Service")} Deep Dive</span>
          <h1 class="hero-title">${escapeHtml(service.name || "Service")}</h1>
          <div class="hero-copy">${escapeHtml(service.valueProp || "")}</div>
          <div class="hero-actions">
            <a class="btn btn-primary" href="/#forms">Ready to start? Hire us</a>
            <a class="btn btn-ghost" href="/#forms">Use calculator</a>
          </div>
        </div>
        <div class="hero-side">
          <div class="stat"><div class="stat-label">Pricing Range</div><div class="stat-value">${escapeHtml(formatInr(service.pricing_min_inr))}</div></div>
          <div class="stat"><div class="stat-label">To</div><div class="stat-value">${escapeHtml(formatInr(service.pricing_max_inr))}</div></div>
          <div class="stat"><div class="stat-label">Delivery Model</div><div class="stat-value">4 Steps</div></div>
        </div>
      </section>

      <section class="section">
        <div class="section-card">
          <div class="section-head">
            <div><h2 class="section-title">What You Get</h2></div>
            <div class="section-copy">A focused scope with tangible deliverables, so you know exactly what the engagement includes.</div>
          </div>
          <div class="deliverables">
            ${deliverables.map((item, index) => `
              <div class="deliverable">
                <div class="deliverable-num">${String(index + 1).padStart(2, "0")}</div>
                <div class="deliverable-title">${escapeHtml(item)}</div>
              </div>
            `).join("")}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-card">
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
            ].map((item, index) => `
              <div class="step">
                <div class="step-num">Step ${String(index + 1).padStart(2, "0")}</div>
                <div class="step-title">${item[0]}</div>
                <div class="step-copy">${item[1]}</div>
              </div>
            `).join("")}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="pricing-grid">
          <div class="section-card">
            <span class="eyebrow">Pricing Range</span>
            <div class="price-range">${escapeHtml(formatInr(service.pricing_min_inr))} - ${escapeHtml(formatInr(service.pricing_max_inr))}</div>
            <div class="pricing-note">Final price depends on scope - use the calculator for an estimate.</div>
            <div style="margin-top:18px"><a class="btn btn-primary" href="/#forms">Open pricing calculator</a></div>
          </div>
          <div class="section-card">
            <span class="eyebrow">Why Teams Choose This</span>
            <div class="pricing-note" style="margin-top:16px">YoungMinds keeps specialist-led execution, fast communication, and clear handoff standards in every service line. You get focused delivery instead of generic agency sprawl.</div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-card">
          <div class="section-head">
            <div><h2 class="section-title">Recent Work</h2></div>
            <div class="section-copy">A quick look at recent project records that match this service area.</div>
          </div>
          <div class="portfolio-grid">${renderRecentWork(service, projects)}</div>
        </div>
      </section>

      <section class="section">
        <div class="cta-card">
          <div>
            <span class="eyebrow">Ready to start?</span>
            <h2 class="section-title" style="margin-top:10px">Let YoungMinds handle your ${escapeHtml((service.name || "service").toLowerCase())}.</h2>
            <div class="section-copy">Tell us the scope, budget, and timeline. We will take it from there.</div>
          </div>
          <a class="btn btn-primary" href="/#forms">Hire us</a>
        </div>
      </section>
    `;
    document.getElementById("service-field").value = service.name || "Service";
  }

  function toggleModal(open){
    document.getElementById("quoteModal").classList.toggle("open", !!open);
  }

  async function submitLead(){
    const name = document.getElementById("lead-name").value.trim();
    const phone = document.getElementById("lead-phone").value.trim();
    const service = document.getElementById("service-field").value.trim();
    const status = document.getElementById("quote-status");
    if (!name || !phone) {
      status.textContent = "Enter your name and WhatsApp number.";
      return;
    }
    status.textContent = "Sending...";
    try {
      const response = await fetch(API_BASE + "/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          phone: phone,
          service: service,
          slug: slug,
          source: "vercel-service-page"
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not submit");
      status.textContent = "Thanks - we will reach out on WhatsApp soon.";
      document.getElementById("lead-name").value = "";
      document.getElementById("lead-phone").value = "";
    } catch (error) {
      status.textContent = error.message || "Could not submit right now.";
    }
  }

  window.toggleQuoteModal = toggleModal;
  window.submitQuickLead = submitLead;

  Promise.all([
    fetch(API_BASE + "/api/services/" + encodeURIComponent(slug)).then(res => res.ok ? res.json() : null).catch(() => null),
    fetch(API_BASE + "/api/projects").then(res => res.ok ? res.json() : []).catch(() => [])
  ]).then(results => {
    renderPage(serviceData(results[0]), results[1]);
  });
})();

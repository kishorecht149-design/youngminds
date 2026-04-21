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
      deliverables: ["Responsive website design","Landing page build","CMS or admin integration","Speed and SEO basics","Form and lead capture setup","Launch support and QA"],
      pricing_packages: [
        { name: "Basic", price_inr: 4999, delivery_time: "4-6 days", revisions: "1 round", note: "Best for small businesses getting online fast.", features: ["4 pages","Template design","Mobile responsive","Contact form","WhatsApp chat button","Google Maps embed"] },
        { name: "Standard", price_inr: 9499, delivery_time: "9-13 days", revisions: "2 rounds", note: "Most popular for growing local businesses.", features: ["8 pages","Semi-custom branding","Booking or enquiry form","Gallery and testimonials","Pricing section","Basic admin panel"] },
        { name: "Premium", price_inr: 17999, delivery_time: "16-22 days", revisions: "Unlimited", note: "For brands that need a custom conversion-focused platform.", features: ["12+ pages","100% custom UI","Online booking system","Service catalogue filters","Offer banners","Full admin panel"] }
      ]
    },
    "graphic-design": {
      name: "Graphic Design",
      shortLabel: "Design",
      valueProp: "Brand visuals that look sharp, feel consistent, and work across digital and print touchpoints.",
      pricing_min_inr: 2000,
      pricing_max_inr: 25000,
      deliverables: ["Logo and identity concepts","Brand color and type direction","Social and ad creatives","Print-ready collateral","Presentation and deck design","Design source files handoff"],
      pricing_packages: [
        { name: "Basic", price_inr: 2000, delivery_time: "2-3 days", revisions: "1 round", note: "Fast-turn visual support for single-brand needs.", features: ["1 core creative set","Template-led design","Brand colour usage","Export-ready files","Social post sizing","Basic support"] },
        { name: "Standard", price_inr: 7999, delivery_time: "4-6 days", revisions: "2 rounds", note: "For brands building a consistent campaign presence.", features: ["Multi-asset pack","Semi-custom design system","Social and ad creatives","Presentation slides","Print-ready files","Source handoff"] },
        { name: "Premium", price_inr: 15999, delivery_time: "7-10 days", revisions: "Unlimited", note: "Full visual direction for launches and brand refreshes.", features: ["Brand identity suite","Custom visual language","Campaign creative system","Print and digital formats","Design source files","Priority support"] }
      ]
    },
    "social-media": {
      name: "Social Media",
      shortLabel: "Social",
      valueProp: "Consistent social content systems that turn scattered posting into a clear growth rhythm.",
      pricing_min_inr: 4000,
      pricing_max_inr: 30000,
      deliverables: ["Monthly content calendar","Post and reel concepts","Caption writing","Creative asset coordination","Publishing support","Performance review summary"],
      pricing_packages: [
        { name: "Basic", price_inr: 4000, delivery_time: "5-7 days setup", revisions: "1 round", note: "Ideal for consistent monthly posting on one platform.", features: ["1 platform plan","8 post ideas","Caption support","Basic design guidance","Publishing checklist","Monthly summary"] },
        { name: "Standard", price_inr: 12000, delivery_time: "7-10 days setup", revisions: "2 rounds", note: "Most popular for businesses growing through content.", features: ["2 platform strategy","Content calendar","Reel concepts","Caption writing","Creative coordination","Performance review"] },
        { name: "Premium", price_inr: 24000, delivery_time: "10-14 days setup", revisions: "Unlimited", note: "For teams that want a full social content engine.", features: ["3+ platform system","Campaign planning","Advanced reporting","Trend and hook research","Publishing workflows","Priority support"] }
      ]
    },
    "ai-solutions": {
      name: "AI Solutions",
      shortLabel: "AI",
      valueProp: "Practical AI systems that automate repetitive work and make your team faster without extra complexity.",
      pricing_min_inr: 8000,
      pricing_max_inr: 100000,
      deliverables: ["Workflow audit and use-case mapping","Custom AI assistant setup","Automation logic and prompts","Tool integrations","Testing and guardrails","Team onboarding guidance"],
      pricing_packages: [
        { name: "Basic", price_inr: 7999, delivery_time: "5-7 days", revisions: "1 round", note: "Entry-level AI chatbot or automation setup.", features: ["1 platform chatbot","FAQ response flows","Up to 20 Q&A pairs","Lead capture","Google Sheets logging","7 days support"] },
        { name: "Standard", price_inr: 14999, delivery_time: "10-14 days", revisions: "2 rounds", note: "Most popular AI package for smart business automation.", features: ["2 platform assistant","Natural language responses","Lead qualification","CRM or Sheets sync","Automated follow-ups","Analytics dashboard"] },
        { name: "Premium", price_inr: 27999, delivery_time: "18-25 days", revisions: "Unlimited", note: "Full AI assistant with custom training and integrations.", features: ["3 platform AI assistant","Custom business training","Unlimited intent flows","CRM/email/Zapier integration","Sentiment routing","60 days support"] }
      ]
    },
    "video-editing": {
      name: "Video Editing",
      shortLabel: "Video",
      valueProp: "Fast-moving edits for reels, explainers, and campaign content that feel current and watchable.",
      pricing_min_inr: 2500,
      pricing_max_inr: 30000,
      deliverables: ["Short-form reel editing","Motion graphics support","Captions and text overlays","Sound polish and pacing","Multiple export formats","Revision-ready project files"],
      pricing_packages: [
        { name: "Basic", price_inr: 4999, delivery_time: "3 working days", revisions: "1 round", note: "Great for creators needing polished short-form content.", features: ["3 short-form videos","Up to 60 seconds each","Basic cuts and transitions","Royalty-free music","Simple text overlays","1080p export"] },
        { name: "Standard", price_inr: 9999, delivery_time: "5 working days", revisions: "2 rounds", note: "Most popular for trend-based brand and creator edits.", features: ["6 short-form videos","Up to 90 seconds each","Subtitles","Sound design","Text animations","Multi-platform formats"] },
        { name: "Premium", price_inr: 18999, delivery_time: "7 working days", revisions: "Unlimited", note: "High-retention cinematic editing for serious campaigns.", features: ["12 short-form videos","Cinematic pacing","Styled subtitles","Advanced colour grading","Motion graphics","Priority support"] }
      ]
    },
    "content-writing": {
      name: "Content Writing",
      shortLabel: "Content",
      valueProp: "Clear, persuasive writing for websites, campaigns, and content engines that need a stronger voice.",
      pricing_min_inr: 1500,
      pricing_max_inr: 20000,
      deliverables: ["Website and landing copy","Brand messaging direction","Blog and article writing","Product or service descriptions","Campaign content support","Editing and proofreading"],
      pricing_packages: [
        { name: "Basic", price_inr: 1500, delivery_time: "2-3 days", revisions: "1 round", note: "For fast copy needs and essential business pages.", features: ["Up to 2 pages","Basic brand tone","Service descriptions","CTA refinement","Editing pass","Delivery-ready copy"] },
        { name: "Standard", price_inr: 6500, delivery_time: "4-6 days", revisions: "2 rounds", note: "Ideal for websites, campaigns, and blog support.", features: ["Website copy set","Brand messaging direction","Blog/article draft","SEO-friendly structure","Product descriptions","Proofreading"] },
        { name: "Premium", price_inr: 14000, delivery_time: "7-10 days", revisions: "Unlimited", note: "A full content system for launches and ongoing growth.", features: ["Multi-page copy system","Campaign messaging","Long-form content","Voice and tone guide","Content engine planning","Priority support"] }
      ]
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
    const packages = Array.isArray(service.pricing_packages) ? service.pricing_packages : [];
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
            <div><h2 class="section-title">Packages & Pricing</h2></div>
            <div class="section-copy">Choose a package as a starting point. Final pricing can still shift based on exact scope, integrations, and content volume.</div>
          </div>
          <div class="package-grid">
            ${packages.map((item, index) => `
              <article class="package-card ${index === 1 ? "featured" : ""}">
                <div class="package-head">
                  <div>
                    <span class="eyebrow">${escapeHtml(item.name || `Package ${index + 1}`)}</span>
                    <div class="package-price">${escapeHtml(formatInr(item.price_inr || 0))}</div>
                  </div>
                </div>
                <div class="package-meta">
                  ${item.delivery_time ? `<span class="package-chip">${escapeHtml(item.delivery_time)}</span>` : ``}
                  ${item.revisions ? `<span class="package-chip">${escapeHtml(item.revisions)}</span>` : ``}
                </div>
                ${item.note ? `<div class="package-note">${escapeHtml(item.note)}</div>` : ``}
                <div class="package-features">
                  ${(Array.isArray(item.features) ? item.features : []).map(feature => `<div class="package-feature">${escapeHtml(feature)}</div>`).join("")}
                </div>
              </article>
            `).join("")}
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

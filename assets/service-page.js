(function(){
  const API_BASE = "https://youngminds-3rk5.onrender.com";
  const slug = window.SERVICE_SLUG;

  function inrToUsd(amount){
    return Math.max(0, Math.round(Number(amount || 0) / 83));
  }

  function makePackage(name, priceInr, options = {}){
    return {
      name: name,
      price_inr: Number(priceInr || 0),
      price_usd: Number(options.price_usd || inrToUsd(priceInr)),
      delivery: options.delivery || "",
      revisions: options.revisions || "",
      duration: options.duration || "",
      isPopular: !!options.isPopular,
      features: Array.isArray(options.features) ? options.features : []
    };
  }

  function makeSector(title, description, packages){
    return { title, description, packages };
  }

  const fallbackMap = {
    "web-development": {
      name: "Web Development",
      shortLabel: "Web",
      valueProp: "Conversion-focused websites and digital products built fast, clean, and ready to scale.",
      pricing_min_inr: 3999,
      pricing_max_inr: 74999,
      deliverables: ["Responsive website design","Landing page build","CMS or admin integration","Speed and SEO basics","Form and lead capture setup","Launch support and QA"],
      sectors: [
        makeSector("Business Websites", "Professional business sites for agencies, consultants, and local brands.", [
          makePackage("Basic", 6999, { delivery: "5-7 days", revisions: "1 round", duration: "5 pages", features: ["Business profile pages", "Services overview", "Lead form and CTA", "Mobile responsive build", "Basic analytics", "Google business integration"] }),
          makePackage("Standard", 12999, { delivery: "9-13 days", revisions: "2 rounds", duration: "8 pages", isPopular: true, features: ["Case study or testimonial sections", "Custom contact funnels", "Blog-ready CMS", "Basic admin panel", "Conversion-focused page structure", "Stronger brand customisation"] }),
          makePackage("Premium", 24999, { delivery: "14-20 days", revisions: "Unlimited", duration: "12+ pages", features: ["Custom UI direction", "Advanced landing sections", "CRM-ready forms", "Offer and campaign blocks", "Expanded admin control", "Priority support"] })
        ]),
        makeSector("E-Commerce Websites", "Online stores built for product display, enquiry, and checkout-ready growth.", [
          makePackage("Basic", 14999, { delivery: "8-12 days", revisions: "1 round", duration: "Up to 25 products", features: ["Storefront setup", "Product pages", "Cart and checkout", "Payment gateway integration", "Mobile commerce layout", "Order email flow"] }),
          makePackage("Standard", 27999, { delivery: "14-20 days", revisions: "2 rounds", duration: "Up to 80 products", isPopular: true, features: ["Collection filtering", "Coupon setup", "Basic inventory workflow", "Admin dashboard", "Shipping rule setup", "Everything in Basic"] }),
          makePackage("Premium", 49999, { delivery: "20-28 days", revisions: "Unlimited", duration: "100+ products", features: ["Custom storefront UI", "Upsell and cross-sell blocks", "Advanced catalog filters", "Marketing automation hooks", "Priority launch support", "Everything in Standard"] })
        ])
      ]
    },
    "graphic-design": {
      name: "Graphic Design",
      shortLabel: "Design",
      valueProp: "Brand visuals that look sharp, feel consistent, and work across digital and print touchpoints.",
      pricing_min_inr: 2000,
      pricing_max_inr: 15999,
      deliverables: ["Logo and identity concepts","Brand color and type direction","Social and ad creatives","Print-ready collateral","Presentation and deck design","Design source files handoff"],
      sectors: [
        makeSector("Graphic Design Packages", "Design support across brand, campaign, and launch needs with clean, editable asset delivery.", [
          makePackage("Basic", 2000, { delivery: "2-3 days", revisions: "1 round", duration: "1 creative set", features: ["One branded creative set", "Template-led design", "Export-ready files", "Social post sizing", "Brand colour alignment", "Basic support"] }),
          makePackage("Standard", 7999, { delivery: "4-6 days", revisions: "2 rounds", duration: "Multi-asset pack", isPopular: true, features: ["Multiple campaign assets", "Semi-custom design system", "Presentation or flyer support", "Print-ready exports", "Source file handoff", "Stronger brand consistency"] }),
          makePackage("Premium", 15999, { delivery: "7-10 days", revisions: "Unlimited", duration: "Full campaign suite", features: ["Brand identity suite", "Custom visual language", "Launch campaign graphics", "Print and digital formats", "Design source files", "Priority support"] })
        ])
      ]
    },
    "social-media": {
      name: "Social Media",
      shortLabel: "Social",
      valueProp: "Consistent social content systems that turn scattered posting into a clear growth rhythm.",
      pricing_min_inr: 4000,
      pricing_max_inr: 24000,
      deliverables: ["Monthly content calendar","Post and reel concepts","Caption writing","Creative asset coordination","Publishing support","Performance review summary"],
      sectors: [
        makeSector("Social Media Management", "A consistent content engine for brands that need planning, execution, and reporting in one lane.", [
          makePackage("Basic", 4000, { delivery: "5-7 days setup", revisions: "1 round", duration: "1 platform / month", features: ["One-platform content plan", "8 post ideas", "Caption support", "Basic design direction", "Publishing checklist", "Monthly summary"] }),
          makePackage("Standard", 12000, { delivery: "7-10 days setup", revisions: "2 rounds", duration: "2 platforms / month", isPopular: true, features: ["Two-platform strategy", "Content calendar", "Reel concepts", "Caption writing", "Creative coordination", "Performance review"] }),
          makePackage("Premium", 24000, { delivery: "10-14 days setup", revisions: "Unlimited", duration: "3+ platforms / month", features: ["Multi-platform system", "Campaign planning", "Advanced reporting", "Trend and hook research", "Publishing workflows", "Priority support"] })
        ])
      ]
    },
    "ai-solutions": {
      name: "AI Solutions",
      shortLabel: "AI",
      valueProp: "Practical AI systems that automate repetitive work and make your team faster without extra complexity.",
      pricing_min_inr: 7999,
      pricing_max_inr: 79999,
      deliverables: ["Workflow audit and use-case mapping","Custom AI assistant setup","Automation logic and prompts","Tool integrations","Testing and guardrails","Team onboarding guidance"],
      sectors: [
        makeSector("AI Chatbots", "FAQ, lead capture, and customer-support chatbots tailored to your workflow.", [
          makePackage("Basic", 7999, { delivery: "5-7 days", revisions: "1 round", duration: "Single assistant", features: ["Website or WhatsApp bot", "Up to 20 Q&A flows", "Lead capture setup", "Basic branding", "Google Sheets logging", "7 days support"] }),
          makePackage("Standard", 14999, { delivery: "10-14 days", revisions: "2 rounds", duration: "Multi-flow assistant", isPopular: true, features: ["Natural language responses", "Lead qualification logic", "CRM or Sheets sync", "Follow-up automations", "Analytics dashboard", "Multi-step conversations"] }),
          makePackage("Premium", 27999, { delivery: "18-25 days", revisions: "Unlimited", duration: "Advanced custom assistant", features: ["Custom trained assistant", "Unlimited intent flows", "CRM/email/Zapier integration", "Escalation routing", "Advanced analytics", "60 days support"] })
        ]),
        makeSector("Custom AI Solutions", "Custom AI work for unique internal tools, client products, or advanced team workflows.", [
          makePackage("Basic", 19999, { delivery: "10-14 days", revisions: "1 round", duration: "Starter custom scope", features: ["Discovery and scoping", "One custom AI workflow", "Prototype build", "Basic integration", "Testing and guardrails", "Documentation"] }),
          makePackage("Standard", 39999, { delivery: "18-25 days", revisions: "2 rounds", duration: "Mid custom scope", isPopular: true, features: ["Custom use-case mapping", "Multiple AI flows", "API integration", "Dashboard layer", "Role permissions", "Launch support"] }),
          makePackage("Premium", 79999, { delivery: "28-40 days", revisions: "Unlimited", duration: "Advanced custom scope", features: ["End-to-end custom AI system", "Advanced integrations", "Scalable architecture", "Team onboarding", "Priority support", "Optimisation handoff"] })
        ])
      ]
    },
    "video-editing": {
      name: "Video Editing",
      shortLabel: "Video",
      valueProp: "Fast-moving edits for reels, explainers, and campaign content that feel current and watchable.",
      pricing_min_inr: 4999,
      pricing_max_inr: 44999,
      deliverables: ["Short-form reel editing","Motion graphics support","Captions and text overlays","Sound polish and pacing","Multiple export formats","Revision-ready project files"],
      sectors: [
        makeSector("Short-Form Content", "Reels, shorts, and TikTok-style edits focused on speed, hooks, and retention.", [
          makePackage("Basic", 4999, { price_usd: 60, delivery: "3 working days", revisions: "1 round", duration: "3 videos / up to 60 sec", features: ["3 short-form videos", "Basic cuts and transitions", "Royalty-free music", "Simple text overlays", "1080p export", "Platform-ready formatting"] }),
          makePackage("Standard", 9999, { price_usd: 120, delivery: "5 working days", revisions: "2 rounds", duration: "6 videos / up to 90 sec", isPopular: true, features: ["6 short-form videos", "Subtitles", "Sound design", "Text animations", "Multi-platform exports", "Higher retention pacing"] }),
          makePackage("Premium", 18999, { price_usd: 229, delivery: "7 working days", revisions: "Unlimited", duration: "12 videos / advanced styling", features: ["12 short-form videos", "Cinematic pacing", "Styled subtitles", "Advanced colour grading", "Motion graphics", "Priority support"] })
        ]),
        makeSector("Promotional & Advertisement Videos", "Campaign videos for launches, offers, and conversion-driven promotions.", [
          makePackage("Basic", 8999, { price_usd: 108, delivery: "4-6 working days", revisions: "1 round", duration: "30-60 sec ad", features: ["Single promo video", "Text overlays", "Basic pacing", "Music syncing", "Offer CTA framing", "1080p export"] }),
          makePackage("Standard", 16999, { price_usd: 205, delivery: "6-8 working days", revisions: "2 rounds", duration: "60-90 sec campaign edit", isPopular: true, features: ["Brand graphics", "Faster cuts", "Sound design", "Multiple aspect ratios", "Ad-ready deliverables", "Everything in Basic"] }),
          makePackage("Premium", 29999, { price_usd: 361, delivery: "8-12 working days", revisions: "Unlimited", duration: "High-end promo package", features: ["Advanced motion graphics", "Colour grading", "Voiceover alignment", "Launch assets export", "Priority revisions", "Everything in Standard"] })
        ])
      ]
    },
    "content-writing": {
      name: "Content Writing",
      shortLabel: "Content",
      valueProp: "Clear, persuasive writing for websites, campaigns, and content engines that need a stronger voice.",
      pricing_min_inr: 1500,
      pricing_max_inr: 14000,
      deliverables: ["Website and landing copy","Brand messaging direction","Blog and article writing","Product or service descriptions","Campaign content support","Editing and proofreading"],
      sectors: [
        makeSector("Content Writing Packages", "Clear website, campaign, and content-system writing with SEO-ready structure and revision room.", [
          makePackage("Basic", 1500, { delivery: "2-3 days", revisions: "1 round", duration: "2 pages / short copy set", features: ["Up to 2 pages of copy", "Basic brand tone", "Service descriptions", "CTA refinement", "Editing pass", "Delivery-ready copy"] }),
          makePackage("Standard", 6500, { delivery: "4-6 days", revisions: "2 rounds", duration: "Website + article support", isPopular: true, features: ["Website copy set", "Brand messaging direction", "Blog or article draft", "SEO-friendly structure", "Product descriptions", "Proofreading"] }),
          makePackage("Premium", 14000, { delivery: "7-10 days", revisions: "Unlimited", duration: "Multi-page content system", features: ["Multi-page copy system", "Campaign messaging", "Long-form content", "Voice and tone guide", "Content engine planning", "Priority support"] })
        ])
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

  function formatUsd(amount){
    return "$" + Number(amount || 0).toLocaleString("en-US");
  }

  function normalizeSectorPackages(items){
    return (Array.isArray(items) ? items : []).map(item => ({
      name: item.name || "Package",
      price_inr: Number(item.price_inr || 0),
      price_usd: Number(item.price_usd || inrToUsd(item.price_inr || 0)),
      delivery: item.delivery || item.delivery_time || "",
      revisions: item.revisions || "",
      duration: item.duration || item.note || "",
      isPopular: !!item.isPopular,
      features: Array.isArray(item.features) ? item.features.filter(Boolean) : []
    }));
  }

  function normalizeService(raw){
    const base = fallbackMap[slug] || {};
    const merged = Object.assign({}, base, raw || {});
    const sectors = Array.isArray(merged.sectors) && merged.sectors.length
      ? merged.sectors
      : (Array.isArray(merged.pricing_packages) && merged.pricing_packages.length
          ? [{ title: (merged.name || "Service") + " Packages", description: merged.valueProp || "", packages: merged.pricing_packages }]
          : (base.sectors || []));
    merged.sectors = sectors.map(sector => ({
      title: sector.title || "Sector",
      description: sector.description || "",
      packages: normalizeSectorPackages(sector.packages)
    }));
    return merged;
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

  function renderCatalogue(service){
    return (Array.isArray(service.sectors) ? service.sectors : []).map((sector, sectorIndex) => `
      <div class="catalogue-sector">
        <div class="catalogue-sector-head">
          <div>
            <span class="eyebrow">Sector ${String(sectorIndex + 1).padStart(2, "0")}</span>
            <h3 class="catalogue-sector-title">${escapeHtml(sector.title || `Sector ${sectorIndex + 1}`)}</h3>
          </div>
          <div class="catalogue-sector-copy">${escapeHtml(sector.description || "")}</div>
        </div>
        <div class="package-grid">
          ${(Array.isArray(sector.packages) ? sector.packages : []).map((item, packageIndex) => `
            <article class="package-card ${(item.isPopular || packageIndex === 1) ? "featured" : ""}">
              <div class="package-head">
                <div>
                  <span class="eyebrow">${escapeHtml(item.name || `Package ${packageIndex + 1}`)}</span>
                  <div class="package-currency">
                    <div class="package-price">${escapeHtml(formatInr(item.price_inr || 0))}</div>
                    <div class="package-usd">${escapeHtml(formatUsd(item.price_usd || 0))}</div>
                  </div>
                </div>
                ${(item.isPopular || packageIndex === 1) ? `<span class="package-chip package-highlight">Most Popular</span>` : ``}
              </div>
              <div class="package-meta">
                ${item.delivery ? `<span class="package-chip">${escapeHtml(item.delivery)}</span>` : ``}
                ${item.duration ? `<span class="package-chip">${escapeHtml(item.duration)}</span>` : ``}
                ${item.revisions ? `<span class="package-chip">${escapeHtml(item.revisions)}</span>` : ``}
              </div>
              <div class="package-features">
                ${(Array.isArray(item.features) ? item.features : []).map(feature => `<div class="package-feature">${escapeHtml(feature)}</div>`).join("")}
              </div>
            </article>
          `).join("")}
        </div>
      </div>
    `).join("");
  }

  function renderPage(service, projects){
    const deliverables = (Array.isArray(service.deliverables) ? service.deliverables : []).slice(0, 6);
    while (deliverables.length < 6) deliverables.push("YoungMinds service deliverable");

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
          <div class="stat"><div class="stat-label">Pricing Range</div><div class="stat-value">${escapeHtml(formatInr(service.pricing_min_inr || 0))}</div></div>
          <div class="stat"><div class="stat-label">To</div><div class="stat-value">${escapeHtml(formatInr(service.pricing_max_inr || 0))}</div></div>
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
            <div class="price-range">${escapeHtml(formatInr(service.pricing_min_inr || 0))} - ${escapeHtml(formatInr(service.pricing_max_inr || 0))}</div>
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
            <div class="section-copy">Each sector below is rendered from the live catalogue data for this service.</div>
          </div>
          ${renderCatalogue(service)}
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
    renderPage(normalizeService(results[0]), results[1]);
  });
})();

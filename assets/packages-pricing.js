(function(){
  const API_BASE = "https://youngminds-3rk5.onrender.com";
  const params = new URLSearchParams(window.location.search);
  const activeSlug = params.get("service") || "";

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

  function inrToUsd(amount){
    return Math.max(0, Math.round(Number(amount || 0) / 83));
  }

  function normalizePackage(pkg){
    return {
      name: pkg && pkg.name ? pkg.name : "Package",
      price_inr: Number(pkg && pkg.price_inr || 0),
      price_usd: Number(pkg && (pkg.price_usd || inrToUsd(pkg.price_inr || 0))),
      delivery: pkg && (pkg.delivery || pkg.delivery_time) || "",
      revisions: pkg && pkg.revisions || "",
      duration: pkg && pkg.duration || "",
      isPopular: !!(pkg && pkg.isPopular),
      features: Array.isArray(pkg && pkg.features) ? pkg.features.filter(Boolean) : []
    };
  }

  function normalizeService(service){
    return {
      name: service && service.name ? service.name : "Service",
      slug: service && service.slug ? service.slug : "",
      shortLabel: service && service.shortLabel ? service.shortLabel : "Service",
      valueProp: service && service.valueProp ? service.valueProp : "",
      sectors: (Array.isArray(service && service.sectors) ? service.sectors : []).map(sector => ({
        title: sector && sector.title ? sector.title : "Sector",
        description: sector && sector.description ? sector.description : "",
        packages: (Array.isArray(sector && sector.packages) ? sector.packages : []).map(normalizePackage)
      }))
    };
  }

  function renderState(html){
    const root = document.getElementById("packages-root");
    if (root) root.innerHTML = html;
  }

  function renderServices(services){
    const list = (Array.isArray(services) ? services : []).map(normalizeService);
    const visible = activeSlug ? list.filter(item => item.slug === activeSlug) : list;
    const filters = ['<a class="filter-chip ' + (!activeSlug ? 'active' : '') + '" href="/packages-pricing/">All Services</a>']
      .concat(list.map(item => '<a class="filter-chip ' + (item.slug === activeSlug ? 'active' : '') + '" href="/packages-pricing/?service=' + encodeURIComponent(item.slug) + '">' + escapeHtml(item.name) + '</a>'))
      .join("");

    renderState(`
      <section class="pp-hero">
        <span class="pp-eyebrow">Packages & Pricing</span>
        <h1 class="pp-title">Compare packages clearly before we scope the final work.</h1>
        <p class="pp-copy">Services explain what we do. Packages & Pricing keeps the commercial side separate, easier to compare, and easier for your team to manage from admin.</p>
        <div class="pp-filters">${filters}</div>
      </section>
      ${(visible.length ? visible : list).map(service => `
        <section class="pp-service">
          <div class="pp-service-head">
            <div>
              <span class="pp-eyebrow">${escapeHtml(service.shortLabel || "Service")}</span>
              <h2 class="pp-service-title">${escapeHtml(service.name)}</h2>
            </div>
            <p class="pp-service-copy">${escapeHtml(service.valueProp || "")}</p>
          </div>
          ${(Array.isArray(service.sectors) ? service.sectors : []).map(sector => `
            <div class="pp-sector">
              <div class="pp-sector-head">
                <div class="pp-sector-title">${escapeHtml(sector.title || "Sector")}</div>
                <div class="pp-sector-copy">${escapeHtml(sector.description || "")}</div>
              </div>
              <div class="pp-grid">
                ${(Array.isArray(sector.packages) ? sector.packages : []).map((pkg, index) => `
                  <article class="pp-card ${(pkg.isPopular || index === 1) ? "featured" : ""}">
                    <div class="pp-card-head">
                      <div>
                        <div class="pp-card-name">${escapeHtml(pkg.name || `Package ${index + 1}`)}</div>
                        <div class="pp-card-price">${escapeHtml(formatInr(pkg.price_inr))}</div>
                        <div class="pp-card-usd">${escapeHtml(formatUsd(pkg.price_usd))}</div>
                      </div>
                      ${(pkg.isPopular || index === 1) ? '<span class="pp-chip popular">Most Popular</span>' : ''}
                    </div>
                    <div class="pp-meta">
                      ${pkg.delivery ? `<span class="pp-chip">${escapeHtml(pkg.delivery)}</span>` : ''}
                      ${pkg.duration ? `<span class="pp-chip">${escapeHtml(pkg.duration)}</span>` : ''}
                      ${pkg.revisions ? `<span class="pp-chip">${escapeHtml(pkg.revisions)}</span>` : ''}
                    </div>
                    <div class="pp-features">
                      ${(Array.isArray(pkg.features) ? pkg.features : []).map(feature => `<div class="pp-feature">${escapeHtml(feature)}</div>`).join("")}
                    </div>
                  </article>
                `).join("")}
              </div>
            </div>
          `).join("")}
        </section>
      `).join("")}
    `);
  }

  async function loadPackages(){
    renderState('<div class="pp-empty"><div class="pp-empty-title">Loading packages</div><div class="pp-empty-copy">Pulling the latest pricing catalogue from YoungMinds.</div></div>');
    try {
      const response = await fetch(API_BASE + "/api/services", { cache: "no-store" });
      const data = await response.json().catch(() => []);
      if (!response.ok || !Array.isArray(data) || !data.length) {
        throw new Error("Could not load packages right now.");
      }
      renderServices(data);
    } catch (error) {
      renderState('<div class="pp-empty"><div class="pp-empty-title">Packages unavailable</div><div class="pp-empty-copy">' + escapeHtml(error && error.message ? error.message : "Could not load packages right now.") + '</div><button class="pp-retry" type="button" onclick="window.location.reload()">Retry</button></div>');
    }
  }

  loadPackages();
})();

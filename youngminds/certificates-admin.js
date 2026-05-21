(function () {
  if (window.__ymCertificatesAdminApplied) return;
  window.__ymCertificatesAdminApplied = true;

  const SESSION_KEY = "ym_admin_session";

  // Helpers
  function getAdminToken() {
    return sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || "";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Active state
  const state = {
    activeTab: "list", // 'list' or 'templates'
    certificates: [],
    totalCertificates: 0,
    templates: [],
    events: [],
    stats: { totalCertificates: 0, totalTemplates: 0, totalEvents: 0 },
    loading: false,
    filters: { search: "", eventId: "", page: 1, limit: 15 }
  };

  // ── CSS STYLES FOR CERTIFICATE INTERFACE ──
  const styles = `
    .cert-dash { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 24px; }
    .cert-stat { background: var(--bg2); border: 1px solid var(--border); padding: 18px; border-radius: 8px; display: flex; flex-direction: column; gap: 4px; }
    .cert-stat-num { font-size: 24px; font-weight: 800; color: var(--accent); }
    .cert-stat-lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted3); }
    
    .cert-tabs { display: flex; gap: 10px; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
    .cert-tab { padding: 10px 16px; background: transparent; border: none; color: var(--muted3); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; border-bottom: 2px solid transparent; }
    .cert-tab.active { color: var(--text); border-bottom-color: var(--accent); }
    
    .cert-controls { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; align-items: center; justify-content: space-between; }
    .cert-filters { display: flex; gap: 10px; flex: 1; min-width: 250px; }
    .cert-search { flex: 1; background: var(--bg3); border: 1px solid var(--border2); color: var(--text); padding: 8px 12px; border-radius: var(--r); font-size: 13px; outline: none; }
    .cert-select { background: var(--bg3); border: 1px solid var(--border2); color: var(--text); padding: 8px 12px; border-radius: var(--r); font-size: 13px; outline: none; }
    
    .cert-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .temp-card { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px; position: relative; }
    .temp-card.default { border-color: var(--accent); }
    .temp-preview { height: 140px; background: var(--bg4); border-radius: 6px; border: 1px dashed var(--border2); display: grid; place-items: center; overflow: hidden; position: relative; }
    .temp-preview img { width: 100%; height: 100%; object-fit: contain; }
    .temp-badge { position: absolute; top: 8px; right: 8px; font-size: 10px; font-weight: 700; background: var(--accent); color: #000; padding: 2px 8px; border-radius: 100px; }
    .temp-actions { display: flex; gap: 8px; margin-top: auto; }

    /* Modal dialog overrides */
    .cert-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; animation: fadeIn 0.2s ease; }
    .cert-modal-content { background: var(--bg2); border: 1px solid var(--border2); border-radius: 12px; width: 100%; max-width: 600px; display: flex; flex-direction: column; overflow: hidden; max-height: 90vh; }
    .cert-modal-hdr { padding: 18px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
    .cert-modal-title { font-size: 16px; font-weight: 700; }
    .cert-modal-body { padding: 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
    .cert-modal-ftr { padding: 16px 24px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 10px; }
    
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group label { font-size: 11px; font-weight: 700; color: var(--muted3); text-transform: uppercase; }
    .form-group input, .form-group select, .form-group textarea { background: var(--bg3); border: 1px solid var(--border2); color: var(--text); padding: 10px 14px; border-radius: var(--r); font-size: 13.5px; outline: none; }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: var(--accent); }
    
    .csv-zone { border: 2px dashed var(--border3); border-radius: 8px; padding: 30px; text-align: center; cursor: pointer; transition: all 0.2s; }
    .csv-zone:hover { border-color: var(--accent); background: rgba(255,255,255,0.02); }
    
    .preview-table-container { max-height: 200px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px; }
    .preview-table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; }
    .preview-table th { background: var(--bg3); padding: 8px; font-weight: 600; border-bottom: 1px solid var(--border); }
    .preview-table td { padding: 8px; border-bottom: 1px solid var(--border); }

    .coord-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  `;

  // Inject styles dynamically
  const styleEl = document.createElement("style");
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  // ── NETWORK CALLS ──
  async function apiRequest(path, options = {}) {
    const token = getAdminToken();
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    };
    const res = await fetch(window.location.origin + path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "API Request Failed");
    return data;
  }

  async function loadData() {
    state.loading = true;
    render();
    try {
      // Parallel fetch
      const [stats, certData, templates, events] = await Promise.all([
        apiRequest("/api/admin/certificates/stats"),
        apiRequest(`/api/admin/certificates?search=${encodeURIComponent(state.filters.search)}&eventId=${state.filters.eventId}&page=${state.filters.page}&limit=${state.filters.limit}`),
        apiRequest("/api/admin/templates"),
        apiRequest("/api/admin/events-list")
      ]);

      state.stats = stats;
      state.certificates = certData.certificates;
      state.totalCertificates = certData.total;
      state.templates = templates;
      state.events = events;
    } catch (err) {
      console.error(err);
      if (typeof window.showToast === "function") {
        window.showToast("Failed to sync certificates data: " + err.message);
      }
    } finally {
      state.loading = false;
      render();
    }
  }

  // ── VIEW RENDERING ──
  function render() {
    const mount = document.getElementById("certificates-admin-content");
    if (!mount) return;

    if (state.loading && !state.certificates.length && !state.templates.length) {
      mount.innerHTML = `
        <div class="empty">
          <div class="spinner"></div>
          <div class="empty-title">Loading Certificates Console</div>
          <div class="empty-sub">Fetching verification history, dynamic templates, and stats...</div>
        </div>
      `;
      return;
    }

    mount.innerHTML = `
      <div class="view-hdr">
        <span class="view-hdr-title">Certificates & Verification</span>
        <span class="view-hdr-count">${state.stats.totalCertificates} generated</span>
        <div class="vhdr-right">
          <button class="btn-sm primary" type="button" onclick="window.__ymCertificatesAdmin.showGenerateModal()">+ Generate Bulk</button>
          <button class="btn-sm" type="button" onclick="window.__ymCertificatesAdmin.showTemplateModal()">+ Add Template</button>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="cert-dash">
        <div class="cert-stat">
          <span class="cert-stat-num">${state.stats.totalCertificates}</span>
          <span class="cert-stat-lbl">Generated PDF Certificates</span>
        </div>
        <div class="cert-stat">
          <span class="cert-stat-num">${state.stats.totalEvents}</span>
          <span class="cert-stat-lbl">Conducted Events / Workshops</span>
        </div>
        <div class="cert-stat">
          <span class="cert-stat-num">${state.stats.totalTemplates}</span>
          <span class="cert-stat-lbl">Active Certificate Templates</span>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="cert-tabs">
        <button class="cert-tab ${state.activeTab === "list" ? "active" : ""}" type="button" onclick="window.__ymCertificatesAdmin.selectTab('list')">Certificates List</button>
        <button class="cert-tab ${state.activeTab === "templates" ? "active" : ""}" type="button" onclick="window.__ymCertificatesAdmin.selectTab('templates')">Template Settings</button>
      </div>

      <!-- Tab Content -->
      ${state.activeTab === "list" ? renderCertificatesList() : renderTemplatesGrid()}
    `;
  }

  function renderCertificatesList() {
    const options = state.events.map(ev => `<option value="${ev._id}" ${state.filters.eventId === ev._id ? "selected" : ""}>${escapeHtml(ev.name)}</option>`).join("");

    const rows = state.certificates.length
      ? state.certificates.map(c => `
          <tr>
            <td><code style="font-size:11.5px;color:var(--accent)">${escapeHtml(c.certificateId)}</code></td>
            <td><strong>${escapeHtml(c.studentName)}</strong></td>
            <td><span style="color:var(--muted3)">${escapeHtml(c.email || "-")}</span></td>
            <td>${escapeHtml(c.eventName)}</td>
            <td><span style="color:var(--muted3)">${escapeHtml(c.date || "-")}</span></td>
            <td><span class="pill-badge" style="background:var(--green2);color:var(--green);font-size:10px;font-weight:700">VERIFIED</span></td>
            <td style="text-align:right">
              <a href="/verify/${c.certificateId}" target="_blank" class="btn-sm" style="display:inline-block;padding:4px 8px;margin-right:4px">Verify Page</a>
              <a href="${c.pdfUrl}" target="_blank" class="btn-sm primary" style="display:inline-block;padding:4px 8px">PDF</a>
            </td>
          </tr>
        `).join("")
      : `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--muted3)">No certificates found for current filters.</td></tr>`;

    return `
      <div class="cert-controls">
        <div class="cert-filters">
          <input type="text" class="cert-search" id="cert-search-input" placeholder="Search by name, email, or ID..." value="${escapeHtml(state.filters.search)}" onkeydown="if(event.key==='Enter') window.__ymCertificatesAdmin.applyFilters()">
          <select class="cert-select" id="cert-event-filter" onchange="window.__ymCertificatesAdmin.applyFilters()">
            <option value="">All Events</option>
            ${options}
          </select>
          <button class="btn-sm" type="button" onclick="window.__ymCertificatesAdmin.applyFilters()">Search</button>
        </div>
      </div>

      <div class="table-container">
        <table class="table" style="width:100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th>ID</th>
              <th>Student Name</th>
              <th>Email</th>
              <th>Event Name</th>
              <th>Date</th>
              <th>Status</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderTemplatesGrid() {
    const cards = state.templates.map(t => {
      const preview = t.backgroundUrl
        ? `<img src="${t.backgroundUrl}" alt="Template background">`
        : `<div style="font-size:12px;color:var(--muted3);text-align:center">Premium Vector Background<br><span style="color:var(--accent)">Default styling active</span></div>`;

      return `
        <div class="temp-card ${t.isDefault ? "default" : ""}">
          <div class="temp-preview">
            ${preview}
            ${t.isDefault ? `<span class="temp-badge">DEFAULT</span>` : ""}
          </div>
          <div>
            <div style="font-weight:700;font-size:14px;margin-bottom:2px">${escapeHtml(t.name)}</div>
            <div style="font-size:11px;color:var(--muted3)">TextColor: <span style="color:${t.textColor}">${t.textColor}</span> | AccentColor: <span style="color:${t.accentColor}">${t.accentColor}</span></div>
          </div>
          <div class="temp-actions">
            <button class="btn-sm" style="flex:1" onclick="window.__ymCertificatesAdmin.showTemplateModal('${t._id}')">Edit Fields</button>
            ${!t.isDefault ? `<button class="btn-sm primary" onclick="window.__ymCertificatesAdmin.setDefaultTemplate('${t._id}')">Set Default</button>` : ""}
            <button class="btn-sm" style="color:var(--red);border-color:var(--red2)" onclick="window.__ymCertificatesAdmin.deleteTemplate('${t._id}')">✕</button>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="cert-grid">
        ${cards}
      </div>
    `;
  }

  window.renderCertificatesManager = render;

  // ── EVENT ACTIONS ──
  window.__ymCertificatesAdmin = {
    loadData: loadData,
    selectTab: function (tab) {
      state.activeTab = tab;
      render();
    },

    applyFilters: function () {
      state.filters.search = document.getElementById("cert-search-input")?.value || "";
      state.filters.eventId = document.getElementById("cert-event-filter")?.value || "";
      loadData();
    },

    setDefaultTemplate: async function (id) {
      if (state.loading) return;
      try {
        await apiRequest(`/api/admin/templates/${id}`, {
          method: "PUT",
          body: JSON.stringify({ isDefault: true })
        });
        if (typeof window.showToast === "function") window.showToast("Default template updated");
        loadData();
      } catch (err) {
        alert(err.message);
      }
    },

    deleteTemplate: async function (id) {
      if (!confirm("Are you sure you want to delete this template? This cannot be undone.")) return;
      try {
        await apiRequest(`/api/admin/templates/${id}`, { method: "DELETE" });
        if (typeof window.showToast === "function") window.showToast("Template deleted");
        loadData();
      } catch (err) {
        alert(err.message);
      }
    },

    // ── TEMPLATE SETTINGS DIALOG ──
    showTemplateModal: function (templateId = "") {
      const template = state.templates.find(t => t._id === templateId) || {
        name: "",
        backgroundUrl: "",
        textColor: "#15130c",
        accentColor: "#ffd700",
        fieldsConfig: {
          studentName: { x: 148, y: 95, fontSize: 32, fontStyle: "bold", align: "center" },
          eventName: { x: 148, y: 120, fontSize: 20, fontStyle: "normal", align: "center" },
          date: { x: 80, y: 155, fontSize: 12, fontStyle: "normal", align: "center" },
          venue: { x: 148, y: 135, fontSize: 12, fontStyle: "normal", align: "center" },
          certificateId: { x: 80, y: 170, fontSize: 10, fontStyle: "italic", align: "center" },
          qrCode: { x: 232, y: 142, width: 35, height: 35 },
          signature: { x: 165, y: 155, label: "Authorized Signatory", fontSize: 12, fontStyle: "normal", align: "center" }
        },
        labelsConfig: {
          titleText: "CERTIFICATE",
          subtitleText: "OF PARTICIPATION",
          kickerText: "THIS IS TO CERTIFY THAT",
          participationText: "has successfully participated in the",
          footerParagraph1: "conducted by YoungMinds Agency,",
          footerParagraph2: "focused on practical skills and real-world learning.",
          footerParagraph3: "We appreciate your enthusiasm and commitment to growth.",
          authorizedSignLabel: "AUTHORIZED SIGNATURE",
          certificateIdLabel: "CERTIFICATE ID",
          dateLabel: "DATE",
          scanToVerifyLabel: "SCAN TO VERIFY"
        }
      };

      const isEdit = !!templateId;

      // Extract dynamic static text labels
      const labels = template.labelsConfig || {
        titleText: "CERTIFICATE",
        subtitleText: "OF PARTICIPATION",
        kickerText: "THIS IS TO CERTIFY THAT",
        participationText: "has successfully participated in the",
        footerParagraph1: "conducted by YoungMinds Agency,",
        footerParagraph2: "focused on practical skills and real-world learning.",
        footerParagraph3: "We appreciate your enthusiasm and commitment to growth.",
        authorizedSignLabel: "AUTHORIZED SIGNATURE",
        certificateIdLabel: "CERTIFICATE ID",
        dateLabel: "DATE",
        scanToVerifyLabel: "SCAN TO VERIFY"
      };

      // Build coordinates form HTML
      const fields = template.fieldsConfig || {};
      const fieldsHtml = Object.keys(fields).map(key => {
        const conf = fields[key];
        return `
          <div style="border-top:1px solid var(--border);padding-top:12px">
            <div style="font-weight:700;font-size:12px;margin-bottom:8px;color:var(--accent)">${escapeHtml(key)} Field Settings</div>
            <div class="coord-grid">
              <div class="form-group">
                <label>X coordinate (mm)</label>
                <input type="number" id="field-${key}-x" value="${conf.x || 0}">
              </div>
              <div class="form-group">
                <label>Y coordinate (mm)</label>
                <input type="number" id="field-${key}-y" value="${conf.y || 0}">
              </div>
              ${conf.fontSize !== undefined ? `
                <div class="form-group">
                  <label>Font Size</label>
                  <input type="number" id="field-${key}-fontSize" value="${conf.fontSize}">
                </div>
              ` : ""}
              ${conf.width !== undefined ? `
                <div class="form-group">
                  <label>Width (mm)</label>
                  <input type="number" id="field-${key}-width" value="${conf.width}">
                </div>
              ` : ""}
              ${conf.label !== undefined ? `
                <div class="form-group" style="grid-column: span 2">
                  <label>Signature Line Label</label>
                  <input type="text" id="field-${key}-label" value="${escapeHtml(conf.label)}">
                </div>
              ` : ""}
            </div>
          </div>
        `;
      }).join("");

      const dialog = document.createElement("div");
      dialog.className = "cert-modal";
      dialog.id = "temp-editor-modal";
      dialog.innerHTML = `
        <div class="cert-modal-content" style="max-height:85vh;overflow-y:auto">
          <div class="cert-modal-hdr">
            <span class="cert-modal-title">${isEdit ? "Edit Template Details & Texts" : "Create New Template"}</span>
            <button class="btn-sm" style="border:none" onclick="document.getElementById('temp-editor-modal').remove()">✕</button>
          </div>
          <div class="cert-modal-body">
            <div class="form-group">
              <label>Template Name</label>
              <input type="text" id="temp-name" value="${escapeHtml(template.name)}" placeholder="e.g. Master Workshop Template">
            </div>
            <div class="form-group">
              <label>Upload Background Image (Landscape A4 PNG/JPG)</label>
              <input type="file" id="temp-bg-file" accept="image/*" onchange="window.__ymCertificatesAdmin.handleBgUpload(event)">
              <input type="hidden" id="temp-bg-base64" value="${escapeHtml(template.backgroundUrl)}">
              <div style="font-size:11px;color:var(--muted3)">Leave blank to automatically render the YoungMinds premium default background.</div>
            </div>
            <div class="coord-grid">
              <div class="form-group">
                <label>Text Color (Hex)</label>
                <input type="color" id="temp-textColor" value="${template.textColor || "#15130c"}">
              </div>
              <div class="form-group">
                <label>Accent Color (Hex)</label>
                <input type="color" id="temp-accentColor" value="${template.accentColor || "#ffd700"}">
              </div>
            </div>
            
            <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px">
              <div style="font-weight:700;font-size:12px;margin-bottom:8px;color:var(--accent)">Certificate Text Labels</div>
              <div style="display:grid;grid-template-columns:1fr;gap:10px">
                <div class="form-group">
                  <label>Header Title</label>
                  <input type="text" id="label-titleText" value="${escapeHtml(labels.titleText || "CERTIFICATE")}">
                </div>
                <div class="form-group">
                  <label>Header Subtitle</label>
                  <input type="text" id="label-subtitleText" value="${escapeHtml(labels.subtitleText || "OF PARTICIPATION")}">
                </div>
                <div class="form-group">
                  <label>Certification Prefix (Kicker)</label>
                  <input type="text" id="label-kickerText" value="${escapeHtml(labels.kickerText || "THIS IS TO CERTIFY THAT")}">
                </div>
                <div class="form-group">
                  <label>Participation Middle Paragraph</label>
                  <input type="text" id="label-participationText" value="${escapeHtml(labels.participationText || "has successfully participated in the")}">
                </div>
                <div class="form-group">
                  <label>Footer Paragraph Line 1</label>
                  <input type="text" id="label-footerParagraph1" value="${escapeHtml(labels.footerParagraph1 || "conducted by YoungMinds Agency,")}">
                </div>
                <div class="form-group">
                  <label>Footer Paragraph Line 2</label>
                  <input type="text" id="label-footerParagraph2" value="${escapeHtml(labels.footerParagraph2 || "focused on practical skills and real-world learning.")}">
                </div>
                <div class="form-group">
                  <label>Footer Paragraph Line 3</label>
                  <input type="text" id="label-footerParagraph3" value="${escapeHtml(labels.footerParagraph3 || "We appreciate your enthusiasm and commitment to growth.")}">
                </div>
                <div class="form-group">
                  <label>Signature Line Label</label>
                  <input type="text" id="label-authorizedSignLabel" value="${escapeHtml(labels.authorizedSignLabel || "AUTHORIZED SIGNATURE")}">
                </div>
                <div class="form-group">
                  <label>Certificate ID Label</label>
                  <input type="text" id="label-certificateIdLabel" value="${escapeHtml(labels.certificateIdLabel || "CERTIFICATE ID")}">
                </div>
                <div class="form-group">
                  <label>Date Label</label>
                  <input type="text" id="label-dateLabel" value="${escapeHtml(labels.dateLabel || "DATE")}">
                </div>
                <div class="form-group">
                  <label>QR Code Label</label>
                  <input type="text" id="label-scanToVerifyLabel" value="${escapeHtml(labels.scanToVerifyLabel || "SCAN TO VERIFY")}">
                </div>
              </div>
            </div>
            
            ${fieldsHtml}

          </div>
          <div class="cert-modal-ftr">
            <button class="btn-sm" onclick="document.getElementById('temp-editor-modal').remove()">Cancel</button>
            <button class="btn-sm primary" onclick="window.__ymCertificatesAdmin.saveTemplate('${templateId}')">Save Template</button>
          </div>
        </div>
      `;

      document.body.appendChild(dialog);
    },

    handleBgUpload: function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (evt) {
        document.getElementById("temp-bg-base64").value = evt.target.result;
      };
      reader.readAsDataURL(file);
    },

    saveTemplate: async function (templateId = "") {
      const name = document.getElementById("temp-name").value.trim();
      if (!name) return alert("Template name is required");

      const backgroundUrl = document.getElementById("temp-bg-base64").value;
      const textColor = document.getElementById("temp-textColor").value;
      const accentColor = document.getElementById("temp-accentColor").value;

      // Extract field settings
      const defaultFields = ["studentName", "eventName", "date", "venue", "certificateId", "qrCode", "signature"];
      const fieldsConfig = {};

      defaultFields.forEach(key => {
        fieldsConfig[key] = {
          x: Number(document.getElementById(`field-${key}-x`)?.value || 0),
          y: Number(document.getElementById(`field-${key}-y`)?.value || 0),
        };
        const fsInput = document.getElementById(`field-${key}-fontSize`);
        if (fsInput) fieldsConfig[key].fontSize = Number(fsInput.value);
        
        const wInput = document.getElementById(`field-${key}-width`);
        if (wInput) {
          fieldsConfig[key].width = Number(wInput.value);
          fieldsConfig[key].height = Number(wInput.value); // Keep QR square
        }
        
        const labelInput = document.getElementById(`field-${key}-label`);
        if (labelInput) fieldsConfig[key].label = labelInput.value.trim();
      });

      // Extract dynamic static text labels
      const labelsConfig = {
        titleText: document.getElementById("label-titleText").value.trim(),
        subtitleText: document.getElementById("label-subtitleText").value.trim(),
        kickerText: document.getElementById("label-kickerText").value.trim(),
        participationText: document.getElementById("label-participationText").value.trim(),
        footerParagraph1: document.getElementById("label-footerParagraph1").value.trim(),
        footerParagraph2: document.getElementById("label-footerParagraph2").value.trim(),
        footerParagraph3: document.getElementById("label-footerParagraph3").value.trim(),
        authorizedSignLabel: document.getElementById("label-authorizedSignLabel").value.trim(),
        certificateIdLabel: document.getElementById("label-certificateIdLabel").value.trim(),
        dateLabel: document.getElementById("label-dateLabel").value.trim(),
        scanToVerifyLabel: document.getElementById("label-scanToVerifyLabel").value.trim(),
      };

      const payload = { name, backgroundUrl, textColor, accentColor, fieldsConfig, labelsConfig };
      const isEdit = !!templateId;

      try {
        await apiRequest(isEdit ? `/api/admin/templates/${templateId}` : "/api/admin/templates", {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify(payload)
        });
        
        document.getElementById("temp-editor-modal").remove();
        if (typeof window.showToast === "function") window.showToast(isEdit ? "Template details saved" : "Template created");
        loadData();
      } catch (err) {
        alert(err.message);
      }
    },

    // ── BULK CERTIFICATE GENERATION DIALOG ──
    showGenerateModal: function () {
      const templateOptions = state.templates.map(t => `<option value="${t._id}">${escapeHtml(t.name)}</option>`).join("");
      
      const dialog = document.createElement("div");
      dialog.className = "cert-modal";
      dialog.id = "bulk-generate-modal";
      dialog.innerHTML = `
        <div class="cert-modal-content">
          <div class="cert-modal-hdr">
            <span class="cert-modal-title">Bulk Generate Certificates</span>
            <button class="btn-sm" style="border:none" onclick="document.getElementById('bulk-generate-modal').remove()">✕</button>
          </div>
          <div class="cert-modal-body" id="bulk-modal-body">
            
            <div class="form-group">
              <label>Event/Workshop Name</label>
              <input type="text" id="bulk-event-name" placeholder="e.g. Artificial Intelligence & Agentic Workflows">
            </div>

            <div class="coord-grid">
              <div class="form-group">
                <label>Date Conducted</label>
                <input type="text" id="bulk-event-date" placeholder="e.g. May 21, 2026">
              </div>
              <div class="form-group">
                <label>Venue / Platform</label>
                <input type="text" id="bulk-event-venue" placeholder="e.g. Online Portal or College Name">
              </div>
            </div>

            <div class="coord-grid">
              <div class="form-group">
                <label>Organizer Name / Authorized</label>
                <input type="text" id="bulk-event-organizer" placeholder="e.g. Young Minds Director">
              </div>
              <div class="form-group">
                <label>Select Template Layout</label>
                <select id="bulk-template-id">
                  ${templateOptions}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Upload Participants List (CSV File)</label>
              <div class="csv-zone" id="csv-drop-zone" onclick="document.getElementById('csv-file-input').click()">
                <div style="font-size:24px;margin-bottom:8px">📂</div>
                <div style="font-weight:700;font-size:13px">Drag and drop your CSV file here, or click to browse</div>
                <div style="font-size:11px;color:var(--muted3);margin-top:4px">CSV headers must contain: name, email, college or school</div>
              </div>
              <input type="file" id="csv-file-input" accept=".csv" style="display:none" onchange="window.__ymCertificatesAdmin.handleCsvSelect(event)">
            </div>

            <!-- Participant Grid Preview -->
            <div id="csv-preview-section" style="display:none">
              <div style="font-weight:700;font-size:12px;margin-bottom:8px">Participant List Preview (<span id="csv-preview-count">0</span> students)</div>
              <div class="preview-table-container">
                <table class="preview-table">
                  <thead>
                    <tr><th>Name</th><th>Email</th><th>School/College</th></tr>
                  </thead>
                  <tbody id="csv-preview-rows"></tbody>
                </table>
              </div>
            </div>

          </div>
          <div class="cert-modal-ftr">
            <button class="btn-sm" onclick="document.getElementById('bulk-generate-modal').remove()">Cancel</button>
            <button class="btn-sm primary" id="btn-trigger-bulk" disabled onclick="window.__ymCertificatesAdmin.triggerGeneration()">Generate All Now</button>
          </div>
        </div>
      `;

      document.body.appendChild(dialog);

      // Add Drag and Drop events
      const dropZone = document.getElementById("csv-drop-zone");
      dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.style.borderColor = "var(--accent)"; });
      dropZone.addEventListener("dragleave", () => { dropZone.style.borderColor = "var(--border3)"; });
      dropZone.addEventListener("drop", e => {
        e.preventDefault();
        dropZone.style.borderColor = "var(--border3)";
        const file = e.dataTransfer.files[0];
        if (file) window.__ymCertificatesAdmin.processCsvFile(file);
      });
    },

    handleCsvSelect: function (e) {
      const file = e.target.files[0];
      if (file) this.processCsvFile(file);
    },

    // CSV parser
    processCsvFile: function (file) {
      const reader = new FileReader();
      reader.onload = function (evt) {
        const text = evt.target.result;
        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        if (lines.length < 2) return alert("CSV is empty or missing data rows");

        // Parse headers
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/['"]/g, ""));
        const nameIdx = headers.findIndex(h => h.includes("name"));
        const emailIdx = headers.findIndex(h => h.includes("email") || h.includes("mail"));
        const collegeIdx = headers.findIndex(h => h.includes("college") || h.includes("school") || h.includes("institution"));

        if (nameIdx === -1) {
          return alert("CSV file must contain a 'name' column header.");
        }

        const participants = [];
        for (let i = 1; i < lines.length; i++) {
          // Robust split ignoring commas inside quotes
          const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(",");
          if (!row || !row[nameIdx]) continue;

          const name = row[nameIdx].replace(/['"]/g, "").trim();
          const email = emailIdx !== -1 && row[emailIdx] ? row[emailIdx].replace(/['"]/g, "").trim() : "";
          const college = collegeIdx !== -1 && row[collegeIdx] ? row[collegeIdx].replace(/['"]/g, "").trim() : "";

          if (name) {
            participants.push({ name, email, college });
          }
        }

        if (!participants.length) return alert("No valid participants found in CSV");

        // Save parsed to global window context temp
        window.__ymCertificatesAdmin.parsedParticipants = participants;

        // Update UI preview
        const rowsHtml = participants.map(p => `<tr><td><strong>${escapeHtml(p.name)}</strong></td><td>${escapeHtml(p.email)}</td><td>${escapeHtml(p.college)}</td></tr>`).join("");
        document.getElementById("csv-preview-rows").innerHTML = rowsHtml;
        document.getElementById("csv-preview-count").textContent = participants.length;
        document.getElementById("csv-preview-section").style.display = "block";
        document.getElementById("btn-trigger-bulk").disabled = false;
        
        // Change drag zone styling
        const dropZone = document.getElementById("csv-drop-zone");
        dropZone.innerHTML = `<div style="font-size:24px;margin-bottom:8px;color:var(--green)">✓</div><div style="font-weight:700;color:var(--green)">${escapeHtml(file.name)} loaded</div>`;
      };
      reader.readAsText(file);
    },

    triggerGeneration: async function () {
      const eventName = document.getElementById("bulk-event-name").value.trim();
      const date = document.getElementById("bulk-event-date").value.trim();
      const venue = document.getElementById("bulk-event-venue").value.trim();
      const organizerName = document.getElementById("bulk-event-organizer").value.trim();
      const templateId = document.getElementById("bulk-template-id").value;
      const participants = window.__ymCertificatesAdmin.parsedParticipants;

      if (!eventName) return alert("Event/Workshop name is required");
      if (!participants || !participants.length) return alert("Please upload a participants list first");

      const bodyContent = document.getElementById("bulk-modal-body");
      bodyContent.innerHTML = `
        <div style="text-align:center;padding:40px 20px;display:flex;flex-direction:column;align-items:center;gap:18px">
          <div class="spinner"></div>
          <div style="font-weight:700;font-size:16px">Generating PDFs & QR Codes...</div>
          <div style="font-size:12px;color:var(--muted3)">Creating secure unique certificate IDs, compiling print-ready landscape A4 PDF documents, and committing to MongoDB database...</div>
        </div>
      `;
      document.getElementById("btn-trigger-bulk").disabled = true;

      try {
        const payload = { eventName, date, venue, organizerName, templateId, participants };
        const result = await apiRequest("/api/admin/certificates/generate", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        if (result.success) {
          // Success Screen
          bodyContent.innerHTML = `
            <div style="text-align:center;padding:30px 20px;display:flex;flex-direction:column;align-items:center;gap:16px">
              <div style="font-size:48px;color:var(--green)">✓</div>
              <div style="font-weight:700;font-size:18px;color:var(--green)">Certificates Generated!</div>
              <div style="font-size:13px;line-height:1.6">Successfully created <strong>${result.count}</strong> custom certificate documents, dynamic verification endpoints, and PDF downloads.</div>
              
              <div style="width:100%;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;padding:14px;margin-top:10px">
                <div style="font-size:11px;color:var(--muted3);text-transform:uppercase;margin-bottom:6px">Bulk Action</div>
                <button class="btn-sm primary" style="width:100%;padding:10px" onclick="window.__ymCertificatesAdmin.downloadAllPdfs()">Download All PDFs</button>
              </div>
            </div>
          `;
          
          // Save list of PDFs to download locally
          window.__ymCertificatesAdmin.generatedPdfs = result.certificates.map(c => ({
            name: `${c.studentName.replace(/[^a-zA-Z0-9]/g, "_")}_Certificate.pdf`,
            url: c.pdfUrl
          }));

          const actionBtn = document.getElementById("btn-trigger-bulk");
          actionBtn.outerHTML = `<button class="btn-sm primary" onclick="document.getElementById('bulk-generate-modal').remove()">Done</button>`;
          loadData();
        }
      } catch (err) {
        alert("Bulk generation failed: " + err.message);
        document.getElementById("bulk-generate-modal").remove();
      }
    },

    downloadAllPdfs: function () {
      const pdfs = window.__ymCertificatesAdmin.generatedPdfs || [];
      if (!pdfs.length) return;
      
      // Open all of them sequentially in intervals to avoid browser popups block
      pdfs.forEach((pdf, index) => {
        setTimeout(() => {
          const a = document.createElement("a");
          a.href = pdf.url;
          a.download = pdf.name;
          a.target = "_blank";
          document.body.appendChild(a);
          a.click();
          a.remove();
        }, index * 400);
      });
    }
  };

  // Add navigation mapping
  if (typeof window.NAV_TITLE !== "undefined") {
    window.NAV_TITLE["certificates"] = "Certificates Management";
  }

  // Intercept nav navigation function to automatically trigger loading
  const originalNav = typeof window.nav === "function" ? window.nav : null;
  if (originalNav) {
    window.nav = function (page, options) {
      const result = originalNav.apply(this, arguments);
      if (String(page || "") === "certificates") {
        setTimeout(loadData, 0);
      }
      return result;
    };
  }

  // Add safe rendering connection hook
  const originalRenderAll = typeof window.renderAllViews === "function" ? window.renderAllViews : null;
  if (originalRenderAll) {
    window.renderAllViews = function () {
      const result = originalRenderAll.apply(this, arguments);
      if (typeof window.safeAdminRender === "function") {
        window.safeAdminRender("certificates-manager", () => render());
      }
      return result;
    };
  }

  // Auto trigger load if actively landing on certificates view
  function checkUrlHash() {
    const pathname = String(window.location.pathname || "").replace(/\/+$/, "");
    if (pathname.includes("/admin/certificates") || window.activeAdminView === "certificates") {
      setTimeout(loadData, 20);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkUrlHash, { once: true });
  } else {
    checkUrlHash();
  }
})();

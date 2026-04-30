(function () {
  const KEY = "ym-theme";
  const root = document.documentElement;
  const sun = '<svg class="ym-theme-sun" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.42-1.42M4.92 19.08l1.42-1.42m0-11.32L4.92 4.92m14.16 14.16-1.42-1.42" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.8"/></svg>';
  const moon = '<svg class="ym-theme-moon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.2 14.35A7.9 7.9 0 0 1 9.65 3.8 8.5 8.5 0 1 0 20.2 14.35Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';

  function systemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function currentTheme() {
    return root.dataset.theme || systemTheme();
  }

  function updateButtons(theme) {
    document.querySelectorAll("[data-ym-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-label", theme === "light" ? "Switch to dark mode" : "Switch to light mode");
      button.setAttribute("title", theme === "light" ? "Switch to dark mode" : "Switch to light mode");
    });
  }

  function applyTheme(theme, persist) {
    root.dataset.theme = theme;
    if (persist) {
      try {
        localStorage.setItem(KEY, theme);
      } catch (err) {}
    }
    updateButtons(theme);
  }

  function makeButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ym-theme-toggle";
    button.dataset.ymThemeToggle = "true";
    button.innerHTML = sun + moon;
    button.addEventListener("click", () => {
      applyTheme(currentTheme() === "light" ? "dark" : "light", true);
    });
    return button;
  }

  function findMount() {
    return (
      document.querySelector("[data-theme-mount]") ||
      document.querySelector(".tb-r") ||
      document.querySelector(".top-actions") ||
      document.querySelector(".topbar-inner") ||
      document.querySelector(".nav-links") ||
      document.querySelector(".nav") ||
      document.querySelector(".topbar > div:last-child") ||
      document.querySelector(".topbar") ||
      document.body
    );
  }

  function mountButton() {
    const existing = document.querySelector("[data-ym-theme-toggle]");
    if (existing) {
      existing.addEventListener("click", () => {
        applyTheme(currentTheme() === "light" ? "dark" : "light", true);
      });
      updateButtons(currentTheme());
      return;
    }
    const target = findMount();
    const button = makeButton();
    if (target === document.body) button.classList.add("ym-theme-floating");
    target.appendChild(button);
    updateButtons(currentTheme());
  }

  try {
    const saved = localStorage.getItem(KEY);
    applyTheme(saved || currentTheme(), false);
  } catch (err) {
    applyTheme(currentTheme(), false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountButton);
  } else {
    mountButton();
  }

  if (window.matchMedia) {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (event) => {
      try {
        if (localStorage.getItem(KEY)) return;
      } catch (err) {}
      applyTheme(event.matches ? "light" : "dark", false);
    };
    if (media.addEventListener) media.addEventListener("change", onChange);
    else if (media.addListener) media.addListener(onChange);
  }

  window.ymApplyTheme = applyTheme;
  window.ymToggleTheme = function () {
    applyTheme(currentTheme() === "light" ? "dark" : "light", true);
  };
})();

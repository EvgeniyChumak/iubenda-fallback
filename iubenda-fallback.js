/* Iubenda iframe fallback */

(function () {
  "use strict";

  var FALLBACK_CLASS = "iub-fallback-wrapper";

  var PADLOCK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true">' +
    '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>' +
    '<path d="M7 11V7a5 5 0 0 1 9.9-1"></path>' +
    "</svg>";

  function openPreferences() {
    var cs = window._iub && window._iub.cs;
    var api = cs && cs.api;

    if (api && typeof api.openPreferences === "function") {
      api.openPreferences();
      return;
    }

    var link = document.querySelector(".iubenda-cs-preferences-link");

    if (link) {
      link.click();
      return;
    }

    console.warn("[Iubenda Fallback] Preferences API is unavailable.");
  }

  function isBlocked(iframe) {
    var activated = iframe.classList.contains("_iub_cs_activate-activated");

    var suppressed =
      iframe.hasAttribute("data-suppressedsrc") ||
      iframe.hasAttribute("suppressedsrc");

    var src = iframe.getAttribute("src") || "";
    var emptySource = !src || src.indexOf("about:blank") !== -1;

    if (activated) {
      return false;
    }

    return (
      suppressed ||
      (iframe.classList.contains("_iub_cs_activate") && emptySource)
    );
  }

  function getFallback(iframe) {
    var parent = iframe.parentElement;

    if (!parent) {
      return null;
    }

    return parent.querySelector(":scope > ." + FALLBACK_CLASS);
  }

  function createFallback() {
    var wrapper = document.createElement("div");
    wrapper.className = FALLBACK_CLASS;

    var icon = document.createElement("div");
    icon.className = "iub-fallback-icon";
    icon.innerHTML = PADLOCK_SVG;

    var title = document.createElement("div");
    title.className = "iub-fallback-title";
    title.textContent =
      "Wir benötigen Ihre Zustimmung, um diesen Inhalt zu laden";

    var text = document.createElement("div");
    text.className = "iub-fallback-text";
    text.textContent =
      "Um auf die eingebetteten Inhalte zugreifen zu können, " +
      "müssen Sie dem Dienst des Drittanbieters zustimmen, " +
      "da dieser Daten über Ihre Aktivitäten sammeln kann.";

    var button = document.createElement("button");
    button.type = "button";
    button.className = "iub-fallback-button";
    button.textContent = "Cookie-Einstellungen öffnen";

    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      openPreferences();
    });

    wrapper.appendChild(icon);
    wrapper.appendChild(title);
    wrapper.appendChild(text);
    wrapper.appendChild(button);

    return wrapper;
  }

  function updateIframe(iframe) {
    var fallback = getFallback(iframe);

    if (isBlocked(iframe)) {
      if (fallback || !iframe.parentElement) {
        return;
      }

      var parent = iframe.parentElement;

      if (window.getComputedStyle(parent).position === "static") {
        parent.style.position = "relative";
      }

      parent.insertBefore(createFallback(), iframe.nextSibling);

      return;
    }

    if (fallback) {
      fallback.remove();
    }
  }

  function updateAll() {
    document.querySelectorAll("iframe").forEach(updateIframe);
  }

  function init() {
    updateAll();

    var observer = new MutationObserver(function () {
      updateAll();
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["src", "class", "data-suppressedsrc", "suppressedsrc"],
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

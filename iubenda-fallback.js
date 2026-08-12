/* Iubenda Fallback v17 */

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

  function getApi() {
    return window._iub && window._iub.cs && window._iub.cs.api
      ? window._iub.cs.api
      : null;
  }

  function openPreferences() {
    var api = getApi();

    if (api && typeof api.openPreferences === "function") {
      api.openPreferences();
      return;
    }

    var link = document.querySelector(".iubenda-cs-preferences-link");

    if (link) {
      link.click();
    }
  }

  function isBlockedByIubenda(iframe) {
    return (
      iframe.hasAttribute("data-suppressedsrc") ||
      iframe.hasAttribute("suppressedsrc")
    );
  }

  function getRequiredPurposes(iframe) {
    return (iframe.getAttribute("data-iub-purposes") || "")
      .split(",")
      .map(function (purpose) {
        return purpose.trim();
      })
      .filter(Boolean);
  }

  function getPreference(preferences, purpose) {
    if (
      preferences.purposes &&
      typeof preferences.purposes[purpose] === "boolean"
    ) {
      return preferences.purposes[purpose];
    }

    if (preferences.uspr && typeof preferences.uspr[purpose] === "boolean") {
      return preferences.uspr[purpose];
    }

    return null;
  }

  function isConsentDenied(iframe) {
    var api = getApi();

    if (
      !api ||
      typeof api.getPreferences !== "function" ||
      typeof api.isPreferenceExpressed !== "function" ||
      api.isPreferenceExpressed() !== true
    ) {
      return false;
    }

    var preferences = api.getPreferences() || {};
    var purposes = getRequiredPurposes(iframe);

    if (!purposes.length) {
      return false;
    }

    var knownValues = purposes
      .map(function (purpose) {
        return getPreference(preferences, purpose);
      })
      .filter(function (value) {
        return typeof value === "boolean";
      });

    return (
      knownValues.length > 0 &&
      knownValues.some(function (value) {
        return value === false;
      })
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

    wrapper.innerHTML =
      '<div class="iub-fallback-icon">' +
      PADLOCK_SVG +
      "</div>" +
      '<div class="iub-fallback-title">' +
      "Wir benötigen Ihre Zustimmung, um diesen Inhalt zu laden" +
      "</div>" +
      '<div class="iub-fallback-text">' +
      "Um auf die eingebetteten Inhalte zugreifen zu können, " +
      "müssen Sie dem Dienst des Drittanbieters zustimmen, " +
      "da dieser Daten über Ihre Aktivitäten sammeln kann." +
      "</div>" +
      '<button type="button" class="iub-fallback-button">' +
      "Cookie-Einstellungen öffnen" +
      "</button>";

    wrapper
      .querySelector(".iub-fallback-button")
      .addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        openPreferences();
      });

    return wrapper;
  }

  function updateIframe(iframe) {
    var fallback = getFallback(iframe);

    var shouldShow = isBlockedByIubenda(iframe) && isConsentDenied(iframe);

    if (!shouldShow) {
      if (fallback) {
        fallback.remove();
      }

      return;
    }

    if (fallback || !iframe.parentElement) {
      return;
    }

    var parent = iframe.parentElement;

    if (window.getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }

    parent.insertBefore(createFallback(), iframe.nextSibling);
  }

  function updateAll() {
    document.querySelectorAll("iframe").forEach(updateIframe);
  }

  function init() {
    var observer = new MutationObserver(updateAll);

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "src",
        "class",
        "data-suppressedsrc",
        "suppressedsrc",
        "data-iub-purposes",
      ],
    });

    updateAll();
    window.setInterval(updateAll, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

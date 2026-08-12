/* Iubenda Fallback v16 */

(function () {
  "use strict";

  var FALLBACK_CLASS = "iub-fallback-wrapper";
  var preferencesReady = false;
  var preferences = {};
  var preferenceExpressed = false;
  var lastPreferenceState = "";

  var PADLOCK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true">' +
    '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>' +
    '<path d="M7 11V7a5 5 0 0 1 9.9-1"></path>' +
    "</svg>";

  function getApi() {
    return (window._iub && window._iub.cs && window._iub.cs.api) || null;
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
      return;
    }

    console.warn("[Iubenda Fallback] Preferences API unavailable.");
  }

  function readPreferences() {
    var api = getApi();

    if (!api || typeof api.getPreferences !== "function") {
      return false;
    }

    try {
      preferences = api.getPreferences() || {};

      preferenceExpressed =
        typeof api.isPreferenceExpressed === "function"
          ? api.isPreferenceExpressed() === true
          : Object.keys(preferences).length > 0;

      preferencesReady = true;

      var state = JSON.stringify({
        expressed: preferenceExpressed,
        preferences: preferences,
      });

      if (state !== lastPreferenceState) {
        lastPreferenceState = state;
        updateAll();
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  function isBlocked(iframe) {
    if (iframe.classList.contains("_iub_cs_activate-activated")) {
      return false;
    }

    if (
      iframe.hasAttribute("data-suppressedsrc") ||
      iframe.hasAttribute("suppressedsrc")
    ) {
      return true;
    }

    var src = iframe.getAttribute("src") || "";

    return (
      iframe.classList.contains("_iub_cs_activate") &&
      (!src || src.indexOf("about:blank") !== -1)
    );
  }

  function getPurposeValue(purpose) {
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

  function hasConsent(iframe) {
    if (!preferencesReady || !preferenceExpressed) {
      return false;
    }

    var purposes = (iframe.getAttribute("data-iub-purposes") || "")
      .split(",")
      .map(function (purpose) {
        return purpose.trim();
      })
      .filter(Boolean);

    var applicableValues = purposes
      .map(getPurposeValue)
      .filter(function (value) {
        return typeof value === "boolean";
      });

    if (applicableValues.length) {
      return applicableValues.every(function (value) {
        return value === true;
      });
    }

    if (typeof preferences.consent === "boolean") {
      return preferences.consent;
    }

    var generalValues = Object.keys(preferences.purposes || {}).map(
      function (purpose) {
        return preferences.purposes[purpose];
      },
    );

    return (
      generalValues.length > 0 &&
      generalValues.every(function (value) {
        return value === true;
      })
    );
  }

  function getFallback(iframe) {
    var parent = iframe.parentElement;

    if (!parent) {
      return null;
    }

    var children = parent.children;

    for (var i = 0; i < children.length; i++) {
      if (children[i].classList.contains(FALLBACK_CLASS)) {
        return children[i];
      }
    }

    return null;
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

    /*
     * Critical rule:
     * show absolutely nothing until Iubenda preferences
     * are available.
     */
    if (!preferencesReady) {
      if (fallback) {
        fallback.remove();
      }

      return;
    }

    var shouldShow = isBlocked(iframe) && !hasConsent(iframe);

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

    if (getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }

    parent.insertBefore(createFallback(), iframe.nextSibling);
  }

  function updateAll() {
    document.querySelectorAll("iframe").forEach(updateIframe);
  }

  function init() {
    /*
     * Remove fallbacks created by an older cached version.
     */
    document
      .querySelectorAll("." + FALLBACK_CLASS)
      .forEach(function (fallback) {
        fallback.remove();
      });

    var observer = new MutationObserver(function () {
      updateAll();
    });

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

    /*
     * Wait for Iubenda. Until it is available,
     * no fallback is created.
     */
    var apiTimer = window.setInterval(function () {
      if (readPreferences()) {
        window.clearInterval(apiTimer);
      }
    }, 100);

    /*
     * Detect later changes made in the preferences panel.
     */
    window.setInterval(readPreferences, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

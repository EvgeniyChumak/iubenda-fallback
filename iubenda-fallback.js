/* Iubenda Fallback v15
 * Uses Iubenda preferences as the source of truth.
 * Iubenda remains responsible for blocking and consent management.
 */

(function () {
  "use strict";

  var FALLBACK_CLASS = "iub-fallback-wrapper";
  var ACTIVATED_CLASS = "_iub_cs_activate-activated";

  var preferences = null;
  var preferenceExpressed = false;
  var preferencesReady = false;
  var preferencesSignature = "";

  var PREFERENCES_CHECK_INTERVAL = 500;
  var API_FALLBACK_TIMEOUT = 5000;

  var PADLOCK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true" focusable="false">' +
    '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>' +
    '<path d="M7 11V7a5 5 0 0 1 9.9-1"></path>' +
    "</svg>";

  function getIubendaApi() {
    var cs = window._iub && window._iub.cs;

    if (cs && cs.api) {
      return cs.api;
    }

    return null;
  }

  function openIubendaPreferences() {
    var cs = window._iub && window._iub.cs;
    var api = getIubendaApi();

    if (api && typeof api.openPreferences === "function") {
      api.openPreferences();
      return;
    }

    if (cs && typeof cs.openPreferences === "function") {
      cs.openPreferences();
      return;
    }

    if (api && typeof api.showCP === "function") {
      api.showCP();
      return;
    }

    var preferencesLink = document.querySelector(
      ".iubenda-cs-preferences-link",
    );

    if (preferencesLink) {
      preferencesLink.click();
      return;
    }

    console.warn("[Iubenda Fallback] Preferences API is not available.");
  }

  window.openIubendaPreferences = openIubendaPreferences;

  function hasSuppressedSource(iframe) {
    return (
      iframe.hasAttribute("data-suppressedsrc") ||
      iframe.hasAttribute("suppressedsrc")
    );
  }

  function hasActiveSource(iframe) {
    var src = iframe.getAttribute("src") || "";

    return Boolean(
      src && src !== "about:blank" && src.indexOf("about:blank") === -1,
    );
  }

  function isActivated(iframe) {
    return iframe.classList.contains(ACTIVATED_CLASS);
  }

  function isIframeBlocked(iframe) {
    if (isActivated(iframe)) {
      return false;
    }

    if (hasSuppressedSource(iframe)) {
      return true;
    }

    return (
      iframe.classList.contains("_iub_cs_activate") && !hasActiveSource(iframe)
    );
  }

  function getRequiredPurposes(iframe) {
    var value = iframe.getAttribute("data-iub-purposes") || "";

    return value
      .split(",")
      .map(function (purpose) {
        return purpose.trim();
      })
      .filter(Boolean);
  }

  function getPurposePreference(purpose) {
    if (!preferences) {
      return null;
    }

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

  function hasConsentForIframe(iframe) {
    if (!preferencesReady || !preferenceExpressed || !preferences) {
      return false;
    }

    var requiredPurposes = getRequiredPurposes(iframe);
    var applicablePreferences = [];

    requiredPurposes.forEach(function (purpose) {
      var value = getPurposePreference(purpose);

      if (typeof value === "boolean") {
        applicablePreferences.push(value);
      }
    });

    /*
     * data-iub-purposes can contain purposes belonging
     * to different applicable laws, for example "3,s".
     * Only preferences present in the current Iubenda
     * response are evaluated.
     */
    if (applicablePreferences.length) {
      return applicablePreferences.every(function (value) {
        return value === true;
      });
    }

    /*
     * Compatibility with configurations that expose
     * only a general consent value.
     */
    if (typeof preferences.consent === "boolean") {
      return preferences.consent;
    }

    return false;
  }

  function getFallback(iframe) {
    var parent = iframe.parentElement;

    if (!parent) {
      return null;
    }

    return parent.querySelector(":scope > ." + FALLBACK_CLASS);
  }

  function buildFallback() {
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
      openIubendaPreferences();
    });

    wrapper.appendChild(icon);
    wrapper.appendChild(title);
    wrapper.appendChild(text);
    wrapper.appendChild(button);

    return wrapper;
  }

  function showFallback(iframe) {
    if (
      !preferencesReady ||
      !iframe.isConnected ||
      !iframe.parentElement ||
      !isIframeBlocked(iframe) ||
      hasConsentForIframe(iframe) ||
      getFallback(iframe)
    ) {
      return;
    }

    var parent = iframe.parentElement;

    if (window.getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }

    parent.insertBefore(buildFallback(), iframe.nextSibling);
  }

  function removeFallback(iframe) {
    var fallback = getFallback(iframe);

    if (fallback) {
      fallback.remove();
    }
  }

  function synchronizeIframe(iframe) {
    if (!iframe || iframe.tagName !== "IFRAME") {
      return;
    }

    /*
     * While the API is loading, show nothing.
     */
    if (!preferencesReady) {
      removeFallback(iframe);
      return;
    }

    if (isIframeBlocked(iframe) && !hasConsentForIframe(iframe)) {
      showFallback(iframe);
    } else {
      removeFallback(iframe);
    }
  }

  function synchronizeAllIframes() {
    document.querySelectorAll("iframe").forEach(function (iframe) {
      synchronizeIframe(iframe);
    });

    removeOrphanedFallbacks();
  }

  function removeOrphanedFallbacks() {
    document
      .querySelectorAll("." + FALLBACK_CLASS)
      .forEach(function (fallback) {
        var parent = fallback.parentElement;
        var iframe = parent && parent.querySelector("iframe");

        if (
          !iframe ||
          !isIframeBlocked(iframe) ||
          hasConsentForIframe(iframe)
        ) {
          fallback.remove();
        }
      });
  }

  function readIubendaPreferences() {
    var api = getIubendaApi();

    if (!api || typeof api.getPreferences !== "function") {
      return false;
    }

    var nextPreferences;

    try {
      nextPreferences = api.getPreferences() || {};

      if (typeof api.isPreferenceExpressed === "function") {
        preferenceExpressed = api.isPreferenceExpressed() === true;
      } else {
        preferenceExpressed = Object.keys(nextPreferences).length > 0;
      }
    } catch (error) {
      console.warn("[Iubenda Fallback] Could not read preferences.", error);

      return false;
    }

    var nextSignature = JSON.stringify({
      expressed: preferenceExpressed,
      preferences: nextPreferences,
    });

    preferences = nextPreferences;
    preferencesReady = true;

    if (nextSignature !== preferencesSignature) {
      preferencesSignature = nextSignature;
      synchronizeAllIframes();
    }

    return true;
  }

  function startPreferencesMonitoring() {
    readIubendaPreferences();

    window.setInterval(function () {
      readIubendaPreferences();
    }, PREFERENCES_CHECK_INTERVAL);

    /*
     * If the Iubenda API is unavailable, allow fallback
     * detection after five seconds instead of waiting forever.
     */
    window.setTimeout(function () {
      if (preferencesReady) {
        return;
      }

      console.warn(
        "[Iubenda Fallback] Preferences API timeout. " +
          "Using iframe blocking state as fallback.",
      );

      preferences = {};
      preferenceExpressed = false;
      preferencesReady = true;

      synchronizeAllIframes();
    }, API_FALLBACK_TIMEOUT);
  }

  function containsIframe(node) {
    if (!node || node.nodeType !== 1) {
      return false;
    }

    return (
      node.tagName === "IFRAME" ||
      Boolean(node.querySelector && node.querySelector("iframe"))
    );
  }

  function processMutations(mutations) {
    var shouldSynchronize = false;

    mutations.forEach(function (mutation) {
      if (
        mutation.type === "attributes" &&
        mutation.target.tagName === "IFRAME"
      ) {
        synchronizeIframe(mutation.target);
        return;
      }

      if (mutation.type !== "childList") {
        return;
      }

      mutation.addedNodes.forEach(function (node) {
        if (containsIframe(node)) {
          shouldSynchronize = true;
        }
      });

      mutation.removedNodes.forEach(function (node) {
        if (containsIframe(node)) {
          shouldSynchronize = true;
        }
      });
    });

    if (shouldSynchronize) {
      synchronizeAllIframes();
    }
  }

  function init() {
    /*
     * Remove any fallback left by a previous script version.
     */
    document
      .querySelectorAll("." + FALLBACK_CLASS)
      .forEach(function (fallback) {
        fallback.remove();
      });

    if (window.MutationObserver && document.body) {
      var observer = new MutationObserver(processMutations);

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
          "data-ready",
        ],
      });
    }

    startPreferencesMonitoring();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* Iubenda Fallback
 * Waits until Iubenda finishes processing all iframes.
 * Iubenda handles blocking and consent management.
 */

(function () {
  "use strict";

  var FALLBACK_CLASS = "iub-fallback-wrapper";
  var PROCESSED_CLASS = "iub-processed";
  var ACTIVATED_CLASS = "_iub_cs_activate-activated";

  // Wait after the last iframe change.
  var SETTLE_DELAY = 1000;

  var settleTimer = null;
  var fallbackReady = false;

  var PADLOCK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true" focusable="false">' +
    '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>' +
    '<path d="M7 11V7a5 5 0 0 1 9.9-1"></path>' +
    "</svg>";

  function openIubendaPreferences() {
    var cs = window._iub && window._iub.cs;

    if (cs && cs.api && typeof cs.api.openPreferences === "function") {
      cs.api.openPreferences();
      return;
    }

    if (cs && typeof cs.openPreferences === "function") {
      cs.openPreferences();
      return;
    }

    if (cs && cs.api && typeof cs.api.showCP === "function") {
      cs.api.showCP();
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

  function isBlocked(iframe) {
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
      !fallbackReady ||
      !iframe.isConnected ||
      !iframe.parentElement ||
      !isBlocked(iframe) ||
      getFallback(iframe)
    ) {
      return;
    }

    var parent = iframe.parentElement;

    if (window.getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }

    parent.insertBefore(buildFallback(), iframe.nextSibling);

    iframe.classList.add(PROCESSED_CLASS);
  }

  function removeFallback(iframe) {
    var fallback = getFallback(iframe);

    if (fallback) {
      fallback.remove();
    }

    iframe.classList.remove(PROCESSED_CLASS);
  }

  function synchronizeAllIframes() {
    document.querySelectorAll("iframe").forEach(function (iframe) {
      if (isBlocked(iframe)) {
        showFallback(iframe);
      } else {
        removeFallback(iframe);
      }
    });

    removeOrphanedFallbacks();
  }

  function removeOrphanedFallbacks() {
    document
      .querySelectorAll("." + FALLBACK_CLASS)
      .forEach(function (fallback) {
        var parent = fallback.parentElement;
        var iframe = parent && parent.querySelector("iframe");

        if (!iframe || !isBlocked(iframe)) {
          fallback.remove();

          if (iframe) {
            iframe.classList.remove(PROCESSED_CLASS);
          }
        }
      });
  }

  function scheduleFinalCheck() {
    fallbackReady = false;

    if (settleTimer) {
      window.clearTimeout(settleTimer);
    }

    settleTimer = window.setTimeout(function () {
      settleTimer = null;
      fallbackReady = true;
      synchronizeAllIframes();
    }, SETTLE_DELAY);
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

  function isRelevantMutation(mutation) {
    if (
      mutation.type === "attributes" &&
      mutation.target.tagName === "IFRAME"
    ) {
      return true;
    }

    if (mutation.type !== "childList") {
      return false;
    }

    for (var i = 0; i < mutation.addedNodes.length; i++) {
      if (containsIframe(mutation.addedNodes[i])) {
        return true;
      }
    }

    for (var j = 0; j < mutation.removedNodes.length; j++) {
      if (containsIframe(mutation.removedNodes[j])) {
        return true;
      }
    }

    return false;
  }

  function init() {
    if (window.MutationObserver && document.body) {
      var observer = new MutationObserver(function (mutations) {
        var relevantMutation = mutations.some(isRelevantMutation);

        if (!relevantMutation) {
          return;
        }

        // Remove a fallback immediately if its iframe
        // has already been activated.
        mutations.forEach(function (mutation) {
          if (
            mutation.type === "attributes" &&
            mutation.target.tagName === "IFRAME" &&
            !isBlocked(mutation.target)
          ) {
            removeFallback(mutation.target);
          }
        });

        scheduleFinalCheck();
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
          "data-ready",
        ],
      });
    }

    // Initial check begins after the entire page is loaded.
    function startInitialCheck() {
      scheduleFinalCheck();
    }

    if (document.readyState === "complete") {
      startInitialCheck();
    } else {
      window.addEventListener("load", startInitialCheck, { once: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

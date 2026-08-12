/* Iubenda Fallback v10
 * Visual fallback for iframe elements blocked by Iubenda.
 * Iubenda remains responsible for blocking and consent management.
 */

(function () {
  "use strict";

  var FALLBACK_CLASS = "iub-fallback-wrapper";
  var PROCESSED_CLASS = "iub-processed";
  var ACTIVATED_CLASS = "_iub_cs_activate-activated";
  var POSITIONED_ATTRIBUTE = "data-iub-fallback-positioned";

  var PADLOCK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true" focusable="false">' +
    '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>' +
    '<path d="M7 11V7a5 5 0 0 1 9.9-1"></path>' +
    "</svg>";

  /**
   * Opens the Iubenda preferences panel.
   * This does not automatically grant consent.
   */
  function openIubendaPreferences() {
    var iubenda = window._iub;
    var cs = iubenda && iubenda.cs;

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

  // Keep it available globally if another button needs it.
  window.openIubendaPreferences = openIubendaPreferences;

  /**
   * Returns the iframe source without automatically resolving it.
   */
  function getIframeSource(iframe) {
    return iframe.getAttribute("src") || "";
  }

  /**
   * Checks whether Iubenda has stored a suppressed source.
   */
  function hasSuppressedSource(iframe) {
    return (
      iframe.hasAttribute("data-suppressedsrc") ||
      iframe.hasAttribute("suppressedsrc")
    );
  }

  /**
   * Checks whether Iubenda has explicitly activated the iframe.
   */
  function isActivated(iframe) {
    return iframe.classList.contains(ACTIVATED_CLASS);
  }

  /**
   * Checks whether the current iframe source is usable.
   */
  function hasActiveSource(iframe) {
    var src = getIframeSource(iframe);

    return Boolean(
      src && src !== "about:blank" && src.indexOf("about:blank") === -1,
    );
  }

  /**
   * An iframe is blocked if it still has a suppressed source
   * and Iubenda has not activated it yet.
   *
   * The second condition also covers manually tagged Iubenda
   * iframes that currently use about:blank.
   */
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
    var parent = iframe.parentNode;

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

  function prepareParent(parent) {
    if (!parent) {
      return;
    }

    if (window.getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
      parent.setAttribute(POSITIONED_ATTRIBUTE, "true");
    }
  }

  function restoreParent(parent) {
    if (parent && parent.getAttribute(POSITIONED_ATTRIBUTE) === "true") {
      parent.style.position = "";
      parent.removeAttribute(POSITIONED_ATTRIBUTE);
    }
  }

  function buildFallback() {
    var wrapper = document.createElement("div");
    wrapper.className = FALLBACK_CLASS;
    wrapper.setAttribute("role", "status");
    wrapper.setAttribute("aria-live", "polite");

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
    if (!iframe.parentNode || getFallback(iframe)) {
      return;
    }

    prepareParent(iframe.parentNode);

    var fallback = buildFallback();

    iframe.parentNode.insertBefore(fallback, iframe.nextSibling);

    iframe.classList.add(PROCESSED_CLASS);
  }

  function removeFallback(iframe) {
    var parent = iframe.parentNode;
    var fallback = getFallback(iframe);

    if (fallback && fallback.parentNode) {
      fallback.parentNode.removeChild(fallback);
    }

    iframe.classList.remove(PROCESSED_CLASS);
    restoreParent(parent);
  }

  function synchronizeIframe(iframe) {
    if (!iframe || iframe.tagName !== "IFRAME") {
      return;
    }

    if (isBlocked(iframe)) {
      showFallback(iframe);
    } else {
      removeFallback(iframe);
    }
  }

  function synchronizeAllIframes() {
    var iframes = document.querySelectorAll("iframe");

    for (var i = 0; i < iframes.length; i++) {
      synchronizeIframe(iframes[i]);
    }

    removeOrphanedFallbacks();
  }

  /**
   * Removes fallbacks whose iframe was replaced or deleted.
   */
  function removeOrphanedFallbacks() {
    var fallbacks = document.querySelectorAll("." + FALLBACK_CLASS);

    for (var i = 0; i < fallbacks.length; i++) {
      var fallback = fallbacks[i];
      var parent = fallback.parentNode;
      var iframe = parent && parent.querySelector("iframe");

      if (!iframe || !isBlocked(iframe)) {
        if (fallback.parentNode) {
          fallback.parentNode.removeChild(fallback);
        }

        if (iframe) {
          iframe.classList.remove(PROCESSED_CLASS);
        }

        restoreParent(parent);
      }
    }
  }

  var synchronizationTimer = null;

  function scheduleSynchronization() {
    if (synchronizationTimer) {
      window.clearTimeout(synchronizationTimer);
    }

    synchronizationTimer = window.setTimeout(function () {
      synchronizationTimer = null;
      synchronizeAllIframes();
    }, 50);
  }

  function init() {
    synchronizeAllIframes();

    if (!window.MutationObserver || !document.body) {
      return;
    }

    var observer = new MutationObserver(function () {
      scheduleSynchronization();
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* Iubenda Fallback v19 */

(function () {
  "use strict";

  var FALLBACK_CLASS = "iub-fallback-wrapper";

  var SIZE_CLASSES = [
    "is-medium",
    "is-small",
    "is-very-small",
    "is-extremely-short",
  ];

  var PADLOCK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true" focusable="false">' +
    '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>' +
    '<path d="M7 11V7a5 5 0 0 1 9.9-1"></path>' +
    "</svg>";

  function getApi() {
    if (window._iub && window._iub.cs && window._iub.cs.api) {
      return window._iub.cs.api;
    }

    return null;
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

    console.warn("[Iubenda Fallback] Preferences API is not available.");
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

  function getCurrentSizeClass(wrapper) {
    for (var i = 0; i < SIZE_CLASSES.length; i++) {
      if (wrapper.classList.contains(SIZE_CLASSES[i])) {
        return SIZE_CLASSES[i];
      }
    }

    return "";
  }

  function getRequiredSizeClass(wrapper) {
    var width = wrapper.clientWidth;
    var height = wrapper.clientHeight;

    if (height <= 80) {
      return "is-extremely-short";
    }

    if (width <= 220 || height <= 130) {
      return "is-very-small";
    }

    if (width <= 300 || height <= 210) {
      return "is-small";
    }

    if (width <= 420 || height <= 280) {
      return "is-medium";
    }

    return "";
  }

  function updateFallbackSize(wrapper) {
    if (!wrapper || !wrapper.isConnected) {
      return;
    }

    var currentClass = getCurrentSizeClass(wrapper);
    var requiredClass = getRequiredSizeClass(wrapper);

    /*
     * Do not change the DOM when the correct responsive
     * class has already been applied.
     */
    if (currentClass === requiredClass) {
      return;
    }

    SIZE_CLASSES.forEach(function (className) {
      wrapper.classList.remove(className);
    });

    if (requiredClass) {
      wrapper.classList.add(requiredClass);
    }
  }

  var resizeObserver =
    typeof window.ResizeObserver === "function"
      ? new ResizeObserver(function (entries) {
          entries.forEach(function (entry) {
            updateFallbackSize(entry.target);
          });
        })
      : null;

  function createFallback() {
    var wrapper = document.createElement("div");

    wrapper.className = FALLBACK_CLASS;

    wrapper.innerHTML =
      '<div class="iub-fallback-icon">' +
      PADLOCK_SVG +
      "</div>" +
      '<div class="iub-fallback-title">' +
      "Video durch Cookie-Einstellungen blockiert" +
      "</div>" +
      '<div class="iub-fallback-text">' +
      "Bitte erlauben Sie externe Medien, um dieses Video anzusehen." +
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

  function removeFallback(fallback) {
    if (!fallback) {
      return;
    }

    if (resizeObserver) {
      resizeObserver.unobserve(fallback);
    }

    fallback.remove();
  }

  function updateIframe(iframe) {
    if (!iframe || iframe.tagName !== "IFRAME") {
      return;
    }

    var fallback = getFallback(iframe);

    var shouldShow = isBlockedByIubenda(iframe) && isConsentDenied(iframe);

    if (!shouldShow) {
      removeFallback(fallback);
      return;
    }

    if (fallback) {
      updateFallbackSize(fallback);
      return;
    }

    if (!iframe.parentElement) {
      return;
    }

    var parent = iframe.parentElement;

    if (window.getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }

    fallback = createFallback();

    parent.insertBefore(fallback, iframe.nextSibling);

    updateFallbackSize(fallback);

    if (resizeObserver) {
      resizeObserver.observe(fallback);
    }
  }

  function updateAll() {
    document.querySelectorAll("iframe").forEach(function (iframe) {
      updateIframe(iframe);
    });
  }

  function processAddedNode(node) {
    if (!node || node.nodeType !== 1) {
      return;
    }

    if (node.tagName === "IFRAME") {
      updateIframe(node);
    }

    if (typeof node.querySelectorAll === "function") {
      node.querySelectorAll("iframe").forEach(function (iframe) {
        updateIframe(iframe);
      });
    }
  }

  function processMutations(mutations) {
    mutations.forEach(function (mutation) {
      /*
       * Attribute changes are processed only when the changed
       * element is an iframe. Fallback class changes are ignored.
       */
      if (mutation.type === "attributes") {
        if (mutation.target.tagName === "IFRAME") {
          updateIframe(mutation.target);
        }

        return;
      }

      if (mutation.type === "childList") {
        mutation.addedNodes.forEach(processAddedNode);
      }
    });
  }

  function init() {
    if (!document.body) {
      return;
    }

    updateAll();

    if (typeof window.MutationObserver === "function") {
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
        ],
      });
    }

    /*
     * Used only as a fallback for browsers without ResizeObserver.
     */
    if (!resizeObserver) {
      window.addEventListener("resize", function () {
        document
          .querySelectorAll("." + FALLBACK_CLASS)
          .forEach(updateFallbackSize);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

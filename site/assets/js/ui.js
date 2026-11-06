/* ==========================================================================
   UI PRIMITIVES — icon sprite, sheets, toasts, storage and formatting helpers
   Loaded on every portal page.
   ========================================================================== */

(function () {
  "use strict";

  const symbols = {
    flame:
      '<path d="M12 3c2.3 3.4 5.4 5.2 5.4 9.1a5.4 5.4 0 0 1-10.8 0c0-2.3 1.2-4 2.5-5.6.6 1.6 1.5 2.4 2.5 2.9-.5-2.3-.5-4.3.4-6.4Z"/><path d="M12 12.2c1.1 1.6 2.1 2.5 2.1 4.1a2.1 2.1 0 0 1-4.2 0c0-1.2.7-2 1.3-2.9.2.8.5 1.2.8 1.4-.2-1 0-1.8 0-2.6Z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4.5 4.5"/>',
    cart:
      '<path d="M3 4h2l2.3 10.1a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 7H6"/><circle cx="10" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5"/>',
    phone:
      '<path d="M21.5 16.9v2a2 2 0 0 1-2.2 2 19 19 0 0 1-8.3-3 18.7 18.7 0 0 1-5.7-5.7 19 19 0 0 1-3-8.4A2 2 0 0 1 4.3 1.6h2a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L7.4 9.4a15 15 0 0 0 6.2 6.2l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.8 2.2Z"/>',
    pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="m4.5 12.5 5 5L20 6.5"/>',
    "check-circle": '<circle cx="12" cy="12" r="9"/><path d="m8 12.4 2.8 2.8 5.4-5.6"/>',
    x: '<path d="M5 5l14 14M19 5 5 19"/>',
    "x-circle": '<circle cx="12" cy="12" r="9"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>',
    "chevron-left": '<path d="m15 5-7 7 7 7"/>',
    "chevron-right": '<path d="m9 5 7 7-7 7"/>',
    "chevron-down": '<path d="m5 9 7 7 7-7"/>',
    "chevron-up": '<path d="m5 15 7-7 7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    trash: '<path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    home: '<path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
    grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
    receipt:
      '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3Z"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
    box: '<path d="m12 3 9 4.5v9L12 21l-9-4.5v-9L12 3Z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/>',
    utensils:
      '<path d="M6 3v7a3 3 0 0 0 6 0V3M9 3v18M18 3c-1.5 2-2 4.5-2 7 0 2 1 3 3 3v8"/>',
    bike:
      '<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M5.5 17.5 9 7h4l3 10.5M8 12h8M12 7V5"/>',
    chart: '<path d="M3 21h18M6 17V9M11 17V4M16 17v-6M21 17v-9"/>',
    settings:
      '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5"/>',
    bell: '<path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>',
    "arrow-right": '<path d="M4 12h16M14 6l6 6-6 6"/>',
    "arrow-left": '<path d="M20 12H4M10 6l-6 6 6 6"/>',
    "arrow-up-right": '<path d="M6 18 18 6M8 6h10v10"/>',
    wifi: '<path d="M2.5 8.5a15 15 0 0 1 19 0M5.5 12a10.5 10.5 0 0 1 13 0M8.5 15.5a6 6 0 0 1 7 0"/><circle cx="12" cy="19" r="1.2"/>',
    "wifi-off":
      '<path d="M2.5 8.5a15 15 0 0 1 5.6-3M15 5.6a15 15 0 0 1 6.5 2.9M5.5 12a10.5 10.5 0 0 1 3-1.8M15 10.4a10.5 10.5 0 0 1 3.5 1.6M8.5 15.5a6 6 0 0 1 4.3-.4M12 19h.01M3 3l18 18"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.3M20 4v7h-7"/>',
    alert:
      '<path d="M10.3 3.8 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    navigation: '<path d="M21 3 3 10.5l7.5 3L14 21 21 3Z"/>',
    message: '<path d="M21 11.5a8 8 0 0 1-8.5 8 9 9 0 0 1-4-1L3 21l2.5-4.5a8 8 0 1 1 15.5-5Z"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3Z"/>',
    "credit-card": '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h3"/>',
    banknote: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
    edit: '<path d="M4 20h4L20 8l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    eye: '<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    logout: '<path d="M9 4H4v16h5M15 8l4 4-4 4M19 12H9"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 2.9-5.5 6.5-5.5s6.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M17.5 14.8c2.4.6 4 2.4 4 5.2"/>',
    truck: '<path d="M2.5 6h11v11h-11zM13.5 10H18l3.5 3.5V17h-8"/><circle cx="6.5" cy="19" r="1.6"/><circle cx="18" cy="19" r="1.6"/>',
    shield: '<path d="M12 2.5 20 6v6c0 5-4 8-8 9.5C8 20 4 17 4 12V6l8-3.5Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    "trend-up": '<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>',
    "trend-down": '<path d="m3 7 6 6 4-4 8 8M15 17h6v-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    "cloud-off": '<path d="M7 18h9a4 4 0 0 0 1.5-7.7A6 6 0 0 0 6.5 8.5M4 4l16 16"/>',
    sync: '<path d="M4 11a8 8 0 0 1 13.6-4.6L20 9M20 4v5h-5M20 13a8 8 0 0 1-13.6 4.6L4 15M4 20v-5h5"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>',
    table: '<path d="M3 7h18M3 12h18M3 17h18M8 5v14M16 5v14"/>',
    leaf: '<path d="M4 20c0-9 6-15 16-16 0 10-6 16-16 16Z"/><path d="M4 20c3-5 7-8 12-10"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 4l4 4M14 6l2 2"/>',
    percent: '<path d="M5 19 19 5"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',
    printer: '<path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>',
    wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 12h2"/>',
    route: '<circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="6" r="2.5"/><path d="M7.5 18H14a4 4 0 0 0 0-8H9a4 4 0 0 1 0-8h7"/>'
  };

  const sprite = document.createElement("div");
  sprite.setAttribute("aria-hidden", "true");
  sprite.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  sprite.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" focusable="false"><defs>' +
    Object.keys(symbols)
      .map(function (name) {
        return '<symbol id="i-' + name + '" viewBox="0 0 24 24">' + symbols[name] + "</symbol>";
      })
      .join("") +
    "</defs></svg>";
  document.body.insertAdjacentHTML("afterbegin", sprite.outerHTML);

  function icon(name, className) {
    return (
      '<svg class="icon ' +
      (className || "") +
      '" aria-hidden="true" focusable="false"><use href="#i-' +
      name +
      '"></use></svg>'
    );
  }

  function money(value) {
    const n = Math.round(Number(value) || 0);
    return "USh " + n.toLocaleString("en-US");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function haptic(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (err) {
      /* vibration is a progressive enhancement */
    }
  }

  function toast(message, type) {
    let region = document.querySelector(".toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      region.setAttribute("aria-live", "polite");
      region.setAttribute("aria-atomic", "false");
      document.body.appendChild(region);
    }
    const el = document.createElement("div");
    el.className = "toast" + (type ? " toast-" + type : "");
    el.setAttribute("role", type === "error" ? "alert" : "status");
    const glyph = type === "error" ? "alert" : type === "success" ? "check-circle" : "info";
    el.innerHTML = icon(glyph) + "<span>" + escapeHtml(message) + "</span>";
    region.appendChild(el);
    window.setTimeout(function () {
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
      window.setTimeout(function () { el.remove(); }, 220);
    }, type === "error" ? 5200 : 3600);
  }

  function openSheet(dialog) {
    const el = typeof dialog === "string" ? document.getElementById(dialog) : dialog;
    if (!el) return;
    if (typeof el.showModal === "function") {
      if (!el.open) el.showModal();
    } else {
      el.setAttribute("open", "");
    }
    document.body.classList.add("is-locked");
    const autofocus = el.querySelector("[data-autofocus]");
    if (autofocus) window.setTimeout(function () { autofocus.focus(); }, 30);
    el.dispatchEvent(new CustomEvent("sheet:open"));
  }

  function closeSheet(dialog) {
    const el = typeof dialog === "string" ? document.getElementById(dialog) : dialog;
    if (!el) return;
    if (typeof el.close === "function" && el.open) el.close();
    else el.removeAttribute("open");
    if (!document.querySelector("dialog[open]")) document.body.classList.remove("is-locked");
  }

  document.addEventListener("click", function (event) {
    const opener = event.target.closest("[data-open-sheet]");
    if (opener) {
      event.preventDefault();
      openSheet(opener.getAttribute("data-open-sheet"));
    }
    const closer = event.target.closest("[data-close-sheet]");
    if (closer) {
      event.preventDefault();
      const dialog = closer.closest("dialog, .sheet");
      if (dialog) closeSheet(dialog);
    }
  });

  document.querySelectorAll("dialog.sheet").forEach(function (dialog) {
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) closeSheet(dialog);
    });
    dialog.addEventListener("close", function () {
      if (!document.querySelector("dialog[open]")) document.body.classList.remove("is-locked");
    });
  });

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      button.dataset.originalHtml = button.innerHTML;
      button.setAttribute("aria-busy", "true");
      button.setAttribute("aria-disabled", "true");
      button.innerHTML =
        '<span class="spinner" aria-hidden="true"></span><span>' + escapeHtml(label || "Working…") + "</span>";
    } else {
      button.removeAttribute("aria-busy");
      button.removeAttribute("aria-disabled");
      if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
      }
    }
  }

  function copyText(text, successMessage) {
    const done = function () { toast(successMessage || "Copied", "success"); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand("copy");
      done();
    } catch (err) {
      toast("Could not copy. Please copy manually.", "error");
    }
    area.remove();
  }

  function storageGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  function debounce(fn, wait) {
    let timer;
    return function () {
      const args = arguments;
      const context = this;
      clearTimeout(timer);
      timer = window.setTimeout(function () { fn.apply(context, args); }, wait);
    };
  }

  function initTabs(root) {
    const scope = root || document;
    scope.querySelectorAll('[role="tablist"]').forEach(function (list) {
      if (list.dataset.bound) return;
      list.dataset.bound = "1";
      const tabs = Array.from(list.querySelectorAll('[role="tab"]'));
      list.addEventListener("keydown", function (event) {
        const index = tabs.indexOf(document.activeElement);
        if (index < 0) return;
        let next = null;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % tabs.length;
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = tabs.length - 1;
        if (next !== null) {
          event.preventDefault();
          tabs[next].focus();
          tabs[next].click();
        }
      });
    });
  }

  window.MM = {
    icon: icon,
    money: money,
    escapeHtml: escapeHtml,
    haptic: haptic,
    toast: toast,
    openSheet: openSheet,
    closeSheet: closeSheet,
    setBusy: setBusy,
    copyText: copyText,
    storageGet: storageGet,
    storageSet: storageSet,
    debounce: debounce,
    initTabs: initTabs
  };

  initTabs();
})();

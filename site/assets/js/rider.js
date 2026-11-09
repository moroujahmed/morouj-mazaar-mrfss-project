/* ==========================================================================
   RIDER APP — active delivery, pool claims, PIN handover, connection-required completion
   All data is local demo data. No network requests are made.
   ========================================================================== */

(function () {
  "use strict";

  const {
    money,
    icon,
    escapeHtml,
    toast,
    openSheet,
    closeSheet,
    haptic,
    storageGet,
    storageSet,
    setBusy
  } = window.MM;

  const CONNECTION_KEY = "mm-rider-connection-v2";
  const PENDING_KEY = "mm-rider-pending-v2";
  const QUEUE_KEY = "mm-rider-queue-v2";
  const PIN_CODE = "4821";
  const PIN_MAX_ATTEMPTS = 3;
  const PIN_LOCK_SECONDS = 20;

  /* ---------------------------------------------------------------------
     Demo data
     --------------------------------------------------------------------- */
  const deliveryPool = [
    {
      id: "1045",
      customer: "Brian Kato",
      firstName: "Brian",
      phone: "+256 772 000 222",
      phoneHref: "+256772000222",
      area: "Ntinda",
      address: "Plot 8 Ntinda Road, Ntinda",
      landmark: "Opposite Ntinda Shopping Complex · white gate",
      distance: "8.093 km",
      eta: "18 min",
      arrive: "13:10",
      placed: "12:46",
      status: "Ready for pickup",
      payment: "Cash on delivery",
      cod: true,
      total: 38000,
      tendered: 50000,
      change: 12000,
      items: [
        { name: "Smoked Beef Luwombo", qty: 1, price: 26000, mods: "Extra chilli on the side" },
        { name: "Cold-Pressed Passion Juice", qty: 1, price: 5000, mods: "No ice" }
      ],
      packaging: 1000,
      delivery: 6000,
      note: "Cash on delivery · Call when at the gate. Gate code 1234."
    }
  ];

  const firstOrder = {
    id: "1042",
    customer: "Sarah Namukasa",
    firstName: "Sarah",
    phone: "+256 772 000 111",
    phoneHref: "+256772000111",
    area: "Nakasero",
    address: "Plot 14 Lumumba Avenue, Nakasero Hill",
    landmark: "White gate opposite the fuel station",
    distance: "1.562 km",
    eta: "12 min",
    arrive: "13:10",
    placed: "12:35",
    status: "On the way",
    payment: "MTN MoMo",
    cod: false,
    total: 35000,
    tendered: 0,
    change: 0,
    items: [
      { name: "Whole Tilapia Flame Combo", qty: 1, price: 32000, mods: "" },
      { name: "Extra Garlic Pepper Dip", qty: 1, price: 2000, mods: "" }
    ],
    packaging: 1000,
    delivery: 0,
    note: "Prepaid. Call on arrival. Handover PIN only after the customer inspects the seal."
  };

  let currentOrder = firstOrder;

  let state = {
    connection: storageGet(CONNECTION_KEY, "online"),
    pending: null,
    queue: [],
    onShift: true,
    delivered: false,
    delivery: null,
    deliveriesDone: 0,
    cashHeld: 65500,
    status: "Ready for pickup"
  };

  if (["online", "weak", "offline"].indexOf(state.connection) === -1) state.connection = "online";
  state.queue = [];
  state.pending = null;

  /* ---------------------------------------------------------------------
     Elements
     --------------------------------------------------------------------- */
  const els = {
    connectionChip: document.getElementById("connectionChip"),
    connectionLabel: document.getElementById("connectionLabel"),
    shiftToggle: document.getElementById("shiftToggle"),
    shiftToggleLabel: document.getElementById("shiftToggleLabel"),
    pageTitle: document.getElementById("riderPageTitle"),
    pageSub: document.getElementById("riderPageSub"),
    pageStatusBadge: document.getElementById("pageStatusBadge"),
    pageStatusText: document.getElementById("pageStatusText"),
    offlineBanner: document.getElementById("offlineBanner"),
    weakBanner: document.getElementById("weakBanner"),
    pendingBanner: document.getElementById("pendingBanner"),
    pendingText: document.getElementById("pendingText"),
    syncPending: document.getElementById("syncPending"),
    activeOrderCard: document.getElementById("activeOrderCard"),
    activeOrderBody: document.getElementById("activeOrderBody"),
    deliveredPanel: document.getElementById("deliveredPanel"),
    poolList: document.getElementById("poolList"),
    poolSub: document.getElementById("poolSub"),
    poolCount: document.getElementById("poolCount"),
    shiftDeliveries: document.getElementById("shiftDeliveries"),
    shiftCash: document.getElementById("shiftCash"),
    shiftCashLabel: document.getElementById("shiftCashLabel"),
    shiftQueue: document.getElementById("shiftQueue"),
    shiftNote: document.getElementById("shiftNote"),
    riderSticky: document.getElementById("riderSticky"),
    pinSheet: document.getElementById("pinSheet"),
    pinSheetSub: document.getElementById("pinSheetSub"),
    pinCashBanner: document.getElementById("pinCashBanner"),
    pinDisplay: document.getElementById("pinDisplay"),
    pinError: document.getElementById("pinError"),
    pinVerify: document.getElementById("pinVerify"),
    keypad: document.getElementById("keypad"),
    connectionSheet: document.getElementById("connectionSheet"),
    connectionHint: document.getElementById("connectionHint"),
    applyConnection: document.getElementById("applyConnection"),
    offlineRetry: document.getElementById("offlineRetry")
  };

  const pinSlots = Array.prototype.slice.call(els.pinDisplay.querySelectorAll(".pin-slot"));
  const keypadButtons = Array.prototype.slice.call(els.keypad.querySelectorAll("button"));

  let pinValue = "";
  let pinAttempts = 0;
  let pinLockedUntil = 0;
  let pinLockTimer = null;

  /* ---------------------------------------------------------------------
     Helpers
     --------------------------------------------------------------------- */
  function nowTime() {
    return new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  function saveConnection() {
    storageSet(CONNECTION_KEY, state.connection);
  }

  function savePending() {
    storageSet(PENDING_KEY, state.pending);
  }

  function saveQueue() {
    storageSet(QUEUE_KEY, state.queue);
  }

  function totalUnits(order) {
    return order.items.reduce(function (sum, item) { return sum + item.qty; }, 0);
  }

  function paymentBadge(order) {
    if (order.cod) {
      return '<span class="badge badge-danger">' + icon("banknote") + "COD</span>";
    }
    return '<span class="badge badge-success">' + icon("check-circle") + "Prepaid</span>";
  }

  function connectionIcon() {
    return state.connection === "offline" ? "wifi-off" : "wifi";
  }

  function connectionWord() {
    return state.connection === "online" ? "Online" : state.connection === "weak" ? "Weak signal" : "Offline";
  }

  function isPending() {
    return Boolean(state.pending && state.pending.id === currentOrder.id);
  }

  /* ---------------------------------------------------------------------
     Render — active order
     --------------------------------------------------------------------- */
  function orderTemplate(order) {
    const pending = isPending();
    const statusText = pending ? "Awaiting verification" : state.status;
    const quantity = totalUnits(order);
    const firstName = order.firstName || order.customer.split(" ")[0];

    const itemsHtml = order.items
      .map(function (item) {
        return (
          '<div class="order-item-row">' +
            "<span><strong>" + escapeHtml(item.name) + "</strong>" +
              (item.mods ? '<span class="order-item-mods">' + escapeHtml(item.mods) + "</span>" : "") +
            "</span>" +
            '<span class="mono">&times;' + item.qty + " &middot; " + money(item.price * item.qty) + "</span>" +
          "</div>"
        );
      })
      .join("");

    return (
      '<div class="order-topbar">' +
        '<div class="cluster">' +
          '<span class="order-number">#' + escapeHtml(order.id) + "</span>" +
          '<span class="badge ' + (pending ? "badge-warning" : "badge-orange") + '">' +
            icon(pending ? "sync" : "bike") + escapeHtml(statusText) +
          "</span>" +
        "</div>" +
        paymentBadge(order) +
      "</div>" +

      '<div class="order-hero">' +
        "<div>" +
          '<span class="label">' + (pending ? "Queued at" : "Arrive by") + "</span>" +
          '<div class="eta-big">' + escapeHtml(pending ? state.pending.at : order.arrive) + "</div>" +
          '<div class="eta-meta">' +
            (pending ? "Waiting for a signal to verify" : escapeHtml(order.eta + " · " + order.distance)) +
          "</div>" +
        "</div>" +
        '<div class="order-amount">' +
          "<span>" + (pending ? "Cash collected" : order.cod ? "Collect cash" : "Prepaid") + "</span>" +
          "<strong>" + money(order.total) + "</strong>" +
        "</div>" +
      "</div>" +

      '<div class="order-body">' +
        '<div class="route">' +
          '<div class="route-stop">' +
            '<span class="route-dot">' + icon("utensils") + "</span>" +
            '<div><span class="label">Pick up</span><strong>Bazaar Flame &amp; Grill</strong>' +
              "<p>Plot 14 Lumumba Avenue, Nakasero · Order ready</p></div>" +
          "</div>" +
          '<div class="route-link" aria-hidden="true"></div>' +
          '<div class="route-stop is-drop">' +
            '<span class="route-dot">' + icon("pin") + "</span>" +
            '<div><span class="label">Drop off</span><strong>' + escapeHtml(order.customer) + "</strong>" +
              "<p>" + escapeHtml(order.address) + "</p>" +
              (order.landmark ? "<p>" + escapeHtml(order.landmark) + "</p>" : "") +
            "</div>" +
          "</div>" +
        "</div>" +

        '<div class="contact-strip">' +
          '<span class="avatar" aria-hidden="true">' + escapeHtml(firstName.charAt(0)) + "</span>" +
          '<div class="contact-info">' +
            "<strong>" + escapeHtml(order.customer) + "</strong>" +
            "<span>" + escapeHtml(order.phone) + "</span>" +
          "</div>" +
          '<div class="contact-actions">' +
            '<a class="btn btn-dark" href="tel:' + escapeHtml(order.phoneHref) + '" aria-label="Call ' + escapeHtml(order.customer) + '">' +
              icon("phone") + "Call" +
            "</a>" +
            '<button class="btn btn-secondary" type="button" data-message="' + escapeHtml(order.id) + '">' +
              icon("message") + "Message" +
            "</button>" +
          "</div>" +
        "</div>" +

        (order.cod
          ? '<div class="cash-banner">' +
              icon("banknote") +
              "<div><strong>" + money(order.total) + " cash due</strong>" +
              "<span>Change from " + money(order.tendered || 0) + ": " + money(order.change || 0) + "</span></div>" +
            "</div>"
          : "") +

        '<div class="order-facts">' +
          '<div class="order-fact"><span>Distance</span><strong>' + escapeHtml(order.distance) + "</strong></div>" +
          '<div class="order-fact"><span>ETA</span><strong>' + escapeHtml(order.eta) + "</strong></div>" +
          '<div class="order-fact"><span>Items</span><strong>' + quantity + "</strong></div>" +
        "</div>" +

        '<div class="order-note">' + icon("info") + "<span>" + escapeHtml(order.note) + "</span></div>" +

        (pending
          ? '<div class="order-note order-note-warning">' + icon("alert") +
              "<span>This handover is saved on your phone but not verified yet. Tap Sync now when you have signal.</span></div>"
          : "") +

        '<div class="big-actions">' +
          '<button class="btn btn-secondary" type="button" data-navigate' + (pending ? ' disabled aria-disabled="true"' : "") + ">" +
            icon("navigation") + "Navigate" +
          "</button>" +
          '<button class="btn btn-primary" type="button" data-complete' + (pending ? ' disabled aria-disabled="true"' : "") + ">" +
            icon(pending ? "sync" : "check-circle") + (pending ? "Queued" : "Complete") +
          "</button>" +
        "</div>" +

        '<details class="order-items">' +
          "<summary>Order items &amp; note" + icon("chevron-down") + "</summary>" +
          '<div style="padding-top:6px">' +
            itemsHtml +
            '<div class="order-item-row"><span class="muted">Packaging</span><span class="mono">' + money(order.packaging) + "</span></div>" +
            '<div class="order-item-row"><span class="muted">Delivery</span><span class="mono">' + money(order.delivery) + "</span></div>" +
            '<div class="order-item-row"><strong>Total</strong><span class="mono">' + money(order.total) + "</span></div>" +
          "</div>" +
        "</details>" +
      "</div>"
    );
  }

  function renderOrder() {
    if (state.delivered) {
      els.activeOrderCard.hidden = true;
      return;
    }
    els.activeOrderCard.hidden = false;
    els.activeOrderBody.innerHTML = orderTemplate(currentOrder);
  }

  function renderSticky() {
    if (state.delivered) {
      els.riderSticky.hidden = true;
      return;
    }
    els.riderSticky.hidden = false;
    const pending = isPending();
    const navigate = els.riderSticky.querySelector("[data-navigate]");
    const complete = els.riderSticky.querySelector("[data-complete]");
    if (navigate) {
      navigate.disabled = pending;
      navigate.setAttribute("aria-disabled", String(pending));
    }
    if (complete) {
      complete.disabled = pending;
      complete.setAttribute("aria-disabled", String(pending));
      complete.innerHTML = icon(pending ? "sync" : "check-circle") + (pending ? "Queued" : "Complete");
    }
  }

  /* ---------------------------------------------------------------------
     Render — delivery pool
     --------------------------------------------------------------------- */
  function renderPool() {
    const openOrders = deliveryPool.filter(function (order) {
      return order.id !== currentOrder.id && state.queue.indexOf(order.id) === -1;
    });

    els.poolSub.textContent = state.onShift
      ? "Ready for pickup · held for 10 minutes"
      : "You are off shift. Go on shift to claim deliveries.";
    els.poolCount.textContent = openOrders.length + " open";

    if (!deliveryPool.length) {
      els.poolList.innerHTML =
        '<div class="empty-state"><span class="icon-tile icon-tile-success">' + icon("check-circle") +
        "</span><h3>All caught up</h3><p class=\"small\">No deliveries are waiting near you.</p></div>";
      return;
    }

    els.poolList.innerHTML = deliveryPool
      .filter(function (order) { return order.id !== currentOrder.id; })
      .map(function (order) {
        const queued = state.queue.indexOf(order.id) !== -1;
        const claimLabel = !state.delivered ? "Finish #" + currentOrder.id + " first" : state.onShift ? "Claim delivery" : "Off shift";
        return (
          '<article class="pool-card' + (queued ? " is-claimed" : "") + '">' +
            '<div class="pool-top">' +
              '<span class="badge ' + (queued ? "badge-success" : "badge-orange") + '">' +
                icon(queued ? "check-circle" : "clock") + (queued ? "Claimed" : "Ready") +
              "</span>" +
              '<span class="tiny muted">Ready ' + escapeHtml(order.placed) + "</span>" +
            "</div>" +
            "<h3>" + escapeHtml(order.area) + " · #" + escapeHtml(order.id) + "</h3>" +
            "<p>" + escapeHtml(order.customer) + " · " + totalUnits(order) + " items · " +
              (order.cod ? "Cash on delivery" : "Paid online") + "</p>" +
            '<div class="pool-meta">' +
              "<span>" + icon("navigation") + escapeHtml(order.distance) + "</span>" +
              "<span>" + icon("clock") + escapeHtml(order.eta) + "</span>" +
              "<span>" + icon("banknote") + money(order.total) + "</span>" +
            "</div>" +
            '<p class="pool-note">' + icon("pin") + "<span>" + escapeHtml(order.note) + "</span></p>" +
            '<button class="btn ' + (!state.delivered || queued ? "btn-secondary" : "btn-primary") + '" type="button" data-claim="' +
              escapeHtml(order.id) + '"' + (!state.delivered || queued || !state.onShift ? " disabled" : "") + ">" +
              icon(queued ? "check" : "plus") + claimLabel +
            "</button>" +
          "</article>"
        );
      })
      .join("");
  }

  /* ---------------------------------------------------------------------
     Render — shift summary
     --------------------------------------------------------------------- */
  function renderShift() {
    const pending = isPending();
    const activeCash = !state.delivered && currentOrder.cod ? currentOrder.total : 0;
    const queuedCash = pending && state.pending.cod ? state.pending.amount : 0;
    const cash = state.cashHeld + activeCash + queuedCash;
    const cashLabel = pending || (!state.delivered && currentOrder.cod) ? "COD due" : "Cash held";

    els.shiftDeliveries.textContent = String(7 + state.deliveriesDone);
    els.shiftCashLabel.textContent = cashLabel;
    els.shiftCash.textContent = money(cash);
    els.shiftQueue.textContent = String(state.queue.length);
    els.shiftNote.textContent = state.queue.length
      ? "Your next claimed delivery is waiting in the queue."
      : "Cash handover is due at the end of your shift.";
  }

  /* ---------------------------------------------------------------------
     Render — delivered panel
     --------------------------------------------------------------------- */
  function renderDelivered() {
    if (!state.delivered) {
      els.deliveredPanel.hidden = true;
      return;
    }

    const delivery = state.delivery || {};
    const nextId = state.queue.length ? state.queue[0] : null;
    const nextOrder = nextId ? deliveryPool.find(function (item) { return item.id === nextId; }) : null;

    els.deliveredPanel.hidden = false;
    els.deliveredPanel.innerHTML =
      '<div class="delivered-icon">' + icon("check-circle") + "</div>" +
      "<h2 id=\"deliveredTitle\">Delivery complete</h2>" +
      "<p>Order #" + escapeHtml(delivery.id || currentOrder.id) + " was handed to " +
        escapeHtml(delivery.customer || currentOrder.customer) + " at " + escapeHtml(delivery.at || nowTime()) + ". " +
        (delivery.cod
          ? money(delivery.amount || 0) + " cash is now in your ledger."
          : "The order was prepaid, so there is no cash to collect.") +
      "</p>" +
      '<div class="delivered-summary">' +
        "<div><span>Order</span><strong>#" + escapeHtml(delivery.id || currentOrder.id) + "</strong></div>" +
        "<div><span>Payment</span><strong>" + (delivery.cod ? "Cash" : "Prepaid") + "</strong></div>" +
        "<div><span>Amount</span><strong>" + money(delivery.amount || 0) + "</strong></div>" +
      "</div>" +
      '<div class="cluster cluster-3" style="justify-content:center;margin-top:18px">' +
        (nextOrder
          ? '<button class="btn btn-primary" type="button" data-start-next="' + escapeHtml(nextOrder.id) + '">' +
              icon("arrow-right") + "Start #" + escapeHtml(nextOrder.id) + " · " + escapeHtml(nextOrder.area) +
            "</button>"
          : "") +
        '<button class="btn btn-secondary" type="button" data-view-pool>View delivery pool</button>' +
      "</div>";
  }

  /* ---------------------------------------------------------------------
     Render — header, connection and banners
     --------------------------------------------------------------------- */
  function renderStatusHeader() {
    const pending = isPending();
    els.pageStatusBadge.className = "badge badge-lg " +
      (state.delivered ? "badge-success" : pending ? "badge-warning" : "badge-orange");

    if (state.delivered) {
      els.pageTitle.textContent = "Delivery complete";
      els.pageSub.textContent = "Order #" + currentOrder.id + " · verified";
      els.pageStatusText.textContent = "Delivered";
      els.pageStatusBadge.querySelector("use").setAttribute("href", "#i-check-circle");
    } else if (pending) {
      els.pageTitle.textContent = "Delivery queued";
      els.pageSub.textContent = "Order #" + currentOrder.id + " · waiting for a connection";
      els.pageStatusText.textContent = "Awaiting verification";
      els.pageStatusBadge.querySelector("use").setAttribute("href", "#i-sync");
    } else {
      els.pageTitle.textContent = "Active delivery";
      els.pageSub.textContent = "Order #" + currentOrder.id + " · " + currentOrder.area + " · " + currentOrder.distance;
      els.pageStatusText.textContent = state.status;
      els.pageStatusBadge.querySelector("use").setAttribute("href", "#i-bike");
    }
  }

  function renderConnection() {
    els.connectionChip.dataset.state = state.connection;
    els.connectionLabel.textContent = connectionWord();
    els.connectionChip.setAttribute(
      "aria-label",
      "Connection status: " + connectionWord().toLowerCase() + ". Change connection status"
    );
    const use = els.connectionChip.querySelector("use");
    if (use) use.setAttribute("href", "#i-" + connectionIcon());

    els.offlineBanner.hidden = state.connection !== "offline";
    els.weakBanner.hidden = state.connection !== "weak";
    els.pendingBanner.hidden = !state.pending;

    if (state.pending) {
      const pending = state.pending;
      const verb = state.connection === "offline"
        ? "is saved on this phone and will be verified when you reconnect."
        : state.connection === "weak"
          ? "is ready to sync over this weak connection. Keep the screen open."
          : "is ready to verify. Sync it to update your ledger.";
      els.pendingText.textContent = "Order #" + pending.id + " completed at " + pending.at + " " + verb;
      els.syncPending.disabled = state.connection === "offline";
      els.syncPending.innerHTML = icon(state.connection === "offline" ? "clock" : "sync") +
        (state.connection === "offline" ? "Waiting" : "Sync now");
    }

    const hints = {
      online: "You are online. Delivery updates sync immediately.",
      weak: "Weak connection. Updates may take longer — keep this screen open until they confirm.",
      offline: "Offline mode. Completing a delivery is blocked until you reconnect."
    };
    els.connectionHint.lastElementChild.textContent =
      "Demo control: switch connection states to preview safe retry. " + hints[state.connection];

    Array.prototype.forEach.call(
      els.connectionSheet.querySelectorAll('input[name="riderConnection"]'),
      function (input) { input.checked = input.value === state.connection; }
    );
  }

  function renderAll() {
    renderConnection();
    renderOrder();
    renderSticky();
    renderDelivered();
    renderPool();
    renderShift();
    renderStatusHeader();
  }

  /* ---------------------------------------------------------------------
     PIN handling
     --------------------------------------------------------------------- */
  function updatePinDisplay() {
    pinSlots.forEach(function (slot, index) {
      slot.textContent = pinValue[index] || "";
      slot.classList.toggle("is-filled", Boolean(pinValue[index]));
      slot.classList.remove("is-error");
    });
    els.pinDisplay.setAttribute(
      "aria-label",
      "Delivery PIN, " + pinValue.length + " of 4 digits entered"
    );
    els.pinVerify.disabled = pinValue.length !== 4 || Date.now() < pinLockedUntil;
  }

  function showPinError(message) {
    els.pinError.innerHTML = icon("alert") + "<span>" + escapeHtml(message) + "</span>";
    els.pinError.hidden = false;
  }

  function hidePinError() {
    els.pinError.hidden = true;
    els.pinError.innerHTML = "";
  }

  function markPinError() {
    pinSlots.forEach(function (slot) { slot.classList.add("is-error"); });
  }

  function setKeypadDisabled(disabled) {
    keypadButtons.forEach(function (button) { button.disabled = disabled; });
  }

  function startPinLock() {
    pinLockedUntil = Date.now() + PIN_LOCK_SECONDS * 1000;
    setKeypadDisabled(true);
    els.pinVerify.disabled = true;
    window.clearInterval(pinLockTimer);

    function tick() {
      const remaining = Math.ceil((pinLockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        pinLockedUntil = 0;
        pinAttempts = 0;
        window.clearInterval(pinLockTimer);
        setKeypadDisabled(false);
        hidePinError();
        updatePinDisplay();
        toast("PIN entry unlocked. Ask the customer to read the code again.", "success");
        return;
      }
      showPinError("Too many attempts. Try again in " + remaining + "s. Call the customer if the PIN still fails.");
    }

    tick();
    pinLockTimer = window.setInterval(tick, 1000);
  }

  function resetPinInput() {
    pinValue = "";
    updatePinDisplay();
  }

  function openPin() {
    if (isPending()) {
      toast("This handover is already queued. Sync it before starting another.", "error");
      return;
    }
    if (state.delivered) return;

    window.clearInterval(pinLockTimer);
    pinLockedUntil = 0;
    pinAttempts = 0;
    resetPinInput();
    hidePinError();
    setKeypadDisabled(false);

    els.pinSheetSub.textContent =
      "Ask " + (currentOrder.firstName || currentOrder.customer) +
      " for the 4-digit PIN before handing over the order.";

    if (currentOrder.cod) {
      els.pinCashBanner.hidden = false;
      els.pinCashBanner.innerHTML = icon("banknote") +
        "<div><strong>" + money(currentOrder.total) + " cash due</strong>" +
        "<span>Give " + money(currentOrder.change || 0) + " change from " + money(currentOrder.tendered || 0) + ".</span></div>";
    } else {
      els.pinCashBanner.hidden = true;
    }

    openSheet(els.pinSheet);
  }

  function addPinDigit(digit) {
    if (Date.now() < pinLockedUntil || pinValue.length >= 4) return;
    hidePinError();
    pinValue += digit;
    updatePinDisplay();
    haptic(8);
  }

  function deletePinDigit() {
    if (pinValue.length) {
      pinValue = pinValue.slice(0, -1);
      updatePinDisplay();
      haptic(8);
    }
  }

  function clearPin() {
    pinValue = "";
    hidePinError();
    updatePinDisplay();
    haptic(8);
  }

  function verifyPin() {
    if (pinValue.length !== 4 || Date.now() < pinLockedUntil) return;

    if (pinValue !== PIN_CODE) {
      pinAttempts += 1;
      markPinError();
      haptic([30, 60, 30]);

      if (pinAttempts >= PIN_MAX_ATTEMPTS) {
        showPinError("Incorrect PIN. Handover locked for " + PIN_LOCK_SECONDS + "s. Call the customer before trying again.");
        window.setTimeout(function () {
          pinValue = "";
          startPinLock();
        }, 450);
      } else {
        const left = PIN_MAX_ATTEMPTS - pinAttempts;
        showPinError("Incorrect PIN. " + left + " attempt" + (left === 1 ? "" : "s") + " left. Ask the customer to read it again.");
        window.setTimeout(function () {
          pinValue = "";
          updatePinDisplay();
        }, 650);
      }
      return;
    }

    hidePinError();
    setKeypadDisabled(true);

    if (state.connection === "offline") {
      showPinError("A connection is required to verify the handover. Reconnect and try again.");
      setKeypadDisabled(false);
      toast("Offline. Completion is blocked until the server can verify the PIN.", "error");
      haptic([30, 60, 30]);
      return;
    }

    setBusy(els.pinVerify, true, "Verifying…");
    const delay = state.connection === "weak" ? 1500 : 700;

    window.setTimeout(function () {
      setBusy(els.pinVerify, false);
      setKeypadDisabled(false);
      closeSheet(els.pinSheet);
      finalizeDelivery();
    }, delay);
  }

  /* ---------------------------------------------------------------------
     Completion and sync
     --------------------------------------------------------------------- */
  function finalizeDelivery() {
    const order = currentOrder;
    state.delivered = true;
    state.delivery = {
      id: order.id,
      customer: order.customer,
      amount: order.total,
      cod: order.cod,
      at: nowTime()
    };
    state.pending = null;
    state.deliveriesDone += 1;
    if (order.cod) state.cashHeld += order.total;
    savePending();
    renderAll();

    const cashNote = order.cod
      ? money(order.total) + " cash added to your ledger."
      : "Prepaid — no cash to collect.";
    toast("Delivery #" + order.id + " verified. " + cashNote, "success");
    haptic([20, 50, 20]);

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.setTimeout(function () {
        els.deliveredPanel.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    }
  }

  function syncPendingDelivery() {
    if (!state.pending) return;
    if (state.connection === "offline") {
      toast("Still offline. Move to an area with signal, then try again.", "error");
      haptic([20, 40, 20]);
      return;
    }

    setBusy(els.syncPending, true, "Syncing…");
    const delay = state.connection === "weak" ? 1700 : 850;
    window.setTimeout(function () {
      setBusy(els.syncPending, false);
      finalizeDelivery();
    }, delay);
  }

  /* ---------------------------------------------------------------------
     Orders, navigation and claims
     --------------------------------------------------------------------- */
  function handleNavigate() {
    if (isPending() || state.delivered) return;

    if (state.status !== "On the way") {
      state.status = "On the way";
      renderOrder();
      renderStatusHeader();
    }

    if (state.connection === "offline") {
      toast("Offline. Using the last saved route to " + currentOrder.area + ".");
    } else {
      toast("Route to " + currentOrder.area + " opened. ETA " + currentOrder.eta + ".", "success");
    }
    haptic(15);
  }

  function claimOrder(id) {
    if (!state.onShift) {
      toast("You are off shift. Turn on your shift before claiming a delivery.", "error");
      return;
    }
    if (state.connection === "offline") {
      toast("Claiming a delivery needs a connection. Reconnect first.", "error");
      return;
    }

    const order = deliveryPool.find(function (item) { return item.id === id; });
    if (!order) return;

    if (!state.delivered) {
      toast("Finish #" + currentOrder.id + " before claiming another delivery.", "error");
      haptic([20, 40, 20]);
      return;
    }

    startOrder(order);
  }

  function startOrder(order) {
    currentOrder = order;
    state.delivered = false;
    state.delivery = null;
    state.pending = null;
    state.status = "Assigned";
    state.queue = state.queue.filter(function (id) { return id !== order.id; });
    savePending();
    saveQueue();
    renderAll();
    toast("Delivery #" + order.id + " started. Navigate when you are ready.", "success");
    haptic([20, 40, 20]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startNextDelivery(id) {
    const order = deliveryPool.find(function (item) { return item.id === id; });
    if (order) startOrder(order);
  }

  function viewPool() {
    const heading = document.getElementById("poolTitle");
    if (heading) heading.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(function () {
      const target = els.poolList.querySelector("[data-claim]:not([disabled])");
      if (target) target.focus();
    }, 350);
  }

  /* ---------------------------------------------------------------------
     Events
     --------------------------------------------------------------------- */
  document.addEventListener("click", function (event) {
    const claim = event.target.closest("[data-claim]");
    if (claim) {
      claimOrder(claim.getAttribute("data-claim"));
      return;
    }

    if (event.target.closest("[data-navigate]")) {
      handleNavigate();
      return;
    }

    if (event.target.closest("[data-complete]")) {
      openPin();
      return;
    }

    const message = event.target.closest("[data-message]");
    if (message) {
      toast("Message sent to " + currentOrder.firstName + ": “I am two minutes away.”", "success");
      haptic(10);
      return;
    }

    const digit = event.target.closest("[data-pin-digit]");
    if (digit) {
      addPinDigit(digit.getAttribute("data-pin-digit"));
      return;
    }

    const action = event.target.closest("[data-pin-action]");
    if (action) {
      if (action.getAttribute("data-pin-action") === "clear") clearPin();
      else deletePinDigit();
      return;
    }

    const startNext = event.target.closest("[data-start-next]");
    if (startNext) {
      startNextDelivery(startNext.getAttribute("data-start-next"));
      return;
    }

    if (event.target.closest("[data-view-pool]")) {
      viewPool();
    }
  });

  els.pinVerify.addEventListener("click", verifyPin);
  els.syncPending.addEventListener("click", syncPendingDelivery);

  els.offlineRetry.addEventListener("click", function () {
    if (state.connection === "offline") {
      toast("Opening connection settings. Choose Online to restore sync.", "error");
    }
    openSheet(els.connectionSheet);
  });

  els.applyConnection.addEventListener("click", function () {
    const selected = els.connectionSheet.querySelector('input[name="riderConnection"]:checked');
    if (!selected) return;
    const next = selected.value;
    const previous = state.connection;
    state.connection = next;
    saveConnection();
    closeSheet(els.connectionSheet);
    renderAll();

    if (next === "online" && previous !== "online") {
      toast(
        "Back online. Complete the handover with the customer PIN when ready.",
        "success"
      );
    } else if (next === "weak") {
      toast("Weak connection. Keep the screen open until actions confirm.");
    } else if (next === "offline") {
      toast("Offline. Completion is blocked until you reconnect.", "error");
    }
    haptic(12);
  });

  els.shiftToggle.addEventListener("change", function () {
    state.onShift = els.shiftToggle.checked;
    els.shiftToggleLabel.textContent = state.onShift ? "On shift" : "Off shift";
    renderPool();
    if (state.onShift) {
      toast("You are back on shift. You can claim new deliveries.", "success");
    } else {
      toast("You are off shift. Finish your active delivery safely.", "error");
    }
    haptic(10);
  });

  document.addEventListener("keydown", function (event) {
    if (!els.pinSheet.open) return;

    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      addPinDigit(event.key);
    } else if (event.key === "Backspace") {
      event.preventDefault();
      deletePinDigit();
    } else if (event.key === "Enter" && !els.pinVerify.disabled) {
      event.preventDefault();
      verifyPin();
    }
  });

  els.pinSheet.addEventListener("close", function () {
    window.clearInterval(pinLockTimer);
    pinLockedUntil = 0;
    pinAttempts = 0;
    setKeypadDisabled(false);
  });

  /* ---------------------------------------------------------------------
     Init
     --------------------------------------------------------------------- */
  els.shiftToggle.checked = state.onShift;
  els.shiftToggleLabel.textContent = "On shift";
  renderAll();
})();

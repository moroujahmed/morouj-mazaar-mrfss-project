/* ==========================================================================
   KITCHEN APP — oldest-first tickets, COD acceptance, bump, 86 list and print
   Demo data only. No network requests are made.
   ========================================================================== */

(function () {
  "use strict";

  const { money, icon, escapeHtml, toast } = window.MM;

  const LATE_MINUTES = 15;

  let busy = false;
  let connection = "online";
  let filter = "all";
  let secondsSinceRefresh = 0;

  const orders = [
    {
      id: "1047",
      customer: "Miriam Nsubuga",
      type: "delivery",
      status: "new",
      placed: "13:12",
      age: 2,
      payment: "Cash on delivery",
      cod: true,
      paid: false,
      total: 27500,
      items: [
        { name: "Chicken Luwombo", qty: 1, mods: "Extra chilli on the side" },
        { name: "Extra chilli", qty: 1, mods: "" }
      ],
      note: "Cash on delivery · extra chilli on the side."
    },
    {
      id: "1044",
      customer: "Alex Wandera",
      type: "dine-in",
      status: "cooking",
      placed: "13:01",
      age: 13,
      payment: "Airtel Money",
      cod: false,
      paid: true,
      total: 8000,
      items: [{ name: "Special Bazaar Rolex", qty: 1, mods: "" }],
      note: "Dine-in · Table 4 · serve directly."
    },
    {
      id: "1043",
      customer: "Brian Kato",
      type: "delivery",
      status: "cooking",
      placed: "12:52",
      age: 22,
      payment: "Cash on delivery",
      cod: true,
      paid: false,
      total: 38000,
      items: [
        { name: "Smoked Beef Luwombo", qty: 1, mods: "" },
        { name: "Cold-Pressed Passion Juice", qty: 1, mods: "No ice" }
      ],
      note: "Cash on delivery · change for USh 50,000."
    },
    {
      id: "1045",
      customer: "Grace Achieng",
      type: "delivery",
      status: "ready",
      placed: "13:08",
      age: 6,
      payment: "MTN MoMo",
      cod: false,
      paid: true,
      total: 25000,
      items: [
        { name: "Quarter Charcoal Grilled Chicken", qty: 1, mods: "No onions" },
        { name: "Golden Chips", qty: 1, mods: "" }
      ],
      note: "Leave at reception if I do not answer."
    }
  ];

  let stock = [
    { id: "chicken-luwombo", name: "Chicken Luwombo", category: "Luwombo", unavailable: false },
    { id: "tilapia", name: "Whole Tilapia Flame Combo", category: "Combos", unavailable: false },
    { id: "beef-luwombo", name: "Smoked Beef Luwombo", category: "Luwombo", unavailable: false },
    { id: "rolex", name: "Special Bazaar Rolex", category: "Sides", unavailable: false },
    { id: "chips", name: "Golden Chips", category: "Sides", unavailable: false },
    { id: "matoke", name: "Matoke & Groundnut", category: "Sides", unavailable: true },
    { id: "goat", name: "Charcoal Goat Chops", category: "Grills", unavailable: true }
  ];

  const els = {
    board: document.getElementById("kitchenBoard"),
    stats: document.getElementById("kitchenStats"),
    updated: document.getElementById("kitchenUpdated"),
    busyToggle: document.getElementById("busyToggle"),
    busyToggleLabel: document.getElementById("busyToggleLabel"),
    busyBanner: document.getElementById("kitchenBusyBanner"),
    connection: document.getElementById("kitchenConnection"),
    connectionLabel: document.getElementById("kitchenConnectionLabel"),
    offlineBanner: document.getElementById("kitchenOfflineBanner"),
    refresh: document.getElementById("refreshTickets"),
    stockList: document.getElementById("stockList"),
    stockCount: document.getElementById("stockCount"),
    printDocket: document.getElementById("printDocket")
  };

  function isLate(order) {
    return order.age >= LATE_MINUTES;
  }

  function statusLabel(status) {
    return status === "new" ? "New" : status === "cooking" ? "Cooking" : "Ready";
  }

  function paymentLabel(order) {
    return order.cod ? "Cash on delivery · " + money(order.total) : order.payment + " · prepaid";
  }

  function ticketTemplate(order) {
    const items = order.items
      .map(function (item) {
        return (
          '<li><span class="ticket-qty">' + item.qty + "</span>" +
            "<span>" + escapeHtml(item.name) +
              (item.mods ? '<span class="ticket-mods">' + escapeHtml(item.mods) + "</span>" : "") +
            "</span>" +
          "</li>"
        );
      })
      .join("");

    const actions = [];
    if (order.status === "new") {
      actions.push(
        '<button class="btn btn-primary btn-sm" type="button" data-accept="' + escapeHtml(order.id) + '">' +
          icon("check") + "Accept COD</button>"
      );
    }
    if (order.status === "cooking") {
      actions.push(
        '<button class="btn btn-primary btn-sm" type="button" data-bump="' + escapeHtml(order.id) + '">' +
          icon("check-circle") + (order.type === "dine-in" ? "Serve to table" : "Bump to pass") + "</button>"
      );
    }
    actions.push(
      '<button class="btn btn-secondary btn-sm" type="button" data-print-ticket="' + escapeHtml(order.id) + '">' +
        icon("printer") + "Print</button>"
    );

    return (
      '<article class="ticket' + (isLate(order) ? " is-late" : "") + '" data-ticket="' + escapeHtml(order.id) + '">' +
        '<div class="ticket-head">' +
          "<div>" +
            "<h3>#" + escapeHtml(order.id) +
              '<span class="badge ' + (order.type === "dine-in" ? "badge-info" : "badge-neutral") + '">' +
                icon(order.type === "dine-in" ? "table" : "bike") +
                (order.type === "dine-in" ? "Dine-in" : "Delivery") +
              "</span>" +
            "</h3>" +
            '<div class="ticket-meta"><span>Placed ' + escapeHtml(order.placed) + "</span><span>·</span><span>" +
              escapeHtml(order.customer) + "</span></div>" +
          "</div>" +
          '<span class="ticket-age">' + icon("clock") + order.age + " min</span>" +
        "</div>" +
        '<div class="ticket-body">' +
          '<ul class="ticket-items">' + items + "</ul>" +
          '<div class="ticket-note">' + icon("info") + "<span>" + escapeHtml(order.note) + "</span></div>" +
          '<div class="ticket-foot">' +
            '<span class="ticket-pay">' + icon(order.cod ? "banknote" : "credit-card") + escapeHtml(paymentLabel(order)) + "</span>" +
            '<div class="ticket-actions">' + actions.join("") + "</div>" +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function renderStats() {
    if (!els.stats) return;
    const open = orders.length;
    const oldest = orders.reduce(function (max, order) { return Math.max(max, order.age); }, 0);
    const late = orders.filter(isLate).length;
    const cod = orders.reduce(function (sum, order) {
      return sum + (order.cod && !order.paid ? order.total : 0);
    }, 0);

    els.stats.innerHTML =
      '<div class="kitchen-stat"><span>Open tickets</span><strong>' + open + '</strong><small>Oldest first</small></div>' +
      '<div class="kitchen-stat"><span>Oldest ticket</span><strong>' + oldest + ' min</strong><small>Target under ' + LATE_MINUTES + ' min</small></div>' +
      '<div class="kitchen-stat"><span>Late tickets</span><strong>' + late + '</strong><small>' + (late ? "Escalate to the pass" : "On time") + '</small></div>' +
      '<div class="kitchen-stat"><span>COD due</span><strong>' + money(cod) + '</strong><small>Collect on handover</small></div>';
  }

  function renderBoard() {
    if (!els.board) return;
    const columns = [
      { id: "new", title: "New · COD", icon: "receipt" },
      { id: "cooking", title: "Cooking", icon: "flame" },
      { id: "ready", title: "Ready for pickup", icon: "check-circle" }
    ];

    els.board.innerHTML = columns
      .map(function (column) {
        const tickets = orders
          .filter(function (order) { return order.status === column.id; })
          .filter(function (order) { return filter === "all" || order.type === filter; })
          .sort(function (a, b) { return b.age - a.age; });

        const body = tickets.length
          ? tickets.map(ticketTemplate).join("")
          : '<div class="kitchen-empty">No tickets in this column.</div>';

        return (
          '<section class="kitchen-column" data-column="' + column.id + '" aria-labelledby="column-' + column.id + '">' +
            '<div class="kitchen-column-head">' +
              '<h2 id="column-' + column.id + '">' + icon(column.icon) + column.title + "</h2>" +
              '<span class="count">' + tickets.length + "</span>" +
            "</div>" +
            '<div class="kitchen-column-body">' + body + "</div>" +
          "</section>"
        );
      })
      .join("");
  }

  function renderStock() {
    if (!els.stockList) return;
    const unavailable = stock.filter(function (item) { return item.unavailable; }).length;
    els.stockCount.textContent = String(unavailable);
    els.stockList.innerHTML = stock
      .map(function (item) {
        return (
          '<div class="stock-row">' +
            "<div><strong>" + escapeHtml(item.name) + "</strong><span>" + escapeHtml(item.category) + "</span></div>" +
            '<label class="switch">' +
              '<input type="checkbox" role="switch" data-stock="' + escapeHtml(item.id) + '"' +
                (item.unavailable ? " checked" : "") +
                ' aria-label="Mark ' + escapeHtml(item.name) + ' as unavailable">' +
              '<span class="switch-track" aria-hidden="true"></span>' +
            "</label>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderBusy() {
    els.busyToggle.setAttribute("aria-pressed", busy ? "true" : "false");
    els.busyToggleLabel.textContent = busy ? "Busy mode: on" : "Busy mode: off";
    els.busyBanner.hidden = !busy;
  }

  function renderConnection() {
    els.connection.dataset.state = connection;
    els.connectionLabel.textContent = connection === "online" ? "Online" : "Offline";
    els.connection.setAttribute(
      "aria-label",
      connection === "online" ? "Connection status: online. Simulate offline" : "Connection status: offline. Simulate online"
    );
    els.offlineBanner.hidden = connection === "online";
  }

  function renderUpdated() {
    if (!els.updated) return;
    els.updated.innerHTML =
      icon("sync", "icon-sm") + "Updated " +
      (secondsSinceRefresh < 5 ? "just now" : secondsSinceRefresh + "s ago") +
      " · polls every 10 seconds";
  }

  function renderAll() {
    renderStats();
    renderBoard();
    renderStock();
    renderBusy();
    renderConnection();
    renderUpdated();
  }

  function requireOnline(action) {
    if (connection === "online") return true;
    toast("Reconnect before you " + action + ". The last confirmed queue is unchanged.", "error");
    return false;
  }

  function acceptOrder(id) {
    if (!requireOnline("accept a ticket")) return;
    const order = orders.find(function (item) { return item.id === id; });
    if (!order || order.status !== "new") return;
    order.status = "cooking";
    renderAll();
    toast("Order #" + id + " accepted · cooking now.", "success");
  }

  function bumpOrder(id) {
    if (!requireOnline("bump a ticket")) return;
    const order = orders.find(function (item) { return item.id === id; });
    if (!order || order.status !== "cooking") return;
    if (order.type === "dine-in") {
      removeOrder(id);
      toast("Order #" + id + " served to Table 4 · dine-in complete.", "success");
      return;
    }
    order.status = "ready";
    renderAll();
    toast("Order #" + id + " bumped · waiting for a rider.", "success");
  }

  function removeOrder(id) {
    const index = orders.findIndex(function (item) { return item.id === id; });
    if (index !== -1) orders.splice(index, 1);
    renderAll();
  }

  function printTicket(id) {
    const order = orders.find(function (item) { return item.id === id; });
    if (!order || !els.printDocket) return;
    const items = order.items
      .map(function (item) {
        return "<li>" + item.qty + " × " + escapeHtml(item.name) +
          (item.mods ? " (" + escapeHtml(item.mods) + ")" : "") + "</li>";
      })
      .join("");
    els.printDocket.innerHTML =
      "<h1>Morouj Mazaar</h1>" +
      "<div>Bazaar Flame &amp; Grill</div>" +
      '<div class="docket-line"></div>' +
      "<div><strong>Order #" + escapeHtml(order.id) + "</strong></div>" +
      "<div>" + (order.type === "dine-in" ? "Dine-in · Table 4" : "Delivery") + " · " + escapeHtml(order.placed) + "</div>" +
      '<div class="docket-line"></div>' +
      "<ul>" + items + "</ul>" +
      '<div class="docket-line"></div>' +
      "<div>Payment: " + (order.cod ? "Cash on delivery" : "Prepaid") + "</div>" +
      "<div>Total: " + money(order.total) + "</div>" +
      '<div class="docket-line"></div>' +
      "<div>No handover PIN or customer phone on this docket.</div>";
    window.print();
    toast("Docket for #" + id + " sent to the browser print dialog.");
  }

  function refresh() {
    secondsSinceRefresh = 0;
    renderAll();
    toast("Kitchen queue refreshed.");
  }

  document.addEventListener("click", function (event) {
    const accept = event.target.closest("[data-accept]");
    if (accept) {
      acceptOrder(accept.getAttribute("data-accept"));
      return;
    }

    const bump = event.target.closest("[data-bump]");
    if (bump) {
      bumpOrder(bump.getAttribute("data-bump"));
      return;
    }

    const print = event.target.closest("[data-print-ticket]");
    if (print) {
      printTicket(print.getAttribute("data-print-ticket"));
      return;
    }

    const filterButton = event.target.closest("[data-filter]");
    if (filterButton) {
      filter = filterButton.getAttribute("data-filter");
      document.querySelectorAll("[data-filter]").forEach(function (button) {
        button.setAttribute("aria-pressed", button === filterButton ? "true" : "false");
      });
      renderBoard();
      return;
    }
  });

  document.addEventListener("change", function (event) {
    const stockToggle = event.target.closest("[data-stock]");
    if (!stockToggle) return;
    const item = stock.find(function (entry) { return entry.id === stockToggle.getAttribute("data-stock"); });
    if (!item) return;
    item.unavailable = stockToggle.checked;
    renderStock();
    toast(
      item.unavailable ? item.name + " marked 86 · hidden from the storefront." : item.name + " is available again.",
      item.unavailable ? "error" : "success"
    );
  });

  if (els.busyToggle) {
    els.busyToggle.addEventListener("click", function () {
      busy = !busy;
      renderBusy();
      toast(busy ? "Busy mode on · new ETAs include a kitchen buffer." : "Busy mode off.", busy ? "error" : "success");
    });
  }

  if (els.connection) {
    els.connection.addEventListener("click", function () {
      connection = connection === "online" ? "offline" : "online";
      renderConnection();
      toast(
        connection === "online" ? "Back online. The queue is confirmed." : "Offline. Actions are blocked until reconnect.",
        connection === "online" ? "success" : "error"
      );
    });
  }

  if (els.refresh) els.refresh.addEventListener("click", refresh);

  window.setInterval(function () {
    secondsSinceRefresh += 10;
    renderUpdated();
  }, 10000);

  renderAll();
})();

/* ==========================================================================
   ADMIN APP — dashboard state, tables, drawers and report exports
   Demo data only. All actions are local and reversible by reloading.
   ========================================================================== */

(function () {
  "use strict";

  const { money, icon, escapeHtml, toast, openSheet, closeSheet, storageGet, storageSet, haptic, setBusy } = window.MM;

  /* ---------------------------------------------------------------------
     Data
     --------------------------------------------------------------------- */
  let orders = [
    {
      id: "1042",
      customer: "Sarah Namukasa",
      phone: "+256 772 000 111",
      area: "Nakasero",
      address: "Plot 14 Lumumba Avenue, Nakasero",
      notes: "Gate code 1234 · Call when at the gate",
      status: "On the way",
      payment: "MTN MoMo",
      paid: true,
      rider: "Juma Mukasa",
      time: "12:45",
      items: [
        { name: "Whole Tilapia Flame Combo", qty: 1, price: 32000, mods: "No onions · Extra Garlic Pepper Dip" },
        { name: "Extra Garlic Pepper Dip", qty: 1, price: 2000, mods: "" }
      ],
      packaging: 1000,
      delivery: 0
    },
    {
      id: "1043",
      customer: "Brian Kato",
      phone: "+256 701 234 567",
      area: "Ntinda",
      address: "Plot 8 Ntinda Road, Ntinda",
      notes: "Cash on delivery · Change for USh 50,000",
      status: "Delivered",
      payment: "Cash on delivery",
      paid: true,
      rider: "Juma Mukasa",
      time: "12:52",
      items: [
        { name: "Smoked Beef Luwombo", qty: 1, price: 26000, mods: "" },
        { name: "Cold-Pressed Passion Juice", qty: 1, price: 5000, mods: "" }
      ],
      packaging: 1000,
      delivery: 6000
    },
    {
      id: "1044",
      customer: "Alex Wandera",
      phone: "+256 782 555 019",
      area: "Table 4",
      address: "Dine-in · Table 4",
      notes: "Dine-in order · no rider needed",
      status: "Cooking",
      payment: "Airtel Money",
      paid: true,
      rider: "",
      time: "13:01",
      items: [{ name: "Special Bazaar Rolex", qty: 1, price: 8000, mods: "" }],
      packaging: 0,
      delivery: 0
    },
    {
      id: "1045",
      customer: "Brian Okello",
      phone: "+256 701 234 567",
      area: "Ntinda",
      address: "Plot 8 Ntinda Road, Ntinda",
      notes: "Cash on delivery · Change for USh 50,000",
      status: "Ready",
      payment: "Cash on delivery",
      paid: false,
      rider: "",
      time: "13:08",
      items: [
        { name: "Smoked Beef Luwombo", qty: 1, price: 26000, mods: "" },
        { name: "Cold-Pressed Passion Juice", qty: 1, price: 5000, mods: "" }
      ],
      packaging: 1000,
      delivery: 6000
    },
    {
      id: "1046",
      customer: "Samuel Okello",
      phone: "+256 774 300 441",
      area: "Nakawa",
      address: "Nakawa Market, Shop 12",
      notes: "",
      status: "Delivered",
      payment: "Visa / Mastercard",
      paid: true,
      rider: "David Ochieng",
      time: "11:30",
      items: [
        { name: "Whole Tilapia Flame Combo", qty: 1, price: 32000, mods: "" },
        { name: "Cold-Pressed Passion Juice", qty: 1, price: 5000, mods: "" }
      ],
      packaging: 1000,
      delivery: 0
    },
    {
      id: "1047",
      customer: "Miriam Nsubuga",
      phone: "+256 703 419 882",
      area: "Bugolobi",
      address: "Plot 5 Spring Road, Bugolobi",
      notes: "Extra chilli on the side",
      status: "Delivered",
      payment: "Cash on delivery",
      paid: true,
      rider: "Juma Mukasa",
      time: "13:12",
      items: [
        { name: "Chicken Luwombo", qty: 1, price: 24000, mods: "Extra chilli on the side" },
        { name: "Extra chilli", qty: 1, price: 1000, mods: "" }
      ],
      packaging: 1000,
      delivery: 1500
    }
  ];

  let inventory = [
    { id: "tilapia", name: "Fresh whole tilapia", category: "Seafood", qty: 12, par: 40, unit: "portions", updated: "08:30" },
    { id: "chicken", name: "Chicken quarters", category: "Poultry", qty: 42, par: 60, unit: "pieces", updated: "09:10" },
    { id: "beef", name: "Beef for luwombo", category: "Meat", qty: 6, par: 30, unit: "kg", updated: "07:55" },
    { id: "rolex", name: "Eggs", category: "Dairy", qty: 96, par: 120, unit: "pieces", updated: "09:20" },
    { id: "chapati", name: "Chapati flour", category: "Dry goods", qty: 18, par: 25, unit: "kg", updated: "08:05" },
    { id: "juice", name: "Passion fruit", category: "Produce", qty: 8, par: 45, unit: "kg", updated: "08:40" },
    { id: "matoke", name: "Matoke bunches", category: "Produce", qty: 22, par: 30, unit: "bunches", updated: "09:00" },
    { id: "chips", name: "Potatoes", category: "Produce", qty: 64, par: 80, unit: "kg", updated: "09:15" },
    { id: "rice", name: "Rice", category: "Dry goods", qty: 38, par: 40, unit: "kg", updated: "08:10" },
    { id: "water", name: "Bottled water", category: "Drinks", qty: 120, par: 100, unit: "bottles", updated: "09:30" },
    { id: "soda", name: "Soda crates", category: "Drinks", qty: 14, par: 30, unit: "crates", updated: "09:25" },
    { id: "charcoal", name: "Charcoal", category: "Kitchen", qty: 9, par: 25, unit: "bags", updated: "07:45" }
  ];

  let riders = [
    { name: "Juma Mukasa", plate: "UFD 342B", status: "On delivery", order: "#1042", cash: 65500, cashOrders: "#1043 · #1047", deliveries: 7, phone: "+256 772 100 201" },
    { name: "David Ochieng", plate: "UEX 119A", status: "Available", order: "", cash: 0, deliveries: 5, phone: "+256 701 300 118" },
    { name: "Brian Kato", plate: "UEE 902C", status: "Available", order: "", cash: 0, deliveries: 8, phone: "+256 782 900 332" },
    { name: "Samuel Ssebo", plate: "UFA 450P", status: "Available", order: "", cash: 0, deliveries: 6, phone: "+256 705 440 900" },
    { name: "Alex Wandera", plate: "UFD 881M", status: "Offline", order: "", cash: 0, deliveries: 4, phone: "+256 774 881 004" }
  ];

  let menuItems = [
    { id: "tilapia", name: "Whole Tilapia Flame Combo", category: "combos", price: 32000, available: true, img: "assets/images/grilled_tilapia.jpg", prep: 25 },
    { id: "chicken", name: "Quarter Charcoal Grilled Chicken", category: "grills", price: 18000, available: true, img: "assets/images/charcoal_grilled_chicken_1793348776274.jpg", prep: 20 },
    { id: "beef-luwombo", name: "Smoked Beef Luwombo", category: "luwombo", price: 26000, available: true, img: "assets/images/placeholder-dish.svg", prep: 30 },
    { id: "chicken-luwombo", name: "Chicken Luwombo", category: "luwombo", price: 24000, available: false, img: "assets/images/placeholder-dish.svg", prep: 30 },
    { id: "rolex", name: "Special Bazaar Rolex", category: "sides", price: 8000, available: true, img: "assets/images/passion_juice_rolex.jpg", prep: 10 },
    { id: "juice", name: "Cold-Pressed Passion Juice", category: "beverages", price: 5000, available: true, img: "assets/images/passion_juice_rolex_1793348796512.jpg", prep: 5 },
    { id: "chips", name: "Golden Chips", category: "sides", price: 6000, available: true, img: "assets/images/placeholder-dish.svg", prep: 12 },
    { id: "matoke", name: "Matoke & Groundnut", category: "sides", price: 15000, available: true, img: "assets/images/placeholder-dish.svg", prep: 20 }
  ];

  const categoryNames = {
    combos: "Combos & deals",
    grills: "Flame grills",
    luwombo: "Luwombo",
    sides: "Sides",
    beverages: "Juices & drinks"
  };

  const statusMeta = {
    New: { badge: "badge-info", icon: "receipt" },
    Cooking: { badge: "badge-warning", icon: "flame" },
    Ready: { badge: "badge-orange", icon: "check-circle" },
    "On the way": { badge: "badge-warning", icon: "bike" },
    Delivered: { badge: "badge-success", icon: "check-circle" },
    Cancelled: { badge: "badge-danger", icon: "x-circle" }
  };

  const viewMeta = {
    overview: { title: "Overview", sub: "Sunday, 1 November 2026 · Kampala, EAT" },
    orders: { title: "Orders", sub: "Live orders · kitchen, pick-up and delivery" },
    inventory: { title: "Inventory", sub: "Stock levels and restock alerts" },
    menu: { title: "Menu", sub: "Dishes, prices and availability" },
    delivery: { title: "Delivery", sub: "Fleet, dispatch and cash liabilities" },
    reports: { title: "Reports", sub: "This week · sales, payments and reconciliation" }
  };

  let orderFilter = "all";
  let orderQuery = "";
  let activeOrderId = null;
  let reportPeriod = "week";

  /* ---------------------------------------------------------------------
     Helpers
     --------------------------------------------------------------------- */
  function orderSubtotal(order) {
    return order.items.reduce(function (sum, item) { return sum + item.price * item.qty; }, 0);
  }
  function orderTotal(order) {
    return orderSubtotal(order) + order.packaging + order.delivery;
  }
  function activeOrders() {
    return orders.filter(function (order) { return order.status !== "Delivered" && order.status !== "Cancelled"; });
  }
  function lowStockItems() {
    return inventory.filter(function (item) { return item.qty / item.par < 0.35; });
  }
  function initials(name) {
    return name.split(" ").map(function (part) { return part.charAt(0); }).join("").slice(0, 2).toUpperCase();
  }
  function statusBadge(status) {
    const meta = statusMeta[status] || statusMeta.New;
    return '<span class="badge ' + meta.badge + '">' + icon(meta.icon) + escapeHtml(status) + "</span>";
  }
  function paymentBadge(order) {
    if (order.payment === "Cash on delivery") {
      return '<span class="badge badge-danger">' + icon("banknote") + "COD</span>";
    }
    const short = order.payment === "MTN MoMo" ? "MTN" : order.payment === "Airtel Money" ? "Airtel" : "Card";
    return '<span class="badge badge-success">' + icon("check-circle") + short + "</span>";
  }
  function availableRiders() {
    return riders.filter(function (rider) { return rider.status === "Available"; });
  }
  function stockPercent(item) {
    return Math.min(100, Math.round((item.qty / item.par) * 100));
  }
  function stockState(item) {
    const pct = stockPercent(item);
    if (item.qty <= 0) return { label: "Out of stock", badge: "badge-danger", bar: "progress-red" };
    if (pct < 35) return { label: "Low stock", badge: "badge-danger", bar: "progress-red" };
    if (pct < 65) return { label: "Running low", badge: "badge-warning", bar: "progress-orange" };
    return { label: "Healthy", badge: "badge-success", bar: "" };
  }

  /* ---------------------------------------------------------------------
     View switching
     --------------------------------------------------------------------- */
  function setView(name) {
    if (!viewMeta[name]) return;
    document.querySelectorAll(".admin-panel").forEach(function (panel) {
      const active = panel.id === "panel-" + name;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
    document.querySelectorAll("[data-admin-view]").forEach(function (button) {
      if (button.closest(".admin-nav")) {
        if (button.dataset.adminView === name) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      }
    });
    const meta = viewMeta[name];
    const title = document.getElementById("adminPageTitle");
    const sub = document.getElementById("adminPageSub");
    if (title) title.textContent = meta.title;
    if (sub) sub.textContent = meta.sub;
    closeSidebar();
    try {
      history.replaceState(null, "", window.location.pathname + (name === "overview" ? "" : "#" + name));
    } catch (err) { /* file:// */ }
    const heading = document.querySelector("#panel-" + name + " h2");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* ---------------------------------------------------------------------
     Sidebar
     --------------------------------------------------------------------- */
  const scrim = document.getElementById("adminScrim");
  const menuBtn = document.getElementById("adminMenuBtn");

  function openSidebar() {
    document.body.classList.add("sidebar-open");
    if (scrim) scrim.hidden = false;
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "true");
  }
  function closeSidebar() {
    document.body.classList.remove("sidebar-open");
    if (scrim) scrim.hidden = true;
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
  }

  if (menuBtn) {
    menuBtn.addEventListener("click", function () {
      if (document.body.classList.contains("sidebar-open")) closeSidebar();
      else openSidebar();
    });
  }
  if (scrim) scrim.addEventListener("click", closeSidebar);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeSidebar();
  });
  window.addEventListener("resize", function () {
    if (window.innerWidth > 1024) closeSidebar();
  });

  /* ---------------------------------------------------------------------
     KPI helpers
     --------------------------------------------------------------------- */
  function kpiCard(options) {
    const trend = options.trend
      ? '<span class="' + (options.trendUp === false ? "trend-down" : "trend-up") + '">' +
        icon(options.trendUp === false ? "trend-down" : "trend-up") + options.trend + "</span>"
      : "";
    const valueParts = String(options.value).split(" ");
    const valueHtml = valueParts.length === 2 && valueParts[0] === "USh"
      ? '<span class="kpi-currency">USh</span> ' + escapeHtml(valueParts[1])
      : options.value;
    return (
      '<article class="kpi-card">' +
        '<div class="kpi-top"><div><div class="kpi-label">' + escapeHtml(options.label) + '</div>' +
        '<div class="kpi-value">' + valueHtml + "</div></div>" +
        '<span class="icon-tile ' + (options.tile || "") + '">' + icon(options.icon) + "</span></div>" +
        '<div class="kpi-foot"><span>' + options.sub + "</span>" + trend + "</div>" +
      "</article>"
    );
  }

  function renderOverviewKpis() {
    const kpis = document.getElementById("overviewKpis");
    if (!kpis) return;
    kpis.innerHTML =
      kpiCard({
        label: "Revenue today",
        value: money(1284000),
        icon: "banknote",
        tile: "icon-tile-orange",
        sub: "vs USh 1,098,000 yesterday",
        trend: "+16.9%",
        spark: [40, 62, 54, 78, 66, 92, 100]
      }) +
      kpiCard({
        label: "Orders today",
        value: "42",
        icon: "receipt",
        sub: "5 are still active",
        trend: "+8.2%"
      }) +
      kpiCard({
        label: "Average prep time",
        value: "18 min",
        icon: "clock",
        sub: "Target is under 20 min",
        trend: "-2 min",
        trendUp: true
      }) +
      kpiCard({
        label: "Riders online",
        value: "4 / 5",
        icon: "bike",
        tile: "icon-tile-success",
        sub: "2 orders waiting for dispatch",
        trend: "1 offline",
        trendUp: false
      });
  }

  /* ---------------------------------------------------------------------
     Charts
     --------------------------------------------------------------------- */
  const weekChart = [
    { label: "Mon", value: 1.02 },
    { label: "Tue", value: 1.14 },
    { label: "Wed", value: 0.96 },
    { label: "Thu", value: 1.21 },
    { label: "Fri", value: 1.35 },
    { label: "Sat", value: 1.68 },
    { label: "Sun", value: 1.28, now: true }
  ];

  const todayChart = [
    { label: "08", value: 0.04 },
    { label: "10", value: 0.11 },
    { label: "12", value: 0.24 },
    { label: "14", value: 0.19 },
    { label: "16", value: 0.16 },
    { label: "18", value: 0.33 },
    { label: "20", value: 0.21, now: true }
  ];

  const monthChart = [
    { label: "W1", value: 7.8 },
    { label: "W2", value: 8.4 },
    { label: "W3", value: 7.1 },
    { label: "W4", value: 8.64, now: true }
  ];

  function renderBars(container, data) {
    if (!container) return;
    const max = Math.max.apply(null, data.map(function (item) { return item.value; }));
    container.innerHTML = data
      .map(function (item) {
        const height = Math.max(4, Math.round((item.value / max) * 100));
        return (
          '<div class="bar-col">' +
            '<span class="bar-value">' + (item.value >= 1 ? item.value.toFixed(1) + "M" : Math.round(item.value * 1000) + "k") + "</span>" +
            '<span class="bar' + (item.now ? " is-now" : "") + '" style="height:' + height + '%"></span>' +
            '<span class="bar-label">' + item.label + "</span>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderCharts() {
    renderBars(document.getElementById("revenueChart"), weekChart);
    renderBars(document.getElementById("reportChart"), reportPeriod === "today" ? todayChart : reportPeriod === "month" ? monthChart : weekChart);
  }

  /* ---------------------------------------------------------------------
     Overview
     --------------------------------------------------------------------- */
  function renderPipeline() {
    const holder = document.getElementById("pipelineGrid");
    if (!holder) return;
    const stages = [
      { label: "New", status: "New", icon: "receipt", color: "progress-orange" },
      { label: "Cooking", status: "Cooking", icon: "flame", color: "progress-orange" },
      { label: "Ready", status: "Ready", icon: "check-circle", color: "" },
      { label: "On the way", status: "On the way", icon: "bike", color: "" }
    ];
    const counts = stages.map(function (stage) {
      return orders.filter(function (order) { return order.status === stage.status; }).length;
    });
    const total = Math.max(1, counts.reduce(function (a, b) { return a + b; }, 0));
    holder.innerHTML = stages
      .map(function (stage, index) {
        return (
          '<div class="pipeline-card">' +
            '<div class="p-label">' + icon(stage.icon) + stage.label + "</div>" +
            '<div class="p-value">' + counts[index] + "</div>" +
            '<div class="progress ' + stage.color + '"><span style="width:' + Math.round((counts[index] / total) * 100) + '%"></span></div>' +
            '<div class="p-sub">' + Math.round((counts[index] / total) * 100) + "% of active orders</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderRecentOrders() {
    const body = document.getElementById("recentOrdersBody");
    if (!body) return;
    body.innerHTML = orders.slice(0, 4)
      .map(function (order) {
        return (
          "<tr>" +
            '<td><span class="table-primary">#' + order.id + '</span><div class="table-sub">' + order.time + "</div></td>" +
            '<td><div class="table-customer"><span class="avatar" aria-hidden="true">' + initials(order.customer) + "</span><div><strong>" + escapeHtml(order.customer) + "</strong><span>" + escapeHtml(order.area) + "</span></div></div></td>" +
            '<td class="num">' + money(orderTotal(order)) + "</td>" +
            "<td>" + statusBadge(order.status) + "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function renderLowStock() {
    const holder = document.getElementById("lowStockList");
    if (!holder) return;
    const low = lowStockItems();
    holder.innerHTML = low
      .map(function (item) {
        return (
          '<div class="low-stock-item">' +
            '<span class="icon-tile icon-tile-red">' + icon(item.category === "Seafood" ? "leaf" : "box") + "</span>" +
            "<div><strong>" + escapeHtml(item.name) + "</strong><span>" + item.qty + " of " + item.par + " " + escapeHtml(item.unit) + " left</span></div>" +
            '<span class="badge badge-danger">' + icon("alert") + "Low</span>" +
          "</div>"
        );
      })
      .join("");
    const navLow = document.getElementById("navLowCount");
    if (navLow) navLow.textContent = String(low.length);
  }

  function renderFleetSnapshot() {
    const holder = document.getElementById("fleetSnapshot");
    if (!holder) return;
    holder.innerHTML = riders.slice(0, 4)
      .map(function (rider) {
        const online = rider.status !== "Offline";
        return (
          '<span class="badge ' + (online ? "badge-success" : "badge-neutral") + '">' +
            icon(online ? "bike" : "cloud-off") + escapeHtml(rider.name.split(" ")[0]) +
            " · " + (rider.status === "On delivery" ? "On delivery" : online ? "Available" : "Offline") +
          "</span>"
        );
      })
      .join("");
  }

  /* ---------------------------------------------------------------------
     Orders
     --------------------------------------------------------------------- */
  function filteredOrders() {
    const query = orderQuery.trim().toLowerCase();
    return orders.filter(function (order) {
      if (orderFilter !== "all" && order.status !== orderFilter) return false;
      if (!query) return true;
      return (
        order.id.includes(query) ||
        order.customer.toLowerCase().includes(query) ||
        order.area.toLowerCase().includes(query) ||
        order.phone.toLowerCase().includes(query)
      );
    });
  }

  function renderOrders() {
    const body = document.getElementById("ordersBody");
    if (!body) return;
    const list = filteredOrders();
    body.innerHTML = list
      .map(function (order) {
        return (
          "<tr>" +
            '<td><span class="table-primary">#' + order.id + '</span><div class="table-sub">' + order.time + "</div></td>" +
            '<td><div class="table-customer"><span class="avatar" aria-hidden="true">' + initials(order.customer) + "</span><div><strong>" + escapeHtml(order.customer) + "</strong><span>" + escapeHtml(order.phone) + "</span></div></div></td>" +
            "<td>" + escapeHtml(order.area) + "</td>" +
            '<td class="num">' + money(orderTotal(order)) + "</td>" +
            "<td>" + paymentBadge(order) + "</td>" +
            "<td>" + statusBadge(order.status) + "</td>" +
            '<td><div class="table-actions"><button class="btn btn-secondary" type="button" data-order="' + order.id + '">View</button></div></td>' +
          "</tr>"
        );
      })
      .join("");

    const count = document.getElementById("ordersCount");
    if (count) count.textContent = "Showing " + list.length + " of " + orders.length + " orders";
    const navCount = document.getElementById("navOrderCount");
    if (navCount) navCount.textContent = String(activeOrders().length);
    renderRecentOrders();
    renderPipeline();
  }

  function renderOrderDrawer() {
    const body = document.getElementById("orderDrawerBody");
    const order = orders.find(function (item) { return item.id === activeOrderId; });
    if (!body || !order) return;

    const subtotal = orderSubtotal(order);
    const total = orderTotal(order);
    const isDineIn = order.area.indexOf("Table") === 0;
    const actionMap = {
      New: { label: "Accept order", action: "accept", icon: "check" },
      Cooking: { label: isDineIn ? "Mark ready to serve" : "Mark ready for pickup", action: "ready", icon: "check-circle" },
      Ready: { label: isDineIn ? "Mark served" : "Assign rider & dispatch", action: "dispatch", icon: "bike" },
      "On the way": { label: "Confirm delivery", action: "delivered", icon: "home" }
    };
    const action = actionMap[order.status];

    const assignOptions = availableRiders()
      .map(function (rider) {
        return '<option value="' + escapeHtml(rider.name) + '">' + escapeHtml(rider.name) + " · " + escapeHtml(rider.plate) + "</option>";
      })
      .join("");

    body.innerHTML =
      '<div class="spread"><div>' +
        '<span class="badge ' + (statusMeta[order.status] || statusMeta.New).badge + ' badge-lg">' + icon((statusMeta[order.status] || statusMeta.New).icon) + escapeHtml(order.status) + "</span>" +
        '<p class="small muted" style="margin-top:6px">Placed at ' + order.time + " EAT · " + escapeHtml(order.payment) + (order.paid ? " · paid" : " · collect on delivery") + "</p>" +
      "</div>" +
      (order.status !== "Delivered" && order.status !== "Cancelled"
        ? '<button class="btn btn-danger btn-sm" type="button" data-order-action="cancel" data-confirm="false">Cancel order</button>'
        : "") +
      "</div>" +

      '<div class="drawer-section"><h3>Customer</h3><div class="stack stack-2">' +
        '<div class="spread"><strong>' + escapeHtml(order.customer) + '</strong><a class="btn btn-ghost btn-sm" href="tel:' + escapeHtml(order.phone.replace(/\s/g, "")) + '">' + icon("phone") + "Call</a></div>" +
        '<div class="small muted">' + escapeHtml(order.phone) + "</div>" +
        '<div class="small">' + icon("pin") + " " + escapeHtml(order.address) + "</div>" +
        (order.notes ? '<div class="alert alert-orange" style="margin-top:4px">' + icon("info") + "<div><strong>Delivery note</strong><span>" + escapeHtml(order.notes) + "</span></div></div>" : "") +
      "</div></div>" +

      '<div class="drawer-section"><h3>Items</h3><div class="drawer-items">' +
        order.items.map(function (item) {
          return '<div class="drawer-item"><div><strong>' + item.qty + "× " + escapeHtml(item.name) + "</strong>" + (item.mods ? '<div class="small muted">' + escapeHtml(item.mods) + "</div>" : "") + '</div><span class="mono">' + money(item.price * item.qty) + "</span></div>";
        }).join("") +
      "</div></div>" +

      '<div class="drawer-totals">' +
        '<div class="drawer-total-row"><span>Subtotal</span><span class="mono">' + money(subtotal) + "</span></div>" +
        '<div class="drawer-total-row"><span>Packaging</span><span class="mono">' + money(order.packaging) + "</span></div>" +
        '<div class="drawer-total-row"><span>Delivery</span><span class="mono">' + (order.delivery ? money(order.delivery) : "Free") + "</span></div>" +
        '<div class="drawer-total-row"><span>Rider</span><span>' + (order.rider ? escapeHtml(order.rider) : "Not assigned") + "</span></div>" +
        '<div class="drawer-total-row is-total"><span>Total</span><span class="mono">' + money(total) + "</span></div>" +
      "</div>" +

      (order.status === "Ready" && !isDineIn && !order.rider
        ? '<div class="drawer-section"><h3>Assign a rider</h3><div class="cluster" style="align-items:stretch">' +
            '<label class="sr-only" for="assignRiderSelect">Choose rider</label>' +
            '<select class="select" id="assignRiderSelect" style="flex:1">' +
              (assignOptions || '<option value="">No riders available</option>') +
            "</select>" +
            '<button class="btn btn-dark" type="button" data-order-action="assign-selected"' + (assignOptions ? "" : " disabled") + ">Dispatch</button>" +
          "</div></div>"
        : "") +

      (action
        ? '<div class="drawer-actions"><button class="btn btn-primary" type="button" data-order-action="' + action.action + '">' + icon(action.icon) + action.label + "</button>" +
          '<button class="btn btn-secondary" type="button" data-close-sheet>Close</button></div>'
        : '<div class="drawer-actions"><button class="btn btn-secondary" type="button" data-close-sheet>Close</button></div>') +

      '<details class="demo-toolbar" style="margin-top:2px"><summary>Fix customer details</summary>' +
        '<div class="demo-body" style="display:block">' +
          '<div class="field" style="margin-bottom:10px"><label class="field-label" for="editOrderName">Customer name</label><input class="input" id="editOrderName" type="text" value="' + escapeHtml(order.customer) + '"></div>' +
          '<div class="field" style="margin-bottom:10px"><label class="field-label" for="editOrderPhone">Phone number</label><input class="input" id="editOrderPhone" type="tel" value="' + escapeHtml(order.phone) + '"></div>' +
          '<div class="field" style="margin-bottom:10px"><label class="field-label" for="editOrderNotes">Delivery notes</label><textarea class="textarea" id="editOrderNotes" rows="2">' + escapeHtml(order.notes) + "</textarea></div>" +
          '<button class="btn btn-dark btn-block btn-sm" type="button" data-order-save>Save &amp; sync to rider</button>' +
        "</div>" +
      "</details>";

    const title = document.getElementById("orderDrawerTitle");
    const sub = document.getElementById("orderDrawerSub");
    if (title) title.textContent = "Order #" + order.id;
    if (sub) sub.textContent = order.customer + " · " + order.area;
  }

  function openOrder(id) {
    activeOrderId = id;
    renderOrderDrawer();
    openSheet(document.getElementById("orderDrawer"));
  }

  function advanceOrder(order) {
    if (order.status === "New") {
      order.status = "Cooking";
      toast("Order #" + order.id + " accepted and sent to the kitchen.", "success");
    } else if (order.status === "Cooking") {
      order.status = "Ready";
      toast("Order #" + order.id + " marked ready.", "success");
    } else if (order.status === "Ready") {
      if (order.area.indexOf("Table") === 0) {
        order.status = "Delivered";
        toast("Table order #" + order.id + " marked served.", "success");
      } else if (order.rider) {
        order.status = "On the way";
        toast("Order #" + order.id + " picked up by " + order.rider + ".", "success");
      } else {
        const rider = availableRiders()[0];
        if (!rider) {
          toast("No rider is available. Bring a rider online first.", "error");
          return;
        }
        assignRider(order, rider.name);
        return;
      }
    } else if (order.status === "On the way") {
      order.status = "Delivered";
      const rider = riders.find(function (item) { return item.name === order.rider; });
      if (rider) {
        rider.status = "Available";
        rider.order = "";
        rider.deliveries += 1;
        if (!order.paid) rider.cash += orderTotal(order);
      }
      toast("Delivery #" + order.id + " confirmed. Cash liability updated.", "success");
      haptic([20, 50, 20]);
    }
    renderAll();
    renderOrderDrawer();
  }

  function assignRider(order, riderName) {
    const rider = riders.find(function (item) { return item.name === riderName && item.status === "Available"; });
    if (!rider) {
      toast("That rider is no longer available. Choose another.", "error");
      return;
    }
    order.rider = rider.name;
    order.status = "On the way";
    rider.status = "On delivery";
    rider.order = "#" + order.id;
    toast("Order #" + order.id + " dispatched with " + rider.name + ".", "success");
    renderAll();
    renderOrderDrawer();
  }

  /* ---------------------------------------------------------------------
     Inventory
     --------------------------------------------------------------------- */
  function renderInventory() {
    const body = document.getElementById("inventoryBody");
    const kpis = document.getElementById("inventoryKpis");
    if (!body) return;
    const low = inventory.filter(function (item) { return item.qty / item.par < 0.35; });
    const healthy = inventory.filter(function (item) { return item.qty / item.par >= 0.65; }).length;

    if (kpis) {
      kpis.innerHTML =
        kpiCard({ label: "Tracked items", value: String(inventory.length), icon: "box", sub: "Kitchen and bar" }) +
        kpiCard({ label: "Low or out", value: String(low.length), icon: "alert", tile: "icon-tile-red", sub: "Needs restocking today" }) +
        kpiCard({ label: "Healthy levels", value: String(healthy), icon: "check-circle", tile: "icon-tile-success", sub: "Above 65% of par" });
    }

    body.innerHTML = inventory
      .map(function (item) {
        const pct = stockPercent(item);
        const state = stockState(item);
        return (
          "<tr>" +
            '<td><strong style="font-size:.875rem">' + escapeHtml(item.name) + "</strong></td>" +
            "<td>" + escapeHtml(item.category) + "</td>" +
            '<td><div class="stock-cell"><div class="stock-cell-top"><strong>' + item.qty + " / " + item.par + " " + escapeHtml(item.unit) + '</strong><span>' + pct + '%</span></div><div class="progress ' + state.bar + '"><span style="width:' + pct + '%"></span></div></div></td>' +
            "<td><span class=\"badge " + state.badge + "\">" + icon(state.label === "Healthy" ? "check-circle" : "alert") + state.label + "</span></td>" +
            '<td><span class="small muted">' + item.updated + "</span></td>" +
            '<td><div class="table-actions">' +
              '<button class="icon-btn icon-btn-sm" type="button" data-stock-adjust="' + item.id + '" data-delta="-1" aria-label="Decrease ' + escapeHtml(item.name) + ' by one">' + icon("minus") + "</button>" +
              '<button class="icon-btn icon-btn-sm" type="button" data-stock-adjust="' + item.id + '" data-delta="1" aria-label="Increase ' + escapeHtml(item.name) + ' by one">' + icon("plus") + "</button>" +
            "</div></td>" +
          "</tr>"
        );
      })
      .join("");
    renderLowStock();
  }

  /* ---------------------------------------------------------------------
     Menu
     --------------------------------------------------------------------- */
  function renderMenuAdmin() {
    const grid = document.getElementById("menuAdminGrid");
    if (!grid) return;
    grid.innerHTML = menuItems
      .map(function (item) {
        return (
          '<article class="admin-menu-card">' +
            '<div class="admin-menu-media"><img src="' + escapeHtml(item.img) + '" alt="" width="420" height="236" loading="lazy">' +
              '<span class="badge ' + (item.available ? "badge-success" : "badge-danger") + '">' + icon(item.available ? "check-circle" : "x-circle") + (item.available ? "Available" : "86'd") + "</span>" +
            "</div>" +
            '<div class="admin-menu-body">' +
              "<h3>" + escapeHtml(item.name) + "</h3>" +
              '<div class="small muted">' + escapeHtml(categoryNames[item.category] || item.category) + " · " + item.prep + " min</div>" +
              '<div class="admin-menu-meta"><span class="admin-menu-price">' + money(item.price) + '</span><span class="badge badge-neutral">' + icon("star") + "4.8</span></div>" +
              '<div class="admin-menu-foot">' +
                '<label class="switch" for="menu-available-' + item.id + '">' +
                  '<input type="checkbox" id="menu-available-' + item.id + '" data-menu-toggle="' + item.id + '"' + (item.available ? " checked" : "") + ">" +
                  '<span class="switch-track" aria-hidden="true"></span>' +
                  '<span class="tiny">' + (item.available ? "On menu" : "Hidden") + "</span>" +
                "</label>" +
                '<button class="btn btn-secondary" type="button" data-menu-edit="' + item.id + '">' + icon("edit") + "Edit</button>" +
              "</div>" +
            "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function openMenuItemSheet(id) {
    const item = menuItems.find(function (entry) { return entry.id === id; });
    const title = document.getElementById("menuItemSheetTitle");
    const sub = document.getElementById("menuItemSheetSub");
    const idField = document.getElementById("menuItemId");
    const name = document.getElementById("menuItemName");
    const category = document.getElementById("menuItemCategory");
    const price = document.getElementById("menuItemPrice");
    const desc = document.getElementById("menuItemDesc");
    const available = document.getElementById("menuItemAvailable");
    const error = document.getElementById("menuItemError");
    if (!idField || !name || !price) return;
    idField.value = item ? item.id : "";
    name.value = item ? item.name : "";
    category.value = item ? item.category : "grills";
    price.value = item ? String(item.price) : "";
    desc.value = item ? item.desc || "" : "";
    available.checked = item ? item.available : true;
    if (error) error.hidden = true;
    if (title) title.textContent = item ? "Edit dish" : "Add a dish";
    if (sub) sub.textContent = item ? "Changes appear on the storefront immediately." : "New items appear on the storefront immediately.";
    openSheet(document.getElementById("menuItemSheet"));
  }

  /* ---------------------------------------------------------------------
     Delivery
     --------------------------------------------------------------------- */
  function renderDelivery() {
    const kpis = document.getElementById("deliveryKpis");
    if (kpis) {
      const cash = riders.reduce(function (sum, rider) { return sum + rider.cash; }, 0);
      const waiting = orders.filter(function (order) { return order.status === "Ready" && !order.rider; }).length;
      kpis.innerHTML =
        kpiCard({ label: "Riders online", value: String(riders.filter(function (r) { return r.status !== "Offline"; }).length), icon: "bike", tile: "icon-tile-success", sub: "1 rider offline" }) +
        kpiCard({ label: "Ready for dispatch", value: String(waiting), icon: "clock", tile: "icon-tile-orange", sub: "Paid and packed", trend: waiting ? "Waiting" : "Clear" }) +
        kpiCard({ label: "Average delivery", value: "24 min", icon: "navigation", sub: "Last 7 days", trend: "-3 min", trendUp: true }) +
        kpiCard({ label: "Cash liability", value: money(cash), icon: "banknote", sub: "Reconcile at end of shift" });
    }

    const dispatch = document.getElementById("dispatchList");
    if (dispatch) {
      const waitingOrders = orders.filter(function (order) { return order.status === "Ready" && !order.rider; });
      if (!waitingOrders.length) {
        dispatch.innerHTML = '<div class="empty-state" style="padding:24px 10px"><span class="icon-tile icon-tile-success">' + icon("check-circle") + "</span><h3>All caught up</h3><p class=\"small\">No orders are waiting for a rider.</p></div>";
      } else {
        dispatch.innerHTML = waitingOrders
          .map(function (order) {
            return (
              '<div class="dispatch-item">' +
                '<span class="icon-tile icon-tile-orange">' + icon("receipt") + "</span>" +
                "<div><strong>#" + order.id + " · " + escapeHtml(order.area) + "</strong><span>" + escapeHtml(order.customer) + " · " + money(orderTotal(order)) + (order.paid ? " · prepaid" : " · cash") + "</span></div>" +
                '<button class="btn btn-primary btn-sm" type="button" data-assign-order="' + order.id + '">Assign</button>' +
              "</div>"
            );
          })
          .join("");
      }
    }

    const fleet = document.getElementById("fleetGrid");
    if (fleet) {
      fleet.innerHTML = riders
        .map(function (rider) {
          const online = rider.status !== "Offline";
          const statusText = rider.status === "On delivery" ? "On delivery " + rider.order : rider.status;
          return (
            '<article class="rider-admin-card">' +
              '<div class="rider-admin-head">' +
                '<span class="avatar avatar-dark" aria-hidden="true">' + initials(rider.name) + "</span>" +
                "<div><strong>" + escapeHtml(rider.name) + "</strong><span>" + escapeHtml(rider.plate) + " · " + statusText + "</span></div>" +
                '<span class="badge ' + (rider.status === "On delivery" ? "badge-warning" : online ? "badge-success" : "badge-neutral") + '">' + icon(rider.status === "On delivery" ? "bike" : online ? "check-circle" : "cloud-off") + (online ? "Online" : "Offline") + "</span>" +
              "</div>" +
              '<div class="rider-admin-stats">' +
                '<div class="rider-admin-stat"><span>Deliveries</span><strong>' + rider.deliveries + '</strong></div>' +
                '<div class="rider-admin-stat"><span>Cash held</span><strong>' + money(rider.cash) + "</strong></div>" +
              "</div>" +
              '<div class="cluster cluster-3">' +
                '<button class="btn btn-secondary btn-sm" type="button" data-rider-call="' + escapeHtml(rider.name) + '">' + icon("phone") + "Call</button>" +
                '<button class="btn btn-ghost btn-sm" type="button" data-admin-view="reports">' + icon("banknote") + "Ledger</button>" +
              "</div>" +
            "</article>"
          );
        })
        .join("");
    }
  }

  /* ---------------------------------------------------------------------
     Reports
     --------------------------------------------------------------------- */
  const reportKpisData = {
    today: { revenue: 1284000, orders: "42", avg: 30571, completion: "96%" },
    week: { revenue: 8640000, orders: "186", avg: 46452, completion: "97%" },
    month: { revenue: 32400000, orders: "742", avg: 43666, completion: "95%" }
  };

  function renderReports() {
    const kpis = document.getElementById("reportKpis");
    const data = reportKpisData[reportPeriod] || reportKpisData.week;
    if (kpis) {
      kpis.innerHTML =
        kpiCard({ label: "Gross revenue", value: money(data.revenue), icon: "banknote", tile: "icon-tile-orange", sub: reportPeriod === "today" ? "Today" : reportPeriod === "month" ? "This month" : "This week", trend: "+12.4%" }) +
        kpiCard({ label: "Orders", value: data.orders, icon: "receipt", sub: "Completed orders", trend: "+8.2%" }) +
        kpiCard({ label: "Average order", value: money(data.avg), icon: "chart", sub: "Items + fees", trend: "+3.1%" }) +
        kpiCard({ label: "Completion rate", value: data.completion, icon: "check-circle", tile: "icon-tile-success", sub: "Delivered without incident", trend: "+0.8%" });
    }

    const top = document.getElementById("topItems");
    if (top) {
      const items = [
        { name: "Whole Tilapia Flame Combo", units: 38, revenue: 1216000 },
        { name: "Quarter Charcoal Grilled Chicken", units: 42, revenue: 756000 },
        { name: "Special Bazaar Rolex", units: 65, revenue: 520000 },
        { name: "Smoked Beef Luwombo", units: 18, revenue: 468000 },
        { name: "Cold-Pressed Passion Juice", units: 54, revenue: 270000 }
      ];
      top.innerHTML = items
        .map(function (item, index) {
          return (
            '<div class="top-item-row">' +
              '<span class="top-item-rank">' + (index + 1) + "</span>" +
              "<div><strong>" + escapeHtml(item.name) + "</strong><span>" + item.units + " sold</span></div>" +
              '<span class="mono">' + money(item.revenue) + "</span>" +
            "</div>"
          );
        })
        .join("");
    }

    const mix = document.getElementById("paymentMix");
    if (mix) {
      const methods = [
        { label: "MTN MoMo", value: 54, color: "#f28c28" },
        { label: "Airtel Money", value: 22, color: "#c62828" },
        { label: "Cash", value: 18, color: "#173f35" },
        { label: "Card", value: 6, color: "#a8b5b0" }
      ];
      mix.innerHTML = methods
        .map(function (method) {
          return (
            '<div class="mix-row">' +
              '<span class="mix-label"><i style="background:' + method.color + '"></i>' + method.label + "</span>" +
              '<div class="progress"><span style="width:' + method.value + "%;background:" + method.color + '"></span></div>' +
              '<span class="mono">' + method.value + "%</span>" +
            "</div>"
          );
        })
        .join("");
    }

    renderLedger();
    renderCharts();
  }

  function renderLedger() {
    const body = document.getElementById("ledgerBody");
    if (!body) return;
    body.innerHTML = riders
      .map(function (rider) {
        const cleared = rider.cash === 0;
        return (
          "<tr>" +
            "<td><strong>" + escapeHtml(rider.name) + "</strong>" +
              (rider.cashOrders ? '<span class="sub mono">' + escapeHtml(rider.cashOrders) + "</span>" : "") +
            "</td>" +
            '<td><span class="mono">' + escapeHtml(rider.plate) + "</span></td>" +
            '<td class="num">' + rider.deliveries + "</td>" +
            '<td class="num">' + money(rider.cash) + "</td>" +
            "<td>" + (cleared ? '<span class="badge badge-success">' + icon("check-circle") + "Cleared</span>" : '<span class="badge badge-warning">' + icon("banknote") + "Due</span>") + "</td>" +
            '<td><button class="btn ' + (cleared ? "btn-ghost" : "btn-secondary") + ' btn-sm" type="button" data-reconcile="' + escapeHtml(rider.name) + '"' + (cleared ? " disabled" : "") + ">" + (cleared ? "Cleared" : "Reconcile") + "</button></td>" +
          "</tr>"
        );
      })
      .join("");
  }

  /* ---------------------------------------------------------------------
     Rendering
     --------------------------------------------------------------------- */
  function renderAll() {
    renderOverviewKpis();
    renderCharts();
    renderPipeline();
    renderRecentOrders();
    renderLowStock();
    renderFleetSnapshot();
    renderOrders();
    renderInventory();
    renderMenuAdmin();
    renderDelivery();
    renderReports();
  }

  /* ---------------------------------------------------------------------
     Export
     --------------------------------------------------------------------- */
  function csvCell(value) {
    return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
  }

  function downloadCsv(filename, headers, rows) {
    const content = [headers.map(csvCell).join(",")]
      .concat(rows.map(function (row) { return row.map(csvCell).join(","); }))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast("Export downloaded: " + filename, "success");
  }

  function exportData(kind) {
    if (kind === "orders") {
      downloadCsv(
        "morouj-orders-" + new Date().toISOString().slice(0, 10) + ".csv",
        ["Order", "Customer", "Phone", "Area", "Address", "Status", "Payment", "Paid", "Rider", "Total UGX"],
        orders.map(function (order) {
          return [order.id, order.customer, order.phone, order.area, order.address, order.status, order.payment, order.paid ? "yes" : "no", order.rider || "unassigned", orderTotal(order)];
        })
      );
    } else if (kind === "reports") {
      downloadCsv(
        "morouj-report-" + reportPeriod + ".csv",
        ["Report", "Period", "Metric", "Value"],
        [
          ["Sales", reportPeriod, "Gross revenue UGX", (reportKpisData[reportPeriod] || reportKpisData.week).revenue],
          ["Sales", reportPeriod, "Orders", (reportKpisData[reportPeriod] || reportKpisData.week).orders],
          ["Sales", reportPeriod, "Average order UGX", (reportKpisData[reportPeriod] || reportKpisData.week).avg],
          ["Sales", reportPeriod, "Completion rate", (reportKpisData[reportPeriod] || reportKpisData.week).completion]
        ].concat(
          riders.map(function (rider) { return ["Cash ledger", "End of day", rider.name + " (" + rider.plate + ")", rider.cash]; })
        )
      );
    } else {
      downloadCsv(
        "morouj-overview.csv",
        ["Metric", "Value"],
        [
          ["Revenue today UGX", 1284000],
          ["Orders today", 42],
          ["Average prep time", "18 min"],
          ["Riders online", "4 of 5"],
          ["Active orders", activeOrders().length],
          ["Low stock items", lowStockItems().length]
        ]
      );
    }
  }

  /* ---------------------------------------------------------------------
     Events
     --------------------------------------------------------------------- */
  document.addEventListener("click", function (event) {
    const navButton = event.target.closest("[data-admin-view]");
    if (navButton) {
      event.preventDefault();
      setView(navButton.dataset.adminView);
      return;
    }

    const orderButton = event.target.closest("[data-order]");
    if (orderButton) {
      openOrder(orderButton.dataset.order);
      return;
    }

    const actionButton = event.target.closest("[data-order-action]");
    if (actionButton) {
      const order = orders.find(function (item) { return item.id === activeOrderId; });
      if (!order) return;
      const action = actionButton.dataset.orderAction;
      if (action === "cancel") {
        if (actionButton.dataset.confirm !== "true") {
          actionButton.dataset.confirm = "true";
          actionButton.textContent = "Tap again to cancel";
          actionButton.classList.add("btn-danger");
          window.setTimeout(function () {
            actionButton.dataset.confirm = "false";
            actionButton.textContent = "Cancel order";
          }, 4000);
          return;
        }
        order.status = "Cancelled";
        if (order.rider) {
          const rider = riders.find(function (item) { return item.name === order.rider; });
          if (rider) { rider.status = "Available"; rider.order = ""; }
        }
        toast("Order #" + order.id + " cancelled.", "error");
        renderAll();
        renderOrderDrawer();
        return;
      }
      if (action === "assign-selected") {
        const select = document.getElementById("assignRiderSelect");
        if (select && select.value) assignRider(order, select.value);
        return;
      }
      advanceOrder(order);
      return;
    }

    const saveButton = event.target.closest("[data-order-save]");
    if (saveButton) {
      const order = orders.find(function (item) { return item.id === activeOrderId; });
      if (!order) return;
      const name = document.getElementById("editOrderName");
      const phone = document.getElementById("editOrderPhone");
      const notes = document.getElementById("editOrderNotes");
      if (name) order.customer = name.value.trim() || order.customer;
      if (phone) order.phone = phone.value.trim() || order.phone;
      if (notes) order.notes = notes.value.trim();
      toast("Order #" + order.id + " synced to the rider screen.", "success");
      haptic([10]);
      renderAll();
      renderOrderDrawer();
      return;
    }

    const stockButton = event.target.closest("[data-stock-adjust]");
    if (stockButton) {
      const item = inventory.find(function (entry) { return entry.id === stockButton.dataset.stockAdjust; });
      if (!item) return;
      item.qty = Math.max(0, Math.min(item.par * 2, item.qty + Number(stockButton.dataset.delta)));
      item.updated = "now";
      renderInventory();
      renderDelivery();
      haptic([8]);
      return;
    }

    const assignButton = event.target.closest("[data-assign-order]");
    if (assignButton) {
      const order = orders.find(function (item) { return item.id === assignButton.dataset.assignOrder; });
      const rider = availableRiders()[0];
      if (!order) return;
      if (!rider) {
        toast("No available rider. Free a rider before dispatching.", "error");
        return;
      }
      assignRider(order, rider.name);
      return;
    }

    const toggle = event.target.closest("[data-menu-toggle]");
    if (toggle) {
      const item = menuItems.find(function (entry) { return entry.id === toggle.dataset.menuToggle; });
      if (!item) return;
      item.available = toggle.checked;
      renderMenuAdmin();
      toast(item.name + (item.available ? " is back on the menu." : " has been 86'd."), item.available ? "success" : "error");
      return;
    }

    const editMenu = event.target.closest("[data-menu-edit]");
    if (editMenu) {
      openMenuItemSheet(editMenu.dataset.menuEdit);
      return;
    }

    const reconcile = event.target.closest("[data-reconcile]");
    if (reconcile) {
      const rider = riders.find(function (item) { return item.name === reconcile.dataset.reconcile; });
      if (!rider || rider.cash === 0) return;
      const amount = rider.cash;
      rider.cash = 0;
      renderDelivery();
      renderReports();
      toast(rider.name + " reconciled · " + money(amount) + " added to the cash drawer.", "success");
      haptic([20, 50, 20]);
      return;
    }

    const riderCall = event.target.closest("[data-rider-call]");
    if (riderCall) {
      toast("Calling " + riderCall.dataset.riderCall + "…");
      return;
    }

    const exportButton = event.target.closest("[data-export]");
    if (exportButton) {
      exportData(exportButton.dataset.export);
      return;
    }
  });

  const orderSearch = document.getElementById("orderSearch");
  if (orderSearch) {
    orderSearch.addEventListener("input", window.MM.debounce(function () {
      orderQuery = orderSearch.value;
      renderOrders();
    }, 120));
  }

  const filters = document.getElementById("orderFilters");
  if (filters) {
    filters.addEventListener("click", function (event) {
      const button = event.target.closest("[data-order-filter]");
      if (!button) return;
      orderFilter = button.dataset.orderFilter;
      filters.querySelectorAll("button").forEach(function (item) {
        item.setAttribute("aria-pressed", item === button ? "true" : "false");
      });
      renderOrders();
    });
  }

  const refresh = document.getElementById("refreshOrders");
  if (refresh) {
    refresh.addEventListener("click", function () {
      setBusy(refresh, true, "Refreshing…");
      window.setTimeout(function () {
        setBusy(refresh, false);
        renderAll();
        toast("Orders refreshed · 6 orders loaded", "success");
      }, 700);
    });
  }

  const addMenu = document.getElementById("addMenuItem");
  if (addMenu) addMenu.addEventListener("click", function () { openMenuItemSheet(""); });

  const previewMenu = document.getElementById("previewMenu");
  if (previewMenu) {
    previewMenu.addEventListener("click", function () {
      window.open("customer.html#menu", "_blank", "noopener");
    });
  }

  const menuForm = document.getElementById("menuItemForm");
  if (menuForm) {
    menuForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const idField = document.getElementById("menuItemId");
      const name = document.getElementById("menuItemName");
      const category = document.getElementById("menuItemCategory");
      const price = document.getElementById("menuItemPrice");
      const desc = document.getElementById("menuItemDesc");
      const available = document.getElementById("menuItemAvailable");
      const error = document.getElementById("menuItemError");
      const nameValue = name ? name.value.trim() : "";
      const priceValue = price ? Number(price.value) : 0;
      if (nameValue.length < 2 || priceValue < 500) {
        if (error) error.hidden = false;
        if (name) name.setAttribute("aria-invalid", "true");
        if (price) price.setAttribute("aria-invalid", "true");
        return;
      }
      if (error) error.hidden = true;
      if (name) name.removeAttribute("aria-invalid");
      if (price) price.removeAttribute("aria-invalid");
      const editId = idField ? idField.value : "";
      if (editId) {
        const item = menuItems.find(function (entry) { return entry.id === editId; });
        if (item) {
          item.name = nameValue;
          item.category = category.value;
          item.price = priceValue;
          item.desc = desc.value.trim();
          item.available = available.checked;
        }
        toast("Dish updated on the storefront.", "success");
      } else {
        menuItems.unshift({
          id: "dish-" + Date.now(),
          name: nameValue,
          category: category.value,
          price: priceValue,
          desc: desc.value.trim(),
          available: available.checked,
          img: "assets/images/placeholder-dish.svg",
          prep: 20
        });
        toast("New dish added to the menu.", "success");
      }
      closeSheet(document.getElementById("menuItemSheet"));
      renderMenuAdmin();
      haptic([10]);
    });
  }

  const restockAll = document.getElementById("restockAll");
  if (restockAll) {
    restockAll.addEventListener("click", function () {
      const low = lowStockItems();
      low.forEach(function (item) { item.qty = item.par; item.updated = "now"; });
      renderInventory();
      renderDelivery();
      toast(low.length + " low-stock items restocked to par.", "success");
    });
  }

  const inventoryExport = document.getElementById("inventoryExport");
  if (inventoryExport) {
    inventoryExport.addEventListener("click", function () {
      downloadCsv(
        "morouj-inventory.csv",
        ["Item", "Category", "Quantity", "Par", "Unit", "Status", "Updated"],
        inventory.map(function (item) { return [item.name, item.category, item.qty, item.par, item.unit, stockState(item).label, item.updated]; })
      );
    });
  }

  const reportRange = document.getElementById("reportRange");
  if (reportRange) {
    reportRange.addEventListener("change", function () {
      reportPeriod = reportRange.value;
      renderReports();
      toast("Report period updated.", "success");
    });
  }

  const notify = document.getElementById("adminNotify");
  if (notify) {
    notify.addEventListener("click", function () {
      toast("3 new updates: 2 low-stock alerts, 1 new order in Kololo.");
    });
  }

  /* ---------------------------------------------------------------------
     Init
     --------------------------------------------------------------------- */
  renderAll();
  const hash = window.location.hash.replace("#", "");
  if (viewMeta[hash]) setView(hash);
})();

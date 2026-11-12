/* ==========================================================================
   CUSTOMER APP — menu, modifiers, basket, checkout, payment and tracking
   All data is local demo data. No network requests are made.
   ========================================================================== */

(function () {
  "use strict";

  const { money, icon, escapeHtml, toast, openSheet, closeSheet, haptic, storageGet, storageSet, debounce } = window.MM;

  const menu = [
    {
      id: "tilapia",
      name: "Whole Tilapia Flame Combo",
      category: "combos",
      price: 32000,
      desc: "Whole Lake Victoria tilapia, charcoal grilled and glazed with garlic, lime and chilli. Served with chips, matoke and a house dip.",
      img: "assets/images/grilled_tilapia.jpg",
      rating: 4.9,
      prep: 25,
      badge: "Bestseller",
      kcal: 480,
      serves: "Serves 1–2"
    },
    {
      id: "chicken",
      name: "Quarter Charcoal Grilled Chicken",
      category: "grills",
      price: 18000,
      desc: "Quarter chicken marinated in local herbs, garlic and ginger, finished over open charcoal. Served with kachumbari.",
      img: "assets/images/charcoal_grilled_chicken_1793348776274.jpg",
      rating: 4.7,
      prep: 20,
      badge: "Flame grilled",
      kcal: 410,
      serves: "Serves 1"
    },
    {
      id: "beef-luwombo",
      name: "Smoked Beef Luwombo",
      category: "luwombo",
      price: 26000,
      desc: "Traditional steamed beef wrapped in banana leaves with rich groundnut sauce, served with matoke.",
      img: "assets/images/placeholder-dish.svg",
      rating: 4.8,
      prep: 30,
      badge: "Slow steamed",
      kcal: 520,
      serves: "Serves 1–2"
    },
    {
      id: "chicken-luwombo",
      name: "Chicken Luwombo",
      category: "luwombo",
      price: 24000,
      desc: "Steamed chicken in groundnut sauce, wrapped in banana leaves and served with matoke.",
      img: "assets/images/placeholder-dish.svg",
      rating: 4.8,
      prep: 30,
      badge: "Traditional",
      kcal: 470,
      serves: "Serves 1",
      available: false
    },
    {
      id: "rolex",
      name: "Special Bazaar Rolex",
      category: "sides",
      price: 8000,
      desc: "Three-egg omelette with tomato and cabbage, rolled inside two warm handmade chapatis.",
      img: "assets/images/passion_juice_rolex.jpg",
      rating: 4.9,
      prep: 10,
      badge: "Kampala classic",
      kcal: 310,
      serves: "Serves 1"
    },
    {
      id: "chips",
      name: "Golden Chips",
      category: "sides",
      price: 6000,
      desc: "Crispy hand-cut potato chips with a light sprinkle of sea salt.",
      img: "assets/images/placeholder-dish.svg",
      rating: 4.6,
      prep: 12,
      badge: "",
      kcal: 280,
      serves: "Serves 1"
    },
    {
      id: "matoke",
      name: "Matoke & Groundnut",
      category: "sides",
      price: 15000,
      desc: "Steamed green banana in a rich, slow-cooked groundnut sauce.",
      img: "assets/images/placeholder-dish.svg",
      rating: 4.7,
      prep: 20,
      badge: "",
      kcal: 360,
      serves: "Serves 1",
      available: false
    },
    {
      id: "juice",
      name: "Cold-Pressed Passion Juice",
      category: "beverages",
      price: 5000,
      desc: "Fresh natural Masaka passion fruit juice, lightly sweetened and served chilled (500 ml).",
      img: "assets/images/passion_juice_rolex_1793348796512.jpg",
      rating: 4.9,
      prep: 5,
      badge: "Fresh today",
      kcal: 120,
      serves: "500 ml"
    },
    {
      id: "water",
      name: "Mineral Water",
      category: "beverages",
      price: 2000,
      desc: "Chilled bottled mineral water (500 ml).",
      img: "assets/images/placeholder-dish.svg",
      rating: 4.5,
      prep: 1,
      badge: "",
      kcal: 0,
      serves: "500 ml"
    },
    {
      id: "soda",
      name: "Soda",
      category: "beverages",
      price: 3000,
      desc: "Chilled bottled soda. Ask the rider for available flavours (300 ml).",
      img: "assets/images/placeholder-dish.svg",
      rating: 4.5,
      prep: 1,
      badge: "",
      kcal: 140,
      serves: "300 ml"
    },
    {
      id: "coffee",
      name: "African Coffee",
      category: "beverages",
      price: 4000,
      desc: "Freshly brewed Ugandan coffee, served hot.",
      img: "assets/images/placeholder-dish.svg",
      rating: 4.6,
      prep: 5,
      badge: "",
      kcal: 5,
      serves: "1 cup"
    },
    {
      id: "chapati",
      name: "Chapati",
      category: "sides",
      price: 1500,
      desc: "Soft handmade chapati, cooked to order.",
      img: "assets/images/placeholder-dish.svg",
      rating: 4.7,
      prep: 5,
      badge: "",
      kcal: 160,
      serves: "1 piece"
    }
  ];

  const addOnOptions = [
    { id: "garlic-dip", name: "Extra Garlic Pepper Dip", price: 2000 },
    { id: "chilli", name: "Extra Chilli Sauce", price: 1000 },
    { id: "groundnut", name: "Extra Groundnut Sauce", price: 1500 }
  ];

  const cookingStyles = ["Mild", "Medium", "Hot"];
  const omissions = ["No onions", "No salt", "No chilli", "No garlic"];

  const areas = {
    nakasero: { label: "Nakasero", distance: "1.562 km", fee: 0, packaging: 1000 },
    ntinda: { label: "Ntinda", distance: "8.093 km", fee: 6000, packaging: 1000 },
    table4: { label: "Dine-in · Table 4", distance: "0 km", fee: 0, packaging: 0 }
  };

  const paymentLabels = {
    mtn: "MTN Mobile Money",
    airtel: "Airtel Money",
    cod: "Cash on delivery",
    card: "Visa / Mastercard"
  };

  const RIDER_PHONE = "+256 772 100 201";
  const MOV_DELIVERY = 20000;

  const storeStates = {
    open: null,
    closed: {
      tone: "alert-danger",
      title: "We are closed",
      text: "Orders open at 09:00 EAT. You can browse the menu, but checkout is disabled."
    },
    paused: {
      tone: "alert-warning",
      title: "The kitchen has paused new orders",
      text: "Please try again in a few minutes. Existing orders are still being prepared."
    }
  };

  function readStoreState() {
    const fromUrl = new URLSearchParams(window.location.search).get("store");
    const value = (fromUrl || "open").toLowerCase();
    return storeStates[value] ? value : "open";
  }

  /* ---------------------------------------------------------------------
     State
     --------------------------------------------------------------------- */
  let cart = storageGet("mm_cart_v1", null);
  if (cart === null) {
    cart = [
      {
        key: "demo-tilapia",
        id: "tilapia",
        name: "Whole Tilapia Flame Combo",
        img: "assets/images/grilled_tilapia.jpg",
        basePrice: 32000,
        qty: 1,
        cooking: "Medium",
        omissions: ["No onions"],
        addons: [{ id: "garlic-dip", name: "Extra Garlic Pepper Dip", price: 2000 }],
        unitPrice: 34000
      }
    ];
    storageSet("mm_cart_v1", cart);
  }

  let activeCategory = "all";
  let searchQuery = "";
  let currentDish = null;
  let currentDishState = null;
  let selectedArea = storageGet("mm_area_v1", "nakasero");
  let selectedPayment = "mtn";
  let currentView = "browse";
  let order = storageGet("mm_order_v1", null);
  let orderStatus = 3;
  let rideFeedback = null;
  let storeState = readStoreState();

  const els = {
    grid: document.getElementById("dishGrid"),
    menuEmpty: document.getElementById("menuEmpty"),
    menuStatus: document.getElementById("menuStatus"),
    search: document.getElementById("menuSearch"),
    clearSearch: document.getElementById("clearSearch"),
    cartLines: document.getElementById("cartLines"),
    checkoutLines: document.getElementById("checkoutLines"),
    cartEmpty: document.getElementById("cartEmpty"),
    cartSummaryWrap: document.getElementById("cartSummaryWrap"),
    cartSheetSub: document.getElementById("cartSheetSub"),
    cartCheckoutBtn: document.getElementById("cartCheckoutBtn"),
    cartCount: document.getElementById("cartCount"),
    cartTrigger: document.querySelector(".cart-trigger"),
    cartDock: document.getElementById("cartDock"),
    dockCount: document.getElementById("dockCount"),
    dockTotal: document.getElementById("dockTotal"),
    cartSubtotal: document.getElementById("cartSubtotal"),
    cartTotal: document.getElementById("cartTotal"),
    summaryCount: document.getElementById("summaryCount"),
    summaryItems: document.getElementById("summaryItems"),
    summaryPackaging: document.getElementById("summaryPackaging"),
    summaryDistance: document.getElementById("summaryDistance"),
    summaryDelivery: document.getElementById("summaryDelivery"),
    summaryTotal: document.getElementById("summaryTotal"),
    placeOrderLabel: document.getElementById("placeOrderLabel"),
    placeOrderBtn: document.getElementById("placeOrderBtn"),
    checkoutForm: document.getElementById("checkoutForm"),
    checkoutErrors: document.getElementById("checkoutErrors"),
    checkoutErrorsText: document.getElementById("checkoutErrorsText"),
    storeStatusBanner: document.getElementById("storeStatusBanner"),
    storeStatusTitle: document.getElementById("storeStatusTitle"),
    storeStatusText: document.getElementById("storeStatusText"),
    movNote: document.getElementById("movNote"),
    movNoteText: document.getElementById("movNoteText"),
    cashChangeError: document.getElementById("cashChangeError"),
    addressField: document.getElementById("addressField"),
    customerName: document.getElementById("customerName"),
    customerPhone: document.getElementById("customerPhone"),
    customerAddress: document.getElementById("customerAddress"),
    customerNotes: document.getElementById("customerNotes"),
    cashChangeWrap: document.getElementById("cashChangeWrap"),
    dineInNote: document.getElementById("dineInNote"),
    paymentSheet: document.getElementById("paymentSheet"),
    paymentSheetSub: document.getElementById("paymentSheetSub"),
    payAmount: document.getElementById("payAmount"),
    processingAmount: document.getElementById("processingAmount"),
    paidAmount: document.getElementById("paidAmount"),
    confirmAmount: document.getElementById("confirmAmount"),
    paymentInitial: document.getElementById("paymentInitial"),
    paymentProcessing: document.getElementById("paymentProcessing"),
    paymentSuccess: document.getElementById("paymentSuccess"),
    paymentFoot: document.getElementById("paymentFoot"),
    paymentDoneFoot: document.getElementById("paymentDoneFoot"),
    confirmPayment: document.getElementById("confirmPayment"),
    trackPayment: document.getElementById("trackPayment"),
    paymentCancel: document.getElementById("paymentCancel"),
    paymentClose: document.getElementById("paymentClose"),
    dishSheet: document.getElementById("dishSheet"),
    dishSheetContent: document.getElementById("dishSheetContent"),
    trackMilestones: document.getElementById("trackMilestones"),
    trackTimeline: document.getElementById("trackTimeline"),
    trackEta: document.getElementById("etaValue"),
    etaSub: document.getElementById("etaSub"),
    trackStatusBadge: document.getElementById("trackStatusBadge"),
    trackTitle: document.getElementById("trackTitle"),
    trackSubtitle: document.getElementById("trackSubtitle"),
    trackRiderCard: document.getElementById("trackRiderCard"),
    trackMapCard: document.getElementById("trackMapCard"),
    trackPinCard: document.getElementById("trackPinCard"),
    trackDocket: document.getElementById("trackDocket"),
    docketLines: document.getElementById("docketLines"),
    docketTotals: document.getElementById("docketTotals"),
    deliveredCard: document.getElementById("deliveredCard")
  };

  /* ---------------------------------------------------------------------
     Helpers
     --------------------------------------------------------------------- */
  function cartQty() {
    return cart.reduce(function (sum, line) { return sum + line.qty; }, 0);
  }

  function subtotal() {
    return cart.reduce(function (sum, line) { return sum + line.unitPrice * line.qty; }, 0);
  }

  function totals() {
    const area = areas[selectedArea] || areas.nakasero;
    const sub = subtotal();
    const packaging = sub > 0 ? area.packaging : 0;
    const delivery = sub > 0 ? area.fee : 0;
    return { sub, packaging, delivery, total: sub + packaging + delivery, area };
  }

  function modsText(line) {
    const parts = [];
    if (line.cooking) parts.push(line.cooking);
    if (line.omissions && line.omissions.length) parts.push(line.omissions.join(", "));
    if (line.addons && line.addons.length) parts.push(line.addons.map(function (a) { return a.name; }).join(", "));
    return parts.join(" · ");
  }

  function isDishAvailable(dish) {
    return Boolean(dish) && dish.available !== false;
  }

  function cartSoldOutLines() {
    return cart.filter(function (line) {
      const dish = menu.find(function (item) { return item.id === line.id; });
      return dish && !isDishAvailable(dish);
    });
  }

  function movShortfall() {
    if (selectedArea === "table4") return 0;
    return Math.max(0, MOV_DELIVERY - subtotal());
  }

  function cashChangeTendered() {
    const select = document.getElementById("cashChange");
    if (!select || select.value === "exact") return totals().total;
    return Number(select.value) || 0;
  }

  function cashChangeInvalid() {
    return selectedPayment === "cod" && cashChangeTendered() < totals().total;
  }

  function canPlaceOrder() {
    return (
      cart.length > 0 &&
      storeState === "open" &&
      cartSoldOutLines().length === 0 &&
      movShortfall() === 0 &&
      !cashChangeInvalid()
    );
  }

  function renderStoreState() {
    const config = storeStates[storeState];
    document.body.dataset.storeState = storeState;
    if (!els.storeStatusBanner) return;
    els.storeStatusBanner.hidden = !config;
    if (!config) return;
    els.storeStatusBanner.className = "alert " + config.tone;
    if (els.storeStatusTitle) els.storeStatusTitle.textContent = config.title;
    if (els.storeStatusText) els.storeStatusText.textContent = config.text;
  }

  function renderCheckoutGuards() {
    const shortfall = movShortfall();
    if (els.movNote) {
      els.movNote.hidden = shortfall === 0;
      if (els.movNoteText) {
        els.movNoteText.textContent =
          "Add " + money(shortfall) + " more to reach the " + money(MOV_DELIVERY) + " delivery minimum. Dine-in has no minimum.";
      }
    }

    const invalidChange = cashChangeInvalid();
    if (els.cashChangeError) {
      els.cashChangeError.hidden = !invalidChange;
      if (invalidChange) {
        els.cashChangeError.querySelector("span").textContent =
          "Change for " + money(cashChangeTendered()) + " does not cover the " + money(totals().total) +
          " total. Choose exact cash or a higher amount.";
      }
    }

    if (els.placeOrderBtn) els.placeOrderBtn.disabled = !canPlaceOrder();
  }

  function saveCart() {
    storageSet("mm_cart_v1", cart);
    storageSet("mm_area_v1", selectedArea);
  }

  function lineMarkup(line) {
    const dish = menu.find(function (item) { return item.id === line.id; });
    const soldOut = dish && !isDishAvailable(dish);
    const mods = (modsText(line) || "Standard preparation") + (soldOut ? " · Sold out" : "");
    return (
      '<div class="cart-line' + (soldOut ? " is-sold-out" : "") + '" data-line="' + escapeHtml(line.key) + '">' +
        '<img class="cart-line-img" src="' + escapeHtml(line.img) + '" alt="" width="74" height="74" loading="lazy">' +
        '<div>' +
          '<div class="cart-line-head">' +
            '<div><div class="cart-line-name">' + escapeHtml(line.name) + "</div>" +
            '<div class="cart-line-mods">' + escapeHtml(mods) + "</div></div>" +
            '<button class="cart-line-remove" type="button" data-cart-remove="' + escapeHtml(line.key) + '" aria-label="Remove ' + escapeHtml(line.name) + '">' +
              icon("trash") +
            "</button>" +
          "</div>" +
          '<div class="cart-line-foot">' +
            '<div class="stepper" aria-label="Quantity for ' + escapeHtml(line.name) + '">' +
              '<button type="button" data-cart-dec="' + escapeHtml(line.key) + '" aria-label="Decrease quantity"' + (line.qty <= 1 ? " disabled" : "") + ">" + icon("minus") + "</button>" +
              '<span class="value">' + line.qty + "</span>" +
              '<button type="button" data-cart-inc="' + escapeHtml(line.key) + '" aria-label="Increase quantity">' + icon("plus") + "</button>" +
            "</div>" +
            '<span class="cart-line-price">' + money(line.unitPrice * line.qty) + "</span>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function renderCart() {
    const qty = cartQty();
    const t = totals();

    if (els.cartLines) els.cartLines.innerHTML = cart.map(lineMarkup).join("");
    if (els.checkoutLines) els.checkoutLines.innerHTML = cart.map(lineMarkup).join("");
    if (els.cartEmpty) els.cartEmpty.hidden = cart.length > 0;
    if (els.cartSummaryWrap) els.cartSummaryWrap.hidden = cart.length === 0;

    if (els.cartSheetSub) els.cartSheetSub.textContent = qty + (qty === 1 ? " item" : " items") + " · ready when you are";
    if (els.cartCheckoutBtn) els.cartCheckoutBtn.disabled = cart.length === 0 || storeState !== "open";
    if (els.cartCount) {
      els.cartCount.textContent = String(qty);
      els.cartCount.dataset.empty = qty === 0 ? "true" : "false";
    }
    if (els.cartTrigger) els.cartTrigger.setAttribute("aria-label", "Open cart, " + qty + (qty === 1 ? " item" : " items"));

    if (els.cartSubtotal) els.cartSubtotal.textContent = money(t.sub);
    if (els.cartTotal) els.cartTotal.textContent = money(t.total);

    if (els.cartDock) els.cartDock.hidden = cart.length === 0;
    document.body.classList.toggle("has-dock", cart.length > 0);
    if (els.dockCount) els.dockCount.textContent = qty + (qty === 1 ? " item" : " items");
    if (els.dockTotal) els.dockTotal.textContent = money(t.total) + " · " + t.area.label;

    if (els.summaryCount) els.summaryCount.textContent = String(qty);
    if (els.summaryItems) els.summaryItems.textContent = money(t.sub);
    if (els.summaryPackaging) els.summaryPackaging.textContent = t.packaging ? money(t.packaging) : "USh 0";
    if (els.summaryDistance) els.summaryDistance.textContent = t.area.distance;
    if (els.summaryDelivery) els.summaryDelivery.textContent = t.delivery ? money(t.delivery) : "Free";
    if (els.summaryTotal) els.summaryTotal.textContent = money(t.total);
    if (els.payAmount) els.payAmount.textContent = money(t.total);
    if (els.processingAmount) els.processingAmount.textContent = money(t.total);
    if (els.confirmAmount) els.confirmAmount.textContent = money(t.total);
    if (els.paidAmount) els.paidAmount.textContent = money(t.total);

    if (els.placeOrderLabel) {
      els.placeOrderLabel.textContent =
        selectedPayment === "cod"
          ? "Place cash order"
          : "Pay with " + (selectedPayment === "card" ? "card" : paymentLabels[selectedPayment]);
    }
    renderCheckoutGuards();
  }

  /* ---------------------------------------------------------------------
     Menu rendering
     --------------------------------------------------------------------- */
  function renderMenu() {
    if (!els.grid) return;
    const query = searchQuery.trim().toLowerCase();
    const filtered = menu.filter(function (dish) {
      const inCategory = activeCategory === "all" || dish.category === activeCategory;
      const inSearch =
        !query ||
        dish.name.toLowerCase().includes(query) ||
        dish.desc.toLowerCase().includes(query) ||
        dish.category.includes(query);
      return inCategory && inSearch;
    });

    els.grid.innerHTML = filtered
      .map(function (dish) {
        const available = isDishAvailable(dish);
        return (
          '<article class="dish-card' + (available ? "" : " is-sold-out") + '">' +
            '<div class="dish-card-media" data-dish="' + dish.id + '">' +
              '<img src="' + dish.img + '" alt="' + escapeHtml(dish.name) + '" width="640" height="400" loading="lazy">' +
              (available
                ? (dish.badge ? '<span class="badge">' + escapeHtml(dish.badge) + "</span>" : "")
                : '<span class="badge badge-danger">Sold out</span>') +
              '<span class="dish-rating">' + icon("star") + dish.rating.toFixed(1) + "</span>" +
            "</div>" +
            '<div class="dish-card-body">' +
              '<div class="dish-card-head"><div class="dish-name"><button type="button" data-dish="' + dish.id + '">' + escapeHtml(dish.name) + "</button></div></div>" +
              '<p class="dish-desc">' + escapeHtml(dish.desc) + "</p>" +
              '<div class="dish-meta"><span>' + icon("clock") + dish.prep + " min</span><span>" + icon("users") + escapeHtml(dish.serves) + "</span></div>" +
              '<div class="dish-card-foot">' +
                '<span class="dish-price">' + money(dish.price) + "</span>" +
                (available
                  ? '<button class="add-btn" type="button" data-add="' + dish.id + '" aria-label="Add ' + escapeHtml(dish.name) + ' to basket">' + icon("plus") + "</button>"
                  : '<button class="add-btn" type="button" disabled aria-label="' + escapeHtml(dish.name) + ' is sold out">' + icon("x-circle") + "</button>") +
              "</div>" +
            "</div>" +
          "</article>"
        );
      })
      .join("");

    if (els.menuEmpty) els.menuEmpty.hidden = filtered.length > 0;
    if (els.menuStatus) {
      els.menuStatus.textContent = filtered.length + (filtered.length === 1 ? " dish" : " dishes") + " shown";
    }
    if (els.clearSearch) els.clearSearch.hidden = !searchQuery;
  }

  function setCategory(category, button) {
    activeCategory = category;
    document.querySelectorAll("[data-category]").forEach(function (chip) {
      const active = chip === button;
      chip.classList.toggle("is-active", active);
      chip.classList.toggle("chip-orange", active);
      chip.setAttribute("aria-pressed", active ? "true" : "false");
    });
    renderMenu();
  }

  /* ---------------------------------------------------------------------
     Dish detail
     --------------------------------------------------------------------- */
  function openDish(id) {
    const dish = menu.find(function (item) { return item.id === id; });
    if (!dish) return;
    if (!isDishAvailable(dish)) {
      toast(dish.name + " is sold out today. Please choose another dish.", "error");
      haptic([20, 40, 20]);
      return;
    }
    currentDish = dish;
    currentDishState = {
      qty: 1,
      cooking: "Medium",
      omissions: new Set(),
      addons: new Set()
    };
    renderDishSheet();
    openSheet(els.dishSheet);
  }

  function dishUnitPrice() {
    if (!currentDish || !currentDishState) return 0;
    let total = currentDish.price;
    currentDishState.addons.forEach(function (id) {
      const addon = addOnOptions.find(function (item) { return item.id === id; });
      if (addon) total += addon.price;
    });
    return total;
  }

  function dishTotal() {
    return dishUnitPrice() * currentDishState.qty;
  }

  function renderDishSheet() {
    if (!currentDish || !currentDishState) return;
    const dish = currentDish;
    const state = currentDishState;
    els.dishSheetContent.innerHTML =
      '<div class="sheet-head">' +
        "<div><h2 id=\"dishSheetTitle\">" + escapeHtml(dish.name) + "</h2>" +
        '<p>' + icon("clock") + " " + dish.prep + " min · " + escapeHtml(dish.serves) + " · " + dish.kcal + " kcal</p></div>" +
        '<button class="icon-btn icon-btn-sm" type="button" data-close-sheet aria-label="Close dish details">' + icon("x") + "</button>" +
      "</div>" +
      '<div class="sheet-body stack stack-4">' +
        '<div style="position:relative;overflow:hidden;border-radius:16px;background:var(--gray-100)">' +
          '<img src="' + dish.img + '" alt="" width="640" height="360" style="width:100%;height:190px;object-fit:cover">' +
          '<span class="badge badge-solid-orange" style="position:absolute;top:12px;left:12px">' + icon("star") + dish.rating.toFixed(1) + " (" + (1200 + dish.prep * 7) + ")</span>" +
        "</div>" +
        '<div class="spread">' +
          "<div><div class=\"tiny muted\" style=\"font-weight:800;text-transform:uppercase;letter-spacing:.08em\">Base price</div>" +
          '<div class="mono" style="font-size:1.3rem;font-weight:800">' + money(dish.price) + "</div></div>" +
          '<div class="stepper" aria-label="Quantity">' +
            '<button type="button" data-dish-qty="-1" aria-label="Decrease quantity"' + (state.qty <= 1 ? " disabled" : "") + ">" + icon("minus") + "</button>" +
            '<span class="value" id="dishQty">' + state.qty + "</span>" +
            '<button type="button" data-dish-qty="1" aria-label="Increase quantity">' + icon("plus") + "</button>" +
          "</div>" +
        "</div>" +
        '<p class="small muted" style="line-height:1.6">' + escapeHtml(dish.desc) + "</p>" +
        '<div role="group" aria-labelledby="cookingLabel">' +
          '<div class="field-label" id="cookingLabel" style="margin-bottom:8px">Cooking style <span class="optional">Choose one</span></div>' +
          '<div class="cluster">' +
            cookingStyles.map(function (style) {
              return '<button class="chip" type="button" data-cooking="' + style + '" aria-pressed="' + (state.cooking === style ? "true" : "false") + '">' + style + "</button>";
            }).join("") +
          "</div>" +
        "</div>" +
        '<div role="group" aria-labelledby="omissionsLabel">' +
          '<div class="field-label" id="omissionsLabel" style="margin-bottom:8px">Free kitchen omissions <span class="optional">Optional</span></div>' +
          '<div class="cluster">' +
            omissions.map(function (item) {
              return '<button class="chip chip-check" type="button" data-omission="' + item + '" aria-pressed="' + (state.omissions.has(item) ? "true" : "false") + '"><span class="check-box">' + icon("check") + "</span>" + item + "</button>";
            }).join("") +
          "</div>" +
        "</div>" +
        '<div role="group" aria-labelledby="addonsLabel">' +
          '<div class="field-label" id="addonsLabel" style="margin-bottom:8px">Paid add-ons <span class="optional">Optional</span></div>' +
          '<div class="cluster">' +
            addOnOptions.map(function (addon) {
              return '<button class="chip chip-check" type="button" data-addon="' + addon.id + '" aria-pressed="' + (state.addons.has(addon.id) ? "true" : "false") + '"><span class="check-box">' + icon("check") + "</span>" + escapeHtml(addon.name) + ' <span class="mono">(+' + addon.price.toLocaleString() + ")</span></button>";
            }).join("") +
          "</div>" +
        "</div>" +
        '<div class="alert alert-info">' + icon("info") + "<div><strong>Allergy note</strong><span>Tell the kitchen in the checkout notes if you have a severe allergy. We handle nuts, dairy and gluten in the same kitchen.</span></div></div>" +
      "</div>" +
      '<div class="sheet-foot">' +
        '<div style="flex:1"><div class="tiny muted">Total</div><div class="mono" id="dishTotal" style="font-size:1.35rem;font-weight:800">' + money(dishTotal()) + "</div></div>" +
        '<button class="btn btn-primary btn-lg" type="button" id="addDishBtn" data-autofocus>Add ' + state.qty + " to basket</button>" +
      "</div>";
  }

  function updateDishSheet() {
    if (!currentDish || !currentDishState) return;
    els.dishSheetContent.querySelectorAll("[data-cooking]").forEach(function (button) {
      button.setAttribute("aria-pressed", button.dataset.cooking === currentDishState.cooking ? "true" : "false");
    });
    els.dishSheetContent.querySelectorAll("[data-omission]").forEach(function (button) {
      button.setAttribute("aria-pressed", currentDishState.omissions.has(button.dataset.omission) ? "true" : "false");
    });
    els.dishSheetContent.querySelectorAll("[data-addon]").forEach(function (button) {
      button.setAttribute("aria-pressed", currentDishState.addons.has(button.dataset.addon) ? "true" : "false");
    });
    const qtyEl = document.getElementById("dishQty");
    if (qtyEl) qtyEl.textContent = String(currentDishState.qty);
    const totalEl = document.getElementById("dishTotal");
    if (totalEl) totalEl.textContent = money(dishTotal());
    const addBtn = document.getElementById("addDishBtn");
    if (addBtn) addBtn.textContent = "Add " + currentDishState.qty + " to basket";
    els.dishSheetContent.querySelectorAll("[data-dish-qty]").forEach(function (button) {
      if (button.dataset.dishQty === "-1") button.disabled = currentDishState.qty <= 1;
    });
  }

  function addDishToCart() {
    if (!currentDish || !currentDishState) return;
    if (!isDishAvailable(currentDish)) {
      toast(currentDish.name + " just sold out. Remove it from the basket and choose another dish.", "error");
      haptic([30, 60, 30]);
      return;
    }
    const addons = Array.from(currentDishState.addons).map(function (id) {
      return addOnOptions.find(function (item) { return item.id === id; });
    }).filter(Boolean);
    const key = currentDish.id + "-" + Date.now() + "-" + Math.floor(Math.random() * 999);
    cart.push({
      key,
      id: currentDish.id,
      name: currentDish.name,
      img: currentDish.img,
      basePrice: currentDish.price,
      qty: currentDishState.qty,
      cooking: currentDishState.cooking,
      omissions: Array.from(currentDishState.omissions),
      addons,
      unitPrice: dishUnitPrice()
    });
    saveCart();
    renderCart();
    closeSheet(els.dishSheet);
    haptic([20, 50, 20]);
    toast(currentDish.name + " added to your basket", "success");
  }

  function quickAdd(id) {
    const dish = menu.find(function (item) { return item.id === id; });
    if (!dish) return;
    if (!isDishAvailable(dish)) {
      toast(dish.name + " is sold out today. Please choose another dish.", "error");
      haptic([20, 40, 20]);
      return;
    }
    const existing = cart.find(function (line) {
      return line.id === id && (!line.addons || line.addons.length === 0) && (!line.omissions || line.omissions.length === 0) && line.cooking === "Medium";
    });
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({
        key: id + "-" + Date.now(),
        id,
        name: dish.name,
        img: dish.img,
        basePrice: dish.price,
        qty: 1,
        cooking: "Medium",
        omissions: [],
        addons: [],
        unitPrice: dish.price
      });
    }
    saveCart();
    renderCart();
    haptic([12]);
    toast(dish.name + " added", "success");
  }

  /* ---------------------------------------------------------------------
     Cart events
     --------------------------------------------------------------------- */
  function findLine(key) {
    return cart.find(function (line) { return line.key === key; });
  }

  document.addEventListener("click", function (event) {
    const storeButton = event.target.closest("[data-store-state]");
    if (storeButton) {
      event.preventDefault();
      setStoreState(storeButton.dataset.storeState);
      return;
    }

    const addButton = event.target.closest("[data-add]");
    if (addButton) {
      event.preventDefault();
      quickAdd(addButton.dataset.add);
      return;
    }

    const dishButton = event.target.closest("[data-dish]");
    if (dishButton) {
      event.preventDefault();
      openDish(dishButton.dataset.dish);
      return;
    }

    const categoryButton = event.target.closest("[data-category]");
    if (categoryButton) {
      setCategory(categoryButton.dataset.category, categoryButton);
      return;
    }

    const cartButton = event.target.closest("[data-cart-inc], [data-cart-dec], [data-cart-remove]");
    if (cartButton) {
      const key = cartButton.dataset.cartInc || cartButton.dataset.cartDec || cartButton.dataset.cartRemove;
      const line = findLine(key);
      if (!line) return;
      if (cartButton.dataset.cartInc) line.qty += 1;
      if (cartButton.dataset.cartDec) line.qty = Math.max(1, line.qty - 1);
      if (cartButton.dataset.cartRemove) {
        cart = cart.filter(function (item) { return item.key !== key; });
        toast(line.name + " removed");
      }
      saveCart();
      renderCart();
      haptic([10]);
      return;
    }

    const viewButton = event.target.closest("[data-show-view]");
    if (viewButton) {
      event.preventDefault();
      document.querySelectorAll("dialog[open]").forEach(closeSheet);
      showView(viewButton.dataset.showView);
      return;
    }

    const scrollMenuButton = event.target.closest("[data-scroll-menu]");
    if (scrollMenuButton) {
      event.preventDefault();
      document.querySelectorAll("dialog[open]").forEach(closeSheet);
      showView("browse");
      window.setTimeout(function () {
        const target = document.getElementById("menu");
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 40);
      return;
    }

    if (event.target.closest("#addDishBtn")) {
      addDishToCart();
      return;
    }

    const qtyButton = event.target.closest("[data-dish-qty]");
    if (qtyButton) {
      currentDishState.qty = Math.max(1, currentDishState.qty + Number(qtyButton.dataset.dishQty));
      updateDishSheet();
      haptic([8]);
      return;
    }

    const cookingButton = event.target.closest("[data-cooking]");
    if (cookingButton) {
      currentDishState.cooking = cookingButton.dataset.cooking;
      updateDishSheet();
      return;
    }

    const omissionButton = event.target.closest("[data-omission]");
    if (omissionButton) {
      const value = omissionButton.dataset.omission;
      if (currentDishState.omissions.has(value)) currentDishState.omissions.delete(value);
      else currentDishState.omissions.add(value);
      updateDishSheet();
      return;
    }

    const addonButton = event.target.closest("[data-addon]");
    if (addonButton) {
      const value = addonButton.dataset.addon;
      if (currentDishState.addons.has(value)) currentDishState.addons.delete(value);
      else currentDishState.addons.add(value);
      updateDishSheet();
    }
  });

  /* ---------------------------------------------------------------------
     Search
     --------------------------------------------------------------------- */
  if (els.search) {
    els.search.addEventListener(
      "input",
      debounce(function () {
        searchQuery = els.search.value;
        renderMenu();
      }, 100)
    );
  }

  if (els.clearSearch) {
    els.clearSearch.addEventListener("click", function () {
      searchQuery = "";
      if (els.search) els.search.value = "";
      renderMenu();
      if (els.search) els.search.focus();
    });
  }

  const resetSearch = document.getElementById("resetSearch");
  if (resetSearch) {
    resetSearch.addEventListener("click", function () {
      searchQuery = "";
      if (els.search) els.search.value = "";
      const all = document.querySelector("[data-category='all']");
      if (all) setCategory("all", all);
      else renderMenu();
    });
  }

  /* ---------------------------------------------------------------------
     Checkout
     --------------------------------------------------------------------- */
  function setArea(area) {
    selectedArea = area;
    storageSet("mm_area_v1", area);
    document.querySelectorAll("input[name='area']").forEach(function (input) {
      input.checked = input.value === area;
    });
    const dineIn = area === "table4";
    if (els.addressField) els.addressField.hidden = dineIn;
    if (els.customerAddress) els.customerAddress.required = !dineIn;
    if (els.dineInNote) els.dineInNote.hidden = !dineIn;
    renderCart();
  }

  function setPayment(method) {
    selectedPayment = method;
    if (els.cashChangeWrap) els.cashChangeWrap.hidden = method !== "cod";
    renderCart();
  }

  function setStoreState(next) {
    if (!storeStates[next]) return;
    storeState = next;
    renderStoreState();
    renderCart();
    if (storeState !== "open" && currentView === "checkout") showView("browse");
    toast(
      storeState === "open"
        ? "Store open. Checkout is available."
        : storeStates[storeState].title + ". Checkout is disabled.",
      storeState === "open" ? "success" : "error"
    );
  }

  document.querySelectorAll("input[name='area']").forEach(function (input) {
    input.addEventListener("change", function () { setArea(input.value); });
  });

  document.querySelectorAll("input[name='payment']").forEach(function (input) {
    input.addEventListener("change", function () { setPayment(input.value); });
  });

  const cashChangeSelect = document.getElementById("cashChange");
  if (cashChangeSelect) {
    cashChangeSelect.addEventListener("change", renderCart);
  }

  function clearFieldError(input, errorId) {
    if (!input) return;
    input.removeAttribute("aria-invalid");
    const error = document.getElementById(errorId);
    if (error) error.hidden = true;
  }

  [["customerName", "nameError"], ["customerPhone", "phoneError"], ["customerAddress", "addressError"]].forEach(function (pair) {
    const input = document.getElementById(pair[0]);
    if (input) input.addEventListener("input", function () { clearFieldError(input, pair[1]); });
  });

  function validateCheckout() {
    const errors = [];
    const name = els.customerName ? els.customerName.value.trim() : "";
    const phoneRaw = els.customerPhone ? els.customerPhone.value.trim() : "";
    const phone = phoneRaw.replace(/[\s()-]/g, "");
    const address = els.customerAddress ? els.customerAddress.value.trim() : "";
    const dineIn = selectedArea === "table4";

    clearFieldError(els.customerName, "nameError");
    clearFieldError(els.customerPhone, "phoneError");
    clearFieldError(els.customerAddress, "addressError");

    if (name.length < 2) {
      errors.push("Enter the name the rider should ask for.");
      if (els.customerName) {
        els.customerName.setAttribute("aria-invalid", "true");
        const error = document.getElementById("nameError");
        if (error) error.hidden = false;
      }
    }
    if (!/^(?:\+?256|0)7\d{8}$/.test(phone)) {
      errors.push("Enter a valid Ugandan mobile number, e.g. +256 772 000 111.");
      if (els.customerPhone) {
        els.customerPhone.setAttribute("aria-invalid", "true");
        const error = document.getElementById("phoneError");
        if (error) error.hidden = false;
      }
    }
    if (!dineIn && address.length < 4) {
      errors.push("Add a building, plot or landmark for the rider.");
      if (els.customerAddress) {
        els.customerAddress.setAttribute("aria-invalid", "true");
        const error = document.getElementById("addressError");
        if (error) error.hidden = false;
      }
    }

    if (storeState !== "open") {
      errors.push(storeStates[storeState].title + ". " + storeStates[storeState].text);
    }

    const soldOut = cartSoldOutLines();
    if (soldOut.length) {
      errors.push(
        soldOut.map(function (line) { return line.name; }).join(", ") +
        " is sold out. Remove it from the basket before checking out."
      );
    }

    const shortfall = movShortfall();
    if (shortfall > 0) {
      errors.push(
        "Add " + money(shortfall) + " more to reach the " + money(MOV_DELIVERY) +
        " delivery minimum. Dine-in has no minimum."
      );
    }

    if (cashChangeInvalid()) {
      errors.push(
        "Change for " + money(cashChangeTendered()) + " does not cover the " + money(totals().total) +
        " total. Choose exact cash or a higher amount."
      );
    }

    if (errors.length) {
      if (els.checkoutErrorsText) els.checkoutErrorsText.textContent = errors.join(" ");
      if (els.checkoutErrors) {
        els.checkoutErrors.hidden = false;
        els.checkoutErrors.focus();
      }
      haptic([60, 40, 60]);
      const firstInvalid = document.querySelector("[aria-invalid='true']");
      if (firstInvalid) firstInvalid.focus();
      return false;
    }

    if (els.checkoutErrors) els.checkoutErrors.hidden = true;
    return true;
  }

  function openPayment() {
    if (!cart.length) {
      toast("Your basket is empty. Add a dish first.", "error");
      showView("browse");
      return;
    }
    if (storeState !== "open") {
      toast(storeStates[storeState].title + ". Checkout is disabled.", "error");
      return;
    }
    if (!validateCheckout()) return;

    const t = totals();
    if (els.paymentSheetSub) {
      els.paymentSheetSub.textContent = paymentLabels[selectedPayment] + " · " + (selectedPayment === "cod" ? "pay the rider at handover" : "secure request");
    }
    if (els.payAmount) els.payAmount.textContent = money(t.total);
    if (els.processingAmount) els.processingAmount.textContent = money(t.total);
    if (els.confirmAmount) els.confirmAmount.textContent = money(t.total);
    if (els.paidAmount) els.paidAmount.textContent = money(t.total);
    if (els.confirmPayment) {
      els.confirmPayment.firstChild.textContent =
        selectedPayment === "cod" ? "Place order " : "Pay ";
    }
    if (els.paymentInitial) els.paymentInitial.hidden = false;
    if (els.paymentProcessing) els.paymentProcessing.hidden = true;
    if (els.paymentSuccess) els.paymentSuccess.hidden = true;
    if (els.paymentFoot) els.paymentFoot.hidden = false;
    if (els.paymentDoneFoot) els.paymentDoneFoot.hidden = true;
    if (els.paymentCancel) els.paymentCancel.disabled = false;
    if (els.paymentClose) els.paymentClose.disabled = false;
    openSheet(els.paymentSheet);
  }

  if (els.checkoutForm) {
    els.checkoutForm.addEventListener("submit", function (event) {
      event.preventDefault();
      openPayment();
    });
  }

  let processingTimer = null;

  if (els.confirmPayment) {
    els.confirmPayment.addEventListener("click", function () {
      if (els.confirmPayment.getAttribute("aria-disabled") === "true") return;
      if (els.paymentInitial) els.paymentInitial.hidden = true;
      if (els.paymentProcessing) els.paymentProcessing.hidden = false;
      if (els.paymentFoot) els.paymentFoot.hidden = true;
      if (els.paymentCancel) els.paymentCancel.disabled = true;
      if (els.paymentClose) els.paymentClose.disabled = true;
      els.confirmPayment.setAttribute("aria-busy", "true");
      haptic([15]);

      processingTimer = window.setTimeout(function () {
        if (els.paymentProcessing) els.paymentProcessing.hidden = true;
        if (els.paymentSuccess) els.paymentSuccess.hidden = false;
        if (els.paymentDoneFoot) els.paymentDoneFoot.hidden = false;
        if (els.paymentClose) els.paymentClose.disabled = false;
        els.confirmPayment.removeAttribute("aria-busy");

        const successTitle = els.paymentSuccess.querySelector("h3");
        const successCopy = els.paymentSuccess.querySelector("p");
        if (selectedPayment === "cod") {
          if (successTitle) successTitle.textContent = "Order confirmed";
          if (successCopy) successCopy.textContent = "Keep " + money(totals().total) + " ready for the rider. You can track the kitchen and rider from here.";
        } else {
          if (successTitle) successTitle.textContent = "Payment confirmed";
          if (successCopy) successCopy.textContent = "Your order is with the kitchen. We will update the tracker as each step is completed.";
        }
        haptic([20, 50, 20]);
        createOrder();
      }, 1600);
    });
  }

  if (els.paymentCancel) {
    els.paymentCancel.addEventListener("click", function () {
      if (processingTimer) window.clearTimeout(processingTimer);
      closeSheet(els.paymentSheet);
    });
  }

  if (els.trackPayment) {
    els.trackPayment.addEventListener("click", function () {
      closeSheet(els.paymentSheet);
      showView("track");
    });
  }

  function createOrder() {
    const t = totals();
    const id = String(1042 + Math.floor(Math.random() * 8));
    const notes = els.customerNotes ? els.customerNotes.value.trim() : "";
    order = {
      id,
      pin: "4821",
      customer: els.customerName ? els.customerName.value.trim() : "Sarah Namukasa",
      phone: els.customerPhone ? els.customerPhone.value.trim() : "+256 772 000 111",
      area: selectedArea,
      areaLabel: t.area.label,
      address: selectedArea === "table4" ? "Table 4, Bazaar Flame & Grill" : (els.customerAddress ? els.customerAddress.value.trim() : "Plot 14 Lumumba Avenue"),
      notes,
      distance: t.area.distance,
      items: cart.map(function (line) {
        return {
          name: line.name,
          qty: line.qty,
          price: line.unitPrice,
          mods: modsText(line)
        };
      }),
      subtotal: t.sub,
      packaging: t.packaging,
      delivery: t.delivery,
      total: t.total,
      payment: selectedPayment,
      paymentLabel: paymentLabels[selectedPayment],
      cashChange: selectedPayment === "cod" && document.getElementById("cashChange") ? document.getElementById("cashChange").value : null,
      placedAt: new Date()
    };
    orderStatus = 2;
    storageSet("mm_order_v1", order);
    renderTracking();
  }

  /* ---------------------------------------------------------------------
     Tracking
     --------------------------------------------------------------------- */
  const deliverySteps = [
    { label: "Received", icon: "receipt", title: "Order received", sub: "Payment confirmed" },
    { label: "Confirmed", icon: "check-circle", title: "Kitchen confirmed", sub: "Chef Moses started your grill" },
    { label: "Cooking", icon: "flame", title: "Packed and sealed", sub: "Safety seal applied" },
    { label: "On the way", icon: "bike", title: "On the way", sub: "Juma picked up your order" },
    { label: "Delivered", icon: "home", title: "Delivered", sub: "Share your PIN after checking the seal" }
  ];

  const dineInSteps = [
    { label: "Received", icon: "receipt", title: "Order received", sub: "Payment confirmed" },
    { label: "Confirmed", icon: "check-circle", title: "Kitchen confirmed", sub: "Your order is in the queue" },
    { label: "Cooking", icon: "flame", title: "Cooking", sub: "Chef Moses is preparing your food" },
    { label: "Ready", icon: "utensils", title: "Ready to serve", sub: "A server is bringing it to your table" },
    { label: "Served", icon: "home", title: "Served", sub: "Enjoy your meal at Table 4" }
  ];

  function getOrder() {
    if (order) return order;
    return {
      id: "1042",
      pin: "4821",
      customer: "Sarah Namukasa",
      phone: "+256 772 000 111",
      area: "nakasero",
      areaLabel: "Nakasero",
      address: "Plot 14 Lumumba Avenue, Nakasero",
      notes: "Gate code 1234 · Call when at the gate",
      distance: "1.562 km",
      items: [
        { name: "Whole Tilapia Flame Combo", qty: 1, price: 34000, mods: "Medium · No onions · Extra Garlic Pepper Dip" }
      ],
      subtotal: 34000,
      packaging: 1000,
      delivery: 0,
      total: 35000,
      payment: "mtn",
      paymentLabel: "MTN Mobile Money",
      placedAt: new Date()
    };
  }

  function renderTracking() {
    const current = getOrder();
    const dineIn = current.area === "table4";
    const steps = dineIn ? dineInSteps : deliverySteps;
    orderStatus = Math.max(0, Math.min(orderStatus, steps.length - 1));

    if (els.trackTitle) els.trackTitle.textContent = "Order #" + current.id;
    if (els.trackSubtitle) {
      els.trackSubtitle.textContent =
        (dineIn ? "Dine-in · Table 4" : "Delivery to " + current.areaLabel) +
        " · " + current.paymentLabel + (current.payment === "cod" ? " · pay on delivery" : " · paid");
    }

    if (els.trackMilestones) {
      els.trackMilestones.innerHTML = steps.map(function (step, index) {
        const state = index < orderStatus ? "is-done" : index === orderStatus ? "is-current" : "";
        const glyph = index < orderStatus ? "check" : step.icon;
        return (
          '<div class="milestone ' + state + '">' +
            '<span class="milestone-dot">' + icon(glyph) + "</span>" +
            "<span>" + step.label + "</span>" +
          "</div>"
        );
      }).join("");
    }

    if (els.trackTimeline) {
      els.trackTimeline.innerHTML = steps.map(function (step, index) {
        const state = index < orderStatus ? "is-done" : index === orderStatus ? "is-current" : "";
        const glyph = index < orderStatus ? "check" : step.icon;
        return (
          '<div class="timeline-step ' + state + '">' +
            '<span class="timeline-dot">' + icon(glyph) + "</span>" +
            '<div><div class="timeline-title">' + step.title + '</div><div class="timeline-sub">' + step.sub + "</div></div>" +
          "</div>"
        );
      }).join("");
    }

    const statusLabels = dineIn
      ? ["Received", "Confirmed", "Cooking", "Ready to serve", "Served"]
      : ["Received", "Confirmed", "Cooking", "On the way", "Delivered"];
    const statusIcons = dineIn
      ? ["receipt", "check-circle", "flame", "utensils", "home"]
      : ["receipt", "check-circle", "flame", "bike", "home"];
    const badgeClass =
      orderStatus >= 4 ? "badge-success" : orderStatus === 3 ? "badge-warning" : "badge-info";
    if (els.trackStatusBadge) {
      els.trackStatusBadge.className = "badge " + badgeClass + " badge-lg";
      els.trackStatusBadge.innerHTML = icon(statusIcons[orderStatus]) + statusLabels[orderStatus];
    }

    if (els.trackEta) {
      if (orderStatus >= 4) els.trackEta.textContent = dineIn ? "Served" : "Delivered";
      else if (orderStatus === 3) els.trackEta.textContent = dineIn ? "5–8 min" : "13:15 EAT";
      else els.trackEta.textContent = dineIn ? "12–18 min" : "13:15 EAT";
    }
    if (els.etaSub) {
      if (orderStatus >= 4) els.etaSub.textContent = dineIn ? "Enjoy your meal at Table 4" : "Handed over with PIN · Thank you";
      else if (orderStatus === 3) els.etaSub.textContent = dineIn ? "A server is bringing your food" : "18 minutes remaining · 1.2 km away";
      else els.etaSub.textContent = "The kitchen is preparing your order";
    }

    if (els.trackRiderCard) els.trackRiderCard.hidden = dineIn || orderStatus < 3 || orderStatus >= 4;
    if (els.trackMapCard) els.trackMapCard.hidden = dineIn || orderStatus >= 4;
    if (els.trackPinCard) els.trackPinCard.hidden = dineIn || orderStatus >= 4;
    if (els.deliveredCard) els.deliveredCard.hidden = orderStatus < 4;

    if (els.docketLines) {
      els.docketLines.innerHTML = current.items
        .map(function (item) {
          const lineTotal = item.price * item.qty;
          return (
            '<div class="docket-line">' +
              '<span class="qty">' + item.qty + "×</span>" +
              '<span class="name">' + escapeHtml(item.name) + "</span>" +
              '<span class="price">' + money(lineTotal) + "</span>" +
              (item.mods ? '<div class="docket-mod">' + escapeHtml(item.mods) + "</div>" : "") +
            "</div>"
          );
        })
        .join("");
    }
    if (els.docketTotals) {
      els.docketTotals.innerHTML =
        '<div class="row"><span>Subtotal</span><span>' + money(current.subtotal) + "</span></div>" +
        '<div class="row"><span>Packaging</span><span>' + money(current.packaging) + "</span></div>" +
        '<div class="row"><span>Delivery (' + escapeHtml(current.distance) + ")</span><span>" + (current.delivery ? money(current.delivery) : "USh 0") + "</span></div>" +
        '<div class="row total"><span>Total ' + (current.payment === "cod" ? "due" : "paid") + "</span><span>" + money(current.total) + "</span></div>";
    }
    const docketStatus = els.trackDocket ? els.trackDocket.querySelector(".docket-status") : null;
    if (docketStatus) {
      docketStatus.innerHTML =
        icon(current.payment === "cod" ? "banknote" : "check-circle") +
        (current.payment === "cod" ? "Cash on delivery · " + money(current.total) : "Paid via " + current.paymentLabel);
    }
  }

  const advance = document.getElementById("advanceStatus");
  if (advance) {
    advance.addEventListener("click", function () {
      const steps = order && order.area === "table4" ? dineInSteps : deliverySteps;
      if (orderStatus < steps.length - 1) {
        orderStatus += 1;
        renderTracking();
        haptic([12]);
        toast("Order status updated to “" + steps[orderStatus].label + "”", "success");
        if (orderStatus === 4) {
          document.getElementById("trackTitle").focus?.();
          toast("Order complete. Please rate your meal.", "success");
        }
      } else {
        toast("This order is already complete.");
      }
    });
  }

  const reset = document.getElementById("resetStatus");
  if (reset) {
    reset.addEventListener("click", function () {
      orderStatus = 3;
      renderTracking();
      toast("Demo order reset to “On the way”");
    });
  }

  const copyPin = document.getElementById("copyPin");
  if (copyPin) {
    copyPin.addEventListener("click", function () {
      const current = getOrder();
      window.MM.copyText(current.pin, "Handover PIN copied");
    });
  }

  const copyOrderLink = document.getElementById("copyOrderLink");
  if (copyOrderLink) {
    copyOrderLink.addEventListener("click", function () {
      window.MM.copyText(window.location.href, "Order link copied");
    });
  }

  const callRider = document.getElementById("callRider");
  if (callRider) {
    callRider.addEventListener("click", function () {
      toast("Calling Rider Juma on " + RIDER_PHONE + "…");
      haptic([10]);
    });
  }

  const messageRider = document.getElementById("messageRider");
  if (messageRider) {
    messageRider.addEventListener("click", function () {
      toast("Opening a message to Rider Juma…");
    });
  }

  const helpOrder = document.getElementById("helpOrder");
  if (helpOrder) {
    helpOrder.addEventListener("click", function () {
      toast("Opening the kitchen concierge on WhatsApp…");
    });
  }

  const centerMap = document.getElementById("centerMap");
  if (centerMap) {
    centerMap.addEventListener("click", function () {
      toast("Centred on Rider Juma · 1.2 km from your gate");
    });
  }

  document.querySelectorAll("[data-rating]").forEach(function (button) {
    button.addEventListener("click", function () {
      rideFeedback = button.dataset.rating;
      document.querySelectorAll("[data-rating]").forEach(function (item) {
        item.setAttribute("aria-pressed", item === button ? "true" : "false");
      });
    });
  });

  const submitFeedback = document.getElementById("submitFeedback");
  if (submitFeedback) {
    submitFeedback.addEventListener("click", function () {
      if (!rideFeedback) {
        toast("Choose a rating first.", "error");
        return;
      }
      toast("Thank you — your feedback was sent to the manager.", "success");
      haptic([20, 50, 20]);
    });
  }

  /* ---------------------------------------------------------------------
     Dine-in
     --------------------------------------------------------------------- */
  const startDineIn = document.getElementById("startDineIn");
  if (startDineIn) {
    startDineIn.addEventListener("click", function () {
      const table = document.getElementById("tableNumber");
      const number = table ? table.value : "4";
      setArea("table4");
      closeSheet(document.getElementById("dineInSheet"));
      const label = "Table " + number;
      document.querySelectorAll("input[name='area']").forEach(function (input) {
        if (input.value === "table4") input.checked = true;
      });
      const areaOption = document.querySelector("input[name='area'][value='table4']")?.closest(".area-option");
      if (areaOption) {
        const strong = areaOption.querySelector("strong");
        if (strong) strong.textContent = "Dine-in · " + label;
      }
      toast(label + " selected. No delivery fee.", "success");
      if (cart.length) showView("checkout");
      else {
        showView("browse");
        window.setTimeout(function () {
          document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
        }, 60);
      }
    });
  }

  /* ---------------------------------------------------------------------
     View switching
     --------------------------------------------------------------------- */
  function showView(name) {
    const views = {
      browse: document.getElementById("browseView"),
      checkout: document.getElementById("checkoutView"),
      track: document.getElementById("trackView")
    };
    if (!views[name]) return;

    if (name === "checkout" && cart.length === 0) {
      toast("Your basket is empty. Add a dish first.", "error");
      name = "browse";
    }
    if (name === "checkout" && storeState !== "open") {
      toast(storeStates[storeState].title + ". Checkout is disabled.", "error");
      name = "browse";
    }

    Object.keys(views).forEach(function (key) {
      views[key].classList.toggle("is-active", key === name);
    });
    currentView = name;

    if (name === "checkout") {
      setArea(selectedArea);
      setPayment(selectedPayment);
      renderCart();
    }
    if (name === "track") {
      renderTracking();
    }

    const hash = name === "browse" ? "" : "#" + name;
    try {
      history.replaceState(null, "", window.location.pathname + window.location.search + hash);
    } catch (err) {
      /* file:// may block history updates */
    }

    window.scrollTo({ top: 0, behavior: "auto" });
    const heading = views[name].querySelector("h1");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }

  /* ---------------------------------------------------------------------
     Init
     --------------------------------------------------------------------- */
  renderStoreState();
  renderMenu();
  renderCart();
  setArea(selectedArea);
  setPayment(selectedPayment);
  renderTracking();

  const initialHash = window.location.hash.replace("#", "");
  if (initialHash === "checkout") showView("checkout");
  else if (initialHash === "track") showView("track");
})();

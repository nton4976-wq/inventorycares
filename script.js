
/* script.js
*/


/* InventoryPro UI + Full Functionality (Vanilla JS + LocalStorage)
   - Items CRUD
   - Stock movements (IN/OUT/ADJUST) update stock
   - Monthly reports aggregation + CSV export + print
   - Role simulation (Admin/Staff)
   - Backup/Restore JSON
   - Low stock alerts (sidebar chip)
*/



(() => {
  "use strict";

  const STORAGE_KEY = "oism_pro_v1";
  const CURRENCY = "$";

  const state = {
    items: [],
    movements: [],
    activity: [],
    settings: {
      theme: "light",
      role: "Admin",
    },
    ui: {
      view: "dashboard",
      inv: { search: "", category: "all", sort: "updated_desc", page: 1, pageSize: 10, onlyLow: false },
      rep: { tab: "usage", month: null, year: null },
    }
  };

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const dom = {
    body: document.body,

    sidebar: $("#sidebar"),
    scrim: $("#scrim"),
    burgerBtn: $("#burgerBtn"),
    pageTitle: $("#pageTitle"),
    topRoleBadge: $("#topRoleBadge"),

    navBtns: $$(".sb-item"),

    sidebarLowAlert: $("#sidebarLowAlert"),
    sidebarLowAlertText: $("#sidebarLowAlertText"),

    themeToggle: $("#themeToggle"),

    // Views
    views: {
      dashboard: $("#view-dashboard"),
      inventory: $("#view-inventory"),
      reports: $("#view-reports"),
      settings: $("#view-settings"),
    },

    // Dashboard
    dashTotalItems: $("#dashTotalItems"),
    dashTotalQty: $("#dashTotalQty"),
    dashLowStock: $("#dashLowStock"),
    dashTotalValue: $("#dashTotalValue"),
    dashMonthLabel: $("#dashMonthLabel"),
    dashAdded: $("#dashAdded"),
    dashUsed: $("#dashUsed"),
    dashUsageBar: $("#dashUsageBar"),
    dashUsageNote: $("#dashUsageNote"),
    dashTopUsed: $("#dashTopUsed"),
    dashActivityBody: $("#dashActivityBody"),
    demoBtnDash: $("#demoBtnDash"),

    // Inventory
    invSearch: $("#invSearch"),
    invCategory: $("#invCategory"),
    invSort: $("#invSort"),
    invPageSize: $("#invPageSize"),
    invOnlyLow: $("#invOnlyLow"),
    addItemBtn: $("#addItemBtn"),
    openGlobalMoveBtn: $("#openGlobalMoveBtn"),
    invBody: $("#invBody"),
    invPagerInfo: $("#invPagerInfo"),
    invPagerCtrls: $("#invPagerCtrls"),

    // Reports
    exportReportsBtn: $("#exportReportsBtn"),
    printReportsBtn: $("#printReportsBtn"),
    repPrevMonth: $("#repPrevMonth"),
    repNextMonth: $("#repNextMonth"),
    repMonthLabel: $("#repMonthLabel"),
    repMonthPickerBtn: $("#repMonthPickerBtn"),
    repMonthPop: $("#repMonthPop"),
    repMonth: $("#repMonth"),
    repYear: $("#repYear"),
    repApplyMonth: $("#repApplyMonth"),
    repTotalUsed: $("#repTotalUsed"),
    repTotalAdded: $("#repTotalAdded"),
    repBelowMin: $("#repBelowMin"),
    repTopUsedCount: $("#repTopUsedCount"),
    repUsedDelta: $("#repUsedDelta"),
    repTabs: $$(".tab"),
    repThead: $("#repThead"),
    repTbody: $("#repTbody"),

    // Settings
    darkToggle: $("#darkToggle"),
    roleBtns: $$(".seg-btn"),
    roleHelpText: $("#roleHelpText"),
    exportJsonBtn: $("#exportJsonBtn"),
    importJsonBtn: $("#importJsonBtn"),
    importFile: $("#importFile"),
    demoBtn: $("#demoBtn"),
    clearDataBtn: $("#clearDataBtn"),

    // Modals
    itemModal: $("#itemModal"),
    itemForm: $("#itemForm"),
    itemModalTitle: $("#itemModalTitle"),
    itemId: $("#itemId"),
    itemName: $("#itemName"),
    itemCategoryInput: $("#itemCategory"),
    itemDesc: $("#itemDesc"),
    itemUnit: $("#itemUnit"),
    itemQty: $("#itemQty"),
    itemMin: $("#itemMin"),
    itemPrice: $("#itemPrice"),
    qtyHelp: $("#qtyHelp"),
    catList: $("#catList"),

    moveModal: $("#moveModal"),
    moveForm: $("#moveForm"),
    moveItemSelect: $("#moveItemSelect"),
    moveItemHint: $("#moveItemHint"),
    moveType: $("#moveType"),
    moveQty: $("#moveQty"),
    moveDate: $("#moveDate"),
    movePerson: $("#movePerson"),
    moveRemarks: $("#moveRemarks"),

    confirmModal: $("#confirmModal"),
    confirmMsg: $("#confirmMsg"),
    confirmCancel: $("#confirmCancel"),
    confirmOk: $("#confirmOk"),

    toastWrap: $("#toastWrap")
  };

  /* ---------- utils ---------- */
  const isAdmin = () => state.settings.role === "Admin";

  function uid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  }

  function nowISO() { return new Date().toISOString(); }

  function toLocalDTValue(iso) {
    const d = iso ? new Date(iso) : new Date();
    const pad = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function parseLocalDTValue(v) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  function monthName(m) {
    return new Date(2020, m-1, 1).toLocaleString(undefined, { month: "long" });
  }

  function formatMoney(n) {
    const v = Number(n || 0);
    return CURRENCY + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, { year:"numeric", month:"numeric", day:"numeric" });
  }

  function formatDateTime(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(undefined, { year:"numeric", month:"short", day:"2-digit", hour:"2-digit", minute:"2-digit" });
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(type, title, subtitle="", ttl=3200){
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `
      <div>
        <div class="t">${escapeHtml(title)}</div>
        ${subtitle ? `<div class="s">${escapeHtml(subtitle)}</div>` : ""}
      </div>
      <button class="icon-btn icon-btn-flat" type="button" aria-label="Close">×</button>
    `;
    el.querySelector("button").addEventListener("click", () => el.remove());
    dom.toastWrap.appendChild(el);
    setTimeout(() => { if (el.isConnected) el.remove(); }, ttl);
  }

  function openModal(el){ el.classList.remove("hidden"); dom.body.style.overflow = "hidden"; }
  function closeModal(el){ el.classList.add("hidden"); dom.body.style.overflow = ""; }

  function getMonthRange(year, month){
    const start = new Date(year, month-1, 1, 0,0,0,0);
    const endExcl = new Date(year, month, 1, 0,0,0,0);
    return { start, endExcl };
  }

  function movementDelta(mov){
    const q = Number(mov.qty);
    if (mov.type === "IN") return Math.abs(q);
    if (mov.type === "OUT") return -Math.abs(q);
    return q; // ADJUST can be +/-.
  }

  function getItemById(id){ return state.items.find(i => i.id === id) || null; }

  function getCategories(){
    return Array.from(new Set(state.items.map(i => (i.category||"").trim()).filter(Boolean)))
      .sort((a,b)=>a.localeCompare(b));
  }

  function addActivity(action, detail=""){
    state.activity.unshift({ id: uid(), ts: nowISO(), role: state.settings.role, action, detail });
    if (state.activity.length > 250) state.activity.length = 250;
    persist();
  }

  /* ---------- storage ---------- */
  function persist(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      items: state.items,
      movements: state.movements,
      activity: state.activity,
      settings: state.settings,
      ui: state.ui
    }));
  }

  function loadState(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw){
      const d = new Date();
      state.ui.rep.month = d.getMonth()+1;
      state.ui.rep.year = d.getFullYear();
      persist();
      return;
    }
    try{
      const p = JSON.parse(raw);
      state.items = Array.isArray(p.items) ? p.items : [];
      state.movements = Array.isArray(p.movements) ? p.movements : [];
      state.activity = Array.isArray(p.activity) ? p.activity : [];
      state.settings = { ...state.settings, ...(p.settings||{}) };
      state.ui = { ...state.ui, ...(p.ui||{}) };

      if (!state.ui.rep.month || !state.ui.rep.year){
        const d = new Date();
        state.ui.rep.month = d.getMonth()+1;
        state.ui.rep.year = d.getFullYear();
      }
    }catch{
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  /* ---------- theme + role ---------- */
  function applyTheme(){
    dom.body.setAttribute("data-theme", state.settings.theme);
    dom.darkToggle.checked = state.settings.theme === "dark";
  }

  function toggleTheme(){
    state.settings.theme = (state.settings.theme === "dark") ? "light" : "dark";
    applyTheme();
    persist();
    toast("success","Theme updated",`Now using ${state.settings.theme} mode`);
  }

  function applyRole(){
    dom.topRoleBadge.textContent = state.settings.role;

    dom.roleBtns.forEach(b => b.classList.toggle("active", b.dataset.role === state.settings.role));
    dom.roleHelpText.textContent = state.settings.role === "Admin"
      ? "Admin: Full access (add, edit, delete items)"
      : "Staff: Limited access (no delete, no direct stock edits)";

    // Permissions for buttons
    dom.addItemBtn.disabled = !isAdmin();
    dom.exportJsonBtn.disabled = !isAdmin();
    dom.importJsonBtn.disabled = !isAdmin();
    dom.clearDataBtn.disabled = !isAdmin();
  }

  function setRole(role){
    state.settings.role = role;
    applyRole();
    persist();
    toast("success","Role changed",`Now simulating: ${role}`);
    renderAll();
  }

  /* ---------- navigation ---------- */
  function setView(view){
    state.ui.view = view;
    persist();

    dom.navBtns.forEach(b => b.classList.toggle("active", b.dataset.view === view));
    Object.entries(dom.views).forEach(([k, el]) => el.classList.toggle("hidden", k !== view));

    const titles = {
      dashboard: "Dashboard",
      inventory: "Inventory",
      reports: "Reports",
      settings: "Settings"
    };
    dom.pageTitle.textContent = titles[view] || "InventoryPro";

    // close sidebar on mobile
    if (isMobile()) closeSidebar();
    renderAll();
  }

  /* ---------- sidebar mobile ---------- */
  function isMobile(){ return window.matchMedia("(max-width: 920px)").matches; }
  function openSidebar(){
    dom.sidebar.classList.add("open");
    dom.scrim.classList.remove("hidden");
  }
  function closeSidebar(){
    dom.sidebar.classList.remove("open");
    dom.scrim.classList.add("hidden");
  }
  function toggleSidebar(){
    if (dom.sidebar.classList.contains("open")) closeSidebar();
    else openSidebar();
  }

  /* ---------- calculations ---------- */
  function computeTotals(){
    const totalItems = state.items.length;
    const totalQty = state.items.reduce((s,i)=>s+(Number(i.qty)||0),0);
    const lowCount = state.items.filter(i => (Number(i.qty)||0) <= (Number(i.minQty)||0)).length;
    const totalValue = state.items.reduce((s,i)=> s + ((Number(i.qty)||0) * (Number(i.unitPrice)||0)), 0);
    return { totalItems, totalQty, lowCount, totalValue };
  }

  function computeMonthAgg(year, month){
    const { start, endExcl } = getMonthRange(year, month);
    const perItem = new Map();
    let added = 0, used = 0;

    const moves = state.movements.filter(m => {
      const d = new Date(m.date);
      return d >= start && d < endExcl;
    });

    for (const m of moves){
      if (!perItem.has(m.itemId)) perItem.set(m.itemId, { in:0, out:0, net:0, count:0 });
      const s = perItem.get(m.itemId);
      const delta = movementDelta(m);
      if (delta > 0){ s.in += delta; added += delta; }
      if (delta < 0){ s.out += Math.abs(delta); used += Math.abs(delta); }
      s.net += delta;
      s.count++;
    }
    return { perItem, added, used, moves };
  }

  function balanceAt(itemId, atDate){
    const item = getItemById(itemId);
    if (!item) return 0;
    let qty = Number(item.qty)||0;
    for (const m of state.movements){
      if (m.itemId !== itemId) continue;
      const d = new Date(m.date);
      if (d > atDate) qty -= movementDelta(m);
    }
    return Math.max(0, Math.round(qty));
  }

  /* ---------- render dashboard ---------- */
  function renderDashboard(){
    const t = computeTotals();
    dom.dashTotalItems.textContent = String(t.totalItems);
    dom.dashTotalQty.textContent = String(t.totalQty);
    dom.dashLowStock.textContent = String(t.lowCount);
    dom.dashTotalValue.textContent = formatMoney(t.totalValue);

    // Monthly (current month)
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth()+1;
    dom.dashMonthLabel.textContent = `${monthName(m)} ${y}`;

    const agg = computeMonthAgg(y, m);
    dom.dashAdded.textContent = `+${agg.added}`;
    dom.dashUsed.textContent = `-${agg.used}`;

    const usageRate = agg.added <= 0 ? 0 : Math.min(100, Math.round((agg.used / agg.added) * 100));
    dom.dashUsageBar.style.width = `${usageRate}%`;
    dom.dashUsageNote.textContent = `Usage rate: ${usageRate}% of stock added`;

    // Top 5 used (by OUT)
    const top = [...agg.perItem.entries()]
      .map(([id, s]) => ({ item: getItemById(id), out: s.out }))
      .filter(x => x.item && x.out > 0)
      .sort((a,b)=>b.out-a.out)
      .slice(0, 5);

    const max = Math.max(1, ...top.map(x=>x.out));
    dom.dashTopUsed.innerHTML = top.length ? top.map((x, idx) => {
      const w = Math.round((x.out / max) * 100);
      return `
        <div class="top5-row">
          <div class="top5-rank">${idx+1}</div>
          <div class="top5-name">${escapeHtml(x.item.name)}</div>
          <div class="top5-right">${x.out} used</div>
          <div class="top5-bar"><div style="width:${w}%"></div></div>
        </div>
      `;
    }).join("") : `<div class="muted">No usage yet this month.</div>`;

    // Recent activity
    const rows = state.activity.slice(0, 12);
    dom.dashActivityBody.innerHTML = rows.length ? rows.map(a => `
      <tr>
        <td>${escapeHtml(formatDateTime(a.ts))}</td>
        <td>
          <div style="font-weight:800">${escapeHtml(a.action)}</div>
          <div class="muted" style="font-size:12px">${escapeHtml(a.detail||"")}</div>
        </td>
        <td>${escapeHtml(a.role)}</td>
      </tr>
    `).join("") : `<tr><td colspan="3" class="muted">No activity yet.</td></tr>`;
  }

  /* ---------- render inventory ---------- */
  function buildPager(pages, current){
    const btn = (label, page, disabled=false, active=false) =>
      `<button class="btn ${active ? "btn-primary" : "btn-ghost"}" data-page="${page}" ${disabled?"disabled":""} type="button">${label}</button>`;

    let html = "";
    html += btn("«", 1, current===1);
    html += btn("‹", current-1, current===1);

    const windowSize = 5;
    const start = Math.max(1, current - Math.floor(windowSize/2));
    const end = Math.min(pages, start + windowSize - 1);
    const adjStart = Math.max(1, end - windowSize + 1);

    for (let p=adjStart; p<=end; p++) html += btn(String(p), p, false, p===current);

    html += btn("›", current+1, current===pages);
    html += btn("»", pages, current===pages);
    return html;
  }

  function renderInventory(){
    // categories
    const cats = getCategories();
    dom.invCategory.innerHTML = `<option value="all">All Categories</option>` +
      cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    dom.invCategory.value = state.ui.inv.category;

    // datalist for categories
    dom.catList.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}"></option>`).join("");

    // filter + sort
    const s = (state.ui.inv.search||"").trim().toLowerCase();
    const cat = state.ui.inv.category;
    const onlyLow = !!state.ui.inv.onlyLow;

    let list = [...state.items];

    if (s){
      list = list.filter(i =>
        (i.name||"").toLowerCase().includes(s) ||
        (i.category||"").toLowerCase().includes(s) ||
        (i.description||"").toLowerCase().includes(s)
      );
    }
    if (cat !== "all") list = list.filter(i => i.category === cat);
    if (onlyLow) list = list.filter(i => (Number(i.qty)||0) <= (Number(i.minQty)||0));

    const sort = state.ui.inv.sort;
    list.sort((a,b)=>{
      const na=(a.name||"").toLowerCase(), nb=(b.name||"").toLowerCase();
      const qa=Number(a.qty)||0, qb=Number(b.qty)||0;
      const ua=new Date(a.lastUpdated||a.dateAdded||0).getTime();
      const ub=new Date(b.lastUpdated||b.dateAdded||0).getTime();
      switch(sort){
        case "updated_asc": return ua-ub;
        case "stock_asc": return qa-qb;
        case "stock_desc": return qb-qa;
        case "name_desc": return nb.localeCompare(na);
        case "name_asc":
        default: return na.localeCompare(nb);
      }
    });

    // pagination
    const pageSize = Number(state.ui.inv.pageSize)||10;
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total/pageSize));
    state.ui.inv.page = Math.max(1, Math.min(pages, state.ui.inv.page));

    const start = (state.ui.inv.page-1)*pageSize;
    const slice = list.slice(start, start+pageSize);

    if (!slice.length){
      dom.invBody.innerHTML = `<tr><td colspan="8" class="muted">No items match your filters.</td></tr>`;
    } else {
      dom.invBody.innerHTML = slice.map(i => {
        const qty = Number(i.qty)||0;
        const min = Number(i.minQty)||0;
        const low = qty <= min;
        const rowClass = low ? "row-low" : "";
        const value = (Number(i.unitPrice)||0) * qty;

        return `
          <tr class="${rowClass}">
            <td>
              <div style="font-weight:800">${escapeHtml(i.name)}</div>
            </td>
            <td><span class="pill">${escapeHtml(i.category)}</span></td>
            <td class="stock">
              ${qty}${low ? `<small>LOW</small>` : ``}
            </td>
            <td class="money">${min}</td>
            <td class="money">${escapeHtml(i.unit)}</td>
            <td class="money">${formatMoney(value)}</td>
            <td class="money">${escapeHtml(formatDate(i.lastUpdated || i.dateAdded))}</td>
            <td style="text-align:right;">
              <div class="actions">
                <button class="icon-action" data-action="move" data-id="${i.id}" title="Movement" type="button">⟳</button>
                <button class="icon-action" data-action="edit" data-id="${i.id}" title="Edit" type="button">✎</button>
                <button class="icon-action" data-action="delete" data-id="${i.id}" title="Delete" type="button">🗑</button>
              </div>
            </td>
          </tr>
        `;
      }).join("");
    }

    const from = total ? start+1 : 0;
    const to = Math.min(total, start+pageSize);
    dom.invPagerInfo.textContent = `Showing ${from}-${to} of ${total}`;
    dom.invPagerCtrls.innerHTML = buildPager(pages, state.ui.inv.page);

    // permission: staff cannot delete
    if (!isAdmin()){
      $$(".icon-action[data-action='delete']").forEach(b => {
        b.disabled = true;
        b.style.opacity = ".45";
        b.style.cursor = "not-allowed";
        b.title = "Staff cannot delete";
      });
    }
  }

  /* ---------- render reports ---------- */
  function renderReports(){
    // fill month/year selects once
    if (!dom.repMonth.options.length){
      dom.repMonth.innerHTML = Array.from({length:12}, (_,i)=> `<option value="${i+1}">${monthName(i+1)}</option>`).join("");
    }
    if (!dom.repYear.options.length){
      const nowY = new Date().getFullYear();
      const years = [];
      for (let y = nowY-3; y <= nowY+2; y++) years.push(y);
      dom.repYear.innerHTML = years.map(y=> `<option value="${y}">${y}</option>`).join("");
    }

    dom.repMonth.value = String(state.ui.rep.month);
    dom.repYear.value = String(state.ui.rep.year);
    dom.repMonthLabel.textContent = `${monthName(state.ui.rep.month)} ${state.ui.rep.year}`;

    // tab active
    dom.repTabs.forEach(t => t.classList.toggle("active", t.dataset.tab === state.ui.rep.tab));

    const year = Number(state.ui.rep.year);
    const month = Number(state.ui.rep.month);
    const { start, endExcl } = getMonthRange(year, month);
    const endOfMonth = new Date(endExcl.getTime()-1);

    const agg = computeMonthAgg(year, month);

    dom.repTotalUsed.textContent = String(agg.used);
    dom.repTotalAdded.textContent = String(agg.added);

    const belowMin = state.items.filter(i => balanceAt(i.id, endOfMonth) <= (Number(i.minQty)||0)).length;
    dom.repBelowMin.textContent = String(belowMin);

    const usedItemsCount = [...agg.perItem.values()].filter(s => (s.out||0) > 0).length;
    dom.repTopUsedCount.textContent = String(usedItemsCount);

    // delta vs last month (Total Used)
    const prev = new Date(year, month-2, 1);
    const prevAgg = computeMonthAgg(prev.getFullYear(), prev.getMonth()+1);
    const prevUsed = prevAgg.used;
    let deltaTxt = "—";
    if (prevUsed === 0 && agg.used > 0) deltaTxt = "↑ 100% vs last month";
    else if (prevUsed > 0){
      const pct = Math.round(((agg.used - prevUsed) / prevUsed) * 100);
      const arrow = pct >= 0 ? "↑" : "↓";
      const cls = pct >= 0 ? "good" : "";
      deltaTxt = `${arrow} ${Math.abs(pct)}% vs last month`;
      dom.repUsedDelta.className = `kpi-mini ${pct>=0 ? "good" : ""}`;
    }
    dom.repUsedDelta.textContent = deltaTxt;

    // Build table per tab
    const tab = state.ui.rep.tab;

    if (tab === "usage"){
      dom.repThead.innerHTML = `
        <tr>
          <th>ITEM</th>
          <th style="width:220px">CATEGORY</th>
          <th style="width:120px">IN</th>
          <th style="width:120px">OUT</th>
          <th style="width:120px">NET</th>
          <th style="width:120px; text-align:right;">STOCK</th>
        </tr>
      `;

      const rows = state.items.map(i => {
        const s = agg.perItem.get(i.id) || { in:0, out:0, net:0 };
        const stock = balanceAt(i.id, endOfMonth);
        return {
          name: i.name, cat: i.category,
          in: s.in||0, out: s.out||0, net: (s.in||0) - (s.out||0), stock
        };
      }).filter(r => (r.in+r.out+r.net) !== 0).sort((a,b)=> b.out-a.out);

      dom.repTbody.innerHTML = rows.length ? rows.map(r => `
        <tr>
          <td style="font-weight:800">${escapeHtml(r.name)}</td>
          <td class="money">${escapeHtml(r.cat)}</td>
          <td style="color:var(--green); font-weight:800">+${r.in}</td>
          <td style="color:var(--red); font-weight:800">-${r.out}</td>
          <td style="color:${r.net<0 ? "var(--red)" : "var(--green)"}; font-weight:900">${r.net<0 ? r.net : "+"+r.net}</td>
          <td style="text-align:right; font-weight:900">${r.stock}</td>
        </tr>
      `).join("") : `<tr><td colspan="6" class="muted">No usage records for this month.</td></tr>`;
    }

    if (tab === "in"){
      dom.repThead.innerHTML = `
        <tr>
          <th>ITEM</th>
          <th style="width:220px">CATEGORY</th>
          <th style="width:140px">TOTAL IN</th>
          <th style="width:140px">MOVES</th>
          <th style="width:120px; text-align:right;">STOCK</th>
        </tr>
      `;
      const rows = state.items.map(i => {
        const s = agg.perItem.get(i.id) || { in:0, count:0 };
        const stock = balanceAt(i.id, endOfMonth);
        return { name:i.name, cat:i.category, in:s.in||0, moves:s.count||0, stock };
      }).filter(r => r.in > 0).sort((a,b)=> b.in-a.in);

      dom.repTbody.innerHTML = rows.length ? rows.map(r => `
        <tr>
          <td style="font-weight:800">${escapeHtml(r.name)}</td>
          <td class="money">${escapeHtml(r.cat)}</td>
          <td style="color:var(--green); font-weight:900">+${r.in}</td>
          <td class="money">${r.moves}</td>
          <td style="text-align:right; font-weight:900">${r.stock}</td>
        </tr>
      `).join("") : `<tr><td colspan="5" class="muted">No stock-in records for this month.</td></tr>`;
    }

    if (tab === "low"){
      dom.repThead.innerHTML = `
        <tr>
          <th>ITEM</th>
          <th style="width:220px">CATEGORY</th>
          <th style="width:120px">STOCK</th>
          <th style="width:120px">MIN</th>
          <th style="width:140px">STATUS</th>
        </tr>
      `;
      const rows = state.items.map(i => {
        const stock = balanceAt(i.id, endOfMonth);
        const min = Number(i.minQty)||0;
        return { name:i.name, cat:i.category, stock, min, status: stock===0 ? "Out of stock" : "Low" };
      }).filter(r => r.stock <= r.min).sort((a,b)=> a.stock-b.stock);

      dom.repTbody.innerHTML = rows.length ? rows.map(r => `
        <tr>
          <td style="font-weight:800">${escapeHtml(r.name)}</td>
          <td class="money">${escapeHtml(r.cat)}</td>
          <td style="font-weight:900; color:var(--red)">${r.stock}</td>
          <td class="money">${r.min}</td>
          <td style="font-weight:900; color:var(--amber)">${escapeHtml(r.status)}</td>
        </tr>
      `).join("") : `<tr><td colspan="5" class="muted">No low-stock items for this month.</td></tr>`;
    }

    if (tab === "most"){
      dom.repThead.innerHTML = `
        <tr>
          <th style="width:80px">#</th>
          <th>ITEM</th>
          <th style="width:220px">CATEGORY</th>
          <th style="width:140px">USED (OUT)</th>
          <th style="width:120px; text-align:right;">STOCK</th>
        </tr>
      `;
      const rows = [...agg.perItem.entries()]
        .map(([id, s]) => ({ item: getItemById(id), used: s.out||0 }))
        .filter(x => x.item && x.used > 0)
        .sort((a,b)=> b.used-a.used)
        .slice(0, 30)
        .map((x, idx) => ({
          rank: idx+1,
          name: x.item.name,
          cat: x.item.category,
          used: x.used,
          stock: balanceAt(x.item.id, endOfMonth)
        }));

      dom.repTbody.innerHTML = rows.length ? rows.map(r => `
        <tr>
          <td class="money">${r.rank}</td>
          <td style="font-weight:800">${escapeHtml(r.name)}</td>
          <td class="money">${escapeHtml(r.cat)}</td>
          <td style="color:var(--red); font-weight:900">-${r.used}</td>
          <td style="text-align:right; font-weight:900">${r.stock}</td>
        </tr>
      `).join("") : `<tr><td colspan="5" class="muted">No usage records for this month.</td></tr>`;
    }

    if (tab === "audit"){
      dom.repThead.innerHTML = `
        <tr>
          <th style="width:180px">DATE</th>
          <th>ITEM</th>
          <th style="width:120px">TYPE</th>
          <th style="width:100px">QTY</th>
          <th style="width:160px">PERSON</th>
          <th>REMARKS</th>
        </tr>
      `;
      const rows = agg.moves
        .slice()
        .sort((a,b)=> new Date(b.date) - new Date(a.date))
        .slice(0, 200);

      dom.repTbody.innerHTML = rows.length ? rows.map(m => {
        const item = getItemById(m.itemId);
        const delta = movementDelta(m);
        const qtyText = delta >= 0 ? `+${Math.abs(delta)}` : `-${Math.abs(delta)}`;
        const color = delta >= 0 ? "var(--green)" : "var(--red)";
        return `
          <tr>
            <td class="money">${escapeHtml(formatDateTime(m.date))}</td>
            <td style="font-weight:800">${escapeHtml(item ? item.name : "Unknown")}</td>
            <td class="money">${escapeHtml(m.type)}</td>
            <td style="font-weight:900; color:${color}">${qtyText}</td>
            <td class="money">${escapeHtml(m.person||"")}</td>
            <td class="money">${escapeHtml(m.remarks||"")}</td>
          </tr>
        `;
      }).join("") : `<tr><td colspan="6" class="muted">No movements this month.</td></tr>`;
    }
  }

  /* ---------- sidebar low alert chip ---------- */
  function renderSidebarLowAlert(){
    const lowCount = state.items.filter(i => (Number(i.qty)||0) <= (Number(i.minQty)||0)).length;
    dom.sidebarLowAlertText.textContent = `${lowCount} Low Stock Alerts`;
  }

  /* ---------- modals: item ---------- */
  function openItemModal(mode, item=null){
    dom.itemForm.reset();
    dom.itemId.value = item ? item.id : "";
    dom.itemModalTitle.textContent = (mode === "edit") ? "Edit Item" : "Add New Item";
    $("#saveItemBtn").textContent = (mode === "edit") ? "Save Changes" : "Add Item";

    if (item){
      dom.itemName.value = item.name || "";
      dom.itemCategoryInput.value = item.category || "";
      dom.itemDesc.value = item.description || "";
      dom.itemUnit.value = item.unit || "pcs";
      dom.itemQty.value = String(item.qty ?? 0);
      dom.itemMin.value = String(item.minQty ?? 0);
      dom.itemPrice.value = String(item.unitPrice ?? 0);
    } else {
      dom.itemUnit.value = "pcs";
      dom.itemQty.value = "0";
      dom.itemMin.value = "0";
      dom.itemPrice.value = "0";
    }

    // Staff cannot change qty in edit
    if (mode === "edit" && !isAdmin()){
      dom.itemQty.setAttribute("readonly","readonly");
      dom.qtyHelp.textContent = "Staff cannot directly edit stock. Use Stock Movement.";
    } else {
      dom.itemQty.removeAttribute("readonly");
      dom.qtyHelp.textContent = "Changing stock is recorded as adjustment (Admin only).";
    }

    openModal(dom.itemModal);
    dom.itemName.focus();
  }

  function saveItem(e){
    e.preventDefault();

    const id = dom.itemId.value.trim();
    const name = dom.itemName.value.trim();
    const category = dom.itemCategoryInput.value.trim();
    const desc = dom.itemDesc.value.trim();
    const unit = dom.itemUnit.value;
    const qty = Math.round(Number(dom.itemQty.value));
    const minQty = Math.round(Number(dom.itemMin.value));
    const unitPrice = Number(dom.itemPrice.value);

    if (!name || !category || !unit || Number.isNaN(qty) || Number.isNaN(minQty) || Number.isNaN(unitPrice)){
      toast("error","Invalid input","Please complete the form correctly.");
      return;
    }
    if (qty < 0 || minQty < 0 || unitPrice < 0){
      toast("error","Invalid values","Values must be 0 or higher.");
      return;
    }

    const now = nowISO();

    if (!id){
      if (!isAdmin()){
        toast("warn","Permission denied","Staff cannot add items.");
        return;
      }
      const item = {
        id: uid(),
        name,
        category,
        description: desc,
        qty,
        minQty,
        unit,
        unitPrice,
        dateAdded: now,
        lastUpdated: now
      };
      state.items.push(item);

      // initial stock as IN
      if (qty > 0){
        state.movements.push({
          id: uid(),
          itemId: item.id,
          type: "IN",
          qty,
          date: now,
          person: state.settings.role,
          remarks: "Initial stock"
        });
      }

      addActivity("Item added", `${name} (${category})`);
      toast("success","Item added",name);
    } else {
      const item = getItemById(id);
      if (!item){
        toast("error","Item not found","It may have been removed.");
        closeModal(dom.itemModal);
        return;
      }
      const oldQty = Number(item.qty)||0;

      item.name = name;
      item.category = category;
      item.description = desc;
      item.unit = unit;
      item.minQty = minQty;
      item.unitPrice = unitPrice;

      // admin can adjust stock directly via edit (logged as ADJUST)
      if (isAdmin() && qty !== oldQty){
        const diff = qty - oldQty;
        item.qty = qty;
        state.movements.push({
          id: uid(),
          itemId: item.id,
          type: "ADJUST",
          qty: diff,
          date: now,
          person: state.settings.role,
          remarks: "Stock adjusted via Edit"
        });
        addActivity("Stock adjusted", `${name}: ${oldQty} → ${qty}`);
      } else {
        item.qty = oldQty;
      }

      item.lastUpdated = now;
      addActivity("Item updated", `${name} (${category})`);
      toast("success","Item updated",name);
    }

    persist();
    closeModal(dom.itemModal);
    renderAll();
  }

  /* ---------- modals: movement ---------- */
  function refreshMoveItemSelect(selectedId=null, lock=false){
    const opts = state.items.slice().sort((a,b)=>a.name.localeCompare(b.name))
      .map(i => `<option value="${escapeHtml(i.id)}">${escapeHtml(i.name)}</option>`).join("");

    dom.moveItemSelect.innerHTML = opts || `<option value="">No items</option>`;
    dom.moveItemSelect.value = selectedId || (state.items[0] ? state.items[0].id : "");
    dom.moveItemSelect.disabled = lock;
    dom.moveItemHint.textContent = lock ? "Item locked from table action." : "Select an item to record a movement.";
  }

  function openMoveModal(itemId=null){
    dom.moveForm.reset();
    refreshMoveItemSelect(itemId, !!itemId);

    dom.moveType.value = "IN";
    dom.moveQty.value = "";
    dom.moveDate.value = toLocalDTValue(nowISO());
    dom.movePerson.value = "";
    dom.moveRemarks.value = "";

    openModal(dom.moveModal);
    dom.moveQty.focus();
  }

  function saveMove(e){
    e.preventDefault();

    const itemId = dom.moveItemSelect.value;
    const item = getItemById(itemId);
    if (!item){
      toast("error","No item selected","Please select an item.");
      return;
    }

    const type = dom.moveType.value;
    const qtyRaw = Number(dom.moveQty.value);
    const dateISO = parseLocalDTValue(dom.moveDate.value);
    const person = dom.movePerson.value.trim();
    const remarks = dom.moveRemarks.value.trim();

    if (!dateISO || !person){
      toast("error","Missing fields","Date and Responsible Person are required.");
      return;
    }
    if (Number.isNaN(qtyRaw) || qtyRaw === 0){
      toast("error","Invalid quantity","Quantity must be non-zero.");
      return;
    }

    let qty = qtyRaw;
    if (type === "IN" || type === "OUT") qty = Math.abs(qtyRaw);

    const mov = { id: uid(), itemId: item.id, type, qty, date: dateISO, person, remarks };
    const delta = movementDelta(mov);

    const newQty = (Number(item.qty)||0) + delta;
    if (newQty < 0){
      toast("error","Insufficient stock","This would make stock negative.");
      return;
    }

    item.qty = Math.round(newQty);
    item.lastUpdated = nowISO();
    state.movements.push(mov);

    addActivity(`Movement: ${type}`, `${item.name} (${delta>0?"+":""}${delta}) by ${person}`);
    persist();

    closeModal(dom.moveModal);
    toast("success","Movement saved",`${item.name} updated to ${item.qty} ${item.unit}`);
    renderAll();
  }

  /* ---------- delete confirm ---------- */
  function confirmDelete(itemId){
    if (!isAdmin()){
      toast("warn","Permission denied","Staff cannot delete items.");
      return;
    }
    const item = getItemById(itemId);
    if (!item) return;

    dom.confirmMsg.textContent = `Delete “${item.name}”? This will also remove its movement history.`;
    openModal(dom.confirmModal);

    const onCancel = () => { closeModal(dom.confirmModal); cleanup(); };
    const onOk = () => {
      closeModal(dom.confirmModal);
      cleanup();

      state.items = state.items.filter(i => i.id !== itemId);
      state.movements = state.movements.filter(m => m.itemId !== itemId);
      addActivity("Item deleted", `${item.name} (${item.category})`);
      persist();
      toast("success","Item deleted",item.name);
      renderAll();
    };
    const cleanup = () => {
      dom.confirmCancel.removeEventListener("click", onCancel);
      dom.confirmOk.removeEventListener("click", onOk);
    };

    dom.confirmCancel.addEventListener("click", onCancel);
    dom.confirmOk.addEventListener("click", onOk);
  }

  /* ---------- CSV export ---------- */
  function downloadCSV(filename, headers, rows){
    const esc = (v) => {
      const s = String(v ?? "");
      if (/[",\n]/.test(s)) return `"${s.replaceAll('"','""')}"`;
      return s;
    };
    const content = [headers.map(esc).join(","), ...rows.map(r => r.map(esc).join(","))].join("\n");
    const blob = new Blob([content], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportReportsCSV(){
    const year = Number(state.ui.rep.year);
    const month = Number(state.ui.rep.month);
    const tab = state.ui.rep.tab;
    const { endExcl } = getMonthRange(year, month);
    const endOfMonth = new Date(endExcl.getTime()-1);
    const agg = computeMonthAgg(year, month);

    let headers = [];
    let rows = [];

    if (tab === "usage"){
      headers = ["Item","Category","In","Out","Net","Stock"];
      rows = state.items.map(i => {
        const s = agg.perItem.get(i.id) || { in:0, out:0 };
        const net = (s.in||0) - (s.out||0);
        const stock = balanceAt(i.id, endOfMonth);
        if ((s.in||0)+(s.out||0) === 0) return null;
        return [i.name, i.category, s.in||0, s.out||0, net, stock];
      }).filter(Boolean);
    } else if (tab === "in"){
      headers = ["Item","Category","Total In","Moves","Stock"];
      rows = state.items.map(i => {
        const s = agg.perItem.get(i.id) || { in:0, count:0 };
        const stock = balanceAt(i.id, endOfMonth);
        if ((s.in||0) <= 0) return null;
        return [i.name, i.category, s.in||0, s.count||0, stock];
      }).filter(Boolean);
    } else if (tab === "low"){
      headers = ["Item","Category","Stock","Min","Status"];
      rows = state.items.map(i => {
        const stock = balanceAt(i.id, endOfMonth);
        const min = Number(i.minQty)||0;
        if (stock > min) return null;
        return [i.name, i.category, stock, min, stock===0?"Out of stock":"Low"];
      }).filter(Boolean);
    } else if (tab === "most"){
      headers = ["Rank","Item","Category","Used (Out)","Stock"];
      const list = [...agg.perItem.entries()]
        .map(([id,s]) => ({ item:getItemById(id), used:s.out||0 }))
        .filter(x => x.item && x.used>0)
        .sort((a,b)=>b.used-a.used)
        .slice(0, 50)
        .map((x, idx) => [idx+1, x.item.name, x.item.category, x.used, balanceAt(x.item.id, endOfMonth)]);
      rows = list;
    } else {
      headers = ["Date","Item","Type","Qty","Person","Remarks"];
      rows = agg.moves
        .slice()
        .sort((a,b)=> new Date(b.date)-new Date(a.date))
        .map(m => {
          const item = getItemById(m.itemId);
          return [new Date(m.date).toLocaleString(), item?item.name:"Unknown", m.type, m.qty, m.person||"", m.remarks||""];
        });
    }

    const file = `InventoryPro_${year}-${String(month).padStart(2,"0")}_${tab}.csv`;
    downloadCSV(file, headers, rows);
    toast("success","CSV exported",file);
  }

  /* ---------- backup/restore ---------- */
  function exportJSON(){
    if (!isAdmin()){ toast("warn","Permission denied","Admin only"); return; }
    const payload = {
      exportedAt: nowISO(),
      version: 1,
      data: {
        items: state.items,
        movements: state.movements,
        activity: state.activity,
        settings: state.settings,
        ui: state.ui
      }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `InventoryPro_Backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("success","Backup exported",a.download);
  }

  function importJSONFile(file){
    if (!isAdmin()){ toast("warn","Permission denied","Admin only"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const parsed = JSON.parse(reader.result);
        const data = parsed.data || parsed;
        if (!data.items || !data.movements) throw new Error("Invalid backup format.");
        state.items = Array.isArray(data.items) ? data.items : [];
        state.movements = Array.isArray(data.movements) ? data.movements : [];
        state.activity = Array.isArray(data.activity) ? data.activity : [];
        state.settings = { ...state.settings, ...(data.settings||{}) };
        state.ui = { ...state.ui, ...(data.ui||{}) };

        applyTheme();
        applyRole();
        persist();
        toast("success","Backup restored","Data imported successfully.");
        addActivity("Backup restored", file.name);
        renderAll();
      }catch(err){
        toast("error","Import failed", err.message || "Invalid JSON backup.");
      }
    };
    reader.readAsText(file);
  }

  function clearAllData(){
    if (!isAdmin()){ toast("warn","Permission denied","Admin only"); return; }
    dom.confirmMsg.textContent = "Clear ALL data? This cannot be undone.";
    openModal(dom.confirmModal);

    const onCancel = () => { closeModal(dom.confirmModal); cleanup(); };
    const onOk = () => {
      closeModal(dom.confirmModal);
      cleanup();

      localStorage.removeItem(STORAGE_KEY);
      state.items = [];
      state.movements = [];
      state.activity = [];
      state.settings = { theme:"light", role:"Admin" };
      const d = new Date();
      state.ui = {
        view: "dashboard",
        inv: { search:"", category:"all", sort:"updated_desc", page:1, pageSize:10, onlyLow:false },
        rep: { tab:"usage", month: d.getMonth()+1, year: d.getFullYear() }
      };
      applyTheme();
      applyRole();
      persist();
      toast("success","Data cleared","LocalStorage reset.");
      renderAll();
    };
    const cleanup = () => {
      dom.confirmCancel.removeEventListener("click", onCancel);
      dom.confirmOk.removeEventListener("click", onOk);
    };
    dom.confirmCancel.addEventListener("click", onCancel);
    dom.confirmOk.addEventListener("click", onOk);
  }

  /* ---------- demo ---------- */
  function loadDemoData(){
    if (!isAdmin()){ toast("warn","Permission denied","Admin only"); return; }

    const mk = (name, category, unit, qty, minQty, price=0, desc="") => ({
      id: uid(), name, category, unit, qty, minQty,
      unitPrice: price,
      description: desc,
      dateAdded: nowISO(),
      lastUpdated: nowISO()
    });

    const items = [
      mk("A4 Paper", "Paper Products", "ream", 150, 50, 5.99, "Standard A4 ream"),
      mk("Ballpoint Pens (Blue)", "Writing Instruments", "box", 12, 20, 8.50, "Blue pens"),
      mk("Stapler", "Office Supplies", "pcs", 8, 3, 12.99, "Heavy duty"),
      mk("Whiteboard Markers", "Writing Instruments", "pack", 5, 8, 9.99, "Assorted colors"),
      mk("File Folders", "Filing & Storage", "pack", 200, 50, 12.00, "Manila folders"),
      mk("Sticky Notes", "Office Supplies", "pack", 18, 10, 3.00, "3x3"),
      mk("Printer Toner", "Technology", "pcs", 3, 5, 89.99, "Black toner"),
    ];

    state.items = items;
    state.movements = [];
    state.activity = [];

    // movements current month
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth();
    const t = (day, hh=10) => new Date(y, m, day, hh, 0).toISOString();

    const push = (item, type, qty, date, person, remarks) => {
      state.movements.push({ id: uid(), itemId: item.id, type, qty, date, person, remarks });
      item.qty = Math.max(0, Math.round((Number(item.qty)||0) + movementDelta({type, qty})));
      item.lastUpdated = nowISO();
    };

    push(items[0], "OUT", 2, t(2), "Staff", "Issued to departments");
    push(items[1], "OUT", 4, t(3), "Staff", "Office use");
    push(items[2], "OUT", 10, t(4), "Staff", "Department request");
    push(items[3], "OUT", 5, t(5), "Staff", "Weekly usage");
    push(items[0], "IN", 0, t(6), "Admin", "No replenishment");

    addActivity("System", "Demo data loaded");
    persist();
    toast("success","Demo loaded","Go to Reports / Inventory to view.");
    renderAll();
  }

  /* ---------- render all ---------- */
  function renderAll(){
    applyTheme();
    applyRole();
    renderSidebarLowAlert();

    const view = state.ui.view;
    if (view === "dashboard") renderDashboard();
    if (view === "inventory") renderInventory();
    if (view === "reports") renderReports();
  }

  /* ---------- events ---------- */
  function bindEvents(){
    // nav
    dom.navBtns.forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));

    // sidebar low alert -> inventory low filter
    dom.sidebarLowAlert.addEventListener("click", () => {
      state.ui.inv.onlyLow = true;
      state.ui.inv.page = 1;
      dom.invOnlyLow.checked = true;
      setView("inventory");
    });

    // mobile sidebar
    dom.burgerBtn.addEventListener("click", toggleSidebar);
    dom.scrim.addEventListener("click", closeSidebar);

    // theme
    dom.themeToggle.addEventListener("click", toggleTheme);
    dom.darkToggle.addEventListener("change", () => toggleTheme());

    // roles
    dom.roleBtns.forEach(b => b.addEventListener("click", () => setRole(b.dataset.role)));

    // inventory filters
    dom.invSearch.addEventListener("input", (e) => {
      state.ui.inv.search = e.target.value;
      state.ui.inv.page = 1;
      persist();
      renderInventory();
    });
    dom.invCategory.addEventListener("change", (e) => {
      state.ui.inv.category = e.target.value;
      state.ui.inv.page = 1;
      persist();
      renderInventory();
    });
    dom.invSort.addEventListener("change", (e) => {
      state.ui.inv.sort = e.target.value;
      persist();
      renderInventory();
    });
    dom.invPageSize.addEventListener("change", (e) => {
      state.ui.inv.pageSize = Number(e.target.value);
      state.ui.inv.page = 1;
      persist();
      renderInventory();
    });
    dom.invOnlyLow.addEventListener("change", (e) => {
      state.ui.inv.onlyLow = e.target.checked;
      state.ui.inv.page = 1;
      persist();
      renderInventory();
    });

    // add item
    dom.addItemBtn.addEventListener("click", () => {
      if (!isAdmin()) return toast("warn","Permission denied","Staff cannot add items.");
      openItemModal("add");
    });

    // global movement
    dom.openGlobalMoveBtn.addEventListener("click", () => {
      if (!state.items.length) return toast("warn","No items","Add an item first.");
      openMoveModal(null);
    });

    // inventory actions
    dom.invBody.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;

      if (action === "move") openMoveModal(id);
      if (action === "edit"){
        const item = getItemById(id);
        if (!item) return;
        openItemModal("edit", item);
      }
      if (action === "delete") confirmDelete(id);
    });

    // pager
    dom.invPagerCtrls.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-page]");
      if (!b) return;
      const p = Number(b.dataset.page);
      if (Number.isNaN(p)) return;
      state.ui.inv.page = p;
      persist();
      renderInventory();
    });

    // reports tabs
    dom.repTabs.forEach(t => t.addEventListener("click", () => {
      state.ui.rep.tab = t.dataset.tab;
      persist();
      renderReports();
    }));

    // reports month nav
    dom.repPrevMonth.addEventListener("click", () => shiftMonth(-1));
    dom.repNextMonth.addEventListener("click", () => shiftMonth(1));

    // month picker popover
    dom.repMonthPickerBtn.addEventListener("click", () => {
      dom.repMonthPop.classList.toggle("hidden");
    });
    dom.repApplyMonth.addEventListener("click", () => {
      state.ui.rep.month = Number(dom.repMonth.value);
      state.ui.rep.year = Number(dom.repYear.value);
      dom.repMonthPop.classList.add("hidden");
      persist();
      renderReports();
    });
    document.addEventListener("click", (e) => {
      if (dom.repMonthPop.classList.contains("hidden")) return;
      const within = dom.repMonthPop.contains(e.target) || dom.repMonthPickerBtn.contains(e.target);
      if (!within) dom.repMonthPop.classList.add("hidden");
    });

    // export/print
    dom.exportReportsBtn.addEventListener("click", exportReportsCSV);
    dom.printReportsBtn.addEventListener("click", () => { setView("reports"); setTimeout(()=>window.print(), 30); });

    // settings backup
    dom.exportJsonBtn.addEventListener("click", exportJSON);
    dom.importJsonBtn.addEventListener("click", () => {
      if (!isAdmin()) return toast("warn","Permission denied","Admin only");
      dom.importFile.value = "";
      dom.importFile.click();
    });
    dom.importFile.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importJSONFile(f);
    });
    dom.clearDataBtn.addEventListener("click", clearAllData);

    // demo
    dom.demoBtn.addEventListener("click", loadDemoData);
    dom.demoBtnDash.addEventListener("click", loadDemoData);

    // modals close
    $$("[data-close-modal]").forEach(b => b.addEventListener("click", () => {
      const id = b.getAttribute("data-close-modal");
      closeModal($("#"+id));
    }));

    // modal submit
    dom.itemForm.addEventListener("submit", saveItem);
    dom.moveForm.addEventListener("submit", saveMove);

    // ESC closes modals
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      [dom.itemModal, dom.moveModal, dom.confirmModal].forEach(m => { if (!m.classList.contains("hidden")) closeModal(m); });
      if (isMobile()) closeSidebar();
    });

    // overlay click closes
    [dom.itemModal, dom.moveModal, dom.confirmModal].forEach(overlay => {
      overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(overlay); });
    });

    window.addEventListener("resize", () => {
      if (!isMobile()){
        dom.scrim.classList.add("hidden");
        dom.sidebar.classList.remove("open");
      }
    });
  }

  function shiftMonth(delta){
    let m = Number(state.ui.rep.month);
    let y = Number(state.ui.rep.year);
    m += delta;
    if (m < 1){ m = 12; y -= 1; }
    if (m > 12){ m = 1; y += 1; }
    state.ui.rep.month = m;
    state.ui.rep.year = y;
    dom.repMonth.value = String(m);
    dom.repYear.value = String(y);
    persist();
    renderReports();
  }

  /* ---------- init ---------- */
  function init(){
    loadState();

    if (!state.ui.rep.month || !state.ui.rep.year){
      const d = new Date();
      state.ui.rep.month = d.getMonth()+1;
      state.ui.rep.year = d.getFullYear();
    }

    applyTheme();
    applyRole();

    // sync controls
    dom.invSearch.value = state.ui.inv.search || "";
    dom.invSort.value = state.ui.inv.sort || "updated_desc";
    dom.invPageSize.value = String(state.ui.inv.pageSize || 10);
    dom.invOnlyLow.checked = !!state.ui.inv.onlyLow;

    // set month selectors
    // (options built in renderReports)
    bindEvents();

    if (!state.activity.length && !state.items.length){
      addActivity("System ready", "Add items and track stock movements.");
    }

    setView(state.ui.view || "dashboard");
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
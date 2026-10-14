(() => {
  'use strict';

  const KEY = 'so-ngan-sach:v1';
  const DAY = 864e5;
  const REMIND_FIRST = 3 * DAY;  // chưa sao lưu lần nào: nhắc sau 3 ngày dùng
  const REMIND_EVERY = 14 * DAY; // đã từng sao lưu: nhắc lại sau 14 ngày nếu có thay đổi
  const SNOOZE = 3 * DAY;
  const GROUPS = {
    need: { label: 'Thiết yếu', target: 50, color: 'var(--need)' },
    want: { label: 'Mong muốn', target: 30, color: 'var(--want)' },
    save: { label: 'Tiết kiệm', target: 20, color: 'var(--save)' },
  };
  const DEFAULT_CATS = [
    ['Nhà ở & hoá đơn', 'need', 20], ['Ăn uống', 'need', 20], ['Đi lại', 'need', 5], ['Sức khoẻ', 'need', 5],
    ['Mua sắm', 'want', 15], ['Giải trí', 'want', 15],
    ['Tiết kiệm', 'save', 20],
  ];
  // % thu nhập gợi ý cho từng hạng mục mặc định (khung 50/30/20, chỉnh theo cơ cấu chi tiêu ở Việt Nam)
  const SUGGEST = Object.fromEntries(DEFAULT_CATS.map(([name, , pct]) => [name, pct]));
  const INCOME_CATS = [
    ['salary', 'Tiền lương', 'wallet'], ['allowance', 'Tiền phụ cấp', 'piggy'], ['bonus', 'Tiền thưởng', 'gift'],
    ['side', 'Thu nhập phụ', 'coins'], ['invest', 'Đầu tư', 'chart'], ['other', 'Thu nhập khác', 'plus'],
  ];

  // ---------- Biểu tượng (nét, 24×24) ----------
  const ICONS = {
    food: ['#ef8a3a', '<circle cx="12" cy="12" r="4"/><path d="M3.5 4v5a2 2 0 0 0 4 0V4M5.5 11v9M20.5 4c-1.7 1-2.5 3-2.5 5.5h2.5V20"/>'],
    coffee: ['#c08a52', '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5V6M12 3.5V6"/>'],
    cart: ['#3dbb7a', '<path d="M3 4h2.2l2.3 10.5h10.3l2-7.5H6.4"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>'],
    home: ['#9a74e0', '<path d="M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-5h4v5"/>'],
    bolt: ['#e8b730', '<path d="M13 2.5 4.5 13.5H11L10 21.5l8.5-11H12z"/>'],
    water: ['#4a86e8', '<path d="M12 3.5c3 4 6 7.3 6 10.5a6 6 0 0 1-12 0c0-3.2 3-6.5 6-10.5z"/>'],
    wifi: ['#2fa8d8', '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.3" r=".9"/>'],
    phone: ['#8b93a1', '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>'],
    car: ['#c08a52', '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10.5h14M8 21l1.5-4M16 21l-1.5-4"/><circle cx="9" cy="13.8" r=".9"/><circle cx="15" cy="13.8" r=".9"/>'],
    fuel: ['#e05a4f', '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M4 10h10M14 8l3 3v6a1.5 1.5 0 0 0 3 0V9l-3-3"/>'],
    health: ['#25a99b', '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/>'],
    shirt: ['#4a6ee8', '<path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c0 2-1.6 3.2-4 3.2S8 5 8 3z"/>'],
    sparkle: ['#e2589c', '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>'],
    bag: ['#e0605f', '<path d="M5 8h14l-1 12.5H6zM9 8V6.5a3 3 0 0 1 6 0V8"/>'],
    fun: ['#7b6cf0', '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7 12.5h4M9 10.5v4"/><circle cx="15.5" cy="11.3" r=".9"/><circle cx="17.5" cy="13.7" r=".9"/>'],
    gift: ['#e8b730', '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8.5h14V12M12 8v12.5M12 8C10.5 5 7 4.5 7 6.8 7 8 9 8 12 8zm0 0c1.5-3 5-3.5 5-1.2C17 8 15 8 12 8z"/>'],
    book: ['#e05a4f', '<path d="M3.5 5h6A2.5 2.5 0 0 1 12 7.5V20a2 2 0 0 0-2-2H3.5zM20.5 5h-6A2.5 2.5 0 0 0 12 7.5V20a2 2 0 0 1 2-2h6.5z"/>'],
    piggy: ['#f0a35c', '<ellipse cx="11" cy="13" rx="7" ry="5.5"/><path d="M17.6 11.3H20v3.2h-2M7.5 17.6v2.9M14.5 17.6v2.9M8.5 8.2l.8-2.7 2.6 2"/><circle cx="14" cy="11.2" r=".9"/>'],
    chart: ['#3dbb7a', '<path d="M3 20.5h18M5 16l4-5 4 3 6-8M15 6h4v4"/>'],
    card: ['#5b8def', '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/>'],
    tag: ['#8b93a1', '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.3"/>'],
    wallet: ['#3dbb7a', '<path d="M19 7V5a1 1 0 0 0-1-1H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H6a2 2 0 0 1-2-2"/><circle cx="16" cy="13.5" r="1"/>'],
    coins: ['#2fa8d8', '<ellipse cx="9" cy="7" rx="5" ry="2.5"/><path d="M4 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7M4 11v4c0 1.4 2.2 2.5 5 2.5"/><ellipse cx="15" cy="15" rx="5" ry="2.5"/><path d="M10 15v3c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-3"/>'],
    plus: ['#e2589c', '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>'],
  };
  // Hạng mục tự nhận biểu tượng theo tên (thứ tự quan trọng: "điện thoại" phải đứng trước "điện")
  const ICON_RULES = [
    [/điện thoại|liên lạc|sim|cước/, 'phone'], [/internet|mạng|wifi/, 'wifi'], [/cà phê|cafe|coffee|trà sữa/, 'coffee'],
    [/ăn|uống|cơm|thực phẩm/, 'food'], [/hàng ngày|chợ|siêu thị|tạp hoá|sinh hoạt/, 'cart'], [/nhà|thuê|trọ/, 'home'],
    [/điện|hoá đơn|hóa đơn/, 'bolt'], [/nước/, 'water'], [/xăng|dầu/, 'fuel'], [/đi lại|xe|di chuyển|grab|taxi|vé/, 'car'],
    [/sức khoẻ|sức khỏe|y tế|thuốc|bệnh|khám|bảo hiểm/, 'health'], [/quần áo|thời trang|giày/, 'shirt'],
    [/mỹ phẩm|làm đẹp|tóc|spa/, 'sparkle'], [/mua sắm|shopping/, 'bag'], [/giải trí|du lịch|phim|game|chơi/, 'fun'],
    [/quà|hiếu|hỉ|cưới|giao lưu|biếu/, 'gift'], [/học|giáo dục|sách|khoá/, 'book'], [/tiết kiệm|dự phòng|để dành/, 'piggy'],
    [/đầu tư|chứng khoán|vàng/, 'chart'], [/trả góp|nợ|vay|thẻ/, 'card'],
  ];
  const iconKey = (name) => (ICON_RULES.find(([re]) => re.test(String(name).toLowerCase())) || [null, 'tag'])[1];
  const svg = (key) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[key][1]}</svg>`;
  const chip = (key) => `<span class="chip" style="--c:${ICONS[key][0]}">${svg(key)}</span>`;
  const incomeMeta = (cat) => INCOME_CATS.find((x) => x[0] === cat) || INCOME_CATS[5];

  // ---------- Tiện ích ----------
  const $ = (id) => document.getElementById(id);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = (n) => String(n).padStart(2, '0');
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const isoOf = (d) => `${keyOf(d)}-${pad(d.getDate())}`;
  const dateOf = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const thu = (d) => (d.getDay() === 0 ? 'CN' : `Thứ ${d.getDay() + 1}`);
  const sum = (list, f) => list.reduce((s, x) => s + (x[f] || 0), 0);
  const nf = new Intl.NumberFormat('vi-VN');
  const num = (n) => nf.format(Math.round(n));
  const money = (n) => `${num(n)} ₫`;
  const pf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
  const compact = (n) => (n >= 1e6 ? `${pf.format(n / 1e6)}tr` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : n ? String(n) : '–');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const monthName = (key) => { const [y, m] = key.split('-'); return `Tháng ${+m}/${y}`; };

  // "50k" → 50.000, "1.5tr" / "1,5tr" → 1.500.000, "1.200.000" → 1.200.000
  function parseMoney(raw) {
    const s = String(raw).trim().toLowerCase().replace(/\s|₫|đ/g, '');
    const m = s.match(/^([\d.,]+)(k|n|tr|m|ty|tỷ)?$/);
    if (!m) return NaN;
    const grouped = /^\d{1,3}([.,]\d{3})+$/.test(m[1]);
    if (!m[2] || grouped) {
      const base = parseInt(m[1].replace(/[.,]/g, ''), 10);
      return base * (m[2] ? unit(m[2]) : 1);
    }
    return Math.round(parseFloat(m[1].replace(',', '.')) * unit(m[2]));
  }
  const unit = (u) => (u === 'k' || u === 'n' ? 1e3 : u === 'tr' || u === 'm' ? 1e6 : 1e9);

  // ---------- Trạng thái ----------
  let state = load();
  let tab = 'entry';
  let mode = 'exp';          // màn Nhập vào: 'exp' tiền chi | 'inc' tiền thu
  let selCat = null;         // tên hạng mục chi đang chọn (theo tên vì mỗi tháng có id riêng)
  let selInc = 'salary';     // loại thu đang chọn
  let editing = null;        // { kind: 'exp' | 'inc', id, key } khi đang sửa một khoản
  let selDay = null;         // ngày đang chọn trên lịch
  let reportSel = null;      // tháng đang chọn trên biểu đồ báo cáo
  let toastTimer = 0;

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.months) return { ...s, view: keyOf(new Date()) }; // mở app luôn ở tháng hiện tại
    } catch { /* dữ liệu hỏng → bắt đầu sổ mới */ }
    return { view: keyOf(new Date()), months: {} };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* hết dung lượng / chế độ riêng tư */ }
  }
  // Tháng mới thừa hưởng bộ hạng mục (tên, nhóm, %, cố định) và chế độ thông minh của tháng gần nhất trước nó
  function newMonth(key) {
    const srcKey = Object.keys(state.months).filter((k) => k < key && state.months[k].categories?.length).sort().at(-1);
    const p = srcKey && state.months[srcKey];
    if (!p) return { incomes: [], transactions: [], categories: DEFAULT_CATS.map(([name, group]) => ({ id: uid(), name, group, planned: 0 })) };
    return {
      incomes: [], transactions: [], smart: p.smart, pctInit: p.pctInit,
      categories: p.categories.map((c) => ({ ...c, id: uid(), planned: p.smart ? 0 : c.planned })),
    };
  }
  const month = (key) => (state.months[key] ||= newMonth(key));
  const cur = () => month(state.view);

  // Chi tiêu thông minh: ngân sách mỗi hạng mục = thu nhập × % của hạng mục đó
  function applySmart(m) {
    if (!m.smart) return;
    const income = sum(m.incomes, 'amount');
    for (const c of m.categories) c.planned = Math.round((income * (c.pct || 0)) / 100);
  }
  // Mỗi nhóm luôn đúng mục tiêu 50/30/20; trong nhóm chia theo SUGGEST, có hạng mục lạ thì chia đều
  function suggestPcts(m) {
    const out = {};
    for (const g in GROUPS) {
      const cats = m.categories.filter((c) => c.group === g);
      const known = cats.every((c) => SUGGEST[c.name]);
      const total = known ? cats.reduce((t, c) => t + SUGGEST[c.name], 0) : cats.length;
      for (const c of cats) out[c.id] = (GROUPS[g].target * (known ? SUGGEST[c.name] : 1)) / total;
    }
    return out;
  }
  // Giữ tổng = 100%: mục "Cố định" và mục vừa sửa (keepId) đứng yên, các mục còn lại co giãn theo tỉ lệ đang có
  function rebalance(m, keepId) {
    const keep = m.categories.find((c) => c.id === keepId);
    const free = m.categories.filter((c) => !c.locked && c !== keep);
    const lockedSum = sum(m.categories.filter((c) => c.locked), 'pct');
    if (keep) keep.pct = Math.min(keep.pct, Math.max(0, 100 - lockedSum));
    if (!free.length) return;
    const room = Math.max(0, 100 - lockedSum - (keep ? keep.pct : 0));
    const before = sum(free, 'pct');
    for (const c of free) c.pct = Math.round((before > 0 ? (c.pct || 0) / before : 1 / free.length) * room * 10) / 10;
    // phần lẻ do làm tròn dồn vào mục lớn nhất
    const big = free.reduce((a, b) => (b.pct > a.pct ? b : a));
    big.pct = Math.max(0, Math.round((big.pct + room - sum(free, 'pct')) * 1e6) / 1e6);
  }
  // % mà enableSmart sẽ dùng — để xem trước khi nhập khoản thu
  function previewPcts(m) {
    const st = stats(m);
    const out = {};
    if (m.smart || (m.pctInit && !(st.planned > 0 && st.income > 0))) for (const c of m.categories) out[c.id] = c.pct || 0;
    else if (st.planned > 0 && st.income > 0) for (const c of m.categories) out[c.id] = (c.planned / st.income) * 100;
    else return suggestPcts(m);
    return out;
  }
  function enableSmart(m) {
    const pcts = previewPcts(m);
    for (const c of m.categories) c.pct = pcts[c.id];
    m.pctInit = true;
    m.smart = true;
  }
  function stats(m) {
    const spentBy = {};
    for (const t of m.transactions) spentBy[t.catId] = (spentBy[t.catId] || 0) + t.amount;
    return { spentBy, spent: sum(m.transactions, 'amount'), income: sum(m.incomes, 'amount'), planned: sum(m.categories, 'planned') };
  }
  function timeInfo(key) {
    const [y, mo] = key.split('-').map(Number);
    const dim = new Date(y, mo, 0).getDate();
    const now = new Date();
    const nk = keyOf(now);
    if (key === nk) return { dim, when: 'now', elapsed: now.getDate() / dim, daysLeft: dim - now.getDate() + 1 };
    return key < nk ? { dim, when: 'past', elapsed: 1, daysLeft: 0 } : { dim, when: 'future', elapsed: 0, daysLeft: dim };
  }

  // Khoản cố định hằng tháng: mỗi quy tắc tự ghi đúng một lần vào tháng hiện tại, lần đầu mở app trong tháng đó.
  // Quy tắc nhớ hạng mục theo tên vì mỗi tháng có bộ id hạng mục riêng.
  function applyRecurring() {
    const rules = state.recurring || [];
    if (!rules.length) return;
    const key = keyOf(new Date());
    const m = month(key);
    const done = (m.recDone ||= []);
    const todo = rules.filter((r) => !done.includes(r.id));
    if (!todo.length) return;
    const { dim } = timeInfo(key);
    for (const r of todo) {
      done.push(r.id);
      m.transactions.push({
        id: uid(), at: Date.now(), date: `${key}-${pad(Math.min(r.day, dim))}`,
        catId: m.categories.find((c) => c.name === r.cat)?.id || '', note: r.note, amount: r.amount, recId: r.id,
      });
    }
    state.lastChange = Date.now();
    save();
  }

  // Trả về lời nhắc sao lưu, hoặc null nếu chưa cần nhắc
  function backupNotice() {
    const now = Date.now();
    const last = state.lastBackup || 0;
    if (!(state.lastChange > last) || now < (state.snoozeUntil || 0)) return null;
    if (!last) return now - state.firstChange > REMIND_FIRST ? 'Sổ chưa được sao lưu lần nào — dữ liệu chỉ nằm trên máy này.' : null;
    return now - last > REMIND_EVERY ? `Lần sao lưu gần nhất cách đây ${Math.floor((now - last) / DAY)} ngày.` : null;
  }

  // ================= Render =================
  function render() {
    applyRecurring();
    renderEntry();
    renderCalendar();
    renderBudget();
    renderReport();
    renderMore();
    renderBackup();
    showTab();
  }

  function showTab() {
    for (const s of document.querySelectorAll('.tab')) s.hidden = s.dataset.tab !== tab;
    for (const b of document.querySelectorAll('.tabbar button')) {
      const on = b.dataset.tab === tab;
      b.classList.toggle('is-on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    }
  }

  function renderBackup() {
    const note = backupNotice();
    for (const slot of document.querySelectorAll('.backup-slot')) {
      slot.innerHTML = note ? `<div class="backup-note" role="status"><span>${note}</span><span class="backup-actions">
        <button type="button" class="small-btn" data-act="export">Sao lưu ngay</button>
        <button type="button" class="link" data-act="snooze">Để sau</button></span></div>` : '';
    }
  }

  // ---------- Nhập vào ----------
  const tile = (ic, label, on, kind, val) =>
    `<button type="button" class="tile${on ? ' is-on' : ''}" data-act="pick" data-pick="${kind}" data-val="${esc(val)}" aria-pressed="${on}" style="--c:${ICONS[ic][0]}">${svg(ic)}<span>${esc(label)}</span></button>`;

  function renderEntry() {
    const inc = mode === 'inc';
    for (const b of document.querySelectorAll('[data-act=mode]')) {
      b.classList.toggle('is-on', b.dataset.mode === mode);
      b.setAttribute('aria-selected', b.dataset.mode === mode);
      b.disabled = !!editing && b.dataset.mode !== mode; // đang sửa thì không đổi loại khoản
    }
    if (!$('f-date').value) $('f-date').value = isoOf(new Date());
    const iso = $('f-date').value;
    const d = dateOf(iso);
    $('date-text').textContent = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} (${thu(d)})`;
    $('amt-label').textContent = inc ? 'Tiền thu' : 'Tiền chi';

    const m = month(iso.slice(0, 7));
    let g;
    if (inc) {
      g = INCOME_CATS.map(([k, label, ic]) => tile(ic, label, k === selInc, 'inc', k)).join('');
    } else {
      if (!m.categories.some((c) => c.name === selCat)) selCat = m.categories[0]?.name ?? null;
      g = m.categories.map((c) => tile(iconKey(c.name), c.name, c.name === selCat, 'cat', c.name)).join('') +
        `<button type="button" class="tile tile-edit" data-act="tab" data-tab="budget"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Chỉnh sửa ›</span></button>`;
    }
    $('f-cats').innerHTML = g;

    const old = editing && findEntry(editing);
    $('repeat-row').hidden = inc || !!(old && (state.recurring || []).some((r) => r.id === old.recId));
    $('f-submit').textContent = editing ? 'Lưu thay đổi' : inc ? 'Nhập khoản thu' : 'Nhập khoản chi';
    $('edit-actions').hidden = !editing;
    renderExtra();
  }

  function findEntry(e) {
    const m = state.months[e.key];
    return m && (e.kind === 'exp' ? m.transactions : m.incomes).find((x) => x.id === e.id);
  }

  // Phần dưới lưới danh mục: còn bao nhiêu trong hạng mục (tiền chi) / xem trước cách chia (tiền thu)
  function renderExtra() {
    const iso = $('f-date').value;
    const key = iso.slice(0, 7);
    const m = month(key);
    const typed = parseMoney($('f-amount').value);
    const amt = typed > 0 ? typed : 0;
    $('f-submit').classList.toggle('is-empty', !amt);
    const old = editing && editing.key === key ? findEntry(editing) : null;

    if (mode === 'exp') {
      const c = m.categories.find((x) => x.name === selCat);
      if (!c) { $('f-extra').innerHTML = ''; return; }
      const spent = (stats(m).spentBy[c.id] || 0) - (old && old.catId === c.id ? old.amount : 0);
      const left = c.planned - spent - amt;
      $('f-extra').innerHTML = c.planned > 0
        ? `<p class="hint">${esc(c.name)} · ${amt ? 'sau khoản này còn' : 'còn'} <b class="${left < 0 ? 'neg' : ''}">${left < 0 ? '−' : ''}${money(Math.abs(left))}</b> / ${money(c.planned)} trong ${monthName(key)}</p>`
        : `<p class="hint">${esc(c.name)} chưa có ngân sách trong ${monthName(key)} — nhập Tiền thu để app tự chia.</p>`;
      return;
    }

    const pcts = previewPcts(m);
    const total = sum(m.incomes, 'amount') - (old ? old.amount : 0) + amt;
    let rows = '';
    for (const g in GROUPS) {
      for (const c of m.categories.filter((x) => x.group === g)) {
        const p = pcts[c.id] || 0;
        rows += `<div class="split-row">${chip(iconKey(c.name))}<span class="split-name">${esc(c.name)}</span>
          <span class="split-pct">${pf.format(p)}%</span><span class="split-amt">${num((total * p) / 100)}</span></div>`;
      }
    }
    $('f-extra').innerHTML = `<div class="split">
      <div class="split-head"><b>Tự chia vào ngân sách ${monthName(key)}</b><span>Tổng thu tháng: <b>${money(total)}</b></span></div>
      ${rows || '<p class="hint">Tháng này chưa có hạng mục chi nào.</p>'}
      <p class="hint">Mỗi mục nhận đúng % của nó. Sửa % hoặc tích “Cố định” ở tab <button type="button" class="link" data-act="tab" data-tab="budget">Ngân sách</button>.</p></div>`;
  }

  function startEdit(kind, id, key) {
    editing = { kind, id, key };
    const item = findEntry(editing);
    if (!item) { editing = null; return; }
    mode = kind;
    $('f-date').value = item.date || `${key}-01`;
    $('f-note').value = item.note || '';
    $('f-amount').value = num(item.amount);
    $('f-repeat').checked = false;
    if (kind === 'exp') selCat = state.months[key].categories.find((c) => c.id === item.catId)?.name ?? selCat;
    else selInc = item.cat || 'other';
    tab = 'entry';
    render();
    window.scrollTo(0, 0);
  }
  function endEdit() {
    if (editing) $('f-date').value = isoOf(new Date());
    editing = null;
    $('f-note').value = '';
    $('f-amount').value = '';
    $('f-repeat').checked = false;
    $('f-amount').classList.remove('invalid');
  }

  // ---------- Lịch ----------
  function renderCalendar() {
    const key = state.view;
    const m = cur();
    const st = stats(m);
    $('cal-title').textContent = monthName(key);
    const [y, mo] = key.split('-').map(Number);
    const dim = new Date(y, mo, 0).getDate();
    const lead = (new Date(y, mo - 1, 1).getDay() + 6) % 7; // tuần bắt đầu thứ 2
    const exp = {};
    const inc = {};
    for (const t of m.transactions) exp[t.date] = (exp[t.date] || 0) + t.amount;
    for (const i of m.incomes) if (i.date) inc[i.date] = (inc[i.date] || 0) + i.amount;
    if (selDay && selDay.slice(0, 7) !== key) selDay = null;
    const today = isoOf(new Date());
    const left = st.income - st.spent;

    let h = `<div class="trio">
      <div><span>Thu nhập</span><b class="pos">${money(st.income)}</b></div>
      <div><span>Chi tiêu</span><b>${money(st.spent)}</b></div>
      <div><span>Còn lại</span><b class="${left < 0 ? 'neg' : ''}">${money(left)}</b></div></div>
      <div class="cal"><div class="cal-week">${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((w) => `<span>${w}</span>`).join('')}</div><div class="cal-grid">`;
    h += '<span></span>'.repeat(lead);
    for (let d = 1; d <= dim; d++) {
      const iso = `${key}-${pad(d)}`;
      h += `<button type="button" class="day${iso === today ? ' is-today' : ''}${iso === selDay ? ' is-sel' : ''}" data-act="day-sel" data-iso="${iso}" aria-label="Ngày ${d}">
        <span class="day-n">${d}</span>${inc[iso] ? `<small class="pos">+${compact(inc[iso])}</small>` : ''}${exp[iso] ? `<small>${compact(exp[iso])}</small>` : ''}</button>`;
    }
    h += `</div></div>`;

    const names = Object.fromEntries(m.categories.map((c) => [c.id, c.name]));
    const entries = [
      ...m.transactions.map((t) => ({ ...t, kind: 'exp', title: names[t.catId] || 'Chưa phân loại', ic: iconKey(names[t.catId] || '') })),
      ...m.incomes.filter((i) => i.date && i.amount > 0).map((i) => ({ ...i, kind: 'inc', title: incomeMeta(i.cat)[1], ic: incomeMeta(i.cat)[2] })),
    ].filter((e) => !selDay || e.date === selDay)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.at || 0) - (a.at || 0)));

    if (selDay) {
      const d = dateOf(selDay);
      h += `<div class="list-head"><span>${thu(d)}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}</span>
        <button type="button" class="link" data-act="day-sel" data-iso="">Xem cả tháng</button></div>`;
    }
    if (!entries.length) {
      h += `<div class="empty">${selDay ? 'Không có khoản nào trong ngày này.' : 'Chưa có khoản nào trong tháng này.'}
        <button type="button" class="link" data-act="tab" data-tab="entry">Nhập khoản mới</button></div>`;
    } else {
      let day = '';
      for (const e of entries) {
        if (e.date !== day) {
          day = e.date;
          const d = dateOf(day);
          const dayExp = exp[day] || 0;
          const dayInc = inc[day] || 0;
          h += `<div class="day-head"><span>${thu(d)}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}</span>
            <span>${dayInc ? `<b class="pos">+${num(dayInc)}</b>` : ''}${dayExp ? `<b>−${num(dayExp)}</b>` : ''}</span></div>`;
        }
        const sub = [e.recId && '↻ hằng tháng', e.note && esc(e.note)].filter(Boolean).join(' · ');
        h += `<button type="button" class="entry" data-act="edit" data-kind="${e.kind}" data-id="${e.id}" data-key="${key}">
          ${chip(e.ic)}<span class="entry-main"><span class="entry-title">${esc(e.title)}</span>${sub ? `<span class="entry-sub">${sub}</span>` : ''}</span>
          <span class="entry-amt${e.kind === 'inc' ? ' pos' : ''}">${e.kind === 'inc' ? '+' : ''}${num(e.amount)}</span></button>`;
      }
    }
    $('cal').innerHTML = h;
  }

  // ---------- Ngân sách ----------
  function renderBudget() {
    const m = cur();
    const st = stats(m);
    const ti = timeInfo(state.view);
    $('bud-title').textContent = monthName(state.view);
    renderSummary(st, ti);
    renderPlan(m, st, ti);
  }

  function renderSummary(st, ti) {
    const unalloc = st.income - st.planned;
    const left = st.planned - st.spent;
    const perDay = ti.daysLeft > 0 ? Math.max(0, left) / ti.daysLeft : null;
    const stat = (label, val, sub, cls = '') =>
      `<div class="stat ${cls}"><div class="stat-label">${label}</div><div class="stat-val">${val}</div><div class="stat-sub">${sub}</div></div>`;
    $('summary').innerHTML =
      stat('Thu nhập', money(st.income), 'trong tháng', 'pos') +
      stat('Đã phân bổ', money(st.planned), st.income > 0 ? `${Math.round((st.planned / st.income) * 100)}% thu nhập` : 'chưa có thu nhập') +
      stat(unalloc < 0 ? 'Phân bổ vượt' : 'Chưa phân bổ', money(Math.abs(unalloc)),
        unalloc < 0 ? 'kế hoạch lớn hơn thu nhập' : unalloc === 0 && st.income > 0 ? 'mỗi đồng đều có việc' : 'chưa giao việc',
        unalloc < 0 ? 'is-bad' : '') +
      stat('Đã chi', money(st.spent), st.planned > 0 ? `${Math.round((st.spent / st.planned) * 100)}% ngân sách` : '—') +
      stat(left < 0 ? 'Vượt ngân sách' : 'Còn lại', money(Math.abs(left)), 'so với kế hoạch', left < 0 ? 'is-bad' : '') +
      stat('Mỗi ngày còn', perDay === null ? '—' : money(perDay), ti.when === 'past' ? 'tháng đã kết thúc' : `chia đều ${ti.daysLeft} ngày`, 'is-key');
  }

  function renderPlan(m, st, ti) {
    const pctTotal = sum(m.categories, 'pct');
    let h = `<div class="card smart"><label class="switch"><input type="checkbox" id="smart-toggle"${m.smart ? ' checked' : ''}><span class="knob"></span>
      <span><b>Chi tiêu thông minh</b><small>${m.smart
        ? `Đã chia <b class="${pctTotal > 100.05 ? 'neg' : ''}">${pf.format(pctTotal)}%</b> thu nhập theo %`
        : 'Tự chia thu nhập theo % cho từng hạng mục'}</small></span></label>
      ${m.smart ? '<button type="button" class="link" data-act="suggest">Dùng % gợi ý</button>' : ''}</div>`;

    // Thu nhập
    const incomes = m.incomes.filter((i) => i.amount > 0 || i.date);
    h += `<div class="card"><div class="card-head"><h2>Thu nhập</h2><b class="pos">${money(st.income)}</b></div>`;
    for (const i of incomes) {
      const [, label, ic] = incomeMeta(i.cat);
      const d = i.date ? dateOf(i.date) : null;
      h += `<button type="button" class="entry" data-act="edit" data-kind="inc" data-id="${i.id}" data-key="${state.view}">
        ${chip(i.cat ? ic : 'wallet')}<span class="entry-main"><span class="entry-title">${esc(i.cat ? label : i.name || 'Thu nhập')}</span>
        <span class="entry-sub">${[d && `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`, i.note && esc(i.note)].filter(Boolean).join(' · ') || 'Thu nhập dự kiến'}</span></span>
        <span class="entry-amt pos">${num(i.amount)}</span></button>`;
    }
    h += `<button type="button" class="add" data-act="new-income">+ Nhập khoản thu</button></div>`;

    // Tỉ lệ 50/30/20 theo thu nhập
    const byGroup = {};
    for (const g in GROUPS) byGroup[g] = sum(m.categories.filter((c) => c.group === g), 'planned');
    const base = Math.max(st.income, st.planned) || 1;
    h += `<div class="card"><div class="ratio-bar">`;
    for (const g in GROUPS) h += `<i style="width:${(byGroup[g] / base) * 100}%;background:${GROUPS[g].color}"></i>`;
    h += `<span class="tick" style="left:50%"></span><span class="tick" style="left:80%"></span></div><div class="ratio-legend">`;
    for (const g in GROUPS) {
      const pct = st.income > 0 ? Math.round((byGroup[g] / st.income) * 100) : 0;
      h += `<span><i class="sw" style="background:${GROUPS[g].color}"></i>${GROUPS[g].label} <b>${pct}%</b> / ${GROUPS[g].target}%</span>`;
    }
    h += `</div></div>`;

    // Hạng mục theo nhóm
    for (const g in GROUPS) {
      const cats = m.categories.filter((c) => c.group === g);
      const gSpent = cats.reduce((s, c) => s + (st.spentBy[c.id] || 0), 0);
      h += `<div class="card"><div class="card-head"><h2><i class="dot" style="background:${GROUPS[g].color}"></i>${GROUPS[g].label}</h2>
        <span class="muted">đã chi <b>${num(gSpent)}</b> / ${num(byGroup[g])}</span></div>`;
      for (const c of cats) {
        const spent = st.spentBy[c.id] || 0;
        const left = c.planned - spent;
        const ratio = c.planned > 0 ? spent / c.planned : spent > 0 ? 1.01 : 0;
        const barCls = ratio > 1 ? 'over' : ti.when === 'now' && ratio > ti.elapsed + 0.1 ? 'warn' : '';
        h += `<div class="cat-row">
          <div class="cat-top">${chip(iconKey(c.name))}${cell('cat', c.id, 'name', c.name)}
            ${cell('cat', c.id, 'planned', num(c.planned), true, m.smart && (c.locked || st.income === 0))}
            <button type="button" class="del" data-act="del-cat" data-id="${c.id}" aria-label="Xoá ${esc(c.name)}">×</button></div>
          <div class="bar ${barCls}" title="${Math.round(ratio * 100)}% ngân sách"><i style="width:${Math.min(100, ratio * 100)}%"></i>
            ${ti.when === 'now' ? `<span class="pace" style="left:${ti.elapsed * 100}%" title="Hôm nay"></span>` : ''}</div>
          <div class="cat-bottom"><span class="muted">Đã chi <b>${num(spent)}</b> · ${left < 0 ? '<span class="neg">Vượt' : 'Còn'} <b>${num(Math.abs(left))}</b>${left < 0 ? '</span>' : ''}</span>
            ${m.smart ? `<span class="pct-lock"><span class="pct">${cell('cat', c.id, 'pct', pf.format(c.pct || 0), true, c.locked)}%</span>
              <label class="lock"><input type="checkbox" data-lock="${c.id}" data-fid="cat:${c.id}:lock"${c.locked ? ' checked' : ''}> Cố định</label></span>` : ''}</div>
        </div>`;
      }
      h += `<button type="button" class="add" data-act="add-cat" data-group="${g}">+ Thêm hạng mục</button></div>`;
    }

    if (st.spentBy['']) {
      h += `<div class="card"><div class="card-head"><h2>Chưa phân loại</h2><b class="neg">${money(st.spentBy[''])}</b></div></div>`;
    }
    $('plan').innerHTML = h;
  }

  function cell(kind, id, field, value, isNum, disabled) {
    return `<input class="cell${isNum ? ' num' : ''}" type="text" ${isNum ? 'inputmode="decimal"' : 'maxlength="40"'}${disabled ? ' disabled' : ''}
      data-kind="${kind}" data-id="${id}" data-field="${field}" data-fid="${kind}:${id}:${field}" value="${esc(value)}"
      aria-label="${field === 'name' ? 'Tên' : field === 'pct' ? 'Phần trăm thu nhập' : 'Số tiền'}">`;
  }

  // ---------- Báo cáo: 6 tháng gần nhất có dữ liệu. Hạng mục được ghép giữa các tháng theo tên. ----------
  function renderReport() {
    const keys = Object.keys(state.months).filter((k) => {
      const s = stats(state.months[k]);
      return s.spent > 0 || s.planned > 0;
    }).sort().slice(-6);
    if (!keys.length) {
      $('report').innerHTML = `<div class="empty">Chưa có gì để báo cáo — nhập thu nhập hoặc vài khoản chi trước đã.</div>`;
      return;
    }
    const rows = keys.map((key) => ({ key, m: state.months[key], ...stats(state.months[key]) }));
    if (!keys.includes(reportSel)) reportSel = keys.includes(state.view) ? state.view : keys.at(-1);
    const isOver = (spent, planned) => spent > 0 && spent > planned;

    // Chỉ tính các tháng đã kết thúc (tháng đang chạy làm lệch trung bình), trừ khi chưa có tháng nào xong.
    // Tiền chuyển vào nhóm Tiết kiệm được tính là để dành, không phải tiêu.
    const nowKey = keyOf(new Date());
    const closed = rows.filter((r) => r.key < nowKey);
    const base = closed.length ? closed : rows;
    const span = closed.length ? `${closed.length} tháng đã xong` : 'tháng này';
    for (const r of base) {
      const saveIds = new Set(r.m.categories.filter((c) => c.group === 'save').map((c) => c.id));
      r.consumed = sum(r.m.transactions.filter((t) => !saveIds.has(t.catId)), 'amount');
    }
    const withIncome = base.filter((r) => r.income > 0);
    const incomeSum = sum(withIncome, 'income');
    const saveRate = incomeSum ? Math.round(((incomeSum - sum(withIncome, 'consumed')) / incomeSum) * 100) : null;

    const cats = new Map();
    for (const r of rows) {
      const add = (name, spent, planned) => {
        const c = cats.get(name) || { name, total: 0, cells: {} };
        const cl = (c.cells[r.key] ||= { spent: 0, planned: 0 });
        cl.spent += spent; cl.planned += planned; c.total += spent;
        cats.set(name, c);
      };
      for (const c of r.m.categories) add(c.name, r.spentBy[c.id] || 0, c.planned);
      if (r.spentBy['']) add('Chưa phân loại', r.spentBy[''], Infinity);
    }
    const catRows = [...cats.values()].filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
    for (const c of catRows) c.over = keys.filter((k) => c.cells[k] && isOver(c.cells[k].spent, c.cells[k].planned)).length;
    const worst = catRows.reduce((a, b) => (b.over > (a?.over || 0) ? b : a), null);

    const tileStat = (label, val, sub) => `<div class="stat"><div class="stat-label">${label}</div><div class="stat-val">${val}</div><div class="stat-sub">${sub}</div></div>`;
    let h = `<div class="summary rep-tiles">` +
      tileStat('Chi trung bình', money(sum(base, 'spent') / base.length), `mỗi tháng · ${span}`) +
      tileStat('Để dành được', saveRate === null ? '—' : `${saveRate}%`, saveRate === null ? 'chưa có thu nhập' : `thu nhập · gồm tiền tiết kiệm · ${span}`) +
      tileStat('Hay vượt nhất', worst ? esc(worst.name) : 'Chưa mục nào', worst ? `vượt ${worst.over}/${rows.length} tháng` : 'mọi hạng mục đều trong kế hoạch') +
      `</div>`;

    // Biểu đồ: cột = đã chi, vạch ngang = kế hoạch
    const max = Math.max(...rows.map((r) => Math.max(r.spent, r.planned))) || 1;
    const peak = rows.reduce((a, b) => (b.spent > a.spent ? b : a));
    h += `<div class="card"><div class="card-head"><h2>Chi tiêu so với kế hoạch</h2><span class="muted">6 tháng gần nhất</span></div>
      <div class="legend"><span><i class="sw" style="background:var(--bar)"></i>Đã chi</span><span><i class="sw-line"></i>Kế hoạch</span>
      <span><i class="sw" style="background:var(--danger)"></i>▲ Vượt kế hoạch</span></div><div class="chart">`;
    for (const r of rows) {
      const over = isOver(r.spent, r.planned);
      const hPct = (r.spent / max) * 100;
      const label = (over ? '▲ ' : '') + (r.key === reportSel || r === peak ? compact(r.spent) : '');
      h += `<button type="button" class="col${r.key === reportSel ? ' is-sel' : ''}${over ? ' is-over' : ''}" data-act="rep-sel" data-key="${r.key}"
        title="${monthName(r.key)}: đã chi ${money(r.spent)} / kế hoạch ${money(r.planned)}">
        <span class="col-plot"><span class="col-val" style="bottom:${hPct}%">${label}</span><i class="col-bar" style="height:${hPct}%"></i>
        ${r.planned > 0 ? `<b class="col-plan" style="bottom:${(r.planned / max) * 100}%"></b>` : ''}</span>
        <span class="col-name">T${+r.key.slice(5)}<small>${r.key.slice(2, 4)}</small></span></button>`;
    }
    const s = rows.find((r) => r.key === reportSel);
    const diff = s.planned - s.spent;
    h += `</div><p class="rep-detail"><b>${monthName(s.key)}</b> — đã chi <b>${money(s.spent)}</b> / kế hoạch <b>${money(s.planned)}</b>
      · ${diff < 0 ? `<span class="neg">vượt ${money(-diff)}</span>` : `còn ${money(diff)}`}
      <button type="button" class="link" data-act="goto" data-key="${s.key}">Xem lịch tháng này</button></p></div>`;

    // Bảng hạng mục × tháng (cũng là dạng bảng của biểu đồ)
    if (catRows.length) {
      h += `<div class="card"><div class="card-head"><h2>Đã chi theo hạng mục</h2></div><div class="table-wrap"><table class="rep-table"><thead><tr><th>Hạng mục</th>` +
        keys.map((k) => `<th>T${+k.slice(5)}/${k.slice(2, 4)}</th>`).join('') + `<th>Vượt</th></tr></thead><tbody>`;
      for (const c of catRows) {
        h += `<tr><th>${esc(c.name)}</th>` + keys.map((k) => {
          const cl = c.cells[k];
          if (!cl) return '<td class="muted">–</td>';
          return isOver(cl.spent, cl.planned)
            ? `<td class="neg" title="Kế hoạch ${money(cl.planned)}">▲ ${compact(cl.spent)}</td>` : `<td>${compact(cl.spent)}</td>`;
        }).join('') + `<td class="${c.over ? 'neg' : 'muted'}">${c.over}/${keys.length}</td></tr>`;
      }
      h += `</tbody><tfoot><tr><th>Tổng đã chi</th>` + rows.map((r) => `<td>${compact(r.spent)}</td>`).join('') + `<td></td></tr>
        <tr><th>Kế hoạch</th>` + rows.map((r) => `<td>${compact(r.planned)}</td>`).join('') + `<td></td></tr></tfoot></table></div>
        <p class="hint">▲ = chi nhiều hơn kế hoạch của hạng mục trong tháng đó. k = nghìn, tr = triệu đồng.</p></div>`;
    }
    $('report').innerHTML = h;
  }

  // ---------- Khác ----------
  function renderMore() {
    const d = state.lastBackup && new Date(state.lastBackup);
    const rules = state.recurring || [];
    let h = `<div class="card"><div class="card-head"><h2>Sao lưu dữ liệu</h2></div>
      <p class="hint">Dữ liệu chỉ nằm trong trình duyệt của máy này. ${d ? `Sao lưu gần nhất: <b>${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}</b>.` : '<b>Chưa sao lưu lần nào.</b>'}</p>
      <div class="btn-row"><button type="button" class="small-btn" data-act="export">Sao lưu</button>
      <button type="button" class="small-btn ghost" data-act="import">Khôi phục từ tệp</button></div></div>`;

    h += `<div class="card"><div class="card-head"><h2>Khoản cố định hằng tháng</h2>${rules.length ? `<span class="muted">${money(sum(rules, 'amount'))}</span>` : ''}</div>`;
    if (!rules.length) {
      h += `<p class="hint">Chưa có. Khi nhập một khoản chi, tích “Lặp lại hằng tháng” để app tự ghi khoản đó vào các tháng sau.</p>`;
    } else {
      for (const r of rules) {
        h += `<div class="rec-row">${chip(iconKey(r.cat || ''))}<span class="entry-main"><span class="entry-title">${esc(r.note || r.cat || 'Khoản chi')}</span>
          <span class="entry-sub">${esc(r.cat || 'Chưa phân loại')} · ngày ${r.day} hằng tháng</span></span>
          ${cell('rec', r.id, 'amount', num(r.amount), true)}
          <button type="button" class="del" data-act="del-rec" data-id="${r.id}" aria-label="Bỏ khoản cố định">×</button></div>`;
      }
      h += `<p class="hint">Đổi số tiền hoặc bỏ một khoản chỉ ảnh hưởng từ tháng sau; khoản đã ghi giữ nguyên.</p>`;
    }
    h += `</div><div class="card"><div class="card-head"><h2>Mẹo</h2></div><ul class="tips">
      <li>Gõ nhanh số tiền: <b>50k</b>, <b>1.5tr</b>, <b>2ty</b>.</li>
      <li>Chạm vào một khoản ở tab Lịch hoặc Ngân sách để sửa hoặc xoá.</li>
      <li>Nhập Tiền thu là ngân sách tháng tự chia theo % của từng hạng mục.</li>
      <li>Tháng mới tự dùng lại bộ hạng mục và % của tháng trước.</li></ul></div>`;
    $('more').innerHTML = h;
  }

  // Lưu rồi vẽ lại; giữ con trỏ ở ô đang gõ (Tab sang ô kế tiếp không bị mất focus)
  function commit(focusFid, navOnly) {
    applySmart(cur());
    if (!navOnly) {
      state.lastChange = Date.now();
      state.firstChange ||= state.lastChange;
      navigator.storage?.persist?.().catch(() => {}); // xin trình duyệt đừng tự dọn dữ liệu của app
    }
    save();
    setTimeout(() => {
      const fid = focusFid || document.activeElement?.dataset?.fid;
      render();
      if (fid) {
        const el = document.querySelector(`[data-fid="${fid}"]`);
        if (el && !el.disabled) { el.focus(); el.select(); }
      }
    });
  }

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 3000);
  }

  function shake(el) {
    el.classList.remove('invalid');
    void el.offsetWidth;
    el.classList.add('invalid');
  }

  // ================= Sự kiện =================
  const shiftMonth = (delta) => {
    const [y, mo] = state.view.split('-').map(Number);
    state.view = keyOf(new Date(y, mo - 1 + delta, 1));
  };

  const actions = {
    tab(el) { tab = el.dataset.tab; showTab(); window.scrollTo(0, 0); },
    mode(el) { if (editing) return; mode = el.dataset.mode; renderEntry(); },
    pick(el) {
      if (el.dataset.pick === 'inc') selInc = el.dataset.val; else selCat = el.dataset.val;
      for (const t of document.querySelectorAll('#f-cats .tile')) {
        const on = t === el;
        t.classList.toggle('is-on', on);
        t.setAttribute('aria-pressed', on);
      }
      renderExtra();
    },
    day(el) {
      const d = dateOf($('f-date').value || isoOf(new Date()));
      d.setDate(d.getDate() + Number(el.dataset.d));
      $('f-date').value = isoOf(d);
      renderEntry();
    },
    prev() { shiftMonth(-1); selDay = null; commit(null, true); },
    next() { shiftMonth(1); selDay = null; commit(null, true); },
    'day-sel'(el) { selDay = el.dataset.iso && el.dataset.iso !== selDay ? el.dataset.iso : null; renderCalendar(); },
    edit(el) { startEdit(el.dataset.kind, el.dataset.id, el.dataset.key); },
    'cancel-edit'() { endEdit(); render(); },
    'delete-entry'() {
      if (!editing || !confirm('Xoá khoản này khỏi sổ?')) return;
      const m = state.months[editing.key];
      if (editing.kind === 'exp') m.transactions = m.transactions.filter((t) => t.id !== editing.id);
      else m.incomes = m.incomes.filter((i) => i.id !== editing.id);
      endEdit();
      commit(null);
      toast('Đã xoá khoản này.');
    },
    'new-income'() {
      endEdit();
      mode = 'inc';
      $('f-date').value = state.view === keyOf(new Date()) ? isoOf(new Date()) : `${state.view}-01`;
      tab = 'entry';
      render();
      window.scrollTo(0, 0);
    },
    'rep-sel'(el) { reportSel = el.dataset.key; renderReport(); },
    goto(el) { state.view = el.dataset.key; selDay = null; tab = 'calendar'; commit(null, true); window.scrollTo(0, 0); },
    snooze() { state.snoozeUntil = Date.now() + SNOOZE; save(); renderBackup(); },
    'add-cat'(el) {
      const item = { id: uid(), name: 'Hạng mục mới', group: el.dataset.group, planned: 0, pct: 0 };
      cur().categories.push(item);
      commit(`cat:${item.id}:name`);
    },
    'del-cat'(el) {
      const m = cur();
      const c = m.categories.find((x) => x.id === el.dataset.id);
      const used = m.transactions.filter((t) => t.catId === c.id);
      if (used.length && !confirm(`"${c.name}" đang có ${used.length} khoản chi. Xoá hạng mục và chuyển các khoản này sang "Chưa phân loại"?`)) return;
      used.forEach((t) => { t.catId = ''; });
      m.categories = m.categories.filter((x) => x.id !== c.id);
      if (m.smart) rebalance(m);
      commit();
    },
    suggest() {
      const m = cur();
      const sug = suggestPcts(m);
      for (const c of m.categories) if (!c.locked) c.pct = sug[c.id];
      rebalance(m);
      commit();
    },
    'del-rec'(el) {
      state.recurring = state.recurring.filter((r) => r.id !== el.dataset.id);
      commit();
    },
    async export() {
      const text = JSON.stringify(state, null, 2);
      const name = `so-ngan-sach-${isoOf(new Date())}`;
      // Trên điện thoại: mở bảng chia sẻ để lưu vào Tệp / Drive / gửi cho chính mình. Không được thì tải tệp về.
      const shareable = matchMedia('(pointer: coarse)').matches && [
        new File([text], `${name}.json`, { type: 'application/json' }),
        new File([text], `${name}.txt`, { type: 'text/plain' }),
      ].find((f) => navigator.canShare?.({ files: [f] }));
      let shared = false;
      if (shareable) {
        try { await navigator.share({ files: [shareable], title: 'Sao lưu Sổ ngân sách' }); shared = true; }
        catch (err) { if (err.name === 'AbortError') return; }
      }
      if (!shared) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        a.download = `${name}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
      state.lastBackup = Date.now();
      save();
      renderBackup();
      renderMore();
      toast('Đã sao lưu.');
    },
    import() { $('import-file').click(); },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (el && !el.disabled && actions[el.dataset.act]) actions[el.dataset.act](el);
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.id === 'f-date') { if (!el.value) el.value = isoOf(new Date()); renderEntry(); return; }
    if (el.id === 'import-file') return importFile(el);
    if (el.id === 'f-amount') { const v = parseMoney(el.value); if (v > 0) el.value = num(v); return; }
    const m = cur();
    if (el.id === 'smart-toggle') {
      if (el.checked) enableSmart(m); else m.smart = false;
      return commit();
    }
    if (el.dataset.lock) {
      m.categories.find((c) => c.id === el.dataset.lock).locked = el.checked;
      return commit();
    }
    if (!el.dataset.field) return;
    const list = { cat: m.categories, rec: state.recurring }[el.dataset.kind];
    const item = list && list.find((x) => x.id === el.dataset.id);
    if (!item) return;
    if (el.dataset.field === 'name') {
      const name = el.value.trim() || item.name;
      if (el.dataset.kind === 'cat') for (const r of state.recurring || []) if (r.cat === item.name) r.cat = name;
      item.name = name;
    } else if (el.dataset.field === 'pct') {
      const v = parseFloat(el.value.replace('%', '').replace(',', '.'));
      if (v >= 0) { item.pct = Math.min(100, v); rebalance(m, item.id); }
    } else {
      const v = parseMoney(el.value || '0');
      const income = sum(m.incomes, 'amount');
      if (isNaN(v)) { /* giữ giá trị cũ */ }
      else if (m.smart && el.dataset.kind === 'cat') { item.pct = (v / income) * 100; rebalance(m, item.id); } // sửa số tiền → quy ngược ra %
      else item[el.dataset.field] = v;
    }
    commit();
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'f-amount') renderExtra();
  });

  document.addEventListener('focusin', (e) => {
    if (e.target.classList.contains('cell')) e.target.select();
  });

  $('entry').addEventListener('submit', (e) => {
    e.preventDefault();
    const amtEl = $('f-amount');
    const amount = parseMoney(amtEl.value);
    if (!(amount > 0)) { shake(amtEl); amtEl.focus(); return; }
    const iso = $('f-date').value || isoOf(new Date());
    const key = iso.slice(0, 7);
    const note = $('f-note').value.trim();

    // Đang sửa: gỡ khoản cũ ra (giữ id, thời điểm tạo, liên kết khoản cố định) rồi ghi lại vào đúng tháng của ngày mới
    let old = null;
    if (editing) {
      const src = state.months[editing.key];
      const list = editing.kind === 'exp' ? src.transactions : src.incomes;
      const idx = list.findIndex((x) => x.id === editing.id);
      if (idx >= 0) old = list.splice(idx, 1)[0];
    }
    const m = month(key);
    const base = { ...(old || {}), id: old?.id || uid(), at: old?.at || Date.now(), date: iso, note, amount };
    let msg;

    if (mode === 'exp') {
      const c = m.categories.find((x) => x.name === selCat);
      const t = { ...base, catId: c ? c.id : '' };
      if ($('f-repeat').checked && !$('repeat-row').hidden) {
        const rule = { id: uid(), note, amount, cat: c ? c.name : '', day: +iso.slice(8) };
        (state.recurring ||= []).push(rule);
        (m.recDone ||= []).push(rule.id); // khoản đang ghi chính là lần của tháng này
        t.recId = rule.id;
      }
      m.transactions.push(t);
      msg = `${old ? 'Đã lưu' : 'Đã ghi'} ${money(amount)} · ${c ? c.name : 'Chưa phân loại'}`;
      if (c && c.planned > 0) {
        const left = c.planned - (stats(m).spentBy[c.id] || 0);
        msg += left < 0 ? ` — vượt ${money(-left)}` : ` — còn ${money(left)}`;
      }
    } else {
      const [, label] = incomeMeta(selInc);
      if (!m.smart) enableSmart(m); // nhập thu nhập = bật chia tự động theo %
      m.incomes.push({ ...base, cat: selInc, name: label });
      applySmart(m);
      msg = `${old ? 'Đã lưu' : 'Đã nhập'} ${money(amount)} · ngân sách ${monthName(key)} đã chia lại theo %`;
    }
    state.view = key;
    endEdit();
    commit();
    toast(msg);
  });

  function importFile(input) {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    file.text().then((text) => {
      const data = JSON.parse(text);
      if (!data || typeof data.months !== 'object') throw new Error('format');
      if (!confirm('Thay toàn bộ dữ liệu hiện tại bằng dữ liệu trong tệp này?')) return;
      state = { view: keyOf(new Date()), months: data.months, recurring: data.recurring || [], lastBackup: Date.now() }; // vừa khớp với tệp sao lưu
      commit(null, true);
      toast('Đã khôi phục dữ liệu.');
    }).catch(() => alert('Tệp không đúng định dạng của Sổ ngân sách.'));
  }

  render();
})();

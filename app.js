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

  const $ = (id) => document.getElementById(id);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = (n) => String(n).padStart(2, '0');
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const isoOf = (d) => `${keyOf(d)}-${pad(d.getDate())}`;
  const sum = (list, f) => list.reduce((s, x) => s + (x[f] || 0), 0);
  const nf = new Intl.NumberFormat('vi-VN');
  const num = (n) => nf.format(Math.round(n));
  const money = (n) => `${num(n)} ₫`;
  const pf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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

  // ---------- State ----------
  let state = load();
  let filter = '';
  let recOpen = false;
  let editing = null; // id khoản chi đang sửa trong form

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
  function blankMonth() {
    return {
      incomes: [{ id: uid(), name: 'Lương', amount: 0 }],
      categories: DEFAULT_CATS.map(([name, group]) => ({ id: uid(), name, group, planned: 0 })),
      transactions: [],
    };
  }
  function cur() {
    return (state.months[state.view] ||= blankMonth());
  }
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
  function enableSmart(m) {
    const st = stats(m);
    if (st.planned > 0 && st.income > 0) { // giữ nguyên kế hoạch đang có
      for (const c of m.categories) c.pct = (c.planned / st.income) * 100;
    } else if (!m.pctInit) {
      const sug = suggestPcts(m);
      for (const c of m.categories) c.pct = sug[c.id];
    }
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
  function prevPlanKey() {
    return Object.keys(state.months).filter((k) => k < state.view).sort().reverse().find((k) => {
      const s = stats(state.months[k]);
      return s.income > 0 || s.planned > 0;
    });
  }
  // Trả về lời nhắc sao lưu, hoặc null nếu chưa cần nhắc
  function backupNotice() {
    const now = Date.now();
    const last = state.lastBackup || 0;
    if (!(state.lastChange > last) || now < (state.snoozeUntil || 0)) return null;
    if (!last) return now - state.firstChange > REMIND_FIRST ? 'Sổ chưa được sao lưu lần nào — dữ liệu chỉ nằm trên máy này.' : null;
    return now - last > REMIND_EVERY ? `Lần sao lưu gần nhất cách đây ${Math.floor((now - last) / DAY)} ngày.` : null;
  }
  function renderBackup() {
    const note = backupNotice();
    $('backup-note').hidden = !note;
    $('backup-note').innerHTML = note ? `<span>${note}</span><span class="backup-actions">
      <button type="button" class="ink-btn" data-act="export">Sao lưu ngay</button>
      <button type="button" class="link" data-act="snooze">Để sau</button></span>` : '';
    const d = state.lastBackup && new Date(state.lastBackup);
    $('backup-status').textContent = d ? `Sao lưu gần nhất: ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}.` : 'Chưa sao lưu lần nào.';
  }
  const monthName = (key) => { const [y, m] = key.split('-'); return `Tháng ${+m}/${y}`; };

  // ---------- Render ----------
  // Khoản cố định hằng tháng: mỗi quy tắc tự ghi đúng một lần vào tháng hiện tại, lần đầu mở app trong tháng đó.
  // Quy tắc nhớ hạng mục theo tên vì mỗi tháng có bộ id hạng mục riêng.
  function applyRecurring() {
    const rules = state.recurring || [];
    if (!rules.length) return;
    const key = keyOf(new Date());
    const m = (state.months[key] ||= blankMonth());
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

  function renderRecurring() {
    const rules = state.recurring || [];
    let h = '';
    if (rules.length) {
      h = `<details class="rec"${recOpen ? ' open' : ''}><summary>Khoản cố định hằng tháng <span class="num">${rules.length} khoản · ${money(sum(rules, 'amount'))}</span></summary>`;
      for (const r of rules) {
        h += `<div class="tx"><span class="tx-main"><span class="tx-note">${esc(r.note || r.cat || 'Khoản chi')}</span>
          <span class="tx-cat">${esc(r.cat || 'Chưa phân loại')} · ngày ${r.day} hằng tháng</span></span>
          ${cell('rec', r.id, 'amount', num(r.amount), true)}
          <button type="button" class="del" data-act="del-rec" data-id="${r.id}" aria-label="Bỏ khoản cố định">×</button></div>`;
      }
      h += `<p class="rec-hint">Đổi số tiền hoặc bỏ một khoản chỉ ảnh hưởng từ tháng sau; khoản đã ghi trong sổ giữ nguyên.</p></details>`;
    }
    $('recurring').innerHTML = h;
  }

  function render() {
    applyRecurring();
    renderRecurring();
    const m = cur();
    const st = stats(m);
    const ti = timeInfo(state.view);
    renderHead();
    renderBackup();
    renderSummary(st, ti);
    renderPlan(m, st, ti);
    renderCatOptions(m);
    renderTx(m);
  }

  function renderHead() {
    const [y, mo] = state.view.split('-');
    $('month-label').innerHTML = `Tháng ${+mo}<small>${y}</small>`;
    const d = $('tx-date');
    const ti = timeInfo(state.view);
    d.min = `${state.view}-01`;
    d.max = `${state.view}-${pad(ti.dim)}`;
    if (!d.value || d.value.slice(0, 7) !== state.view) d.value = ti.when === 'now' ? isoOf(new Date()) : d.min;
  }

  function renderSummary(st, ti) {
    const unalloc = st.income - st.planned;
    const left = st.planned - st.spent;
    const perDay = ti.daysLeft > 0 ? Math.max(0, left) / ti.daysLeft : null;
    const usedPct = st.planned > 0 ? Math.round((st.spent / st.planned) * 100) : 0;
    const stat = (label, val, sub, cls = '') =>
      `<div class="stat ${cls}"><div class="stat-label">${label}</div><div class="stat-val">${val}</div><div class="stat-sub">${sub}</div></div>`;
    $('summary').innerHTML =
      stat('Thu nhập', money(st.income), 'dự kiến trong tháng') +
      stat('Đã phân bổ', money(st.planned), st.income > 0 ? `${Math.round((st.planned / st.income) * 100)}% thu nhập` : 'chưa nhập thu nhập') +
      stat(unalloc < 0 ? 'Phân bổ vượt' : 'Chưa phân bổ', money(Math.abs(unalloc)),
        unalloc < 0 ? 'kế hoạch lớn hơn thu nhập' : unalloc === 0 && st.income > 0 ? 'mỗi đồng đều có việc' : 'chưa giao việc',
        unalloc < 0 ? 'is-bad' : unalloc === 0 && st.income > 0 ? 'is-good' : '') +
      stat('Đã chi', money(st.spent), st.planned > 0 ? `${usedPct}% ngân sách` : '—') +
      stat(left < 0 ? 'Vượt ngân sách' : 'Còn lại', money(Math.abs(left)), 'so với kế hoạch', left < 0 ? 'is-bad' : '') +
      stat('Mỗi ngày còn', perDay === null ? '—' : money(perDay),
        ti.when === 'past' ? 'tháng đã kết thúc' : `chia đều cho ${ti.daysLeft} ngày`, 'is-key');
  }

  function renderPlan(m, st, ti) {
    let h = '';
    const prev = prevPlanKey();
    if (prev && st.income === 0 && st.planned === 0 && !m.transactions.some((t) => !t.recId)) {
      h += `<div class="banner"><span>Tháng này chưa có kế hoạch.</span>
        <button type="button" class="ink-btn" data-act="copy-prev">Chép từ ${monthName(prev)}</button></div>`;
    }

    h += `<div class="block"><div class="block-head"><h3>Thu nhập</h3><span class="block-meta"><b>${money(st.income)}</b></span></div>
      <div class="cols inc"><span>Nguồn thu</span><span>Số tiền</span><span></span></div>`;
    for (const i of m.incomes) {
      h += `<div class="line"><div class="row inc">
        ${cell('inc', i.id, 'name', i.name)}${cell('inc', i.id, 'amount', num(i.amount), true)}
        <button type="button" class="del" data-act="del-inc" data-id="${i.id}" aria-label="Xoá ${esc(i.name)}">×</button></div></div>`;
    }
    h += `<button type="button" class="add" data-act="add-inc">+ Thêm nguồn thu</button></div>`;

    const pctTotal = sum(m.categories, 'pct');
    h += `<div class="smart"><label><input type="checkbox" id="smart-toggle"${m.smart ? ' checked' : ''}> Chi tiêu thông minh</label>
      <span class="block-meta">${m.smart
        ? `đã chia <b class="${pctTotal > 100.05 ? 'neg' : ''}">${pf.format(pctTotal)}%</b> thu nhập · <button type="button" class="link" data-act="suggest">Dùng % gợi ý</button>`
        : 'tự chia thu nhập theo % cho từng hạng mục'}</span></div>`;

    // Tỉ lệ 50/30/20 theo thu nhập
    const byGroup = {};
    for (const g in GROUPS) byGroup[g] = sum(m.categories.filter((c) => c.group === g), 'planned');
    const base = Math.max(st.income, st.planned) || 1;
    h += `<div class="ratio"><div class="ratio-bar">`;
    for (const g in GROUPS) h += `<i style="width:${(byGroup[g] / base) * 100}%;background:${GROUPS[g].color}"></i>`;
    h += `<span class="tick" style="left:50%"></span><span class="tick" style="left:80%"></span></div><div class="ratio-legend">`;
    for (const g in GROUPS) {
      const pct = st.income > 0 ? Math.round((byGroup[g] / st.income) * 100) : 0;
      h += `<span><i class="sw" style="background:${GROUPS[g].color}"></i>${GROUPS[g].label} <b>${pct}%</b> / ${GROUPS[g].target}%</span>`;
    }
    h += `</div></div>`;

    for (const g in GROUPS) {
      const cats = m.categories.filter((c) => c.group === g);
      const gSpent = cats.reduce((s, c) => s + (st.spentBy[c.id] || 0), 0);
      h += `<div class="block"><div class="block-head">
        <h3><i class="dot" style="background:${GROUPS[g].color}"></i>${GROUPS[g].label}</h3>
        <span class="block-meta">đã chi <b>${num(gSpent)}</b> / <b>${num(byGroup[g])}</b></span></div>
        <div class="cols"><span>Hạng mục</span><span>Kế hoạch</span><span class="spent">Đã chi</span><span>Còn lại</span><span></span></div>`;
      for (const c of cats) {
        const spent = st.spentBy[c.id] || 0;
        const left = c.planned - spent;
        const ratio = c.planned > 0 ? spent / c.planned : spent > 0 ? 1.01 : 0;
        const barCls = ratio > 1 ? 'over' : ti.when === 'now' && ratio > ti.elapsed + 0.1 ? 'warn' : '';
        h += `<div class="line"><div class="row">
          ${cell('cat', c.id, 'name', c.name)}${cell('cat', c.id, 'planned', num(c.planned), true, m.smart && (c.locked || st.income === 0))}
          <span class="num muted spent">${num(spent)}</span><span class="num ${left < 0 ? 'neg' : ''}">${num(left)}</span>
          <button type="button" class="del" data-act="del-cat" data-id="${c.id}" aria-label="Xoá ${esc(c.name)}">×</button></div>
          <div class="smart-line"><div class="bar ${barCls}" title="${Math.round(ratio * 100)}% ngân sách"><i style="width:${Math.min(100, ratio * 100)}%"></i>
          ${ti.when === 'now' ? `<span class="pace" style="left:${ti.elapsed * 100}%" title="Hôm nay"></span>` : ''}</div>
          ${m.smart ? `<span class="pct">${cell('cat', c.id, 'pct', pf.format(c.pct || 0), true, c.locked)}%</span>
            <label class="lock"><input type="checkbox" data-lock="${c.id}" data-fid="cat:${c.id}:lock"${c.locked ? ' checked' : ''}> Cố định</label>` : ''}</div></div>`;
      }
      h += `<button type="button" class="add" data-act="add-cat" data-group="${g}">+ Thêm hạng mục</button></div>`;
    }

    if (st.spentBy['']) {
      h += `<div class="line"><div class="row inc"><span>Chưa phân loại</span><span class="num neg">${num(st.spentBy[''])}</span><span></span></div></div>`;
    }
    $('plan').innerHTML = h;
  }

  function cell(kind, id, field, value, isNum, disabled) {
    return `<input class="cell${isNum ? ' num' : ''}" type="text" ${isNum ? 'inputmode="decimal"' : 'maxlength="40"'}${disabled ? ' disabled' : ''}
      data-kind="${kind}" data-id="${id}" data-field="${field}" data-fid="${kind}:${id}:${field}" value="${esc(value)}"
      aria-label="${field === 'name' ? 'Tên' : field === 'pct' ? 'Phần trăm thu nhập' : 'Số tiền'}">`;
  }

  function catOptions(m, selected, first) {
    let h = first || '';
    for (const g in GROUPS) {
      const cats = m.categories.filter((c) => c.group === g);
      if (!cats.length) continue;
      h += `<optgroup label="${GROUPS[g].label}">` +
        cats.map((c) => `<option value="${c.id}"${c.id === selected ? ' selected' : ''}>${esc(c.name)}</option>`).join('') + `</optgroup>`;
    }
    return h;
  }

  function renderCatOptions(m) {
    const sel = $('tx-cat');
    sel.innerHTML = catOptions(m, sel.value);
  }

  function renderTx(m) {
    if (filter && !m.categories.some((c) => c.id === filter)) filter = '';
    const names = Object.fromEntries(m.categories.map((c) => [c.id, c.name]));
    const list = m.transactions.filter((t) => !filter || t.catId === filter)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.at - a.at));

    let h = `<div class="tx-tools"><span>${list.length} khoản · ${money(sum(list, 'amount'))}</span>
      <select id="tx-filter" aria-label="Lọc theo hạng mục">${catOptions(m, filter, '<option value="">Tất cả hạng mục</option>')}</select></div>`;

    if (!list.length) {
      h += `<div class="empty">${m.transactions.length ? 'Không có khoản chi nào trong hạng mục này.' : 'Trang này còn trắng — ghi khoản chi đầu tiên ở trên.'}</div>`;
    } else {
      const wd = new Intl.DateTimeFormat('vi-VN', { weekday: 'long' });
      let day = '';
      for (const t of list) {
        if (t.date !== day) {
          day = t.date;
          const [y, mo, d] = day.split('-').map(Number);
          const total = sum(list.filter((x) => x.date === day), 'amount');
          const label = wd.format(new Date(y, mo - 1, d));
          h += `<div class="day-head"><span>${label[0].toUpperCase() + label.slice(1)}, ${pad(d)}/${pad(mo)}</span><span class="num">${num(total)}</span></div>`;
        }
        const cat = names[t.catId] || 'Chưa phân loại';
        h += `<div class="tx${t.id === editing ? ' is-editing' : ''}"><button type="button" class="tx-main" data-act="edit-tx" data-id="${t.id}" title="Sửa khoản chi này"><span class="tx-note">${esc(t.note || cat)}</span>
          ${t.note || t.recId ? `<span class="tx-cat">${[t.recId && '↻ hằng tháng', t.note && esc(cat)].filter(Boolean).join(' · ')}</span>` : ''}</button>
          <span class="num">${num(t.amount)}</span>
          <button type="button" class="del" data-act="del-tx" data-id="${t.id}" aria-label="Xoá khoản chi">×</button></div>`;
      }
    }
    $('txlist').innerHTML = h;
  }

  // Đưa form về chế độ sửa khoản chi t, hoặc về chế độ ghi mới khi t rỗng
  function setEditing(t) {
    if (!t && editing) $('tx-date').value = ''; // để renderHead đặt lại ngày mặc định
    editing = t ? t.id : null;
    $('tx-form').classList.toggle('is-editing', !!t);
    $('tx-submit').textContent = t ? 'Lưu thay đổi' : 'Ghi sổ';
    $('tx-cancel').hidden = !t;
    $('tx-repeat').checked = false;
    $('tx-repeat').parentElement.hidden = !!(t && (state.recurring || []).some((r) => r.id === t.recId)); // đã là khoản cố định
    $('tx-amount').value = t ? num(t.amount) : '';
    $('tx-amount').classList.remove('invalid');
    $('tx-note').value = t ? t.note : '';
    if (t) { $('tx-date').value = t.date; $('tx-cat').value = t.catId; }
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

  // ---------- Events ----------
  const shiftMonth = (delta) => {
    const [y, mo] = state.view.split('-').map(Number);
    state.view = keyOf(new Date(y, mo - 1 + delta, 1));
  };

  const actions = {
    prev() { setEditing(null); shiftMonth(-1); commit(null, true); },
    next() { setEditing(null); shiftMonth(1); commit(null, true); },
    today() { setEditing(null); state.view = keyOf(new Date()); commit(null, true); },
    snooze() { state.snoozeUntil = Date.now() + SNOOZE; save(); renderBackup(); },
    'edit-tx'(el) {
      setEditing(cur().transactions.find((t) => t.id === el.dataset.id));
      renderTx(cur());
      $('tx-form').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      $('tx-amount').focus();
    },
    'cancel-edit'() { setEditing(null); render(); },
    'add-inc'() {
      const item = { id: uid(), name: 'Nguồn thu mới', amount: 0 };
      cur().incomes.push(item);
      commit(`inc:${item.id}:name`);
    },
    'del-inc'(el) {
      const m = cur();
      m.incomes = m.incomes.filter((i) => i.id !== el.dataset.id);
      commit();
    },
    'add-cat'(el) {
      const item = { id: uid(), name: 'Hạng mục mới', group: el.dataset.group, planned: 0 };
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
    'del-tx'(el) {
      const m = cur();
      if (el.dataset.id === editing) setEditing(null);
      m.transactions = m.transactions.filter((t) => t.id !== el.dataset.id);
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
    'copy-prev'() {
      const src = state.months[prevPlanKey()];
      const m = cur();
      m.incomes = src.incomes.map((i) => ({ ...i, id: uid() }));
      const oldName = Object.fromEntries(m.categories.map((c) => [c.id, c.name]));
      m.categories = src.categories.map((c) => ({ ...c, id: uid() }));
      for (const t of m.transactions) { // khoản cố định đã tự ghi: nối lại hạng mục theo tên
        const name = (state.recurring || []).find((r) => r.id === t.recId)?.cat ?? oldName[t.catId];
        t.catId = m.categories.find((c) => c.name === name)?.id || '';
      }
      m.smart = src.smart;
      m.pctInit = src.pctInit;
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
    },
    import() { $('import-file').click(); },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (el && actions[el.dataset.act]) actions[el.dataset.act](el);
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.id === 'tx-filter') { filter = el.value; renderTx(cur()); return; }
    if (el.id === 'import-file') return importFile(el);
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
    const list = { inc: m.incomes, cat: m.categories, rec: state.recurring }[el.dataset.kind];
    const item = list.find((x) => x.id === el.dataset.id);
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

  document.addEventListener('toggle', (e) => {
    if (e.target.classList?.contains('rec')) recOpen = e.target.open;
  }, true);

  document.addEventListener('focusin', (e) => {
    if (e.target.classList.contains('cell')) e.target.select();
  });

  $('tx-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const amt = $('tx-amount');
    const amount = parseMoney(amt.value);
    if (!(amount > 0)) {
      amt.classList.remove('invalid');
      void amt.offsetWidth;
      amt.classList.add('invalid');
      amt.focus();
      return;
    }
    const data = { date: $('tx-date').value, catId: $('tx-cat').value, note: $('tx-note').value.trim(), amount };
    const m = cur();
    if ($('tx-repeat').checked) {
      const rule = { id: uid(), note: data.note, amount, cat: m.categories.find((c) => c.id === data.catId)?.name || '', day: +data.date.slice(8) };
      (state.recurring ||= []).push(rule);
      (m.recDone ||= []).push(rule.id); // khoản đang ghi chính là lần của tháng này
      data.recId = rule.id;
      recOpen = true;
    }
    const old = m.transactions.find((t) => t.id === editing);
    if (old) Object.assign(old, data);
    else m.transactions.push({ id: uid(), at: Date.now(), ...data });
    setEditing(null);
    commit();
    amt.focus();
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
    }).catch(() => alert('Tệp không đúng định dạng của Sổ ngân sách.'));
  }

  render();
})();

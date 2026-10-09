(() => {
  'use strict';

  const KEY = 'so-ngan-sach:v1';
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

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.months) return s;
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
  const monthName = (key) => { const [y, m] = key.split('-'); return `Tháng ${+m}/${y}`; };

  // ---------- Render ----------
  function render() {
    const m = cur();
    const st = stats(m);
    const ti = timeInfo(state.view);
    renderHead();
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
    if (prev && st.income === 0 && st.planned === 0 && !m.transactions.length) {
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
        h += `<div class="tx"><div class="tx-main"><div class="tx-note">${esc(t.note || cat)}</div>
          ${t.note ? `<div class="tx-cat">${esc(cat)}</div>` : ''}</div>
          <span class="num">${num(t.amount)}</span>
          <button type="button" class="del" data-act="del-tx" data-id="${t.id}" aria-label="Xoá khoản chi">×</button></div>`;
      }
    }
    $('txlist').innerHTML = h;
  }

  // Lưu rồi vẽ lại; giữ con trỏ ở ô đang gõ (Tab sang ô kế tiếp không bị mất focus)
  function commit(focusFid) {
    applySmart(cur());
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
    prev() { shiftMonth(-1); commit(); },
    next() { shiftMonth(1); commit(); },
    today() { state.view = keyOf(new Date()); commit(); },
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
      commit();
    },
    'del-tx'(el) {
      const m = cur();
      m.transactions = m.transactions.filter((t) => t.id !== el.dataset.id);
      commit();
    },
    suggest() {
      const m = cur();
      const sug = suggestPcts(m);
      for (const c of m.categories) if (!c.locked) c.pct = sug[c.id];
      commit();
    },
    'copy-prev'() {
      const src = state.months[prevPlanKey()];
      const m = cur();
      m.incomes = src.incomes.map((i) => ({ ...i, id: uid() }));
      m.categories = src.categories.map((c) => ({ ...c, id: uid() }));
      m.smart = src.smart;
      m.pctInit = src.pctInit;
      commit();
    },
    export() {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `so-ngan-sach-${isoOf(new Date())}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
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
    const item = (el.dataset.kind === 'inc' ? m.incomes : m.categories).find((x) => x.id === el.dataset.id);
    if (!item) return;
    if (el.dataset.field === 'name') {
      item.name = el.value.trim() || item.name;
    } else if (el.dataset.field === 'pct') {
      const v = parseFloat(el.value.replace('%', '').replace(',', '.'));
      if (v >= 0) item.pct = Math.min(100, v);
    } else {
      const v = parseMoney(el.value || '0');
      const income = sum(m.incomes, 'amount');
      if (isNaN(v)) { /* giữ giá trị cũ */ }
      else if (m.smart && el.dataset.kind === 'cat') item.pct = (v / income) * 100; // sửa số tiền → quy ngược ra %
      else item[el.dataset.field] = v;
    }
    commit();
  });

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
    cur().transactions.push({
      id: uid(), at: Date.now(), date: $('tx-date').value, catId: $('tx-cat').value,
      note: $('tx-note').value.trim(), amount,
    });
    amt.value = '';
    $('tx-note').value = '';
    amt.classList.remove('invalid');
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
      state = { view: data.view || keyOf(new Date()), months: data.months };
      commit();
    }).catch(() => alert('Tệp không đúng định dạng của Sổ ngân sách.'));
  }

  render();
})();

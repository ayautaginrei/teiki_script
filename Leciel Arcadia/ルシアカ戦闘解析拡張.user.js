// ==UserScript==
// @name         ルシアカ戦闘解析拡張
// @namespace    lc-battle-analyzer
// @version      1.1
// @description  戦闘結果画面の左側パネルにあるSP・連続値を実数表記にし、末尾の戦闘解析を拡張します
// @author       ayautaginrei
// @match        https://rarirupj.com/leciar/log*
// @updateURL    https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/Leciel%20Arcadia/%E3%83%AB%E3%82%B7%E3%82%A2%E3%82%AB%E6%88%A6%E9%97%98%E8%A7%A3%E6%9E%90%E6%8B%A1%E5%BC%B5.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (!document.querySelector('.battle-result')) return;
  if (window.__lcBattleAnalyzerLoaded) return;
  window.__lcBattleAnalyzerLoaded = true;

  /* =========================================================================
   * 0. 共通設定：状態異常/バフデバフの定義（アイコン・説明・分類）
   * ========================================================================= */

  const ICON_BASE = '/leciar/static/icons/status/';

  const STATUS_DEFS = {
    p: {
      name: '猛毒', icon: 'poison', kind: 'bad',
      desc: 'HPに継続的なダメージを与える。\n被回復量が減少する。',
    },
    f: {
      name: '凍結', icon: 'freeze', kind: 'bad',
      desc: 'SPの自然増加量を減少させる効果が大きい。\n行動後に連続値を減少させる。',
    },
    c: {
      name: '呪縛', icon: 'curse', kind: 'bad',
      desc: '与えるダメージと回復量が減少する。\n受けるダメージが増加する。\n受ける良性変調が少し減少する。',
    },
    pa: {
      name: '麻痺', icon: 'paralysis', kind: 'bad',
      desc: 'パッシブ発動率が減少する。\n付与する変調数が少し減少する。\n受ける悪性変調が少し増加する。',
    },
    he: {
      name: '治癒', icon: 'healing', kind: 'good',
      desc: 'HPに継続的な回復を与える。\n被回復量が増加する。',
    },
    pe: {
      name: '平穏', icon: 'peace', kind: 'good',
      desc: 'SPの自然増加量を増加させる効果が大きい。\n行動後に連続値を増加させる。',
    },
    sh: {
      name: '祝福', icon: 'shukufuku', kind: 'good',
      desc: '与えるダメージと回復量が増加する。\n受けるダメージが減少する。\n受ける良性変調が少し増加する。',
    },
    k: {
      name: '加護', icon: 'kago', kind: 'good',
      desc: 'パッシブ発動率が増加する。\n付与する変調数が少し増加する。\n受ける悪性変調が少し減少する。',
    },
    a: {
      name: '攻増', icon: 'atkU', kind: 'buff',
      desc: 'ATKとMNDの実数値が増加する。\n命中率が増加する。',
    },
    au: {
      name: '攻減', icon: 'atkD', kind: 'debuff',
      desc: 'ATKとMNDの実数値が減少する。\n命中率が減少する。',
    },
    d: {
      name: '守増', icon: 'defU', kind: 'buff',
      desc: 'DEFの実数値が増加する。\n軽減率が増加する。',
    },
    du: {
      name: '守減', icon: 'defD', kind: 'debuff',
      desc: 'DEFの実数値が減少する。\n軽減率が減少する。',
    },
    sp: {
      name: '速増', icon: 'speedU', kind: 'buff',
      desc: 'DEXとAGIの実数値が増加する（行動順には影響しない）。\n連続値の自然増加量・回避率が増加する。',
    },
    spd: {
      name: '速減', icon: 'speedD', kind: 'debuff',
      desc: 'DEXとAGIの実数値が減少する（行動順には影響しない）。\n連続値の自然増加量・回避率が減少する。',
    },
    y: {
      name: '保護', icon: 'hogo', kind: 'shield',
      desc: '悪性変調を受けた際に消費され、その効果を無効化する。',
    },
    so: {
      name: '阻害', icon: 'sogai', kind: 'shield',
      desc: '良性変調を受けた際に消費され、その効果を無効化する。',
    },
  };

  const STATUS_ORDER = ['p', 'f', 'c', 'pa', 'he', 'pe', 'sh', 'k', 'a', 'au', 'd', 'du', 'sp', 'spd', 'y', 'so'];

  function sortByRulebookOrder(keys) {
    const known = STATUS_ORDER.filter((k) => keys.includes(k));
    const unknown = keys.filter((k) => !STATUS_ORDER.includes(k));
    return [...known, ...unknown];
  }

  const HIDDEN_KEYS = new Set(['dw']);
  const CORE_KEYS = new Set(['i', 'h', 'hb', 's', 'sb', 'sd']);

  function defFor(key) {
    return STATUS_DEFS[key] || { name: key, icon: null, kind: 'unknown', desc: '（説明未登録の状態です。実際の効果と異なる場合があります）' };
  }

  /* =========================================================================
   * 1. 画面左部：SP・連続値の実数表記
   * ========================================================================= */

  function parseSpTitle(title) {
    const m = title && title.match(/SP\s*(-?\d+)\s*\/\s*(-?\d+)/);
    if (!m) return null;
    return { cur: Number(m[1]), max: Number(m[2]) };
  }

  function parseHeatTitle(title) {
    const m = title && title.match(/連続値\s*(-?\d+)/);
    if (!m) return null;
    return Number(m[1]);
  }

  function injectSpValue(wrapper) {
    if (!wrapper || wrapper.dataset.lcInjected) return;
    wrapper.dataset.lcInjected = '1';

    const statusbar = wrapper.closest('.statusbar');
    const desc = statusbar && statusbar.querySelector('.statusbar-desc');
    if (!desc) return;

    const valueEl = document.createElement('div');
    valueEl.className = 'statusbar-value lc-sp-value';
    desc.appendChild(valueEl);

    const update = () => {
      const parsed = parseSpTitle(wrapper.getAttribute('title'));
      valueEl.textContent = parsed ? `${parsed.cur} / ${parsed.max}` : '- / -';
    };
    update();

    new MutationObserver(update).observe(wrapper, { attributes: true, attributeFilter: ['title'] });
  }

  function injectHeatValue(wrapper) {
    if (!wrapper || wrapper.dataset.lcInjected) return;
    wrapper.dataset.lcInjected = '1';

    const label = document.createElement('div');
    label.className = 'lc-heat-value';

    const prefix = document.createElement('span');
    prefix.className = 'lc-heat-value-prefix';
    prefix.textContent = '連続値 ';
    label.appendChild(prefix);

    const numEl = document.createElement('span');
    numEl.className = 'lc-heat-value-num';
    label.appendChild(numEl);

    wrapper.insertAdjacentElement('afterend', label);

    const update = () => {
      const v = parseHeatTitle(wrapper.getAttribute('title'));
      numEl.textContent = v === null ? '-' : String(v);
    };
    update();

    new MutationObserver(update).observe(wrapper, { attributes: true, attributeFilter: ['title'] });
  }

  function setupLeftPanelNumbers() {
    document.querySelectorAll('.wide-unit').forEach((unit) => {
      injectSpValue(unit.querySelector('.sp-gauge-wrapper'));
      injectHeatValue(unit.querySelector('.heat-gauge-wrapper'));
    });
  }

  /* =========================================================================
   * 2. データ収集：ユニット一覧 ＋ ターンごとのステータス断面
   * ========================================================================= */

  function collectUnits() {
    const units = {};
    document.querySelectorAll('.wide-unit[id$="u"]').forEach((el) => {
      const m = el.id.match(/^index(\d+)u$/);
      if (!m) return;
      const idx = Number(m[1]);
      const nameEl = el.querySelector('.unit-name-position');
      const side = el.classList.contains('allie') ? 'ally'
        : el.classList.contains('enemie') ? 'enemy' : 'unknown';
      units[idx] = { index: idx, name: nameEl ? nameEl.textContent.trim() : `Unit${idx}`, side };
    });
    return units;
  }

  function collectTurnSnapshots() {
    const turns = [];
    document.querySelectorAll('section.round').forEach((roundEl) => {
      const countEl = roundEl.querySelector('.round-count');
      const label = countEl ? `T${countEl.textContent.trim()}` : `T${turns.length + 1}`;
      const snapEl = roundEl.querySelector('script.round-status-snapshot');
      if (!snapEl) return;
      let arr;
      try {
        arr = JSON.parse(snapEl.textContent);
      } catch (e) {
        return;
      }
      const byUnit = {};
      arr.forEach((obj) => { byUnit[obj.i] = obj; });
      turns.push({ label, byUnit });
    });
    return turns;
  }

  // ユニットごとの「〇〇の行動！」（連続行動時は2回以上）の回数をターン別に集計。
  // 「〇〇 の 自動行動！」（受動効果）や「〇〇 と △△ のチェインスキル！」は対象外。
  function collectActionCounts(units, turns) {
    const nameToIndex = {};
    Object.values(units).forEach((u) => { nameToIndex[u.name] = u.index; });
    const namesByLength = Object.keys(nameToIndex).sort((a, b) => b.length - a.length);

    const perTurn = {};
    Object.values(units).forEach((u) => {
      perTurn[u.index] = turns.map(() => 0);
    });

    const roundEls = document.querySelectorAll('section.round');
    roundEls.forEach((roundEl, turnIdx) => {
      roundEl.querySelectorAll('section.turns > section.turn > span.actor').forEach((el) => {
        const text = (el.textContent || '').trim();
        if (!text.endsWith('の行動！')) return; // 「の自動行動！」「のチェインスキル！」を除外
        const name = namesByLength.find((n) => text === `${n}の行動！`);
        if (!name) return;
        const idx = nameToIndex[name];
        if (perTurn[idx] && perTurn[idx][turnIdx] !== undefined) perTurn[idx][turnIdx] += 1;
      });
    });

    return { perTurn };
  }

  function collectHitCounts(units, turns) {
    const nameToIndex = {};
    Object.values(units).forEach((u) => { nameToIndex[u.name] = u.index; });
    const namesByLength = Object.keys(nameToIndex).sort((a, b) => b.length - a.length);

    const total = {};
    const perTurn = {};
    Object.values(units).forEach((u) => {
      total[u.index] = 0;
      perTurn[u.index] = turns.map(() => 0);
    });

    const roundEls = document.querySelectorAll('section.round');
    roundEls.forEach((roundEl, turnIdx) => {
      roundEl.querySelectorAll('.popup-text').forEach((el) => {
        const text = (el.textContent || '').trim();
        if (!text.endsWith('のダメージを受けた！')) return;
        const name = namesByLength.find((n) => text.startsWith(n + 'は'));
        if (!name) return;
        const idx = nameToIndex[name];
        total[idx] = (total[idx] || 0) + 1;
        if (perTurn[idx] && perTurn[idx][turnIdx] !== undefined) perTurn[idx][turnIdx] += 1;
      });
    });

    return { total, perTurn };
  }

  function collectPeaceHeatGains(units, turns) {
    const nameToIndex = {};
    Object.values(units).forEach((u) => { nameToIndex[u.name] = u.index; });
    const namesByLength = Object.keys(nameToIndex).sort((a, b) => b.length - a.length);

    const perTurn = {};
    Object.values(units).forEach((u) => {
      perTurn[u.index] = turns.map(() => 0);
    });

    const roundEls = document.querySelectorAll('section.round');
    roundEls.forEach((roundEl, turnIdx) => {
      roundEl.querySelectorAll('.depth-result').forEach((el) => {
        const text = (el.textContent || '').trim();
        if (!text.includes('平穏') || !text.includes('連続値が')) return;
        const m = text.match(/^(.+?)は\s*平穏\s*により連続値が\s*(-?\d+)\s*増加した/);
        if (!m) return;
        const name = namesByLength.find((n) => m[1] === n) || namesByLength.find((n) => m[1].startsWith(n));
        if (!name) return;
        const idx = nameToIndex[name];
        if (perTurn[idx] && perTurn[idx][turnIdx] !== undefined) {
          perTurn[idx][turnIdx] += Number(m[2]);
        }
      });
    });

    return { perTurn };
  }

  function collectSkillBreakdown() {
    const nameToKind = {};
    Object.values(STATUS_DEFS).forEach((def) => { nameToKind[def.name] = def.kind; });

    const map = {};
    document.querySelectorAll('section.checkactions[id^="index"]').forEach((el) => {
      const m = el.id.match(/^index(\d+)and\d+$/);
      if (!m) return;
      const actorIdx = Number(m[1]);

      const actionEl = el.querySelector(':scope > .action, :scope > .passive-text');
      if (!actionEl) return;
      const skillEl = actionEl.querySelector(':scope > .skill-name, :scope > .skill-name-enemy');
      if (!skillEl) return;
      const skillName = skillEl.textContent.replace(/！\s*$/, '').trim();
      if (!skillName) return;

      const use = { buff: {}, debuff: {} };
      actionEl.querySelectorAll(':scope > .result').forEach((resultEl) => {
        const html = resultEl.innerHTML;
        const gm = html.match(/<b>([^<]+)<\/b>\s*を\s*<span[^>]*>(-?\d+)<\/span>\s*付与/);
        if (!gm) return;
        const statusName = gm[1];
        const amount = Number(gm[2]);
        if (!amount) return;
        const kind = nameToKind[statusName];
        if (kind === 'good' || kind === 'buff') {
          use.buff[statusName] = (use.buff[statusName] || 0) + amount;
        } else if (kind === 'bad' || kind === 'debuff') {
          use.debuff[statusName] = (use.debuff[statusName] || 0) + amount;
        }
      });

      const key = `${actorIdx}::${skillName}`;
      if (!map[key]) map[key] = [];
      map[key].push(use);
    });
    return map;
  }

  function rulebookRankByName(name) {
    const key = Object.keys(STATUS_DEFS).find((k) => STATUS_DEFS[k].name === name);
    const idx = STATUS_ORDER.indexOf(key);
    return idx === -1 ? 999 : idx;
  }

  /* =========================================================================
   * 3. 状態アイコン＋ツールチップの生成
   * ========================================================================= */

  function makeStatusBadge(key, compact) {
    const def = defFor(key);
    const badge = document.createElement('span');
    badge.className = `lc-status-badge lc-kind-${def.kind}${compact ? ' lc-status-compact' : ''}`;
    badge.setAttribute('data-lc-tooltip', `${def.name}\n${def.desc}`);

    if (def.icon) {
      const img = document.createElement('img');
      img.className = 'lc-status-icon-img';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = def.name;
      img.src = ICON_BASE + def.icon + '.gif';
      img.onerror = () => {
        img.remove();
        badge.classList.add('lc-status-fallback');
        if (compact) badge.prepend(document.createTextNode(def.name.slice(0, 1)));
      };
      badge.appendChild(img);
    } else {
      badge.classList.add('lc-status-fallback');
      if (compact) badge.appendChild(document.createTextNode(def.name.slice(0, 1)));
    }

    if (!compact) {
      const label = document.createElement('span');
      label.className = 'lc-status-label';
      label.textContent = def.name;
      badge.appendChild(label);
    }

    return badge;
  }

  function makeStatusHeaderLabel(key) {
    const def = defFor(key);
    const el = document.createElement('span');
    el.className = `lc-status-text-label lc-kind-${def.kind}`;
    el.setAttribute('data-lc-tooltip', `${def.name}\n${def.desc}`);
    el.textContent = def.name;
    return el;
  }

  /* =========================================================================
   * 4. ユニットごとのターン推移テーブル
   * ========================================================================= */

  const SP_MAX = 300;

  function buildUnitTurnTable(unit, turns, hitCounts, peaceHeatGains, actionCounts) {
    const seenKeysRaw = [];
    turns.forEach((t) => {
      const obj = t.byUnit[unit.index];
      if (!obj) return;
      Object.keys(obj).forEach((k) => {
        if (CORE_KEYS.has(k) || HIDDEN_KEYS.has(k)) return;
        if (!seenKeysRaw.includes(k)) seenKeysRaw.push(k);
      });
    });
    const seenKeys = sortByRulebookOrder([...new Set([...STATUS_ORDER, ...seenKeysRaw])]);
    const perTurnHits = (hitCounts && hitCounts.perTurn[unit.index]) || turns.map(() => 0);
    const perTurnPeaceGain = (peaceHeatGains && peaceHeatGains.perTurn[unit.index]) || turns.map(() => 0);
    const perTurnActionCount = (actionCounts && actionCounts.perTurn[unit.index]) || turns.map(() => 0);

    const table = document.createElement('table');
    table.className = 'lc-turn-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');

    const turnTh = document.createElement('th');
    turnTh.textContent = 'ターン';
    headRow.appendChild(turnTh);

    const actionCountTh = document.createElement('th');
    const actionCountLabel = document.createElement('span');
    actionCountLabel.className = 'lc-status-text-label lc-kind-info';
    actionCountLabel.textContent = '行動数';
    actionCountTh.appendChild(actionCountLabel);
    headRow.appendChild(actionCountTh);

    const spTh = document.createElement('th');
    spTh.textContent = 'SP';
    headRow.appendChild(spTh);

    const hitTh = document.createElement('th');
    const hitLabel = document.createElement('span');
    hitLabel.className = 'lc-status-text-label lc-kind-info';
    hitLabel.textContent = '被弾数';
    hitTh.appendChild(hitLabel);
    headRow.appendChild(hitTh);

    seenKeys.forEach((key) => {
      const th = document.createElement('th');
      th.appendChild(makeStatusHeaderLabel(key));
      headRow.appendChild(th);
    });

    thead.appendChild(headRow);
    table.appendChild(thead);

    // --- 各キーの最大値（背景の濃淡用） ---
    const maxByKey = {};
    seenKeys.forEach((key) => {
      const vals = turns
        .map((t) => t.byUnit[unit.index] && t.byUnit[unit.index][key])
        .filter((v) => v !== undefined && v !== null)
        .map(Math.abs);
      maxByKey[key] = Math.max(1, ...vals, 0);
    });
    const maxHit = Math.max(1, ...perTurnHits);
    const maxActionCount = Math.max(1, ...perTurnActionCount);

    // --- ターンごとの行 ---
    const tbody = document.createElement('tbody');
    turns.forEach((t, turnIdx) => {
      const obj = t.byUnit[unit.index];
      const tr = document.createElement('tr');

      const turnTd = document.createElement('th');
      turnTd.className = 'lc-turn-label-cell';
      turnTd.textContent = t.label;
      tr.appendChild(turnTd);

      // 行動数（このターンでのこのユニット自身の行動回数。通常1、連続行動発生時は2以上）
      const actionCountTd = document.createElement('td');
      const actCount = perTurnActionCount[turnIdx] || 0;
      actionCountTd.textContent = String(actCount);
      if (actCount >= 2) actionCountTd.style.background = heatColor(actCount, maxActionCount, 'info');
      tr.appendChild(actionCountTd);

      // SP
      const spTd = document.createElement('td');
      if (obj && obj.s !== undefined) {
        const slv = Math.max(0, Math.min(3, Math.floor(obj.s / 100)));
        spTd.textContent = String(obj.s);
        spTd.setAttribute(
          'data-lc-tooltip',
          `SLv${slv}（SP ${obj.s} / ${SP_MAX}）\nゲージ: ${obj.sb ?? 0}%\n次のSLvまで: ${Math.max(0, (slv + 1) * 100 - obj.s)}`
        );
        spTd.classList.add(`lc-slv-${slv}`);
      } else {
        spTd.textContent = '-';
      }
      tr.appendChild(spTd);

      // 被弾数
      const hitTd = document.createElement('td');
      const hitVal = perTurnHits[turnIdx] || 0;
      hitTd.textContent = hitVal ? String(hitVal) : '-';
      if (hitVal) hitTd.style.background = heatColor(hitVal, maxHit, 'info');
      tr.appendChild(hitTd);

      // 状態異常/バフデバフ
      seenKeys.forEach((key) => {
        const td = document.createElement('td');
        const v = obj && obj[key] !== undefined ? obj[key] : null;
        if (v === null) {
          td.textContent = '-';
        } else {
          td.textContent = String(v);
          td.style.background = heatColor(Math.abs(v), maxByKey[key], defFor(key).kind);
        }
        if (key === 'pe') {
          const gain = perTurnPeaceGain[turnIdx] || 0;
          if (gain) {
            td.setAttribute('data-lc-tooltip', `連続増: +${gain}`);
          }
        }
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    return table;
  }

  const KIND_COLORS = {
    bad: [220, 80, 80],
    good: [90, 190, 120],
    buff: [90, 150, 220],
    debuff: [220, 150, 60],
    shield: [180, 180, 90],
    info: [80, 150, 255],
    unknown: [190, 190, 200],
  };

  function heatColor(value, max, kind) {
    if (!max) return 'transparent';
    const [r, g, b] = KIND_COLORS[kind] || KIND_COLORS.info;
    const ratio = Math.max(0, Math.min(1, value / max));
    return `rgba(${r}, ${g}, ${b}, ${0.08 + ratio * 0.35})`;
  }

  /* =========================================================================
   * 5. 既存の「戦闘解析（詳細）」テーブルへ統合
   * ========================================================================= */

  function integrateIntoBattleSummary() {
    const table = document.querySelector('table.battle-summary-table');
    if (!table) return;

    const units = collectUnits();
    const turns = collectTurnSnapshots();
    if (turns.length === 0) return;

    const hitCounts = collectHitCounts(units, turns);
    const peaceHeatGains = collectPeaceHeatGains(units, turns);
    const actionCounts = collectActionCounts(units, turns);
    const skillMap = collectSkillBreakdown();

    const headerRow = table.querySelector('tbody tr.ally-row, tbody tr.enemy-row');
    const colCount = headerRow ? headerRow.children.length : 14;

    Object.values(units).forEach((unit) => {
      const summaryRow = table.querySelector(
        `tbody tr.${unit.side === 'ally' ? 'ally' : 'enemy'}-row[onclick*="toggleSkillDetail(${unit.index})"]`
      );
      if (!summaryRow) return;

      let insertAfter = summaryRow;
      let sibling = summaryRow.nextElementSibling;
      while (sibling && sibling.classList.contains(`skill-rows-${unit.index}`)) {
        attachSkillBreakdownRow(sibling, colCount, skillMap);
        insertAfter = sibling.nextElementSibling && sibling.nextElementSibling.classList.contains('lc-skill-breakdown-row')
          ? sibling.nextElementSibling
          : sibling;
        sibling = insertAfter.nextElementSibling;
      }

      const turnRow = document.createElement('tr');
      turnRow.className = `lc-turn-row skill-rows-${unit.index} ${unit.side}-row`;
      const td = document.createElement('td');
      td.colSpan = colCount;
      td.className = 'lc-turn-cell';

      const caption = document.createElement('div');
      caption.className = 'lc-turn-caption';
      const totalHits = (hitCounts.total[unit.index]) || 0;
      caption.textContent = `◆ ${unit.name} のターン別推移`;
      td.appendChild(caption);

      const wrap = document.createElement('div');
      wrap.className = 'lc-turn-table-wrap';
      wrap.appendChild(buildUnitTurnTable(unit, turns, hitCounts, peaceHeatGains, actionCounts));
      td.appendChild(wrap);

      turnRow.appendChild(td);
      insertAfter.insertAdjacentElement('afterend', turnRow);

      summaryRow.addEventListener('click', () => {
        turnRow.classList.toggle('lc-open');
      });
    });

    // 表の説明を一度だけ追加
    const wrapEl = table.closest('.battle-summary-table-wrap');
    if (wrapEl && !wrapEl.querySelector('.lc-summary-note')) {
      const note = document.createElement('p');
      note.className = 'lc-summary-note';
      wrapEl.insertBefore(note, wrapEl.firstChild);
    }
  }

  function attachSkillBreakdownRow(row, colCount, skillMap) {
    if (row.dataset.lcBreakdownAttached) return;
    row.dataset.lcBreakdownAttached = '1';

    const cell = row.querySelector('.skill-name-cell');
    if (!cell) return;
    const m = cell.textContent.trim().match(/^┗\s*(.+?)\s*\((\d+)\)$/);
    if (!m) return;
    const skillName = m[1];
    const rowsClass = [...row.classList].find((c) => c.startsWith('skill-rows-'));
    if (!rowsClass) return;
    const unitIdx = Number(rowsClass.replace('skill-rows-', ''));
    const uses = skillMap[`${unitIdx}::${skillName}`];
    if (!uses || uses.length === 0) return;

    const anyGrant = uses.some((u) => Object.keys(u.buff).length > 0 || Object.keys(u.debuff).length > 0);
    if (!anyGrant) return;

    row.classList.add('lc-skill-row-expandable');

    const detailRow = document.createElement('tr');
    detailRow.className = `lc-skill-breakdown-row ${rowsClass}`;
    const td = document.createElement('td');
    td.colSpan = colCount;
    td.className = 'lc-skill-breakdown-cell';

    uses.forEach((use, i) => {
      const buffEntries = Object.entries(use.buff).sort((a, b) => rulebookRankByName(a[0]) - rulebookRankByName(b[0]));
      const debuffEntries = Object.entries(use.debuff).sort((a, b) => rulebookRankByName(a[0]) - rulebookRankByName(b[0]));

      const line = document.createElement('div');
      line.className = 'lc-breakdown-use';

      const label = document.createElement('span');
      label.className = 'lc-breakdown-use-label';
      label.textContent = `${i + 1}回目:`;
      line.appendChild(label);

      if (buffEntries.length === 0 && debuffEntries.length === 0) {
        const none = document.createElement('span');
        none.className = 'lc-breakdown-none';
        none.textContent = '-';
        line.appendChild(none);
      } else {
        buffEntries.forEach(([name, amount]) => {
          const item = document.createElement('span');
          item.className = 'lc-breakdown-item lc-item-buff';
          item.textContent = `${name} +${amount}`;
          line.appendChild(item);
        });
        debuffEntries.forEach(([name, amount]) => {
          const item = document.createElement('span');
          item.className = 'lc-breakdown-item lc-item-debuff';
          item.textContent = `${name} +${amount}`;
          line.appendChild(item);
        });
      }

      td.appendChild(line);
    });

    detailRow.appendChild(td);
    row.insertAdjacentElement('afterend', detailRow);

    row.addEventListener('click', () => {
      detailRow.classList.toggle('lc-open');
      row.classList.toggle('lc-expanded');
    });
  }

  /* =========================================================================
   * 6. ツールチップ
   * ========================================================================= */

  function setupTooltipSystem() {
    const tip = document.createElement('div');
    tip.className = 'lc-tooltip-float';
    document.body.appendChild(tip);

    const MARGIN = 6;

    function place(target) {
      const text = target.getAttribute('data-lc-tooltip');
      if (!text) return;
      tip.textContent = text;
      tip.classList.add('lc-tooltip-visible');

      const targetRect = target.getBoundingClientRect();
      const tipRect = tip.getBoundingClientRect();

      let top = targetRect.top - tipRect.height - 8;
      if (top < MARGIN) {
        top = targetRect.bottom + 8;
      }
      top = Math.min(top, window.innerHeight - tipRect.height - MARGIN);
      top = Math.max(top, MARGIN);

      let left = targetRect.left + targetRect.width / 2 - tipRect.width / 2;
      left = Math.min(left, window.innerWidth - tipRect.width - MARGIN);
      left = Math.max(left, MARGIN);

      tip.style.top = `${top}px`;
      tip.style.left = `${left}px`;
    }

    function hide() {
      tip.classList.remove('lc-tooltip-visible');
    }

    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('[data-lc-tooltip]');
      if (target) place(target);
    });
    document.addEventListener('mouseout', (e) => {
      const target = e.target.closest('[data-lc-tooltip]');
      if (target && (!e.relatedTarget || !target.contains(e.relatedTarget))) hide();
    });
    document.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
  }

  /* =========================================================================
   * 7. スタイル注入
   * ========================================================================= */

  function injectStyle() {
    const style = document.createElement('style');
    style.textContent = `
      section.turns > section.turn,
      section.passive-area > section.checkactions {
        border-top: 1px solid rgba(255,255,255,0.15);
        margin-top: 14px;
        padding-top: 14px;
      }
      section.turns > section.turn:first-child,
      section.passive-area > section.checkactions:first-child {
        border-top: none;
        margin-top: 0;
        padding-top: 0;
      }

      .lc-sp-value { font-size: 0.85em; opacity: 0.9; }

      .lc-heat-value {
        font-size: 0.75em;
        line-height: 1.3;
        opacity: 0.85;
        margin-top: 1px;
        text-align: right;
      }
      .lc-heat-value-prefix { opacity: 0.7; }
      .lc-heat-value-num { font-weight: bold; }

      .lc-summary-note {
        font-size: 0.85em; opacity: 0.8; margin: 4px 0 10px;
      }

      tr.lc-turn-row { display: none; }
      tr.lc-turn-row.lc-open { display: table-row; }
      /* 展開行はサイト側の行ホバー演出（ally-row/enemy-row用）を継承してしまうため無効化 */
      tr.lc-turn-row:hover > td.lc-turn-cell,
      tr.lc-turn-row > td.lc-turn-cell:hover {
        background: rgba(0,0,0,0.15) !important;
        transform: none !important;
        animation: none !important;
      }
      td.lc-turn-cell { background: rgba(0,0,0,0.15); padding: 10px 12px; cursor: default; }
      .lc-turn-caption { font-weight: bold; font-size: 1em; margin-bottom: 8px; }

      .lc-turn-table-wrap { overflow-x: auto; }
      table.lc-turn-table {
        border-collapse: collapse;
        font-size: 0.92em;
        white-space: nowrap;
      }
      table.lc-turn-table th,
      table.lc-turn-table td {
        border: 1px solid rgba(255,255,255,0.15);
        padding: 5px 7px;
        text-align: center;
        white-space: nowrap;
      }
      table.lc-turn-table thead th {
        background: rgba(0,0,0,0.4);
        font-size: 0.92em;
        padding: 6px 7px;
      }
      table.lc-turn-table tbody th {
        text-align: center;
        background: rgba(0,0,0,0.25);
        white-space: nowrap;
      }
      table.lc-turn-table tbody tr:nth-child(odd) td:not([class*="lc-slv-"]) {
        background: rgba(255,255,255,0.02);
      }

      td.lc-slv-0 { background: rgba(255,255,255,0.03); }
      td.lc-slv-1 { background: rgba(80,150,255,0.18); }
      td.lc-slv-2 { background: rgba(80,150,255,0.32); }
      td.lc-slv-3 { background: rgba(255,190,60,0.38); font-weight: bold; }

      .lc-status-text-label {
        cursor: help;
        border-bottom: 2px solid transparent;
        padding-bottom: 1px;
      }
      .lc-kind-bad.lc-status-text-label { border-color: rgba(220,80,80,0.7); }
      .lc-kind-good.lc-status-text-label { border-color: rgba(90,190,120,0.7); }
      .lc-kind-buff.lc-status-text-label { border-color: rgba(90,150,220,0.7); }
      .lc-kind-debuff.lc-status-text-label { border-color: rgba(220,150,60,0.7); }
      .lc-kind-shield.lc-status-text-label { border-color: rgba(180,180,90,0.7); }
      .lc-kind-info.lc-status-text-label { border-color: rgba(80,150,255,0.75); }

      .lc-status-badge {
        position: relative;
        display: inline-flex; align-items: center; gap: 6px;
        cursor: help;
        white-space: nowrap;
      }
      .lc-status-badge.lc-status-compact { gap: 0; }
      .lc-status-icon-img {
        width: 22px; height: 22px; object-fit: contain; image-rendering: pixelated;
        flex: none;
      }
      .lc-status-fallback {
        display: inline-flex; align-items: center; justify-content: center;
        width: 22px; height: 22px; border-radius: 50%;
        background: rgba(255,255,255,0.15); font-size: 0.8em;
        flex: none;
      }
      .lc-status-label { font-size: 1em; white-space: nowrap; }
      .lc-kind-bad .lc-status-fallback { background: rgba(220,80,80,0.35); }
      .lc-kind-good .lc-status-fallback { background: rgba(90,190,120,0.35); }
      .lc-kind-buff .lc-status-fallback { background: rgba(90,150,220,0.35); }
      .lc-kind-debuff .lc-status-fallback { background: rgba(220,150,60,0.35); }
      .lc-kind-shield .lc-status-fallback { background: rgba(180,180,90,0.35); }

      .lc-status-badge[data-lc-tooltip],
      td[data-lc-tooltip] {
        cursor: help;
      }

      .lc-tooltip-float {
        position: fixed;
        z-index: 9999;
        max-width: 260px;
        width: max-content;
        background: rgba(20,20,20,0.97);
        color: #fff;
        font-size: 0.9em;
        padding: 8px 10px;
        border-radius: 6px;
        line-height: 1.5;
        white-space: pre-line;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity .1s ease;
        box-shadow: 0 2px 10px rgba(0,0,0,0.4);
      }
      .lc-tooltip-float.lc-tooltip-visible {
        opacity: 1;
        visibility: visible;
      }

      /* スキル別内訳の展開（使用回ごとの与バフ/与デバフ） */
      tr.lc-skill-row-expandable { cursor: pointer; }
      tr.lc-skill-row-expandable:hover { background: rgba(255,255,255,0.06); }
      tr.lc-skill-row-expandable .skill-name-cell::after {
        content: ' ▸';
        opacity: 0.55;
        font-size: 0.8em;
      }
      tr.lc-skill-row-expandable.lc-expanded .skill-name-cell::after {
        content: ' ▾';
      }
      tr.lc-skill-breakdown-row { display: none; }
      tr.lc-skill-breakdown-row.lc-open { display: table-row; }
      td.lc-skill-breakdown-cell {
        background: rgba(0,0,0,0.12);
        padding: 8px 16px;
      }
      .lc-breakdown-use {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        padding: 2px 0;
        font-size: 0.9em;
      }
      .lc-breakdown-use-label {
        opacity: 0.6;
        min-width: 4.2em;
      }
      .lc-breakdown-none { opacity: 0.4; }
      .lc-breakdown-item {
        background: rgba(255,255,255,0.08);
        border-radius: 4px;
        padding: 1px 7px;
      }
      .lc-item-buff { color: #9be3ae; }
      .lc-item-debuff { color: #f0b787; }
    `;
    document.head.appendChild(style);
  }

  /* =========================================================================
   * 7. 実行
   * ========================================================================= */

  function init() {
    injectStyle();
    setupTooltipSystem();
    setupLeftPanelNumbers();
    integrateIntoBattleSummary();
  }

  init();
})();

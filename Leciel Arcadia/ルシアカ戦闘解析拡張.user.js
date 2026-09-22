// ==UserScript==
// @name         ルシアカ戦闘解析拡張
// @namespace    lc-battle-analyzer
// @version      1.3
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

  const STATUS_ORDER = ['p', 'f', 'c', 'pa', 'he', 'pe', 'sh', 'k', 'a', 'd', 'sp', 'y', 'so'];

  function sortByRulebookOrder(keys, order) {
    const rulebook = order || STATUS_ORDER;
    const known = rulebook.filter((k) => keys.includes(k));
    const unknown = keys.filter((k) => !rulebook.includes(k));
    return [...known, ...unknown];
  }

  const GRANT_STATUS_ORDER = ['p', 'f', 'c', 'pa', 'he', 'pe', 'sh', 'k', 'a', 'au', 'd', 'du', 'sp', 'spd', 'y', 'so'];

  const HIDDEN_KEYS = new Set(['dw']);
  const CORE_KEYS = new Set(['i', 'h', 'hb', 's', 'sb', 'sd']);

  function getStandardSkillName(el) {
    const dName = el.querySelector('.d-name');
    if (dName) return dName.textContent.trim().replace(/[《》！]/g, '');
    return (el.textContent || '').trim().replace(/！/g, '');
  }

  function getCustomSkillName(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('.d-name').forEach((n) => n.remove());
    return clone.textContent.trim().replace(/！/g, '');
  }

  function sumStatusPolarity(valuesObj) {
    let good = 0;
    let bad = 0;
    Object.entries(valuesObj || {}).forEach(([key, v]) => {
      if (v === undefined || v === null) return;
      let kind;
      let magnitude;
      if (DUAL_SIGN_KEYS[key]) {
        kind = v >= 0 ? defFor(key).kind : defFor(DUAL_SIGN_KEYS[key]).kind;
        magnitude = Math.abs(v);
      } else {
        kind = defFor(key).kind;
        magnitude = Math.abs(v);
      }
      if (kind === 'good' || kind === 'buff' || kind === 'shield') good += magnitude;
      else if (kind === 'bad' || kind === 'debuff') bad += magnitude;
    });
    return { good, bad };
  }

  function defFor(key) {
    return STATUS_DEFS[key] || { name: key, icon: null, kind: 'unknown', desc: '（説明未登録の状態です。実際の効果と異なる場合があります）' };
  }

  const DUAL_SIGN_KEYS = { a: 'au', d: 'du', sp: 'spd' };

  function buildNameIndex(units) {
    const nameToIndex = {};
    Object.values(units).forEach((u) => { nameToIndex[u.name] = u.index; });
    const namesByLength = Object.keys(nameToIndex).sort((a, b) => b.length - a.length);
    return { nameToIndex, namesByLength };
  }

  // 「◯◯の行動！」で始まるターン（手動行動）の行動主体を、ユニットindexに解決する。
  // 該当しない場合はnullを返す。
  function resolveManualActorIndex(turnEl, namesByLength, nameToIndex) {
    const actorSpan = turnEl.querySelector(':scope > span.actor');
    if (!actorSpan) return null;
    const actorText = (actorSpan.textContent || '').trim();
    if (!actorText.endsWith('の行動！')) return null;
    const name = namesByLength.find((n) => actorText === `${n}の行動！`);
    if (!name) return null;
    return nameToIndex[name];
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

  function collectActionDigest(turns) {
    const digest = [];

    function closestPassiveTextAncestor(el) {
      return el.parentElement ? el.parentElement.closest('.passive-text') : null;
    }

    // あるパッシブ発動（.passive-text）を起点に、そこから連鎖する下位のパッシブを
    // 深さ付きのフラットなリストにする（depth 0 = 起点自身）。
    function buildPassiveTree(passiveTextEl, depth, out) {
      const own = [...passiveTextEl.querySelectorAll(':scope > .skill-name, :scope > .skill-name-enemy, :scope > .link-skill-name')]
        .map(getStandardSkillName)
        .filter(Boolean);
      own.forEach((name) => out.push({ name, depth }));
      const children = [...passiveTextEl.querySelectorAll('.passive-text')]
        .filter((child) => closestPassiveTextAncestor(child) === passiveTextEl);
      children.forEach((child) => buildPassiveTree(child, depth + 1, out));
      return out;
    }

    const roundEls = document.querySelectorAll('section.round');
    roundEls.forEach((roundEl, turnIdx) => {
      const entries = [];
      const namesOf = (els) => [...new Set(els.map(getStandardSkillName).filter(Boolean))];

      roundEl.querySelectorAll('section.turns > section.turn').forEach((turnEl) => {
        const actorSpan = turnEl.querySelector(':scope > span.actor');
        if (!actorSpan) return;
        const actorText = (actorSpan.textContent || '').trim();
        if (!actorText.endsWith('の行動！')) return;
        const actorName = actorText.replace(/の行動！$/, '');

        const activeEls = [...turnEl.querySelectorAll('.skill-name, .skill-name-enemy, .link-skill-name')]
          .filter((el) => !el.closest('.passive-text') && !el.closest('.link-text'));
        const firstActiveEl = activeEls[0];

        // 入れ子になっていない（連鎖の起点となる）パッシブのみを対象にする。
        const topLevelPassiveTexts = [...turnEl.querySelectorAll('.passive-text')]
          .filter((pt) => !closestPassiveTextAncestor(pt));

        // 「自分行動前」型（アクティブより前に構造化される）は、
        // インデントしない独立した行として扱う。それ以外は派生としてアクティブに従属させる。
        const beforeActive = [];
        const afterActive = [];
        topLevelPassiveTexts.forEach((pt) => {
          if (firstActiveEl && (firstActiveEl.compareDocumentPosition(pt) & Node.DOCUMENT_POSITION_PRECEDING)) {
            beforeActive.push(pt);
          } else {
            afterActive.push(pt);
          }
        });

        beforeActive.forEach((pt) => {
          entries.push({
            sourceEl: pt,
            actor: actorName,
            activeSkills: [],
            passiveTree: buildPassiveTree(pt, 0, []),
            chainSkills: [],
            active: false,
          });
        });

        const derivedTree = [];
        afterActive.forEach((pt) => buildPassiveTree(pt, 1, derivedTree));
        entries.push({
          sourceEl: firstActiveEl || turnEl,
          actor: actorName,
          activeSkills: namesOf(activeEls),
          passiveTree: derivedTree,
          chainSkills: [],
          active: true,
        });
      });

      roundEl.querySelectorAll('section.passive-area section.passive-text > span.actor').forEach((actorSpan) => {
        const actorText = (actorSpan.textContent || '').trim();
        if (!actorText.endsWith(' の 自動行動！')) return;
        const parentTurn = actorSpan.closest('section.turn');
        const manualActor = parentTurn && parentTurn.querySelector(':scope > span.actor');
        if (manualActor && (manualActor.textContent || '').trim().endsWith('の行動！')) return;

        const ownPassiveText = actorSpan.parentElement;
        if (closestPassiveTextAncestor(ownPassiveText)) return;

        const actorName = actorText.replace(/ の 自動行動！$/, '');
        entries.push({
          sourceEl: ownPassiveText,
          actor: actorName,
          activeSkills: [],
          passiveTree: buildPassiveTree(ownPassiveText, 0, []),
          chainSkills: [],
          active: false,
        });
      });

      roundEl.querySelectorAll('section.link-action .link-text > span.actor').forEach((actorSpan) => {
        const actorText = (actorSpan.textContent || '').trim();
        const m = actorText.match(/^(.+?) と (.+?) のチェインスキル！$/);
        if (!m) return;
        entries.push({ sourceEl: actorSpan, actor: m[1], activeSkills: [], passiveTree: [], chainSkills: ['チェインスキル'], active: false });
        entries.push({ sourceEl: actorSpan, actor: m[2], activeSkills: [], passiveTree: [], chainSkills: ['チェインスキル'], active: false });
      });

      // 収集した順（手動→自動→チェインスキル）ではなく、実際にログへ出現する順に並び替える。
      entries.sort((a, b) => {
        const pos = a.sourceEl.compareDocumentPosition(b.sourceEl);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });
      const count = entries.filter((e) => e.active).length;

      digest.push({
        label: (turns[turnIdx] && turns[turnIdx].label) || `T${turnIdx + 1}`,
        count,
        entries,
      });
    });
    return digest;
  }

  function filterDigestForUnit(digest, unitName) {
    return digest.map((d) => {
      const entries = d.entries.filter((e) => e.actor === unitName);
      return { label: d.label, count: entries.filter((e) => e.active).length, entries };
    });
  }

  function buildActionDigestTable(digest) {
    const table = document.createElement('table');
    table.className = 'lc-turn-table lc-digest-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['ターン', '行動数', '発動スキル'].forEach((text) => {
      const th = document.createElement('th');
      th.textContent = text;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const maxCount = Math.max(1, ...digest.map((d) => d.count));

    const tbody = document.createElement('tbody');
    digest.forEach((d) => {
      const tr = document.createElement('tr');

      const turnTd = document.createElement('th');
      turnTd.className = 'lc-turn-label-cell';
      turnTd.textContent = d.label;
      tr.appendChild(turnTd);

      const countTd = document.createElement('td');
      countTd.textContent = String(d.count);
      if (d.count) countTd.style.background = heatColor(d.count, maxCount, 'info');
      tr.appendChild(countTd);

      const listTd = document.createElement('td');
      listTd.className = 'lc-digest-list';
      if (d.entries.length === 0) {
        listTd.textContent = '-';
      } else {
        // 「自分行動前」型パッシブ＋アクティブ＋その派生パッシブを1つの行動ブロックとして
        // まとめ、どのアクティブに対する前後関係かが見た目で分かるようにする。
        const groups = [];
        let current = [];
        d.entries.forEach((entry) => {
          current.push(entry);
          if (entry.active) {
            groups.push(current);
            current = [];
          }
        });
        if (current.length) groups.push(current);

        groups.forEach((group) => {
          const groupEl = document.createElement('div');
          groupEl.className = 'lc-digest-group';
          group.forEach((entry) => {
            const line = document.createElement('div');
            line.className = 'lc-digest-entry';
            const hasAny = entry.activeSkills.length || entry.passiveTree.length || entry.chainSkills.length;
            if (!hasAny) {
              const span = document.createElement('span');
              span.className = 'lc-digest-skill';
              span.textContent = '（不明）';
              line.appendChild(span);
            }
            if (entry.activeSkills.length) {
              const row = document.createElement('div');
              row.className = 'lc-digest-row';
              const span = document.createElement('span');
              span.className = 'lc-digest-skill lc-digest-active-text';
              span.textContent = entry.activeSkills.join(' / ');
              row.appendChild(span);
              line.appendChild(row);
            }
            entry.passiveTree.forEach((node) => {
              const row = document.createElement('div');
              row.className = 'lc-digest-row';
              row.style.paddingLeft = `${node.depth * 14}px`;
              const span = document.createElement('span');
              span.className = 'lc-digest-skill lc-digest-passive-text';
              span.textContent = node.name;
              row.appendChild(span);
              line.appendChild(row);
            });
            if (entry.chainSkills.length) {
              const row = document.createElement('div');
              row.className = 'lc-digest-row';
              const span = document.createElement('span');
              span.className = 'lc-digest-skill lc-digest-chain-text';
              span.textContent = entry.chainSkills.join(' / ');
              row.appendChild(span);
              line.appendChild(row);
            }
            groupEl.appendChild(line);
          });
          listTd.appendChild(groupEl);
        });
      }
      tr.appendChild(listTd);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  function collectActionCounts(units, turns) {
    const { nameToIndex, namesByLength } = buildNameIndex(units);

    const perTurn = {};
    Object.values(units).forEach((u) => {
      perTurn[u.index] = turns.map(() => 0);
    });

    const roundEls = document.querySelectorAll('section.round');
    roundEls.forEach((roundEl, turnIdx) => {
      roundEl.querySelectorAll('section.turns > section.turn').forEach((turnEl) => {
        const idx = resolveManualActorIndex(turnEl, namesByLength, nameToIndex);
        if (idx === null || idx === undefined) return;
        if (perTurn[idx] && perTurn[idx][turnIdx] !== undefined) perTurn[idx][turnIdx] += 1;
      });
    });

    return { perTurn };
  }

  function collectHitCounts(units, turns) {
    const { nameToIndex, namesByLength } = buildNameIndex(units);

    const perTurn = {};
    Object.values(units).forEach((u) => {
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
        if (perTurn[idx] && perTurn[idx][turnIdx] !== undefined) perTurn[idx][turnIdx] += 1;
      });
    });

    return { perTurn };
  }

  function collectGrantedStatus(units, turns) {
    const { nameToIndex, namesByLength } = buildNameIndex(units);
    const nameToKey = {};
    Object.entries(STATUS_DEFS).forEach(([key, def]) => { nameToKey[def.name] = key; });

    const perTurn = {};
    Object.values(units).forEach((u) => {
      perTurn[u.index] = turns.map(() => ({}));
    });

    function addGrant(idx, turnIdx, statusName, amount) {
      const key = nameToKey[statusName];
      if (!key) return;
      const bucket = perTurn[idx][turnIdx];
      bucket[key] = (bucket[key] || 0) + Math.abs(amount);
    }

    function extractGrants(resultEls) {
      const events = [];
      resultEls.forEach((el) => {
        const text = el.textContent || '';
        if (!text.includes('付与！')) return;
        const bEl = el.querySelector('b');
        if (!bEl) return;
        const numEl = el.querySelector('span[class*="heal"], span[class*="damage"]');
        if (!numEl) return;
        const num = parseInt(numEl.textContent, 10);
        if (Number.isNaN(num)) return;
        events.push({ name: bEl.textContent.trim(), num });
      });
      return events;
    }

    const roundEls = document.querySelectorAll('section.round');
    roundEls.forEach((roundEl, turnIdx) => {
      roundEl.querySelectorAll('section.turns > section.turn').forEach((turnEl) => {
        const idx = resolveManualActorIndex(turnEl, namesByLength, nameToIndex);
        if (idx === null || idx === undefined) return;
        const resultEls = [...turnEl.querySelectorAll('.result')]
          .filter((el) => !el.closest('.passive-text') && !el.closest('.link-text'));
        extractGrants(resultEls).forEach((ev) => addGrant(idx, turnIdx, ev.name, ev.num));
      });

      roundEl.querySelectorAll('section.passive-area section.passive-text > span.actor').forEach((actorSpan) => {
        const actorText = (actorSpan.textContent || '').trim();
        if (!actorText.endsWith(' の 自動行動！')) return;
        const name = namesByLength.find((n) => actorText === `${n} の 自動行動！`);
        if (!name) return;
        const idx = nameToIndex[name];
        const scopeEl = actorSpan.parentElement;
        const resultEls = [...scopeEl.querySelectorAll(':scope > .result')];
        extractGrants(resultEls).forEach((ev) => addGrant(idx, turnIdx, ev.name, ev.num));
      });
    });

    return { perTurn };
  }

  function collectDamageGiven(units, turns) {
    const { nameToIndex, namesByLength } = buildNameIndex(units);

    const perTurn = {};
    Object.values(units).forEach((u) => {
      perTurn[u.index] = turns.map(() => 0);
    });

    const roundEls = document.querySelectorAll('section.round');
    roundEls.forEach((roundEl, turnIdx) => {
      roundEl.querySelectorAll('section.turns > section.turn').forEach((turnEl) => {
        const idx = resolveManualActorIndex(turnEl, namesByLength, nameToIndex);
        if (idx === null || idx === undefined) return;
        turnEl.querySelectorAll('.result').forEach((el) => {
          if (el.closest('.passive-text') || el.closest('.link-text')) return;
          const text = (el.textContent || '').trim();
          if (!text.includes('のダメージを受けた！')) return;
          const span = el.querySelector('span[class*="damage"]');
          if (!span) return;
          const num = parseInt(span.textContent, 10);
          if (Number.isNaN(num)) return;
          if (perTurn[idx] && perTurn[idx][turnIdx] !== undefined) perTurn[idx][turnIdx] += num;
        });
      });
    });

    return { perTurn };
  }

  function collectHealGiven(units, turns) {
    const { nameToIndex, namesByLength } = buildNameIndex(units);

    const perTurn = {};
    Object.values(units).forEach((u) => {
      perTurn[u.index] = turns.map(() => 0);
    });

    const roundEls = document.querySelectorAll('section.round');
    roundEls.forEach((roundEl, turnIdx) => {
      roundEl.querySelectorAll('section.turns > section.turn').forEach((turnEl) => {
        const idx = resolveManualActorIndex(turnEl, namesByLength, nameToIndex);
        if (idx === null || idx === undefined) return;
        turnEl.querySelectorAll('.result').forEach((el) => {
          const text = (el.textContent || '').trim();
          if (!text.includes('回復した！')) return;
          const span = el.querySelector('span[class*="heal"]');
          if (!span) return;
          const num = parseInt(span.textContent, 10);
          if (Number.isNaN(num)) return;
          if (perTurn[idx] && perTurn[idx][turnIdx] !== undefined) perTurn[idx][turnIdx] += num;
        });
      });
    });

    return { perTurn };
  }

  function collectMaxHp(units) {
    const { nameToIndex } = buildNameIndex(units);

    const maxHpByIndex = {};
    document.querySelectorAll('.box .text').forEach((el) => {
      const nameEl = el.querySelector('.name');
      if (!nameEl) return;
      const name = nameEl.textContent.trim();
      const idx = nameToIndex[name];
      if (idx === undefined) return;
      const m = (el.textContent || '').match(/HP:\d+\/(\d+)/);
      if (!m) return;
      maxHpByIndex[idx] = Number(m[1]);
    });
    return maxHpByIndex;
  }

  function collectHpChanges(units, turns) {
    const { nameToIndex, namesByLength } = buildNameIndex(units);

    const dmgHitPerTurn = {};
    const dmgPoisonPerTurn = {};
    const healSkillPerTurn = {};
    const healTickPerTurn = {};
    Object.values(units).forEach((u) => {
      dmgHitPerTurn[u.index] = turns.map(() => 0);
      dmgPoisonPerTurn[u.index] = turns.map(() => 0);
      healSkillPerTurn[u.index] = turns.map(() => 0);
      healTickPerTurn[u.index] = turns.map(() => 0);
    });

    function process(el, turnIdx) {
      const text = (el.textContent || '').trim();
      const isDamage = text.includes('のダメージを受けた！');
      const isHeal = !isDamage && text.includes('回復した！');
      if (!isDamage && !isHeal) return;
      const span = el.querySelector(isDamage ? 'span[class*="damage"]' : 'span[class*="heal"]');
      if (!span) return;
      const num = parseInt(span.textContent, 10);
      if (Number.isNaN(num)) return;
      const name = namesByLength.find((n) => text.startsWith(n));
      if (!name) return;
      const idx = nameToIndex[name];
      if (isHeal) {
        if (el.classList.contains('depth-result')) {
          healTickPerTurn[idx][turnIdx] += num;
        } else {
          healSkillPerTurn[idx][turnIdx] += num;
        }
        return;
      }
      if (el.classList.contains('depth-result')) {
        dmgPoisonPerTurn[idx][turnIdx] += num;
      } else {
        dmgHitPerTurn[idx][turnIdx] += num;
      }
    }

    const roundEls = document.querySelectorAll('section.round');
    roundEls.forEach((roundEl, turnIdx) => {
      roundEl.querySelectorAll('.result, .depth-result').forEach((el) => process(el, turnIdx));
    });

    return { dmgHitPerTurn, dmgPoisonPerTurn, healSkillPerTurn, healTickPerTurn };
  }

  function collectPeaceHeatGains(units, turns) {
    const { nameToIndex, namesByLength } = buildNameIndex(units);

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

  function collectSkillNameMap() {
    const map = {};
    document.querySelectorAll('.skill-name, .skill-name-enemy, .link-skill-name').forEach((el) => {
      const dName = el.querySelector('.d-name');
      if (!dName) return;
      const custom = getCustomSkillName(el);
      const standard = getStandardSkillName(el);
      if (custom && standard) map[custom] = standard;
    });
    return map;
  }

  function relabelSkillNameCells(nameMap) {
    document.querySelectorAll('.skill-name-cell').forEach((cell) => {
      const m = cell.textContent.trim().match(/^(┗\s*)(.+?)(\s*\(\d+\))$/);
      if (!m) return;
      const standard = nameMap[m[2]];
      if (standard && standard !== m[2]) {
        cell.textContent = `${m[1]}${standard}${m[3]}`;
      }
    });
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
      const skillName = getCustomSkillName(skillEl);
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

  function makeStatusHeaderLabel(key) {
    const def = defFor(key);
    const el = document.createElement('span');
    el.className = `lc-status-text-label lc-kind-${def.kind}`;
    el.setAttribute('data-lc-tooltip', `${def.name}\n${def.desc}`);
    el.textContent = def.name;
    return el;
  }

  function makeSimpleHeaderLabel(text, kind) {
    const el = document.createElement('span');
    el.className = `lc-status-text-label lc-kind-${kind}`;
    el.textContent = text;
    return el;
  }

  function appendHeaderCell(headRow, label) {
    const th = document.createElement('th');
    th.appendChild(label);
    headRow.appendChild(th);
  }

  /* =========================================================================
   * 4. ユニットごとのターン推移テーブル
   * ========================================================================= */

  // buildUnitTurnTableA / buildUnitTurnTableD 共通のテーブル描画処理。
  // ターン/行動数/SP/悪計/良計 の共通列と、状態別の列(columns)を持つテーブルを生成する。
  // getBucket(turn, turnIdx) は、そのターンにおける状態別データ(キー→値)を返す関数。
  // onCellExtra(td, col, turnIdx) は状態列セルを描画した直後に呼ばれる追加処理(任意)。
  function buildStatusTurnTable(unit, turns, columns, perTurnActionCount, getBucket, onCellExtra) {
    const table = document.createElement('table');
    table.className = 'lc-turn-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');

    const turnTh = document.createElement('th');
    turnTh.textContent = 'ターン';
    headRow.appendChild(turnTh);

    appendHeaderCell(headRow, makeSimpleHeaderLabel('行動数', 'info'));

    const spTh = document.createElement('th');
    spTh.textContent = 'SP';
    headRow.appendChild(spTh);

    appendHeaderCell(headRow, makeSimpleHeaderLabel('悪計', 'bad'));
    appendHeaderCell(headRow, makeSimpleHeaderLabel('良計', 'good'));

    columns.forEach((col) => {
      const th = document.createElement('th');
      th.appendChild(makeStatusHeaderLabel(col.sign < 0 ? DUAL_SIGN_KEYS[col.key] : col.key));
      headRow.appendChild(th);
    });

    thead.appendChild(headRow);
    table.appendChild(thead);

    const maxByCol = {};
    columns.forEach((col) => {
      const vals = turns
        .map((t, i) => { const b = getBucket(t, i); return b && b[col.key]; })
        .filter((v) => v !== undefined && v !== null)
        .filter((v) => (col.sign === 0 ? true : col.sign > 0 ? v > 0 : v < 0))
        .map(Math.abs);
      maxByCol[col.id] = Math.max(1, ...vals, 0);
    });
    const maxActionCount = Math.max(1, ...perTurnActionCount);
    const cumulativeActionCount = perTurnActionCount.reduce((acc, v) => {
      acc.push((acc.length ? acc[acc.length - 1] : 0) + v);
      return acc;
    }, []);
    const polarityByTurn = turns.map((t, i) => sumStatusPolarity(getBucket(t, i)));
    const maxGood = Math.max(1, ...polarityByTurn.map((p) => p.good));
    const maxBad = Math.max(1, ...polarityByTurn.map((p) => p.bad));

    const tbody = document.createElement('tbody');
    turns.forEach((t, turnIdx) => {
      const bucket = getBucket(t, turnIdx);
      const tr = document.createElement('tr');

      const turnTd = document.createElement('th');
      turnTd.className = 'lc-turn-label-cell';
      turnTd.textContent = t.label;
      tr.appendChild(turnTd);

      const actionCountTd = document.createElement('td');
      const actCount = perTurnActionCount[turnIdx] || 0;
      actionCountTd.textContent = String(actCount);
      if (actCount >= 2) actionCountTd.style.background = heatColor(actCount, maxActionCount, 'info');
      actionCountTd.setAttribute('data-lc-tooltip', `累計: ${cumulativeActionCount[turnIdx]}行動`);
      tr.appendChild(actionCountTd);

      const spTd = document.createElement('td');
      const obj = t.byUnit[unit.index];
      if (obj && obj.s !== undefined) {
        const slv = Math.max(0, Math.min(3, Math.floor(obj.s / 100)));
        spTd.textContent = String(obj.s);
        spTd.classList.add(`lc-slv-${slv}`);
      } else {
        spTd.textContent = '-';
      }
      tr.appendChild(spTd);

      const polarity = polarityByTurn[turnIdx];
      const badTd = document.createElement('td');
      badTd.textContent = polarity.bad ? String(polarity.bad) : '-';
      if (polarity.bad) badTd.style.background = heatColor(polarity.bad, maxBad, 'bad');
      tr.appendChild(badTd);

      const goodTd = document.createElement('td');
      goodTd.textContent = polarity.good ? String(polarity.good) : '-';
      if (polarity.good) goodTd.style.background = heatColor(polarity.good, maxGood, 'good');
      tr.appendChild(goodTd);

      columns.forEach((col) => {
        const td = document.createElement('td');
        const raw = bucket && bucket[col.key] !== undefined ? bucket[col.key] : null;
        let v = raw;
        if (raw !== null && col.sign !== 0) {
          v = (col.sign > 0 ? raw > 0 : raw < 0) ? raw : null;
        }
        if (v === null) {
          td.textContent = '-';
        } else {
          const displayVal = Math.abs(v);
          const kind = col.sign < 0 ? defFor(DUAL_SIGN_KEYS[col.key]).kind : defFor(col.key).kind;
          td.textContent = String(displayVal);
          td.style.background = heatColor(displayVal, maxByCol[col.id], kind);
          if (col.sign < 0) {
            const negDef = defFor(DUAL_SIGN_KEYS[col.key]);
            td.setAttribute('data-lc-tooltip', `${negDef.name}\n${negDef.desc}`);
          }
        }
        if (onCellExtra) onCellExtra(td, col, turnIdx);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    return table;
  }

  function buildUnitTurnTableA(unit, turns, peaceHeatGains, actionCounts) {
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
    const columns = [];
    seenKeys.forEach((key) => {
      if (DUAL_SIGN_KEYS[key]) {
        columns.push({ id: `${key}:pos`, key, sign: 1 });
        columns.push({ id: `${key}:neg`, key, sign: -1 });
      } else {
        columns.push({ id: key, key, sign: 0 });
      }
    });
    const perTurnPeaceGain = (peaceHeatGains && peaceHeatGains.perTurn[unit.index]) || turns.map(() => 0);
    const perTurnActionCount = (actionCounts && actionCounts.perTurn[unit.index]) || turns.map(() => 0);

    return buildStatusTurnTable(
      unit,
      turns,
      columns,
      perTurnActionCount,
      (t) => t.byUnit[unit.index],
      (td, col, turnIdx) => {
        if (col.key === 'pe') {
          const gain = perTurnPeaceGain[turnIdx] || 0;
          if (gain) {
            td.setAttribute('data-lc-tooltip', `連続増: +${gain}`);
          }
        }
      }
    );
  }

  function buildUnitTurnTableD(unit, turns, grantedStatus, actionCounts) {
    const perTurnGrant = (grantedStatus && grantedStatus.perTurn[unit.index]) || turns.map(() => ({}));

    const seenKeysRaw = [];
    perTurnGrant.forEach((bucket) => {
      Object.keys(bucket).forEach((k) => { if (!seenKeysRaw.includes(k)) seenKeysRaw.push(k); });
    });
    const GRANT_FORCED_KEYS = ['au', 'du', 'spd'];
    const seenKeys = sortByRulebookOrder([...new Set([...GRANT_STATUS_ORDER, ...GRANT_FORCED_KEYS, ...seenKeysRaw])], GRANT_STATUS_ORDER);
    const columns = seenKeys.map((key) => ({ id: key, key, sign: 0 }));
    const perTurnActionCount = (actionCounts && actionCounts.perTurn[unit.index]) || turns.map(() => 0);

    return buildStatusTurnTable(
      unit,
      turns,
      columns,
      perTurnActionCount,
      (t, turnIdx) => perTurnGrant[turnIdx] || {}
    );
  }

  function buildUnitTurnTableB(unit, turns, hitCounts, hpChanges, actionCounts, healGiven, maxHpByIndex, damageGiven) {
    const perTurnHits = (hitCounts && hitCounts.perTurn[unit.index]) || turns.map(() => 0);
    const perTurnHit = (hpChanges && hpChanges.dmgHitPerTurn[unit.index]) || turns.map(() => 0);
    const perTurnPoison = (hpChanges && hpChanges.dmgPoisonPerTurn[unit.index]) || turns.map(() => 0);
    const perTurnHealSkill = (hpChanges && hpChanges.healSkillPerTurn[unit.index]) || turns.map(() => 0);
    const perTurnHealTick = (hpChanges && hpChanges.healTickPerTurn[unit.index]) || turns.map(() => 0);
    const perTurnHealGiven = (healGiven && healGiven.perTurn[unit.index]) || turns.map(() => 0);
    const perTurnDamageGiven = (damageGiven && damageGiven.perTurn[unit.index]) || turns.map(() => 0);
    const perTurnActionCount = (actionCounts && actionCounts.perTurn[unit.index]) || turns.map(() => 0);
    const perTurnActualDrop = turns.map((t, i) => {
      const cur = t.byUnit[unit.index] && t.byUnit[unit.index].h;
      const prevT = turns[i - 1];
      const prev = prevT && prevT.byUnit[unit.index] && prevT.byUnit[unit.index].h;
      if (cur === undefined || prev === undefined) return 0;
      return Math.max(0, prev - cur);
    });

    const table = document.createElement('table');
    table.className = 'lc-turn-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');

    const turnTh = document.createElement('th');
    turnTh.textContent = 'ターン';
    headRow.appendChild(turnTh);

    appendHeaderCell(headRow, makeSimpleHeaderLabel('行動数', 'info'));

    const spTh = document.createElement('th');
    spTh.textContent = 'SP';
    headRow.appendChild(spTh);

    appendHeaderCell(headRow, makeSimpleHeaderLabel('HP', 'info'));
    appendHeaderCell(headRow, makeSimpleHeaderLabel('与ダメ', 'bad'));
    appendHeaderCell(headRow, makeSimpleHeaderLabel('与回復', 'good'));
    appendHeaderCell(headRow, makeSimpleHeaderLabel('被回復', 'good'));
    appendHeaderCell(headRow, makeSimpleHeaderLabel('治癒', 'good'));
    appendHeaderCell(headRow, makeSimpleHeaderLabel('被弾数', 'info'));
    appendHeaderCell(headRow, makeSimpleHeaderLabel('被ダメ', 'bad'));
    appendHeaderCell(headRow, makeSimpleHeaderLabel('毒ダメ', 'bad'));

    thead.appendChild(headRow);
    table.appendChild(thead);

    const maxHealSkill = Math.max(1, ...perTurnHealSkill);
    const maxHealTick = Math.max(1, ...perTurnHealTick);
    const maxHealGiven = Math.max(1, ...perTurnHealGiven);
    const maxHitDmg = Math.max(1, ...perTurnHit);
    const maxPoisonDmg = Math.max(1, ...perTurnPoison);
    const maxHitCount = Math.max(1, ...perTurnHits);
    const maxDamageGiven = Math.max(1, ...perTurnDamageGiven);
    const maxActionCount = Math.max(1, ...perTurnActionCount);
    const cumulativeActionCount = perTurnActionCount.reduce((acc, v) => {
      acc.push((acc.length ? acc[acc.length - 1] : 0) + v);
      return acc;
    }, []);
    const maxDecrease = Math.max(1, ...perTurnActualDrop);

    const tbody = document.createElement('tbody');
    turns.forEach((t, turnIdx) => {
      const obj = t.byUnit[unit.index];
      const tr = document.createElement('tr');

      const turnTd = document.createElement('th');
      turnTd.className = 'lc-turn-label-cell';
      turnTd.textContent = t.label;
      tr.appendChild(turnTd);

      const actionCountTd = document.createElement('td');
      const actCount = perTurnActionCount[turnIdx] || 0;
      actionCountTd.textContent = String(actCount);
      if (actCount >= 2) actionCountTd.style.background = heatColor(actCount, maxActionCount, 'info');
      actionCountTd.setAttribute('data-lc-tooltip', `累計: ${cumulativeActionCount[turnIdx]}行動`);
      tr.appendChild(actionCountTd);

      const spTd = document.createElement('td');
      if (obj && obj.s !== undefined) {
        const slv = Math.max(0, Math.min(3, Math.floor(obj.s / 100)));
        spTd.textContent = String(obj.s);
        spTd.classList.add(`lc-slv-${slv}`);
      } else {
        spTd.textContent = '-';
      }
      tr.appendChild(spTd);

      const hpTd = document.createElement('td');
      hpTd.textContent = obj && obj.h !== undefined ? String(obj.h) : '-';
      const decreaseVal = perTurnActualDrop[turnIdx] || 0;
      const mhp = maxHpByIndex && maxHpByIndex[unit.index];
      if (decreaseVal && mhp) {
        const decreasePct = Math.min(100, (decreaseVal / mhp) * 100);
        hpTd.style.background = heatColor(decreasePct, 100, 'bad');
      } else if (decreaseVal) {
        hpTd.style.background = heatColor(decreaseVal, maxDecrease, 'bad');
      }
      if (mhp !== undefined) hpTd.setAttribute('data-lc-tooltip', `MHP: ${mhp}`);
      tr.appendChild(hpTd);

      const damageGivenTd = document.createElement('td');
      const damageGivenVal = perTurnDamageGiven[turnIdx] || 0;
      damageGivenTd.textContent = damageGivenVal ? String(damageGivenVal) : '-';
      if (damageGivenVal) damageGivenTd.style.background = heatColor(damageGivenVal, maxDamageGiven, 'bad');
      tr.appendChild(damageGivenTd);

      const healGivenTd = document.createElement('td');
      const healGivenVal = perTurnHealGiven[turnIdx] || 0;
      healGivenTd.textContent = healGivenVal ? String(healGivenVal) : '-';
      if (healGivenVal) healGivenTd.style.background = heatColor(healGivenVal, maxHealGiven, 'good');
      tr.appendChild(healGivenTd);

      const healTd = document.createElement('td');
      const healVal = perTurnHealSkill[turnIdx] || 0;
      healTd.textContent = healVal ? String(healVal) : '-';
      if (healVal) healTd.style.background = heatColor(healVal, maxHealSkill, 'good');
      tr.appendChild(healTd);

      const healTickTd = document.createElement('td');
      const healTickVal = perTurnHealTick[turnIdx] || 0;
      healTickTd.textContent = healTickVal ? String(healTickVal) : '-';
      if (healTickVal) healTickTd.style.background = heatColor(healTickVal, maxHealTick, 'good');
      if (obj && obj.he !== undefined) {
        healTickTd.setAttribute('data-lc-tooltip', `治癒: ${obj.he}`);
      }
      tr.appendChild(healTickTd);

      const hitCountTd = document.createElement('td');
      const hitCountVal = perTurnHits[turnIdx] || 0;
      hitCountTd.textContent = hitCountVal ? String(hitCountVal) : '-';
      if (hitCountVal) hitCountTd.style.background = heatColor(hitCountVal, maxHitCount, 'info');
      tr.appendChild(hitCountTd);

      const hitDmgTd = document.createElement('td');
      const hitDmgVal = perTurnHit[turnIdx] || 0;
      hitDmgTd.textContent = hitDmgVal ? String(hitDmgVal) : '-';
      if (hitDmgVal) hitDmgTd.style.background = heatColor(hitDmgVal, maxHitDmg, 'bad');
      tr.appendChild(hitDmgTd);

      const poisonDmgTd = document.createElement('td');
      const poisonDmgVal = perTurnPoison[turnIdx] || 0;
      poisonDmgTd.textContent = poisonDmgVal ? String(poisonDmgVal) : '-';
      if (poisonDmgVal) poisonDmgTd.style.background = heatColor(poisonDmgVal, maxPoisonDmg, 'bad');
      if (obj && obj.p !== undefined) {
        poisonDmgTd.setAttribute('data-lc-tooltip', `猛毒: ${obj.p}`);
      }
      tr.appendChild(poisonDmgTd);

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
    const hpChanges = collectHpChanges(units, turns);
    const healGiven = collectHealGiven(units, turns);
    const damageGiven = collectDamageGiven(units, turns);
    const grantedStatus = collectGrantedStatus(units, turns);
    const maxHpByIndex = collectMaxHp(units);
    const skillMap = collectSkillBreakdown();
    const actionDigest = collectActionDigest(turns);

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
      caption.textContent = `◆ ${unit.name} のターン別推移`;
      td.appendChild(caption);

      const tabBar = document.createElement('div');
      tabBar.className = 'lc-panel-tabbar';
      const tabA = document.createElement('button');
      tabA.type = 'button';
      tabA.className = 'lc-panel-tab lc-panel-tab-a';
      tabA.textContent = '状態異常[被]';
      const tabB = document.createElement('button');
      tabB.type = 'button';
      tabB.className = 'lc-panel-tab lc-panel-tab-b';
      tabB.textContent = '詳細解析';
      const tabC = document.createElement('button');
      tabC.type = 'button';
      tabC.className = 'lc-panel-tab lc-panel-tab-c';
      tabC.textContent = '行動早見表';
      const tabD = document.createElement('button');
      tabD.type = 'button';
      tabD.className = 'lc-panel-tab lc-panel-tab-d';
      tabD.textContent = '状態異常[与]';
      tabBar.appendChild(tabB);
      tabBar.appendChild(tabA);
      tabBar.appendChild(tabD);
      tabBar.appendChild(tabC);
      td.appendChild(tabBar);

      const wrap = document.createElement('div');
      wrap.className = 'lc-turn-table-wrap';

      const panelA = document.createElement('div');
      panelA.className = 'lc-panel lc-panel-a';
      panelA.appendChild(buildUnitTurnTableA(unit, turns, peaceHeatGains, actionCounts));

      const panelB = document.createElement('div');
      panelB.className = 'lc-panel lc-panel-b';
      panelB.appendChild(buildUnitTurnTableB(unit, turns, hitCounts, hpChanges, actionCounts, healGiven, maxHpByIndex, damageGiven));

      const panelC = document.createElement('div');
      panelC.className = 'lc-panel lc-panel-c';
      panelC.appendChild(buildActionDigestTable(filterDigestForUnit(actionDigest, unit.name)));

      const panelD = document.createElement('div');
      panelD.className = 'lc-panel lc-panel-d';
      panelD.appendChild(buildUnitTurnTableD(unit, turns, grantedStatus, actionCounts));

      wrap.appendChild(panelA);
      wrap.appendChild(panelB);
      wrap.appendChild(panelC);
      wrap.appendChild(panelD);
      td.appendChild(wrap);

      function setLocalPanelMode(mode) {
        panelA.style.display = mode === 'a' ? '' : 'none';
        panelB.style.display = mode === 'b' ? '' : 'none';
        panelC.style.display = mode === 'c' ? '' : 'none';
        panelD.style.display = mode === 'd' ? '' : 'none';
        tabA.classList.toggle('lc-active', mode === 'a');
        tabB.classList.toggle('lc-active', mode === 'b');
        tabC.classList.toggle('lc-active', mode === 'c');
        tabD.classList.toggle('lc-active', mode === 'd');
      }
      setLocalPanelMode('b');

      tabA.addEventListener('click', (e) => { e.stopPropagation(); setLocalPanelMode('a'); });
      tabB.addEventListener('click', (e) => { e.stopPropagation(); setLocalPanelMode('b'); });
      tabC.addEventListener('click', (e) => { e.stopPropagation(); setLocalPanelMode('c'); });
      tabD.addEventListener('click', (e) => { e.stopPropagation(); setLocalPanelMode('d'); });

      turnRow.appendChild(td);
      insertAfter.insertAdjacentElement('afterend', turnRow);

      summaryRow.addEventListener('click', () => {
        turnRow.classList.toggle('lc-open');
      });
    });

    relabelSkillNameCells(collectSkillNameMap());
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
      section.turn.lc-divider-solid {
        border-top: 1px solid rgba(255,255,255,0.15);
        margin-top: 14px;
        padding-top: 14px;
      }
      section.checkactions.lc-divider-dashed {
        border-top: 1px dashed rgba(255,255,255,0.12);
        margin-top: 14px;
        padding-top: 14px;
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

      tr.lc-turn-row { display: none; }
      tr.lc-turn-row.lc-open { display: table-row; }
      tr.lc-turn-row:hover > td.lc-turn-cell,
      tr.lc-turn-row > td.lc-turn-cell:hover {
        background: rgba(0,0,0,0.15) !important;
        transform: none !important;
        animation: none !important;
      }
      td.lc-turn-cell { background: rgba(0,0,0,0.15); padding: 10px 12px; cursor: default; }
      .lc-turn-caption { font-weight: bold; font-size: 1em; margin-bottom: 8px; }
      .lc-digest-table td.lc-digest-list { text-align: left; padding: 6px 10px; }
      .lc-digest-entry { padding: 2px 6px; }
      .lc-digest-entry + .lc-digest-entry { border-top: 1px dashed rgba(255,255,255,0.1); }
      .lc-digest-row { display: flex; gap: 6px; align-items: baseline; }
      .lc-digest-group { padding: 4px 0; }
      .lc-digest-group + .lc-digest-group { border-top: 2px solid rgba(255,255,255,0.22); margin-top: 2px; }
      .lc-digest-active-text { color: #f0a860; }
      .lc-digest-passive-text { color: #7fb0e6; }
      .lc-digest-chain-text { color: #d888e0; }
      .lc-digest-skill { opacity: 0.95; }
      .lc-panel-tabbar { display: flex; gap: 6px; margin-bottom: 8px; }
      .lc-panel-tab {
        font-family: inherit;
        font-size: 0.85em;
        padding: 4px 12px;
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.2);
        background: rgba(255,255,255,0.05);
        color: inherit;
        cursor: pointer;
      }
      .lc-panel-tab:hover { background: rgba(255,255,255,0.12); }

      .lc-action-jump-source { cursor: pointer; text-decoration: underline dotted; text-underline-offset: 3px; }
      .lc-action-jump-source:hover { color: #ffd166; }
      .lc-jump-highlight { animation: lc-jump-flash 1.2s ease; }
      @keyframes lc-jump-flash {
        0% { background-color: rgba(255, 220, 90, 0.55); }
        100% { background-color: transparent; }
      }
      .lc-panel-tab.lc-active {
        background: rgba(80,150,255,0.35);
        border-color: rgba(80,150,255,0.7);
        font-weight: bold;
      }

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

  function markAutoActionDividers() {
    const blocks = [];
    document.querySelectorAll('section.turns > section.turn, section.passive-area section.checkactions').forEach((el) => {
      if (el.matches('section.turn')) {
        blocks.push({ el, type: 'turn' });
        return;
      }
      const parentTurn = el.closest('section.turn');
      if (parentTurn && parentTurn.querySelector('section.checkactions') === el) return;
      const actorSpan = el.querySelector(':scope > section.passive-text > span.actor');
      const actor = actorSpan ? actorSpan.textContent.trim() : null;
      blocks.push({ el, type: 'auto', actor });
    });

    let prevActor = null;
    blocks.forEach((block, i) => {
      if (i > 0) {
        if (block.type === 'turn') {
          block.el.classList.add('lc-divider-solid');
        } else if (!(block.actor && block.actor === prevActor)) {
          block.el.classList.add('lc-divider-dashed');
        }
      }
      prevActor = block.type === 'auto' ? block.actor : null;
    });
  }

  function injectActionJumpLinks() {
    const actorSpans = [...document.querySelectorAll('section.turns > section.turn > span.actor')]
      .filter((el) => (el.textContent || '').trim().endsWith('の行動！'));

    function resolveTargetInfo(actorSpan) {
      const turnEl = actorSpan.closest('section.turn');
      const roundEl = actorSpan.closest('section.round');
      const checkactions = turnEl && turnEl.querySelector('section.checkactions[id]');
      const markEl = roundEl && roundEl.querySelector('.round-count[id^="round"]');
      if (!checkactions || !markEl) return null;
      const roundNum = parseInt(markEl.textContent, 10);
      if (Number.isNaN(roundNum)) return null;
      return { roundNum, targetId: checkactions.id };
    }

    const byName = {};
    actorSpans.forEach((el) => {
      const name = el.textContent.trim().replace(/の行動！$/, '');
      const info = resolveTargetInfo(el);
      if (!info) return;
      (byName[name] = byName[name] || []).push({ el, ...info });
    });

    function highlight(el) {
      const target = el.closest('section.turn') || el;
      target.classList.add('lc-jump-highlight');
      setTimeout(() => target.classList.remove('lc-jump-highlight'), 1200);
    }

    function jumpTo(info) {
      const el = document.getElementById(info.targetId);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      highlight(el);
    }

    Object.values(byName).forEach((list) => {
      if (list.length < 2) return;
      list.forEach((entry, i) => {
        if (i >= list.length - 1) return;
        entry.el.classList.add('lc-action-jump-source');
        entry.el.title = '次の自分の行動へジャンプ';
        entry.el.addEventListener('click', (e) => {
          e.stopPropagation();
          jumpTo(list[i + 1]);
        });
      });
    });
  }

  /* =========================================================================
   * 7. 実行
   * ========================================================================= */

  function init() {
    const steps = [
      ['injectStyle', injectStyle],
      ['setupTooltipSystem', setupTooltipSystem],
      ['setupLeftPanelNumbers', setupLeftPanelNumbers],
      ['integrateIntoBattleSummary', integrateIntoBattleSummary],
      ['markAutoActionDividers', markAutoActionDividers],
      ['injectActionJumpLinks', injectActionJumpLinks],
    ];
    steps.forEach(([name, fn]) => {
      try {
        fn();
      } catch (e) {
        console.error(`[戦闘解析拡張] ${name} でエラーが発生しました:`, e);
      }
    });
  }

  init();
})();

// ==UserScript==
// @name         BO5技セリフ流し込みツール
// @namespace    https://wdrb.work/bo5/
// @version      1.1
// @description  技ごとにセリフ辞書を管理し、ラウンド設定に一括流し込みします
// @author       ayautaginrei
// @match        https://wdrb.work/bo5/setup.php*
// @updateURL    https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/BO5/BO5%E6%8A%80%E3%82%BB%E3%83%AA%E3%83%95%E6%B5%81%E3%81%97%E8%BE%BC%E3%81%BF%E3%83%84%E3%83%BC%E3%83%AB.user.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'bo5_serif_dicts';
  const W_NAME_KEY  = '__w_name__';

  const loadDicts = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } };
  const saveDicts = d  => localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  const norm      = v  => v == null ? { serif: '', name: '' } : typeof v === 'string' ? { serif: v, name: '' } : { serif: v.serif ?? '', name: v.name ?? '' };
  const $         = s  => document.querySelector(s);
  const $id       = id => document.getElementById(id);
  const isModalOpen = () => $id('bo5-modal-overlay').style.display !== 'none';
  const esc       = v  => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fire      = el => { if (!el) return; ['input','change'].forEach(t => el.dispatchEvent(new Event(t, { bubbles: true }))); };
  const showMsg   = (text, err = false) => {
    const el = $id('bo5-msg');
    el.textContent = text; el.style.color = err ? '#f38ba8' : '#a6e3a1';
    clearTimeout(el._t); el._t = setTimeout(() => { el.textContent = ''; }, 5000);
  };

  function collectCurrentSkills() {
    const rounds = [];
    for (let r = 1; r <= 5; r++) {
      const radio   = $(`input[type="radio"][name="skill_r${r}"]:checked`);
      const serifTA = $(`textarea[name="skill_serif_r${r}"]`);
      if (!radio || !serifTA) continue;
      const el = $(`.skill_prev${r} .skill_name b.large`);
      rounds.push({ round: r, value: radio.value, skillName: el ? el.textContent.trim() : `R${r}技`, serifTA, nameInput: $(`input[name="skill_r${r}_name"]`) });
    }
    return rounds;
  }

  function convertOfficialJson(obj) {
    const entries = {}, duplicates = [], seen = {};
    for (let r = 1; r <= 5; r++) {
      const sv = obj[`skill_r${r}`], serif = obj[`skill_serif_r${r}`] ?? '', name = obj[`skill_r${r}_name`] ?? '';
      if (!sv) continue;
      if (sv in seen && seen[sv].serif !== serif) {
        const dup = duplicates.find(d => d.skillValue === sv);
        if (dup) dup.rounds.push({ r, serif, name });
        else duplicates.push({ skillValue: sv, rounds: [{ r: seen[sv].r, serif: seen[sv].serif, name: seen[sv].name }, { r, serif, name }] });
      }
      entries[sv] = { serif, name }; seen[sv] = { r, serif, name };
    }
    const parts = [obj.btst_name, obj.w_id_name].filter(Boolean);
    return { entries, wName: obj.w_name ?? '', suggestedName: parts.join(' / ') || '公式インポート', count: Object.keys(entries).length, duplicates };
  }

  const isOfficialJson = obj =>
    typeof obj === 'object' && !Array.isArray(obj) &&
    ('skill_r1' in obj || 'skill_r2' in obj) &&
    ('skill_serif_r1' in obj || 'skill_serif_r2' in obj);

  function readCurrentIntoDict(dictName) {
    const dicts = loadDicts();
    if (!dicts[dictName]) dicts[dictName] = {};
    const d = dicts[dictName], wInput = $('input[name="w_name"]');
    if (wInput) d[W_NAME_KEY] = wInput.value;
    const rounds = collectCurrentSkills();
    rounds.forEach(({ value, serifTA, nameInput }) => {
      d[value] = { serif: serifTA.value, name: nameInput ? nameInput.value : norm(d[value]).name };
    });
    saveDicts(dicts);
    return rounds.length;
  }

  function applyDictToRounds(dictName) {
    const d = loadDicts()[dictName] || {}, rounds = collectCurrentSkills();
    let applied = 0; const missing = [];
    const wInput = $('input[name="w_name"]');
    if (wInput && W_NAME_KEY in d) { wInput.value = d[W_NAME_KEY]; fire(wInput); }
    rounds.forEach(({ value, serifTA, nameInput, skillName }) => {
      if (value in d) {
        const e = norm(d[value]);
        serifTA.value = e.serif; fire(serifTA);
        if (nameInput) { nameInput.value = e.name; fire(nameInput); }
        applied++;
      } else { missing.push(skillName || value); }
    });
    return { applied, missing };
  }

  let editorDictName = null;

  function openEditor(dictName) {
    editorDictName = dictName;
    $id('bo5-modal-title').textContent = `辞書エディタ：${dictName}`;
    renderModalRows(dictName);
    $id('bo5-modal-overlay').style.display = 'flex';
  }
  const closeModal = () => { $id('bo5-modal-overlay').style.display = 'none'; };

  function renderModalRows(dictName) {
    const d = loadDicts()[dictName] || {}, rounds = collectCurrentSkills();
    const wrap = $id('bo5-modal-rows');
    wrap.innerHTML = `
      <div class="bo5m-section">
        <div class="bo5m-section-hdr" style="color:#f9e2af;">⚔ 武器の銘</div>
        <div class="bo5m-field-row">
          <label class="bo5m-label">銘</label>
          <input type="text" data-gkey="${W_NAME_KEY}" maxlength="8" placeholder="8文字以内" value="${esc(d[W_NAME_KEY] ?? '')}" class="bo5m-input">
        </div>
      </div>
      <div class="bo5m-section">
        <div class="bo5m-section-hdr" style="color:#a6e3a1;">⚡ 技セリフ・技名</div>
        <div id="bo5m-skill-list"></div>
      </div>`;

    const pageKeys = rounds.map(r => r.value);
    const allKeys  = [...pageKeys, ...Object.keys(d).filter(k => k !== W_NAME_KEY && !pageKeys.includes(k))];
    const list     = $id('bo5m-skill-list');

    if (!allKeys.length) {
      list.innerHTML = '<p style="color:#585b70;font-size:12px;margin:8px 0;">技がありません。「現在の内容を辞書に読み込む」か技を選択してください。</p>';
    } else {
      allKeys.forEach(key => {
        const ri       = rounds.find(r => r.value === key);
        const label    = ri ? ri.skillName : key;
        const roundNums = rounds.filter(r => r.value === key).map(r => `R${r.round}`).join('/');
        const entry    = norm(d[key]);
        const row      = document.createElement('div');
        row.className  = 'bo5m-skill-row';
        row.innerHTML  = `
          <div class="bo5m-skill-hdr">
            <span class="bo5m-skill-name">${esc(label)}</span>
            <span class="bo5m-skill-key" style="color:${ri ? '#89b4fa' : '#585b70'};">${roundNums ? roundNums + '　' : ''}${esc(key)}</span>
            <button class="bo5m-del-btn" data-key="${esc(key)}" title="このキーを削除">✕</button>
          </div>
          <div class="bo5m-field-row">
            <label class="bo5m-label">技名</label>
            <input type="text" data-key="${esc(key)}" data-field="name" maxlength="8" placeholder="8文字以内" value="${esc(entry.name)}" class="bo5m-input bo5m-name-input">
          </div>
          <div class="bo5m-field-row">
            <label class="bo5m-label">セリフ</label>
            <textarea data-key="${esc(key)}" data-field="serif" class="bo5m-textarea" rows="3">${esc(entry.serif)}</textarea>
          </div>`;
        list.appendChild(row);
      });
      list.querySelectorAll('.bo5m-del-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!confirm(`「${btn.dataset.key}」を辞書から削除しますか？`)) return;
          const dicts = loadDicts(); delete dicts[dictName][btn.dataset.key];
          saveDicts(dicts); renderModalRows(dictName); refreshPreview(); showMsg(`${btn.dataset.key} を削除しました`);
        });
      });
    }
  }

  function saveModal() {
    if (!editorDictName) return;
    const dicts = loadDicts(); if (!dicts[editorDictName]) dicts[editorDictName] = {};
    const d = dicts[editorDictName], wrap = $id('bo5-modal-rows');
    wrap.querySelectorAll('[data-gkey]').forEach(el => { d[el.dataset.gkey] = el.value; });
    const keyMap = {};
    wrap.querySelectorAll('[data-key][data-field]').forEach(el => {
      const { key, field } = el.dataset;
      if (!keyMap[key]) keyMap[key] = norm(d[key]);
      keyMap[key][field] = el.value;
    });
    Object.assign(d, keyMap);
    saveDicts(dicts); refreshPreview(); showMsg(`辞書「${editorDictName}」を保存しました`);
  }

  function refreshPreview() {
    const area = $id('bo5-preview-area'); if (!area) return;
    const d = loadDicts()[$id('bo5-dict-select').value] || {}, rounds = collectCurrentSkills();
    const rows = [];
    if (d[W_NAME_KEY]) rows.push(`<div class="bo5-preview-row"><span class="bo5-pv-round" style="color:#f9e2af;">銘</span><span style="color:#f9e2af;flex:1;">${esc(d[W_NAME_KEY])}</span></div>`);
    if (!rounds.length) {
      rows.push('<span style="color:#585b70;font-size:11px;">（技設定が見つかりません）</span>');
    } else {
      rounds.forEach(({ round, value, skillName }) => {
        const entry = d[value] ? norm(d[value]) : null;
        const np    = entry?.name  ? `<b style="color:#cba6f7;">[${esc(entry.name)}]</b> ` : '';
        const sp    = entry?.serif ? esc(entry.serif).substring(0, 45) + (entry.serif.length > 45 ? '…' : '') : '<span style="color:#f38ba8;font-style:italic;">（未設定）</span>';
        rows.push(`<div class="bo5-preview-row"><span class="bo5-pv-round">R${round}</span><span class="bo5-pv-skill">${esc(skillName)}<br><small style="color:#585b70;">${esc(value)}</small></span><span class="bo5-pv-serif">${np}${sp}</span></div>`);
      });
    }
    area.innerHTML = rows.join('');
  }

  function refreshDictSelect(keepValue) {
    const sel = $id('bo5-dict-select'), prev = keepValue ?? sel.value, names = Object.keys(loadDicts());
    sel.innerHTML = names.length ? names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('') : '<option value="">（辞書なし）</option>';
    if (names.includes(prev)) sel.value = prev;
  }

  function buildUI() {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="bo5-serif-panel">
        <div id="bo5-serif-header">📝 技セリフ管理<button id="bo5-serif-toggle" title="折りたたむ">▼</button></div>
        <div id="bo5-serif-body">
          <div class="bo5-section">
            <label>辞書を選択</label>
            <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
              <select id="bo5-dict-select" style="flex:1;min-width:0;"></select>
              <button id="bo5-dict-new" title="新しい辞書を作成">＋新規</button>
              <button id="bo5-dict-rename" title="辞書名を変更">✏</button>
              <button id="bo5-dict-delete" title="辞書を削除" style="color:#f38ba8;">🗑</button>
            </div>
          </div>
          <div class="bo5-section bo5-preview" id="bo5-preview-area"></div>
          <div class="bo5-section" style="display:flex;flex-direction:column;gap:5px;">
            <button id="bo5-btn-apply" class="bo5-btn-primary">▶ 選択辞書を流し込む</button>
            <button id="bo5-btn-read">↑ 現在の内容を辞書に読み込む</button>
            <button id="bo5-btn-edit">✎ 辞書エディタを開く</button>
            <div style="display:flex;gap:5px;">
              <button id="bo5-btn-export" style="flex:1;">⬇ Export JSON</button>
              <button id="bo5-btn-import-trigger" style="flex:1;">⬆ Import JSON</button>
              <input type="file" id="bo5-btn-import" accept=".json,application/json" style="display:none;">
            </div>
            <button id="bo5-btn-import-official-trigger" style="background:#2d3b2d;border-color:#4a7c4a;color:#a6e3a1;">🎮 公式JSONから辞書を生成</button>
            <input type="file" id="bo5-btn-import-official" accept=".json,application/json" style="display:none;">
          </div>
          <div id="bo5-msg" style="margin-top:5px;font-size:11px;min-height:16px;"></div>
        </div>
      </div>
      <div id="bo5-modal-overlay">
        <div id="bo5-modal">
          <div id="bo5-modal-header">
            <span id="bo5-modal-title"></span>
            <div style="display:flex;gap:8px;align-items:center;">
              <button id="bo5-modal-addrow" title="技キーを手動追加">＋行追加</button>
              <button id="bo5-modal-save" class="bo5-btn-primary">保存</button>
              <button id="bo5-modal-close" title="閉じる">✕</button>
            </div>
          </div>
          <div id="bo5-modal-rows"></div>
        </div>
      </div>`);
    injectStyles();
    bindEvents();
    refreshDictSelect();
    refreshPreview();
  }

  function bindEvents() {
    let collapsed = false;
    $id('bo5-serif-toggle').addEventListener('click', () => {
      collapsed = !collapsed;
      $id('bo5-serif-body').style.display = collapsed ? 'none' : '';
      $id('bo5-serif-toggle').textContent  = collapsed ? '▲' : '▼';
    });

    const panel = $id('bo5-serif-panel'), hdr = $id('bo5-serif-header');
    let drag = false, sx, sy, or, ob;
    hdr.addEventListener('mousedown', e => {
      if (e.target.tagName === 'BUTTON') return;
      drag = true; sx = e.clientX; sy = e.clientY;
      const r = panel.getBoundingClientRect(); or = window.innerWidth - r.right; ob = window.innerHeight - r.bottom;
    });
    document.addEventListener('mousemove', e => {
      if (!drag) return;
      panel.style.right = (or - (e.clientX - sx)) + 'px'; panel.style.bottom = (ob - (e.clientY - sy)) + 'px';
      panel.style.left = 'auto'; panel.style.top = 'auto';
    });
    document.addEventListener('mouseup', () => { drag = false; });

    $id('bo5-dict-select').addEventListener('change', refreshPreview);

    $id('bo5-dict-new').addEventListener('click', () => {
      const name = prompt('新しい辞書の名前：'); if (!name?.trim()) return;
      const dicts = loadDicts();
      if (dicts[name.trim()]) { showMsg('同名の辞書が既にあります', true); return; }
      dicts[name.trim()] = {}; saveDicts(dicts);
      refreshDictSelect(name.trim()); $id('bo5-dict-select').value = name.trim(); refreshPreview();
      showMsg(`辞書「${name.trim()}」を作成しました`); openEditor(name.trim());
    });

    $id('bo5-dict-rename').addEventListener('click', () => {
      const old = $id('bo5-dict-select').value; if (!old) return;
      const n = prompt(`辞書「${old}」の新しい名前：`, old);
      if (!n?.trim() || n.trim() === old) return;
      const dicts = loadDicts();
      if (dicts[n.trim()]) { showMsg('同名の辞書が既にあります', true); return; }
      dicts[n.trim()] = dicts[old]; delete dicts[old]; saveDicts(dicts);
      refreshDictSelect(n.trim()); $id('bo5-dict-select').value = n.trim();
      if (editorDictName === old) { editorDictName = n.trim(); $id('bo5-modal-title').textContent = `辞書エディタ：${n.trim()}`; }
      showMsg(`「${old}」→「${n.trim()}」に変更しました`);
    });

    $id('bo5-dict-delete').addEventListener('click', () => {
      const name = $id('bo5-dict-select').value; if (!name) return;
      if (!confirm(`辞書「${name}」を削除しますか？`)) return;
      const dicts = loadDicts(); delete dicts[name]; saveDicts(dicts);
      if (editorDictName === name) { closeModal(); editorDictName = null; }
      refreshDictSelect(''); refreshPreview(); showMsg(`辞書「${name}」を削除しました`);
    });

    $id('bo5-btn-apply').addEventListener('click', () => {
      const name = $id('bo5-dict-select').value;
      if (!name) { showMsg('辞書が選択されていません', true); return; }
      const { applied, missing } = applyDictToRounds(name);
      showMsg(missing.length ? `${applied}件流し込み完了。辞書未登録: ${missing.join('、')}` : `全${applied}ラウンドへの流し込み完了！`);
      refreshPreview();
    });

    $id('bo5-btn-read').addEventListener('click', () => {
      const name = $id('bo5-dict-select').value;
      if (!name) { showMsg('先に辞書を選択または作成してください', true); return; }
      showMsg(`${readCurrentIntoDict(name)}件の技セリフを辞書「${name}」に読み込みました`);
      refreshPreview();
      if (isModalOpen() && editorDictName === name) renderModalRows(name);
    });

    $id('bo5-btn-edit').addEventListener('click', () => {
      const name = $id('bo5-dict-select').value;
      if (!name) { showMsg('辞書が選択されていません', true); return; }
      openEditor(name);
    });

    $id('bo5-modal-overlay').addEventListener('click', e => { if (e.target === $id('bo5-modal-overlay')) closeModal(); });
    $id('bo5-modal-close').addEventListener('click', closeModal);
    $id('bo5-modal-save').addEventListener('click', () => { saveModal(); closeModal(); });

    $id('bo5-modal-addrow').addEventListener('click', () => {
      if (!editorDictName) return;
      const key = prompt('追加する技キー名を入力してください\n（例: gradius_01, dagger_02 など）'); if (!key?.trim()) return;
      const dicts = loadDicts(); if (!dicts[editorDictName]) dicts[editorDictName] = {};
      if (!(key.trim() in dicts[editorDictName])) { dicts[editorDictName][key.trim()] = { serif: '', name: '' }; saveDicts(dicts); }
      renderModalRows(editorDictName);
    });

    $id('bo5-btn-export').addEventListener('click', () => {
      const name = $id('bo5-dict-select').value;
      if (!name) { showMsg('辞書が選択されていません', true); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify({ [name]: loadDicts()[name] || {} }, null, 2)], { type: 'application/json' }));
      a.download = `bo5_serif_${name.replace(/[^\w\u3000-\u9fff]/g, '_')}.json`; a.click();
      showMsg(`「${name}」をエクスポートしました`);
    });

    const makeFileHandler = (triggerId, inputId, handler) => {
      $id(triggerId).addEventListener('click', () => $id(inputId).click());
      $id(inputId).addEventListener('change', function () {
        const file = this.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = e => { try { handler(JSON.parse(e.target.result)); } catch (err) { showMsg('JSONの解析に失敗しました: ' + err.message, true); } };
        reader.readAsText(file); this.value = '';
      });
    };

    makeFileHandler('bo5-btn-import-trigger', 'bo5-btn-import', imported => {
      if (typeof imported !== 'object' || Array.isArray(imported)) throw new Error('形式が不正です');
      const dicts = loadDicts(); let count = 0;
      for (const [name, dict] of Object.entries(imported)) {
        if (typeof dict !== 'object' || Array.isArray(dict)) continue;
        if (dicts[name] && !confirm(`辞書「${name}」は既に存在します。\nOK → マージ　キャンセル → スキップ`)) continue;
        dicts[name] ? Object.assign(dicts[name], dict) : (dicts[name] = dict); count++;
      }
      saveDicts(dicts); refreshDictSelect($id('bo5-dict-select').value); refreshPreview();
      showMsg(`${count}件の辞書をインポートしました`);
    });

    makeFileHandler('bo5-btn-import-official-trigger', 'bo5-btn-import-official', obj => {
      if (!isOfficialJson(obj)) { showMsg('公式形式のJSONではありません', true); return; }
      const { entries, wName, suggestedName, count, duplicates } = convertOfficialJson(obj);
      if (!count) { showMsg('変換できる技セリフが見つかりませんでした', true); return; }
      const dictName = prompt(`公式JSONから ${count} 件の技セリフを読み取りました。\n登録する辞書名：`, suggestedName);
      if (!dictName?.trim()) return;
      const dicts = loadDicts(), dn = dictName.trim();
      if (dicts[dn]) {
        if (!confirm(`辞書「${dn}」は既に存在します。\nOK → マージ　キャンセル → スキップ`)) return;
        if (wName) dicts[dn][W_NAME_KEY] = wName; Object.assign(dicts[dn], entries);
      } else { dicts[dn] = { [W_NAME_KEY]: wName, ...entries }; }
      saveDicts(dicts); refreshDictSelect(dn); $id('bo5-dict-select').value = dn; refreshPreview();
      if (duplicates.length) {
        alert('⚠ 同じ技が複数ラウンドで異なるセリフを持っていました。\n最後のラウンドのセリフを登録しています。\n\n' +
          duplicates.map(d => `【${d.skillValue}】\n` + d.rounds.map(r => `  R${r.r}: ${r.serif.substring(0, 25)}…`).join('\n')).join('\n'));
      }
      showMsg(`辞書「${dn}」に ${count} 件登録しました`);
    });

    document.addEventListener('change', e => {
      if (!e.target.matches('input[type="radio"][name^="skill_r"]')) return;
      setTimeout(() => { refreshPreview(); if (isModalOpen() && editorDictName) renderModalRows(editorDictName); }, 120);
    });
  }

  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      #bo5-serif-panel{position:fixed;bottom:20px;right:20px;width:310px;background:#1e1e2e;color:#cdd6f4;border:1px solid #45475a;border-radius:10px;box-shadow:0 4px 24px rgba(0,0,0,.6);z-index:99998;font-size:13px;font-family:sans-serif}
      #bo5-serif-header{background:#313244;padding:8px 12px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center;font-weight:bold;cursor:default;user-select:none}
      #bo5-serif-header button{background:none;border:none;color:#cdd6f4;cursor:pointer;font-size:14px;padding:0 4px}
      #bo5-serif-body{padding:10px 12px 12px}
      .bo5-section{margin-bottom:8px}
      .bo5-section>label{display:block;font-size:11px;color:#a6adc8;margin-bottom:3px}
      #bo5-dict-select{background:#313244;color:#cdd6f4;border:1px solid #45475a;border-radius:5px;padding:4px 6px}
      #bo5-serif-panel button{background:#313244;color:#cdd6f4;border:1px solid #45475a;border-radius:5px;padding:5px 8px;cursor:pointer;font-size:12px;transition:background .15s}
      #bo5-serif-panel button:hover{background:#45475a}
      .bo5-btn-primary{background:#4c6ef5!important;color:#fff!important;border-color:#4c6ef5!important;font-weight:bold}
      .bo5-btn-primary:hover{background:#3b5bdb!important}
      .bo5-preview{background:#181825;border:1px solid #313244;border-radius:6px;padding:6px 8px;font-size:11px;max-height:160px;overflow-y:auto}
      .bo5-preview-row{display:flex;gap:6px;padding:3px 0;border-bottom:1px solid #313244;align-items:flex-start}
      .bo5-preview-row:last-child{border-bottom:none}
      .bo5-pv-round{color:#89b4fa;min-width:22px;font-weight:bold}
      .bo5-pv-skill{color:#a6e3a1;min-width:72px}
      .bo5-pv-serif{color:#cdd6f4;word-break:break-all;flex:1}
      #bo5-msg{font-size:11px;min-height:16px}
      #bo5-modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:99999;align-items:center;justify-content:center}
      #bo5-modal{background:#1e1e2e;color:#cdd6f4;border:1px solid #45475a;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.8);width:min(680px,92vw);max-height:85vh;display:flex;flex-direction:column;font-size:13px;font-family:sans-serif;overflow:hidden}
      #bo5-modal-header{background:#313244;padding:12px 16px;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center;font-weight:bold;font-size:14px;flex-shrink:0}
      #bo5-modal-header button{background:#45475a;color:#cdd6f4;border:1px solid #585b70;border-radius:5px;padding:5px 10px;cursor:pointer;font-size:12px;transition:background .15s}
      #bo5-modal-header button:hover{background:#585b70}
      #bo5-modal-close{background:none!important;border:none!important;font-size:18px!important;padding:2px 6px!important;color:#a6adc8!important}
      #bo5-modal-rows{overflow-y:auto;padding:16px 20px;flex:1}
      .bo5m-section{margin-bottom:20px}
      .bo5m-section-hdr{font-size:12px;font-weight:bold;padding-bottom:4px;margin-bottom:10px;border-bottom:1px solid #45475a}
      .bo5m-skill-row{background:#181825;border:1px solid #313244;border-radius:8px;padding:12px 14px;margin-bottom:10px}
      .bo5m-skill-hdr{display:flex;align-items:baseline;gap:8px;margin-bottom:8px}
      .bo5m-skill-name{color:#a6e3a1;font-weight:bold;font-size:13px}
      .bo5m-skill-key{color:#585b70;font-size:11px;flex:1}
      .bo5m-del-btn{background:none!important;border:none!important;color:#f38ba8!important;cursor:pointer;font-size:12px!important;padding:2px 4px!important;margin-left:auto}
      .bo5m-del-btn:hover{color:#ff8!important}
      .bo5m-field-row{display:flex;gap:10px;align-items:flex-start;margin-bottom:6px}
      .bo5m-label{color:#a6adc8;font-size:11px;min-width:3em;padding-top:5px;flex-shrink:0}
      .bo5m-input{flex:1;background:#1e1e2e;color:#cdd6f4;border:1px solid #45475a;border-radius:5px;padding:5px 8px;font-size:12px}
      .bo5m-name-input{max-width:180px}
      .bo5m-textarea{flex:1;background:#1e1e2e;color:#cdd6f4;border:1px solid #45475a;border-radius:5px;padding:6px 8px;font-size:12px;resize:vertical;min-height:60px;line-height:1.5}
      .bo5m-input:focus,.bo5m-textarea:focus{outline:none;border-color:#4c6ef5;box-shadow:0 0 0 2px rgba(76,110,245,.25)}
    `;
    document.head.appendChild(s);
  }

  function init() {
    if (!location.pathname.endsWith('setup.php') || !$('.skillset')) return;
    buildUI();
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();

})();

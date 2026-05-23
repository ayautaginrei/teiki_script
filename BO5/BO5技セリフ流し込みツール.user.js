// ==UserScript==
// @name         BO5技セリフ流し込みツール
// @namespace    https://wdrb.work/bo5/
// @version      1.0
// @description  技ごとにセリフ辞書を管理し、ラウンド設定に一括流し込みします
// @author       ayautaginrei
// @match        https://wdrb.work/bo5/setup.php*
// @updateURL
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // =====================================================================
  // ストレージ
  // =====================================================================
  const STORAGE_KEY = 'bo5_serif_dicts';

  function loadDicts() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  }
  function saveDicts(dicts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dicts));
  }

  // =====================================================================
  // 公式JSONから辞書エントリへの変換
  // =====================================================================

  function convertOfficialJson(obj) {
    // 戻り値: { entries, suggestedName, count, duplicates }
    // duplicates: 同じ技キーが複数ラウンドで使われ、かつセリフが異なっていたもの
    const entries    = {};
    const duplicates = []; // { skillValue, rounds: [{r, serif}] }
    const seen       = {}; // skillValue -> { r, serif }

    for (let r = 1; r <= 5; r++) {
      const skillValue = obj[`skill_r${r}`];
      const serif      = obj[`skill_serif_r${r}`];
      if (!skillValue || serif === undefined || serif === null) continue;

      if (skillValue in seen) {
        // 同キーが既にある
        if (seen[skillValue].serif !== serif) {
          // セリフが違う → duplicatesに記録
          const dup = duplicates.find(d => d.skillValue === skillValue);
          if (dup) {
            dup.rounds.push({ r, serif });
          } else {
            duplicates.push({
              skillValue,
              rounds: [{ r: seen[skillValue].r, serif: seen[skillValue].serif }, { r, serif }]
            });
          }
        }
        // 後ラウンド優先で上書き
        entries[skillValue] = serif;
        seen[skillValue] = { r, serif };
      } else {
        entries[skillValue] = serif;
        seen[skillValue] = { r, serif };
      }
    }

    const parts = [obj.btst_name, obj.w_id_name].filter(Boolean);
    const suggestedName = parts.length ? parts.join(' / ') : '公式インポート';

    return { entries, suggestedName, count: Object.keys(entries).length, duplicates };
  }

  // 公式JSONかどうかの簡易判定（version フィールドと skill_r1 の存在で判断）
  function isOfficialJson(obj) {
    return typeof obj === 'object'
      && !Array.isArray(obj)
      && ('skill_r1' in obj || 'skill_r2' in obj)
      && ('skill_serif_r1' in obj || 'skill_serif_r2' in obj);
  }

  // =====================================================================
  // ページ情報の収集
  // =====================================================================
  function collectCurrentSkills() {
    const rounds = [];
    for (let r = 1; r <= 5; r++) {
      // 非表示のchecked radioが現在の確定選択値
      const checkedRadio = document.querySelector(
        `input[type="radio"][name="skill_r${r}"]:checked`
      );
      const textarea = document.querySelector(`textarea[name="skill_serif_r${r}"]`);
      if (!checkedRadio || !textarea) continue;
      rounds.push({
        round: r,
        value: checkedRadio.value,
        skillName: getSkillDisplayName(r),
        textarea,
      });
    }
    return rounds;
  }

  function getSkillDisplayName(r) {
    const el = document.querySelector(`.skill_prev${r} .skill_name b.large`);
    return el ? el.textContent.trim() : `R${r}技`;
  }

  // =====================================================================
  // 辞書操作
  // =====================================================================

  // 現在のフォームのセリフを辞書に読み込む（上書きマージ）
  function readCurrentSerifIntoDict(dictName) {
    const dicts = loadDicts();
    if (!dicts[dictName]) dicts[dictName] = {};
    const rounds = collectCurrentSkills();
    rounds.forEach(({ value, textarea }) => {
      dicts[dictName][value] = textarea.value;
    });
    saveDicts(dicts);
    return rounds.length;
  }

  // 辞書を全ラウンドに流し込む
  function applyDictToRounds(dictName) {
    const dict = (loadDicts()[dictName]) || {};
    const rounds = collectCurrentSkills();
    let applied = 0;
    const missing = [];
    rounds.forEach(({ value, textarea, skillName }) => {
      if (value in dict) {
        textarea.value = dict[value];
        textarea.dispatchEvent(new Event('input',  { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        applied++;
      } else {
        missing.push(skillName || value);
      }
    });
    return { applied, missing };
  }

  // =====================================================================
  // エディタ管理（モジュール化してどこからでも開き直せる）
  // =====================================================================
  let editorDictName = null; // 現在エディタが開いている辞書名

  function openEditor(dictName) {
    editorDictName = dictName;
    renderEditorRows(dictName);
    document.getElementById('bo5-serif-editor').style.display = 'block';
    document.getElementById('bo5-editor-title').textContent = `辞書エディタ：${dictName}`;
  }

  function renderEditorRows(dictName) {
    const dict = (loadDicts()[dictName]) || {};
    const rounds = collectCurrentSkills();
    const rowsDiv = document.getElementById('bo5-editor-rows');

    // 現在ページの技キー ＋ 辞書に既にあるキー（別武器分）をすべて表示
    const pageKeys = rounds.map(r => r.value);
    const dictKeys = Object.keys(dict);
    // pageKeysを先頭に、辞書にあって現在ページにない追加キーを後ろに
    const allKeys = [...pageKeys, ...dictKeys.filter(k => !pageKeys.includes(k))];

    rowsDiv.innerHTML = '';

    if (allKeys.length === 0) {
      rowsDiv.innerHTML = '<p style="color:#585b70;font-size:11px;">技がありません。まず「現在のセリフを読み込む」か直接ページで技を選択してください。</p>';
      return;
    }

    allKeys.forEach(key => {
      const roundInfo  = rounds.find(r => r.value === key);
      const skillLabel = roundInfo ? roundInfo.skillName : key;
      const isCurrentPage = !!roundInfo;

      const row = document.createElement('div');
      row.className = 'bo5-editor-row';
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <label>${esc(skillLabel)}</label>
          <small style="color:${isCurrentPage ? '#89b4fa' : '#585b70'};">
            ${isCurrentPage ? `R${roundInfo.round} ` : ''}${esc(key)}
          </small>
        </div>
        <textarea data-key="${esc(key)}" rows="2">${esc(dict[key] || '')}</textarea>
        <button class="bo5-editor-del-row" data-key="${esc(key)}" title="このキーを辞書から削除">✕ 削除</button>
      `;
      rowsDiv.appendChild(row);
    });

    // 削除ボタン
    rowsDiv.querySelectorAll('.bo5-editor-del-row').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm(`「${btn.dataset.key}」を辞書から削除しますか？`)) return;
        const dicts = loadDicts();
        delete dicts[dictName][btn.dataset.key];
        saveDicts(dicts);
        renderEditorRows(dictName); // 再描画
        showMsg(`${btn.dataset.key} を削除しました`);
        refreshPreview();
      });
    });
  }

  // エディタの「保存」処理（ローカルストレージから最新を読んでマージ）
  function saveEditor() {
    if (!editorDictName) return;
    const dicts = loadDicts();
    if (!dicts[editorDictName]) dicts[editorDictName] = {};

    const rowsDiv = document.getElementById('bo5-editor-rows');
    rowsDiv.querySelectorAll('textarea[data-key]').forEach(ta => {
      dicts[editorDictName][ta.dataset.key] = ta.value;
    });
    saveDicts(dicts);
    refreshPreview();
    showMsg(`辞書「${editorDictName}」を保存しました`);
  }

  // =====================================================================
  // UI 構築
  // =====================================================================
  function buildUI() {
    const panel = document.createElement('div');
    panel.id = 'bo5-serif-panel';
    panel.innerHTML = `
      <div id="bo5-serif-header">
        📝 技セリフ管理
        <button id="bo5-serif-toggle" title="折りたたむ">▼</button>
      </div>
      <div id="bo5-serif-body">

        <div class="bo5-section">
          <label>辞書を選択<small style="color:#585b70;margin-left:6px;">（ダブルクリックでエディタを開く）</small></label>
          <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
            <select id="bo5-dict-select" style="flex:1;min-width:0;"></select>
            <button id="bo5-dict-new"    title="新しい辞書を作成">＋新規</button>
            <button id="bo5-dict-rename" title="辞書名を変更">✏</button>
            <button id="bo5-dict-delete" title="辞書を削除" style="color:#f38ba8;">🗑</button>
          </div>
        </div>

        <!-- プレビュー -->
        <div class="bo5-section bo5-preview" id="bo5-preview-area"></div>

        <!-- アクションボタン群 -->
        <div class="bo5-section" style="display:flex;flex-direction:column;gap:5px;">
          <button id="bo5-btn-apply" class="bo5-btn-primary">▶ 選択辞書を流し込む</button>
          <button id="bo5-btn-read">↑ 現在のセリフを辞書に読み込む</button>
          <button id="bo5-btn-edit">✎ 辞書エディタを開く</button>
          <div style="display:flex;gap:5px;">
            <button id="bo5-btn-export" style="flex:1;">⬇ Export JSON</button>
            <button id="bo5-btn-import-trigger" style="flex:1;">⬆ Import JSON</button>
            <input type="file" id="bo5-btn-import" accept=".json,application/json" style="display:none;">
          </div>
          <button id="bo5-btn-import-official-trigger" style="background:#2d3b2d;border-color:#4a7c4a;color:#a6e3a1;" 公式JSONから辞書を生成</button>
          <input type="file" id="bo5-btn-import-official" accept=".json,application/json" style="display:none;">
        </div>

        <!-- インラインエディタ -->
        <div id="bo5-serif-editor" class="bo5-section" style="display:none;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
            <b id="bo5-editor-title" style="font-size:12px;"></b>
            <button id="bo5-editor-add-row" title="空のキーを追加">＋行追加</button>
          </div>
          <div id="bo5-editor-rows"></div>
          <div style="display:flex;gap:5px;margin-top:6px;">
            <button id="bo5-editor-save"   class="bo5-btn-primary" style="flex:1;">保存</button>
            <button id="bo5-editor-close"  style="flex:1;">閉じる</button>
          </div>
        </div>

        <div id="bo5-msg" style="margin-top:5px;font-size:11px;min-height:16px;"></div>
      </div>
    `;
    document.body.appendChild(panel);
    injectStyles();
    bindEvents();
    refreshDictSelect();
    refreshPreview();
  }

  // =====================================================================
  // セレクト・プレビュー更新
  // =====================================================================
  function refreshDictSelect(keepValue) {
    const sel = document.getElementById('bo5-dict-select');
    const prev = keepValue !== undefined ? keepValue : sel.value;
    const dicts = loadDicts();
    const names = Object.keys(dicts);
    sel.innerHTML = names.length
      ? names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')
      : '<option value="">（辞書なし）</option>';
    if (names.includes(prev)) sel.value = prev;
  }

  function refreshPreview() {
    const area = document.getElementById('bo5-preview-area');
    if (!area) return;
    const dictName = document.getElementById('bo5-dict-select').value;
    const dict = (loadDicts()[dictName]) || {};
    const rounds = collectCurrentSkills();

    if (!rounds.length) {
      area.innerHTML = '<span style="color:#585b70;font-size:11px;">（技設定が見つかりません）</span>';
      return;
    }
    area.innerHTML = rounds.map(({ round, value, skillName }) => {
      const serif  = dict[value];
      const has    = serif !== undefined && serif !== '';
      const preview = has
        ? esc(serif).substring(0, 55) + (serif.length > 55 ? '…' : '')
        : '（未設定）';
      return `<div class="bo5-preview-row">
        <span class="bo5-pv-round">R${round}</span>
        <span class="bo5-pv-skill">${esc(skillName)}<br><small style="color:#585b70;">${esc(value)}</small></span>
        <span class="bo5-pv-serif${has ? '' : ' missing'}">${preview}</span>
      </div>`;
    }).join('');
  }

  // =====================================================================
  // イベントバインド
  // =====================================================================
  function bindEvents() {
    // 折りたたみ
    let collapsed = false;
    document.getElementById('bo5-serif-toggle').addEventListener('click', () => {
      collapsed = !collapsed;
      document.getElementById('bo5-serif-body').style.display = collapsed ? 'none' : '';
      document.getElementById('bo5-serif-toggle').textContent = collapsed ? '▲' : '▼';
    });

    // ドラッグ移動
    const panel  = document.getElementById('bo5-serif-panel');
    const header = document.getElementById('bo5-serif-header');
    let drag = false, sx, sy, or, ob;
    header.addEventListener('mousedown', e => {
      if (e.target.tagName === 'BUTTON') return;
      drag = true; sx = e.clientX; sy = e.clientY;
      const r = panel.getBoundingClientRect();
      or = window.innerWidth  - r.right;
      ob = window.innerHeight - r.bottom;
    });
    document.addEventListener('mousemove', e => {
      if (!drag) return;
      panel.style.right  = (or - (e.clientX - sx)) + 'px';
      panel.style.bottom = (ob - (e.clientY - sy)) + 'px';
      panel.style.left = 'auto'; panel.style.top = 'auto';
    });
    document.addEventListener('mouseup', () => { drag = false; });

    // セレクト変更
    document.getElementById('bo5-dict-select').addEventListener('change', () => {
      refreshPreview();
      // エディタが開いていれば切り替え
      if (document.getElementById('bo5-serif-editor').style.display !== 'none') {
        openEditor(document.getElementById('bo5-dict-select').value);
      }
    });

    // ダブルクリックでエディタ
    document.getElementById('bo5-dict-select').addEventListener('dblclick', () => {
      const name = document.getElementById('bo5-dict-select').value;
      if (name) openEditor(name);
    });

    // 新規
    document.getElementById('bo5-dict-new').addEventListener('click', () => {
      const name = prompt('新しい辞書の名前：\n（例: グラディウス攻め・サイ用 など）');
      if (!name?.trim()) return;
      const dicts = loadDicts();
      if (dicts[name.trim()]) { showMsg('同名の辞書が既にあります', true); return; }
      dicts[name.trim()] = {};
      saveDicts(dicts);
      refreshDictSelect(name.trim());
      document.getElementById('bo5-dict-select').value = name.trim();
      refreshPreview();
      showMsg(`辞書「${name.trim()}」を作成しました`);
      openEditor(name.trim());
    });

    // リネーム
    document.getElementById('bo5-dict-rename').addEventListener('click', () => {
      const old = document.getElementById('bo5-dict-select').value;
      if (!old) return;
      const newName = prompt(`辞書「${old}」の新しい名前：`, old);
      if (!newName?.trim() || newName.trim() === old) return;
      const dicts = loadDicts();
      if (dicts[newName.trim()]) { showMsg('同名の辞書が既にあります', true); return; }
      dicts[newName.trim()] = dicts[old];
      delete dicts[old];
      saveDicts(dicts);
      refreshDictSelect(newName.trim());
      document.getElementById('bo5-dict-select').value = newName.trim();
      if (editorDictName === old) openEditor(newName.trim());
      showMsg(`「${old}」→「${newName.trim()}」に変更しました`);
    });

    // 削除
    document.getElementById('bo5-dict-delete').addEventListener('click', () => {
      const name = document.getElementById('bo5-dict-select').value;
      if (!name) return;
      if (!confirm(`辞書「${name}」を削除しますか？`)) return;
      const dicts = loadDicts();
      delete dicts[name];
      saveDicts(dicts);
      if (editorDictName === name) {
        document.getElementById('bo5-serif-editor').style.display = 'none';
        editorDictName = null;
      }
      refreshDictSelect('');
      refreshPreview();
      showMsg(`辞書「${name}」を削除しました`);
    });

    // ▶ 流し込む
    document.getElementById('bo5-btn-apply').addEventListener('click', () => {
      const name = document.getElementById('bo5-dict-select').value;
      if (!name) { showMsg('辞書が選択されていません', true); return; }
      const { applied, missing } = applyDictToRounds(name);
      showMsg(missing.length
        ? `${applied}件流し込み完了。辞書未登録: ${missing.join('、')}`
        : `全${applied}ラウンドへの流し込み完了！`);
      refreshPreview();
    });

    // ↑ 現在のセリフを読み込む
    document.getElementById('bo5-btn-read').addEventListener('click', () => {
      const name = document.getElementById('bo5-dict-select').value;
      if (!name) { showMsg('先に辞書を選択または作成してください', true); return; }
      const count = readCurrentSerifIntoDict(name);
      showMsg(`${count}件を辞書「${name}」に読み込みました`);
      refreshPreview();
      // エディタが開いていれば内容を再描画して即反映
      if (document.getElementById('bo5-serif-editor').style.display !== 'none'
          && editorDictName === name) {
        renderEditorRows(name);
      }
    });

    // ✎ エディタを開く
    document.getElementById('bo5-btn-edit').addEventListener('click', () => {
      const name = document.getElementById('bo5-dict-select').value;
      if (!name) { showMsg('辞書が選択されていません', true); return; }
      const editor = document.getElementById('bo5-serif-editor');
      if (editor.style.display !== 'none' && editorDictName === name) {
        editor.style.display = 'none'; // トグル：もう一度押したら閉じる
      } else {
        openEditor(name);
      }
    });

    // エディタ：行追加
    document.getElementById('bo5-editor-add-row').addEventListener('click', () => {
      if (!editorDictName) return;
      const key = prompt('追加するキー名を入力してください\n（例: gladius_01, dagger_02 など）');
      if (!key?.trim()) return;
      const dicts = loadDicts();
      if (!dicts[editorDictName]) dicts[editorDictName] = {};
      if (!(key.trim() in dicts[editorDictName])) {
        dicts[editorDictName][key.trim()] = '';
        saveDicts(dicts);
      }
      renderEditorRows(editorDictName);
    });

    // エディタ：保存
    // localStorageの最新値を読み込んでからtextareaの値でマージ保存する
    document.getElementById('bo5-editor-save').addEventListener('click', () => {
      saveEditor();
    });

    // エディタ：閉じる
    document.getElementById('bo5-editor-close').addEventListener('click', () => {
      document.getElementById('bo5-serif-editor').style.display = 'none';
    });

    // ⬇ Export
    document.getElementById('bo5-btn-export').addEventListener('click', () => {
      const name = document.getElementById('bo5-dict-select').value;
      if (!name) { showMsg('辞書が選択されていません', true); return; }
      const dicts = loadDicts();
      const blob = new Blob(
        [JSON.stringify({ [name]: dicts[name] || {} }, null, 2)],
        { type: 'application/json' }
      );
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `bo5_serif_${name.replace(/[^\w\u3000-\u9fff]/g, '_')}.json`;
      a.click();
      showMsg(`「${name}」をエクスポートしました`);
    });

    // ⬆ Import
    document.getElementById('bo5-btn-import-trigger').addEventListener('click', () => {
      document.getElementById('bo5-btn-import').click();
    });
    document.getElementById('bo5-btn-import').addEventListener('change', function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const imported = JSON.parse(e.target.result);
          if (typeof imported !== 'object' || Array.isArray(imported)) throw new Error('形式が不正です');
          const dicts = loadDicts();
          let count = 0;
          for (const [name, dict] of Object.entries(imported)) {
            if (typeof dict !== 'object' || Array.isArray(dict)) continue;
            if (dicts[name]) {
              // 既存辞書へのマージ or 上書きを選択
              const choice = confirm(
                `辞書「${name}」は既に存在します。\n\n` +
                `OK → 既存辞書にマージ（同キーは上書き）\n` +
                `キャンセル → スキップ`
              );
              if (!choice) continue;
              Object.assign(dicts[name], dict);
            } else {
              dicts[name] = dict;
            }
            count++;
          }
          saveDicts(dicts);
          const currentName = document.getElementById('bo5-dict-select').value;
          refreshDictSelect(currentName);
          refreshPreview();
          if (editorDictName && document.getElementById('bo5-serif-editor').style.display !== 'none') {
            renderEditorRows(editorDictName);
          }
          showMsg(`${count}件の辞書をインポートしました`);
        } catch (err) {
          showMsg('JSONの解析に失敗しました: ' + err.message, true);
        }
        this.value = '';
      };
      reader.readAsText(file);
    });

    // 🎮 公式JSONから辞書を生成
    document.getElementById('bo5-btn-import-official-trigger').addEventListener('click', () => {
      document.getElementById('bo5-btn-import-official').click();
    });
    document.getElementById('bo5-btn-import-official').addEventListener('change', function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const obj = JSON.parse(e.target.result);

          // 公式JSONかどうか判定
          if (!isOfficialJson(obj)) {
            showMsg('公式形式のJSONではありません（skill_r1/skill_serif_r1 が見つかりません）', true);
            return;
          }

          const { entries, suggestedName, count } = convertOfficialJson(obj);

          if (count === 0) {
            showMsg('変換できる技セリフが見つかりませんでした', true);
            return;
          }

          // 辞書名を確認・編集させる
          const dictName = prompt(
            `公式JSONから ${count} 件の技セリフを読み取りました。
` +
            `登録する辞書名を入力してください：`,
            suggestedName
          );
          if (!dictName?.trim()) return;

          const dicts = loadDicts();
          if (dicts[dictName.trim()]) {
            const choice = confirm(
              `辞書「${dictName.trim()}」は既に存在します。

` +
              `OK → マージ（同キーは上書き）
` +
              `キャンセル → スキップ`
            );
            if (!choice) return;
            Object.assign(dicts[dictName.trim()], entries);
          } else {
            dicts[dictName.trim()] = entries;
          }
          saveDicts(dicts);
          refreshDictSelect(dictName.trim());
          document.getElementById('bo5-dict-select').value = dictName.trim();
          refreshPreview();
          if (editorDictName && document.getElementById('bo5-serif-editor').style.display !== 'none') {
            renderEditorRows(editorDictName);
          }
          // 同一技キーで異なるセリフが複数ラウンドにある場合は警告
          if (duplicates.length > 0) {
            const warn = duplicates.map(d => {
              const lines = d.rounds.map(rr => `R${rr.r}: ${rr.serif.substring(0, 20)}…`).join('\n  ');
              return `【${d.skillValue}】\n  ${lines}`;
            }).join('\n');
            alert(
              `⚠ 以下の技は複数ラウンドで異なるセリフが設定されていました。\n` +
              `最後のラウンドのセリフを辞書に登録しています。\n` +
              `必要に応じてエディタで修正してください。\n\n${warn}`
            );
          }
          showMsg(`辞書「${dictName.trim()}」に ${count} 件登録しました`);

        } catch (err) {
          showMsg('JSONの解析に失敗しました: ' + err.message, true);
        }
        this.value = '';
      };
      reader.readAsText(file);
    });

    // ラジオ変更時にプレビュー更新
    document.addEventListener('change', e => {
      if (e.target.matches('input[type="radio"][name^="skill_r"]')) {
        setTimeout(() => {
          refreshPreview();
          if (document.getElementById('bo5-serif-editor').style.display !== 'none' && editorDictName) {
            renderEditorRows(editorDictName);
          }
        }, 120);
      }
    });
  }

  // =====================================================================
  // スタイル
  // =====================================================================
  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      #bo5-serif-panel {
        position:fixed;bottom:20px;right:20px;width:330px;
        background:#1e1e2e;color:#cdd6f4;
        border:1px solid #45475a;border-radius:10px;
        box-shadow:0 4px 24px rgba(0,0,0,.6);
        z-index:99999;font-size:13px;font-family:sans-serif;
      }
      #bo5-serif-header {
        background:#313244;padding:8px 12px;
        border-radius:10px 10px 0 0;
        display:flex;justify-content:space-between;align-items:center;
        font-weight:bold;cursor:default;user-select:none;
      }
      #bo5-serif-header button {
        background:none;border:none;color:#cdd6f4;cursor:pointer;font-size:14px;padding:0 4px;
      }
      #bo5-serif-body { padding:10px 12px 12px; }
      .bo5-section { margin-bottom:8px; }
      .bo5-section > label {
        display:block;font-size:11px;color:#a6adc8;margin-bottom:3px;
      }
      #bo5-dict-select {
        background:#313244;color:#cdd6f4;
        border:1px solid #45475a;border-radius:5px;padding:4px 6px;
      }
      #bo5-serif-panel button {
        background:#313244;color:#cdd6f4;
        border:1px solid #45475a;border-radius:5px;
        padding:5px 8px;cursor:pointer;font-size:12px;
        transition:background .15s;
      }
      #bo5-serif-panel button:hover { background:#45475a; }
      .bo5-btn-primary {
        background:#4c6ef5!important;color:#fff!important;
        border-color:#4c6ef5!important;font-weight:bold;
      }
      .bo5-btn-primary:hover { background:#3b5bdb!important; }
      .bo5-preview {
        background:#181825;border:1px solid #313244;
        border-radius:6px;padding:6px 8px;
        font-size:11px;max-height:160px;overflow-y:auto;
      }
      .bo5-preview-row {
        display:flex;gap:6px;padding:3px 0;
        border-bottom:1px solid #313244;align-items:flex-start;
      }
      .bo5-preview-row:last-child { border-bottom:none; }
      .bo5-pv-round  { color:#89b4fa;min-width:22px;font-weight:bold; }
      .bo5-pv-skill  { color:#a6e3a1;min-width:72px; }
      .bo5-pv-serif  { color:#cdd6f4;word-break:break-all;flex:1; }
      .bo5-pv-serif.missing { color:#f38ba8;font-style:italic; }
      #bo5-serif-editor {
        background:#181825;border:1px solid #313244;
        border-radius:6px;padding:8px;margin-top:2px;
      }
      .bo5-editor-row { margin-bottom:7px; }
      .bo5-editor-row label {
        color:#a6e3a1;font-size:11px;display:block;margin-bottom:2px;
      }
      .bo5-editor-row textarea {
        width:100%;box-sizing:border-box;
        background:#1e1e2e;color:#cdd6f4;
        border:1px solid #45475a;border-radius:4px;
        padding:4px;font-size:11px;resize:vertical;min-height:42px;
      }
      .bo5-editor-del-row {
        font-size:10px!important;padding:2px 6px!important;
        color:#f38ba8!important;margin-top:2px;
      }
      #bo5-msg { font-size:11px;min-height:16px; }
    `;
    document.head.appendChild(s);
  }

  // =====================================================================
  // ユーティリティ
  // =====================================================================
  function showMsg(text, isError = false) {
    const el = document.getElementById('bo5-msg');
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? '#f38ba8' : '#a6e3a1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.textContent = ''; }, 5000);
  }
  function esc(v) {
    return String(v ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // =====================================================================
  // 起動
  // =====================================================================
  function init() {
    if (!location.pathname.endsWith('setup.php')) return;
    if (!document.querySelector('.skillset')) return;
    buildUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

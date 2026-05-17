// ==UserScript==
// @name         BO5戦闘設定保存ツール
// @namespace    https://wdrb.work/bo5/
// @version      1.0.0
// @description  戦闘設定をエクスポート／インポートする補助ツール
// @author       ayautaginrei
// @match        *://wdrb.work/bo5/setup.php*
// @match        *://wdrb.work/bo5_supertest/setup.php*
// @updateURL    https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/BO5/BO5%E6%88%A6%E9%97%98%E8%A8%AD%E5%AE%9A%E4%BF%9D%E5%AD%98%E3%83%84%E3%83%BC%E3%83%AB.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function buildSlugMapFromDOM() {
        const map = {};
        document.querySelectorAll('ul.battle_weapon li[data-weapon][data-tippy-content]').forEach(li => {
            const name = li.dataset.tippyContent;
            const slug = li.dataset.weapon;
            if (name && slug) map[name] = slug;
        });
        return map;
    }

    function resolveSlug(rawId) {
        if (isNaN(Number(rawId))) return rawId;
        const name = OLD_ID_TO_NAME[String(rawId)];
        if (!name) return null;
        return buildSlugMapFromDOM()[name] || null;
    }

    function getWeaponDisplayName(rawId) {
        if (!isNaN(Number(rawId))) return OLD_ID_TO_NAME[String(rawId)] || rawId;
        const li = document.querySelector(`ul.battle_weapon li[data-weapon="${rawId}"]`);
        return li ? li.dataset.tippyContent : rawId;
    }

    /* ===================================================
       エクスポート対象フィールド定義
       =================================================== */
    const TEXT_FIELDS = [
        'btst_name',
        'w_name',
        'skill_r1_name', 'skill_r2_name', 'skill_r3_name', 'skill_r4_name', 'skill_r5_name',
        'skill_serif_r1', 'skill_serif_r2', 'skill_serif_r3', 'skill_serif_r4', 'skill_serif_r5',
        'serif_entry', 'serif_start', 'serif_end',
        'round_serif_adv', 'round_serif_dis', 'round_serif_com',
        'serif_win', 'serif_lose', 'serif_drow',
        'image_com', 'image_adv', 'image_dis'
    ];
    const SELECT_FIELDS = ['bt_type', 'color'];

    /* ===================================================
       エクスポート処理
       =================================================== */
    function exportSettings() {
        const form = document.querySelector('form[action="setup.php"]');
        if (!form) { alert('設定フォームが見つかりません。'); return; }

        const data = { version: '1.3', exportedAt: new Date().toISOString() };

        // テキスト・テキストエリアフィールド
        for (const name of TEXT_FIELDS) {
            const el = form.querySelector(`[name="${name}"]`);
            data[name] = el ? el.value : '';
        }

        // セレクトフィールド
        for (const name of SELECT_FIELDS) {
            const el = form.querySelector(`select[name="${name}"]`);
            data[name] = el ? el.value : '';
        }

        // 技選択（skill_r1〜skill_r5）
        for (let r = 1; r <= 5; r++) {
            const radio = form.querySelector(`input[name="skill_r${r}"]:checked`);
            data[`skill_r${r}`] = radio ? radio.value : '';
        }

        // 武器ID（スラッグで保存）
        const weaponRadio = form.querySelector('input[name="w_id"]:checked');
        if (weaponRadio) {
            const rawId = weaponRadio.value;
            data.w_id_slug = resolveSlug(rawId) || rawId;
            data.w_id_name = getWeaponDisplayName(rawId);
        }

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `BO5_${(data.btst_name || 'battlestyle').replace(/[\\/:*?"<>|]/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);

        showNotice(`「${data.btst_name || '(無名)'}」をエクスポートしました`, 'blue');
    }

    /* ===================================================
       インポート処理
       =================================================== */

    function selectRadio(radio) {
        if (!radio.checked) radio.click();
    }

    function importSettings(data) {
        const form = document.querySelector('form[action="setup.php"]');
        if (!form) { alert('設定フォームが見つかりません。'); return; }

        const warnings = [];

        // テキスト・テキストエリアフィールド
        for (const name of TEXT_FIELDS) {
            if (data[name] === undefined) continue;
            const el = form.querySelector(`[name="${name}"]`);
            if (el) {
                el.value = data[name];
                el.dispatchEvent(new Event('input',  { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        // セレクトフィールド
        for (const name of SELECT_FIELDS) {
            if (data[name] === undefined) continue;
            const el = form.querySelector(`select[name="${name}"]`);
            if (el) {
                el.value = data[name];
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        // 武器ID選択
        const rawWeapon = data.w_id_slug || data.w_id_raw;
        if (rawWeapon) {
            const targetSlug = resolveSlug(rawWeapon) || rawWeapon;
            const radio = form.querySelector(`input[name="w_id"][value="${targetSlug}"]`);
            if (radio) {
                selectRadio(radio);
            } else {
                warnings.push(`武器「${data.w_id_name || targetSlug}」は現在の要素に存在しません。手動で設定してください。`);
            }
        }

        // 技選択（skill_r1〜skill_r5）
        for (let r = 1; r <= 5; r++) {
            const val = data[`skill_r${r}`];
            if (!val) continue;
            const radio = form.querySelector(`input[name="skill_r${r}"][value="${val}"]`);
            if (radio) selectRadio(radio);
        }

        let msg = `「${data.btst_name || '(無名)'}」をインポートしました`;
        if (warnings.length > 0) {
            msg += '\n\n⚠ 注意:\n' + warnings.join('\n');
            showNotice(msg, 'yellow');
        } else {
            showNotice(msg, 'blue');
        }
    }

    /* ===================================================
       通知表示
       =================================================== */
    function showNotice(msg, color = 'blue') {
        const area = document.querySelector('div.noticearea');
        if (area) {
            const div = document.createElement('div');
            div.className = 'notice';
            div.innerHTML = `<p class="err"><span class="${color}">${msg.replace(/\n/g, '<br>')}</span></p>`;
            area.appendChild(div);
            setTimeout(() => div.remove(), 5000);
        } else {
            alert(msg);
        }
    }

    /* ===================================================
       UI構築
       =================================================== */
    function buildUI() {
        const sortLink = document.querySelector('.sort_link');
        if (!sortLink) return;

        const style = document.createElement('style');
        style.textContent = `
            #bs-transfer-panel {
                display: inline-flex;
                gap: 6px;
                align-items: center;
                margin-left: 1em;
                vertical-align: middle;
            }
            .bs-btn {
                display: inline-block;
                padding: 4px 10px;
                border: 1px solid #aaa;
                border-radius: 4px;
                background: #2a2a2a;
                color: #efefef;
                cursor: pointer;
                font-size: 0.85em;
                text-decoration: none;
                transition: background 0.15s;
                user-select: none;
            }
            .bs-btn:hover { background: #444; }
            .bs-btn.export { border-color: #5af; color: #5af; }
            .bs-btn.import { border-color: #8f8; color: #8f8; }
            #bs-file-input { display: none; }
        `;
        document.head.appendChild(style);

        const panel = document.createElement('span');
        panel.id = 'bs-transfer-panel';

        const expBtn = document.createElement('a');
        expBtn.href = '#';
        expBtn.className = 'bs-btn export';
        expBtn.textContent = '📤 設定エクスポート';
        expBtn.title = '現在の戦闘設定をJSONファイルに保存します';
        expBtn.addEventListener('click', e => { e.preventDefault(); exportSettings(); });

        const impBtn = document.createElement('a');
        impBtn.href = '#';
        impBtn.className = 'bs-btn import';
        impBtn.textContent = '📥 設定インポート';
        impBtn.title = 'JSONファイルから戦闘設定を読み込みます';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'bs-file-input';
        fileInput.accept = '.json,application/json';
        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (!data.version) throw new Error('BO5エクスポートファイルではありません');
                    importSettings(data);
                } catch (err) {
                    alert('JSONの読み込みに失敗しました:\n' + err.message);
                }
                fileInput.value = '';
            };
            reader.readAsText(file, 'utf-8');
        });

        impBtn.addEventListener('click', e => { e.preventDefault(); fileInput.click(); });

        panel.appendChild(expBtn);
        panel.appendChild(impBtn);
        panel.appendChild(fileInput);
        sortLink.appendChild(panel);
    }

    /* ===================================================
       エントリポイント
       =================================================== */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildUI);
    } else {
        buildUI();
    }

})();

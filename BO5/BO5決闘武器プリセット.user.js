// ==UserScript==
// @name         BO5決闘武器プリセット
// @namespace    https://wdrb.work/bo5/
// @version      1.0.0
// @description  武器選択をプリセット保存・呼び出しできるようにする
// @author       ayautaginrei
// @match        https://wdrb.work/bo5/battle_lobby.php*
// @updateURL    
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'bo5_weapon_presets_v1';
    const MAX_PRESETS = 10;

    function loadPresets() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
        catch { return {}; }
    }

    function savePresets(p) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    }

    function readMaxAllowed() {
        for (const li of document.querySelectorAll('details ul.regulation > li')) {
            if (li.textContent.includes('武器使用可能数')) {
                const n = parseInt(li.querySelector('b')?.textContent ?? '', 10);
                if (n > 0) return n;
            }
        }
        return 3;
    }

    function getChecked(wl) {
        return [...wl.querySelectorAll('input[name="w_id[]"]:checked')].map(c => c.value);
    }

    function syncConfirm(wl) {
        const cl = wl.closest('.equip')?.querySelector('ul.battle_weapon.confirm');
        if (!cl) return;
        cl.innerHTML = '';
        wl.querySelectorAll('input[name="w_id[]"]:checked').forEach(cb => {
            const clone = cb.closest('li').cloneNode(true);
            clone.querySelector('input')?.remove();
            cl.appendChild(clone);
        });
    }

    function applyPreset(wl, weapons, max) {
        wl.querySelectorAll('input[name="w_id[]"]').forEach(c => { c.checked = false; });
        let n = 0;
        for (const id of weapons) {
            if (n >= max) break;
            const cb = wl.querySelector(`input[name="w_id[]"][value="${CSS.escape(id)}"]`);
            if (cb) { cb.checked = true; n++; }
        }
        syncConfirm(wl);
    }

    function esc(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function injectStyle() {
        if (document.getElementById('bo5ps-style')) return;
        const s = document.createElement('style');
        s.id = 'bo5ps-style';
        s.textContent = `
            .bo5ps-panel {
                margin: 0.5em 0 0.8em;
                padding: 0.6em 0.75em 0.75em;
                background: rgba(0,0,0,0.35);
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 4px;
                font-size: 0.85em;
                color: #fff;
            }
            .bo5ps-head {
                display: flex;
                align-items: center;
                gap: 0.5em;
                margin-bottom: 0.55em;
                font-size: 0.88em;
                letter-spacing: 0.08em;
                color: rgba(255,255,255,0.5);
                text-transform: uppercase;
            }
            .bo5ps-head::before {
                content: '';
                display: inline-block;
                width: 3px;
                height: 1em;
                background: currentColor;
                border-radius: 2px;
            }
            .bo5ps-maxinfo {
                margin-bottom: 0.5em;
                font-size: 0.8em;
                color: rgba(255,255,255,0.45);
            }
            .bo5ps-row {
                display: flex;
                flex-wrap: wrap;
                gap: 0.35em;
                align-items: center;
                margin-bottom: 0.5em;
            }
            .bo5ps-input {
                appearance: none;
                background: rgba(255,255,255,0.88);
                border: 1px solid rgba(255,255,255,0.22);
                border-radius: 3px;
                color: #111;
                font-size: 0.9em;
                padding: 0.25em 0.55em;
                width: 9em;
                outline: none;
            }
            .bo5ps-input::placeholder { color: rgba(0,0,0,0.35); }
            .bo5ps-input:focus { border-color: rgba(255,255,255,0.7); background: #fff; }
            .bo5ps-btn {
                appearance: none;
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.22);
                border-radius: 3px;
                color: rgba(255,255,255,0.8);
                cursor: pointer;
                font-size: 0.85em;
                padding: 0.25em 0.7em;
                white-space: nowrap;
                transition: background 0.15s, border-color 0.15s;
            }
            .bo5ps-btn:hover { background: rgba(255,255,255,0.18); border-color: rgba(255,255,255,0.4); }
            .bo5ps-btn.reset {
                background: rgba(180,60,60,0.25);
                border-color: rgba(200,80,80,0.4);
                color: rgba(255,160,160,0.9);
            }
            .bo5ps-btn.reset:hover { background: rgba(180,60,60,0.4); }
            .bo5ps-list {
                display: flex;
                flex-wrap: wrap;
                gap: 0.3em;
            }
            .bo5ps-list:empty::after {
                content: '保存済みプリセットはありません';
                color: rgba(255,255,255,0.3);
                font-size: 0.82em;
            }
            .bo5ps-item {
                display: inline-flex;
                align-items: center;
                gap: 0;
                border: 1px solid rgba(255,255,255,0.18);
                border-radius: 3px;
                overflow: hidden;
                font-size: 0.85em;
                background: rgba(255,255,255,0.05);
            }
            .bo5ps-item-name {
                padding: 0.2em 0.55em;
                cursor: pointer;
                color: rgba(255,255,255,0.85);
                transition: background 0.12s;
            }
            .bo5ps-item-name:hover { background: rgba(255,255,255,0.12); color: #fff; }
            .bo5ps-item-del {
                padding: 0.2em 0.45em;
                cursor: pointer;
                color: rgba(255,120,120,0.7);
                border-left: 1px solid rgba(255,255,255,0.1);
                font-size: 0.9em;
                transition: background 0.12s, color 0.12s;
                user-select: none;
                line-height: 1;
            }
            .bo5ps-item-del:hover { background: rgba(180,50,50,0.35); color: #f99; }
        `;
        document.head.appendChild(s);
    }

    function buildPanel(wl) {
        if (wl.previousElementSibling?.classList.contains('bo5ps-panel')) return;

        const max = readMaxAllowed();

        const panel = document.createElement('div');
        panel.className = 'bo5ps-panel';
        panel.innerHTML = `
            <div class="bo5ps-head">Weapon Preset</div>
            <div class="bo5ps-maxinfo">使用可能数：最大 <b>${max}</b> つ</div>
            <div class="bo5ps-row">
                <input class="bo5ps-input" type="text" placeholder="プリセット名" maxlength="30">
                <button class="bo5ps-btn save" type="button">保存</button>
                <button class="bo5ps-btn reset" type="button">選択リセット</button>
            </div>
            <div class="bo5ps-list"></div>
        `;
        wl.insertAdjacentElement('beforebegin', panel);

        const input = panel.querySelector('.bo5ps-input');
        const saveBtn = panel.querySelector('.save');
        const resetBtn = panel.querySelector('.reset');
        const listEl = panel.querySelector('.bo5ps-list');

        function render() {
            const presets = loadPresets();
            listEl.innerHTML = '';
            for (const [name, weapons] of Object.entries(presets)) {
                const preview = weapons.map(id => {
                    const li = wl.querySelector(`li[data-weapon="${CSS.escape(id)}"]`);
                    return li?.getAttribute('data-tippy-content') ?? id;
                }).join('・');

                const item = document.createElement('div');
                item.className = 'bo5ps-item';
                item.title = preview;
                item.innerHTML = `<span class="bo5ps-item-name">${esc(name)}</span><span class="bo5ps-item-del">✕</span>`;

                item.querySelector('.bo5ps-item-name').addEventListener('click', () => {
                    applyPreset(wl, weapons, max);
                });
                item.querySelector('.bo5ps-item-del').addEventListener('click', () => {
                    if (!confirm(`「${name}」を削除しますか？`)) return;
                    const p = loadPresets();
                    delete p[name];
                    savePresets(p);
                    render();
                });
                listEl.appendChild(item);
            }
        }

        saveBtn.addEventListener('click', () => {
            const name = input.value.trim();
            if (!name) { alert('プリセット名を入力してください'); input.focus(); return; }
            const checked = getChecked(wl);
            if (!checked.length) { alert('武器が選択されていません'); return; }
            const p = loadPresets();
            if (!p[name] && Object.keys(p).length >= MAX_PRESETS) { alert(`最大 ${MAX_PRESETS} 件まで保存できます`); return; }
            p[name] = checked;
            savePresets(p);
            input.value = '';
            render();
        });

        resetBtn.addEventListener('click', () => {
            wl.querySelectorAll('input[name="w_id[]"]').forEach(c => { c.checked = false; });
            syncConfirm(wl);
        });

        render();
    }

    function init() {
        injectStyle();
        document.querySelectorAll('ul.battle_weapon:not(.confirm)').forEach(buildPanel);
    }

    if (typeof $ !== 'undefined') {
        $(document).ready(init);
    } else {
        document.readyState === 'loading'
            ? document.addEventListener('DOMContentLoaded', init)
            : init();
    }

})();

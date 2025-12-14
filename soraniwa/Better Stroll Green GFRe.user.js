// ==UserScript==
// @name         Better Stroll Green GFRe
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Stroll GreenのUIを改善します。
// @author       ayautaginrei(Gemini)
// @match        https://soraniwa.428.st/gf/*
// @updateURL    https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/soraniwa/Better%20Stroll%20Green%20GFRe.user.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'useSTRICT';

    // === 公式一括選択のUX改善 ===

    // 一括選択モードかどうかのフラグ
    let isBulkSelectionMode = false;

    const originalConfirm = window.confirm;
    window.confirm = function(message) {
        if (message === "グループ化されたすべてのアイテムを選択しますか？") {
            if (isBulkSelectionMode) {
                const toast = document.createElement('div');
                toast.textContent = "グループを一括選択しました";
                toast.style.cssText = "position: fixed; bottom: 80px; right: 20px; background: rgba(0,0,0,0.7); color: #fff; padding: 8px 16px; border-radius: 4px; z-index: 99999; pointer-events: none; transition: opacity 0.5s; font-size: 12px;";
                document.body.appendChild(toast);

                setTimeout(() => {
                    toast.style.opacity = '0';
                    setTimeout(() => toast.remove(), 500);
                }, 2000);


                isBulkSelectionMode = false;
                return true;
            } else {

                return false;
            }
        }
        return originalConfirm(message);
    };


    const style = document.createElement('style');
    style.textContent = `

        /* チェックボックスをクリック可能にし、カーソルを指にする */
        .itemcheck {
            pointer-events: auto !important;
            cursor: pointer !important;
        }
        .itemcheck:hover {
            opacity: 0.7;
        }
    `;
    document.head.appendChild(style);

    // === クリックイベントの制御 ===
    document.addEventListener('click', function(e) {

        const checkbox = e.target.closest('.itemcheck');
        if (checkbox) {

            e.preventDefault();
            e.stopPropagation();

            isBulkSelectionMode = true;

            const container = checkbox.closest('td') || checkbox.parentElement;
            const img = container ? container.querySelector('img.itemselect') : null;

            if (img) {
                img.click();
            } else {
                console.warn('Better Stroll Green: 対応する画像が見つかりませんでした');
            }
            return;
        }

        // 2. アイコン画像（.itemselect）がクリックされた場合
        if (e.target.matches('img.itemselect')) {
            if (e.isTrusted) {
                isBulkSelectionMode = false;
            } else {

            }
        }
    }, true);

    // === 共通ストレージキー ===
    const STORAGE_KEYS = {
        YUIN: 'yuuinCount',
        PREV_YUIN: 'prevYuuinCount',
        KIHI: 'kihiCount',
        PREV_KIHI: 'prevKihiCount',
        HIGHLIGHT_CONFIG: 'strollGreenStatHighlighterConfig_v1'
    };

    // === 誘引・忌避・花壇・折りたたみ機能 ===

    function extractCounts(table) {
        const counts = { yuuin: 0, kihi: 0 };
        table.querySelectorAll('tr.odd, tr.even').forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return;

            const name = cells[1].textContent;
            const count = parseInt(cells[2].textContent.match(/\d+/)) || 0;
            if (count > 0) {
                if (name.includes('誘引')) counts.yuuin += count;
                else if (name.includes('忌避')) counts.kihi += count;
            }
        });
        return counts;
    }

    function createOrUpdateLabel(parent, id, label, tooltip, value, insertAfter, addBrAfter = true) {
        let elem = parent.querySelector(`#${id}`);
        if (!elem) {
            elem = document.createElement('div');
            elem.id = id;
            elem.className = 'labelb';
            elem.innerHTML = `
                <div class="labelbleft" data-ctip="${tooltip}">${label}</div>
                <div class="labelbright labelbrightcell2">${value}</div>
            `;

            if (insertAfter && insertAfter.nextElementSibling?.tagName === 'BR') {
                insertAfter.nextElementSibling.remove();
            }

            if (insertAfter) {
                parent.insertBefore(elem, insertAfter.nextElementSibling);
                if (addBrAfter) {
                    parent.insertBefore(document.createElement('br'), elem.nextElementSibling);
                }
            } else {
                parent.appendChild(elem);
                if (addBrAfter) {
                    parent.appendChild(document.createElement('br'));
                }
            }
        } else {
            const valueElem = elem.querySelector('.labelbright');
            if (valueElem.textContent !== value.toString()) {
                valueElem.textContent = value;
            }
        }
        return elem;
    }

    function updateDisplay(mapdesc) {
        const yuuin = localStorage.getItem(STORAGE_KEYS.YUIN) || '0';
        const kihi = localStorage.getItem(STORAGE_KEYS.KIHI) || '0';
        const condLabel = mapdesc.querySelector('.labelb .labelbleft[data-ctip*="移動力"]')?.closest('.labelb');
        if (!condLabel) return;

        const yuinElem = createOrUpdateLabel(mapdesc, 'custom-yuin-display', '誘引', '誘引の値です。', yuuin, condLabel, true);
        createOrUpdateLabel(mapdesc, 'custom-kihi-display', '忌避', '忌避の値です。', kihi, yuinElem, false);
    }

    function convertSelectToButtons(select) {
        select.style.display = 'none';
        select.dataset.buttonsAdded = 'true';

        const container = document.createElement('div');
        container.style.cssText = `display: flex; flex-wrap: nowrap; gap: 4px; margin-top: 2px; margin-bottom: 5px; max-width: 100%; overflow-x: auto; padding: 2px;`;

        const textMap = { '★育成促進': '育成促進', '★切り戻し': '切り戻す' };

        Array.from(select.options).forEach(option => {
            if (option.value === '0') return;

            const button = document.createElement('span');
            const baseText = option.text.substring(0, option.text.indexOf('(')).trim();
            button.textContent = textMap[baseText] || option.text;
            button.dataset.value = option.value;
            button.style.cssText = `padding: 3px 6px; border: 1px solid #a08060; border-radius: 5px; cursor: pointer; background-color: #fffff0; white-space: nowrap; font-size: 12px;`;

            button.addEventListener('click', () => {
                const isSelected = select.value === option.value;
                select.value = isSelected ? '0' : option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));

                container.querySelectorAll('span').forEach(btn => {
                    btn.style.backgroundColor = '#fffff0';
                    btn.style.fontWeight = 'normal';
                });

                if (!isSelected) {
                    button.style.backgroundColor = '#e0ecff';
                    button.style.fontWeight = 'bold';
                }
            });
            container.appendChild(button);
        });

        select.parentNode.insertBefore(container, select);

        const selectedButton = container.querySelector(`[data-value="${select.value}"]`);
        if (selectedButton) {
            selectedButton.style.backgroundColor = '#e0ecff';
            selectedButton.style.fontWeight = 'bold';
        }
    }

    function handleQueryButtonClick() {
        ['YUIN', 'KIHI'].forEach(type => {
            const currentVal = parseInt(localStorage.getItem(STORAGE_KEYS[type]) || '0');
            if (currentVal > 0) {
                localStorage.setItem(STORAGE_KEYS[`PREV_${type}`], currentVal.toString());
                localStorage.setItem(STORAGE_KEYS[type], (currentVal - 1).toString());
            }
        });
        document.querySelectorAll('.mapdesc').forEach(updateDisplay);
    }

    // === DOM変更処理統合 ===

    function processDOMChanges() {
        // アイテム設定画面用の処理
        if (window.location.href.includes('mode=item')) {
            const bagTable = document.getElementById('bag');
            if (bagTable) {
                setTimeout(() => {
                    const { yuuin, kihi } = extractCounts(bagTable);
                    localStorage.setItem(STORAGE_KEYS.YUIN, yuuin.toString());
                    localStorage.setItem(STORAGE_KEYS.KIHI, kihi.toString());
                }, 500);
            }
        }

        document.querySelectorAll('select[name^="kadanact"]:not([data-buttons-added])').forEach(convertSelectToButtons);
        document.querySelectorAll('.mapdesc').forEach(updateDisplay);

        document.querySelectorAll('.queryButton:not([data-listener-added])').forEach(button => {
            if (button.id === 'batchSelectMode') return;
            button.dataset.listenerAdded = 'true';
            button.addEventListener('click', handleQueryButtonClick);
        });
    }

    function addToggle(header, index) {
        if (header.dataset.collapsibleAdded) return;
        header.dataset.collapsibleAdded = 'true';

        header.innerHTML = `<span class="toggle-icon" style="user-select: none;">▼</span> ${header.textContent.replace(/^[▼▲]\s*/, '')}`;
        header.style.cursor = 'pointer';

        let content = header.nextElementSibling;
        while (content && content.tagName !== 'P') content = content.nextElementSibling;
        if (!content) return;

        content.style.cssText = 'max-height: 0px; overflow: hidden; opacity: 0; transition: all 0.3s ease-out;';
        const storageKey = `area_state_${index}`;

        header.addEventListener('click', (e) => {
            e.preventDefault();
            const isHidden = content.style.maxHeight === '0px';
            content.style.maxHeight = isHidden ? `${content.scrollHeight}px` : '0px';
            content.style.opacity = isHidden ? '1' : '0';
            header.querySelector('.toggle-icon').textContent = isHidden ? '▲' : '▼';
            localStorage.setItem(storageKey, isHidden ? 'open' : 'closed');
        });

        if (localStorage.getItem(storageKey) === 'open') {
            content.style.maxHeight = `${content.scrollHeight}px`;
            content.style.opacity = '1';
            header.querySelector('.toggle-icon').textContent = '▲';
        }
    }

    function initCollapsibleAreas() {
        const modal = document.querySelector('#modal6');
        if (!modal) return;

        const applyToggles = () => {
             modal.querySelectorAll('h4').forEach((header, index) => {
                if (header.textContent.startsWith('エリア')) {
                    addToggle(header, index);
                }
            });
        };

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if ((mutation.type === 'attributes' && mutation.attributeName === 'style' && modal.style.display !== 'none') || mutation.type === 'childList') {
                    applyToggles();
                    return;
                }
            }
        });

        observer.observe(modal, { attributes: true, childList: true, subtree: true });

        if (modal.style.display !== 'none') {
            applyToggles();
        }
    }


    // === ステータスハイライト機能 ===

    const DEFAULT_HIGHLIGHT_SETTINGS = [
        { threshold: 900, color: '#FF6B6B', enabled: true },
        { threshold: 700, color: '#6BFF8A', enabled: true },
        { threshold: 0, color: '#6B8AFF', enabled: true }
    ];
    const HIGHLIGHT_OPACITY = 0.3; // 30%

    function hexToRgba(hex, alpha) {
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex.split('').map(char => char + char).join('');
        }
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(255, 255, 255, ${alpha})`;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function loadHighlightSettings() {
        const stored = localStorage.getItem(STORAGE_KEYS.HIGHLIGHT_CONFIG);
        let settings = DEFAULT_HIGHLIGHT_SETTINGS;
        if (stored) {
            try { settings = JSON.parse(stored); } catch (e) { settings = DEFAULT_HIGHLIGHT_SETTINGS; }
        }
        const finalSettings = [];
        for (let i = 0; i < 3; i++) {
            finalSettings.push(settings[i] || { threshold: 0, color: '#FFFFFF', enabled: false });
        }
        return finalSettings.slice(0, 3);
    }

    function saveHighlightSettings(settings) {
        localStorage.setItem(STORAGE_KEYS.HIGHLIGHT_CONFIG, JSON.stringify(settings));
    }

    function applyHighlightColors() {
        const settings = loadHighlightSettings();
        const sortedSettings = settings
            .filter(s => s.enabled)
            .sort((a, b) => (b.threshold || 0) - (a.threshold || 0));

        document.querySelectorAll('.charaframe, .charaframe2, .charaframeself').forEach(el => {
            const total = (Number(el.dataset.str) || 0) +
                          (Number(el.dataset.agi) || 0) +
                          (Number(el.dataset.dex) || 0) +
                          (Number(el.dataset.mag) || 0) +
                          (Number(el.dataset.vit) || 0) +
                          (Number(el.dataset.mnt) || 0);

            let applied = false;
            for (const setting of sortedSettings) {
                if (total >= setting.threshold) {
                    el.style.backgroundColor = hexToRgba(setting.color, HIGHLIGHT_OPACITY);
                    applied = true;
                    break;
                }
            }
            if (!applied) {
                el.style.backgroundColor = '';
            }
        });
    }

    function openHighlightModal() {
        const settings = loadHighlightSettings();
        const container = document.getElementById('settingsContainer');
        container.innerHTML = '';

        settings.forEach((setting, index) => {
            const rowHtml = `
                <div class="setting-row" style="margin-bottom: 10px; display: flex; align-items: center; padding: 5px; border: 1px solid #ddd; background: #fff;">
                    <input type="checkbox" class="setting-enabled" ${setting.enabled ? 'checked' : ''} style="margin-right: 10px; transform: scale(1.2);" id="setting_enabled_${index}">
                    <label for="setting_enabled_${index}" style="margin-right: 10px; font-weight: bold; min-width: 60px;">設定 ${index + 1}:</label>
                    <label for="setting_threshold_${index}" style="margin-right: 5px;">閾値:</label>
                    <input type="number" class="setting-threshold" id="setting_threshold_${index}" value="${setting.threshold}" style="width: 80px; margin-right: 10px; padding: 5px;">
                    <label for="setting_color_${index}" style="margin-right: 5px;">色:</label>
                    <input type="color" class="setting-color" id="setting_color_${index}" value="${setting.color}" style="cursor: pointer;">
                </div>
            `;
            container.insertAdjacentHTML('beforeend', rowHtml);
        });
        document.getElementById('statHighlighterModal').style.display = 'block';
    }

    function closeHighlightModal() {
        document.getElementById('statHighlighterModal').style.display = 'none';
    }

    function injectHighlightUI(searchBox) {
        if (document.getElementById('statHighlighterSettingsBtn')) return;

        const settingsButton = document.createElement('span');
        settingsButton.id = 'statHighlighterSettingsBtn';
        settingsButton.style.cssText = 'float: right; margin-left: 8px; margin-right: 5px; cursor: pointer; font-size: 24px; padding-top: 5px;';
        settingsButton.title = 'ステータス合計ハイライト設定';
        settingsButton.innerHTML = '<i class="ri-settings-3-line"></i>';
        searchBox.parentNode.insertBefore(settingsButton, searchBox);

        const modalHtml = `
            <div id="statHighlighterModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 9998;">
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: #f0f0f0; color: #333; border: 1px solid #ccc; border-radius: 8px; padding: 20px; z-index: 9999; min-width: 450px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                    <h3 style="margin-top: 0; border-bottom: 1px solid #ccc; padding-bottom: 10px;">ステータス合計ハイライト設定</h3>
                    <p style="font-size: 9pt; margin-bottom: 15px;">閾値（合計ステータス）が高い順に優先されます。</p>
                    <div id="settingsContainer"></div>
                    <button id="saveHighlighterSettings" style="margin-top: 15px; padding: 8px 15px; cursor: pointer;">保存して適用</button>
                    <button id="closeHighlighterModal" style="margin-top: 15px; margin-left: 10px; padding: 8px 15px; cursor: pointer;">閉じる</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        settingsButton.addEventListener('click', openHighlightModal);
        document.getElementById('closeHighlighterModal').addEventListener('click', closeHighlightModal);

        document.getElementById('saveHighlighterSettings').addEventListener('click', () => {
            const newSettings = [];
            document.querySelectorAll('#settingsContainer .setting-row').forEach(row => {
                newSettings.push({
                    threshold: Number(row.querySelector('.setting-threshold').value) || 0,
                    color: row.querySelector('.setting-color').value,
                    enabled: row.querySelector('.setting-enabled').checked
                });
            });
            saveHighlightSettings(newSettings);
            applyHighlightColors();
            closeHighlightModal();
        });

        document.getElementById('statHighlighterModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeHighlightModal();
            }
        });

        searchBox.addEventListener('input', () => {
            setTimeout(applyHighlightColors, 50);
        });
    }

    // === メイン処理の開始 ===

    const observer = new MutationObserver(() => {
        let timeout;
        clearTimeout(timeout);
        timeout = setTimeout(processDOMChanges, 100);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    window.addEventListener('load', () => {
        initCollapsibleAreas();

        if (window.location.href.includes('mode=action')) {
            setTimeout(() => {
                const searchBox = document.getElementById('searchBox');
                if (searchBox) {
                    injectHighlightUI(searchBox);
                    applyHighlightColors();
                }
            }, 500);
        }
    });

})();

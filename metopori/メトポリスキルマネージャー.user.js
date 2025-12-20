// ==UserScript==
// @name         メトポリスキルマネージャー
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  スキル構成の保存・読込・ファイル入出力、スロットのドラッグ＆ドロップ並べ替え、ステータス合計の表示
// @author       ayautaginrei(Gemini)
// @match        https://metropolis-c-openbeta.sakuraweb.com/status*
// @update       https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/metopori/%E3%83%A1%E3%83%88%E3%83%9D%E3%83%AA%E3%82%B9%E3%82%AD%E3%83%AB%E3%83%9E%E3%83%8D%E3%83%BC%E3%82%B8%E3%83%A3%E3%83%BC.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // =============================================================================
    //  共通設定・定数
    // =============================================================================
    const STORAGE_KEY = 'skill_set_manager_data_v2';
    const STATUS_CONFIG = {
        startDate: '2025/12/01',
        initialStat: 5,
        initialAP: 2,
        apUrl: 'story.php'
    };
    const statNames = ['STR', 'WIZ', 'DEX', 'AGI', 'INTER', 'MND', 'LIFE'];

    // グローバルに近いスコープでAPを保持し、再計算時に参照できるようにします
    let globalCurrentAp = 0;

    function getSavedData() {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : {};
    }

    function saveToStorage(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .skill-desc-preview {
                display: block;
                margin-top: 5px;
                margin-bottom: 10px;
                padding: 8px 12px;
                background-color: rgba(0, 0, 0, 0.05);
                border-left: 4px solid #4a90e2;
                border-radius: 4px;
                font-size: 0.9em;
                color: #333;
                line-height: 1.4;
                max-width: 600px;
            }
            .drag-handle {
                cursor: grab;
                margin-right: 10px;
                font-size: 1.2em;
                color: #666;
            }
            .drag-handle:active {
                cursor: grabbing;
            }
            .msm-btn {
                cursor: pointer;
                padding: 5px 12px;
                color: white;
                border: none;
                border-radius: 3px;
                font-weight: bold;
                font-size: 0.9em;
                margin-left: 5px;
                white-space: nowrap;
            }
            .msm-btn-save { background: #22c502; }
            .msm-btn-load { background: #2196F3; }
            .msm-btn-del { background: #d4190cff; }
            .msm-btn-edit { background: #2196F3; }
            .msm-btn-file { background: #607D8B; }
            .msm-btn-submit { background: #22c502; }

            .msm-row {
                display: flex;
                gap: 10px;
                align-items: center;
                padding: 8px;
                border-radius: 4px;
                margin-bottom: 5px;
            }
            .msm-label {
                font-weight: bold;
                font-size: 0.9em;
                min-width: 80px;
                color: #333;
            }
        `;
        document.head.appendChild(style);
    }

    // =============================================================================
    //  1. ステータス検証ツール ロジック (AP減算表示版)
    // =============================================================================

    function getTheoreticalMaxPoint() {
        const now = new Date();
        const start = new Date(STATUS_CONFIG.startDate + ' 00:00:00');
        if (now < start) return STATUS_CONFIG.initialStat + STATUS_CONFIG.initialAP;
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayDiff = Math.floor((todayStart - start) / (1000 * 60 * 60 * 24));
        let distributedAP = dayDiff * 2;
        const time8 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
        const time20 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
        if (now >= time8) distributedAP += 1;
        if (now >= time20) distributedAP += 1;
        return distributedAP + STATUS_CONFIG.initialAP + STATUS_CONFIG.initialStat;
    }

    function initStatusValidator() {
        const theoreticalMax = getTheoreticalMaxPoint();

        const pointDisplayParagraphs = document.querySelectorAll('p');
        let targetParagraph = null;
        for (const p of pointDisplayParagraphs) {
            if (p.textContent.includes('ステータスポイント')) {
                targetParagraph = p;
                break;
            }
        }

        if (targetParagraph) {
            const container = document.createElement('span');
            container.style.fontSize = '1.1em';

            const totalSpan = document.createElement('span');
            totalSpan.id = 'user-script-total-display';

            const apSpan = document.createElement('span');
            apSpan.id = 'user-script-ap-display';
            apSpan.innerHTML = '　残りAP：<span style="color:gray;">取得中...</span>';

            container.appendChild(totalSpan);
            container.appendChild(apSpan);

            targetParagraph.innerHTML = "";
            targetParagraph.appendChild(container);

            const calculateSum = () => {
                let sum = 0;
                statNames.forEach(name => {
                    const input = document.querySelector(`input[name="${name}"]`);
                    if (input) {
                        sum += parseInt(input.value || 0, 10);
                    }
                });

                // 表示上の最大値 ＝ 理論値 － 現在持っているAP
                const displayMax = theoreticalMax - globalCurrentAp;

                const isMatch = (sum === displayMax);
                const color = isMatch ? '#006400' : (sum > displayMax ? 'red' : '#d9534f');

                totalSpan.innerHTML = `ステータスポイント：<strong style="color:${color}">${sum}</strong> / <strong>${displayMax}</strong>`;
            };

            // 初回計算
            calculateSum();

            statNames.forEach(name => {
                const input = document.querySelector(`input[name="${name}"]`);
                if (input) {
                    input.addEventListener('input', calculateSum);
                    input.addEventListener('change', calculateSum);
                }
            });

            // AP取得後に再計算
            fetch(STATUS_CONFIG.apUrl)
                .then(response => response.text())
                .then(htmlText => {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlText, 'text/html');
                    const apEl = doc.getElementById('currentAp');
                    const apDisplay = document.getElementById('user-script-ap-display');

                    if (apEl && apDisplay) {
                        globalCurrentAp = parseInt(apEl.textContent, 10);
                        const apColor = globalCurrentAp > 0 ? '#d9534f' : 'black';
                        apDisplay.innerHTML = `　残りAP：<strong style="color:${apColor};">${globalCurrentAp}</strong>`;

                        // APが判明したので、最大値表示を更新
                        calculateSum();
                    }
                })
                .catch(err => {
                    console.error('AP取得エラー', err);
                    const apDisplay = document.getElementById('user-script-ap-display');
                    if(apDisplay) apDisplay.innerHTML = '　残りAP：<span style="color:red;">取得失敗</span>';
                });
        }
    }

    // =============================================================================
    //  2. スキルセットマネージャー ロジック (既存機能維持)
    // =============================================================================

    function createControlPanel() {
        const headers = Array.from(document.querySelectorAll('h3'));
        const targetHeader = headers.find(h => h.textContent.trim() === 'スキル設定');
        if (!targetHeader) return;

        const container = document.createElement('div');
        container.style.cssText = `
            background: #f9f9f9;
            border: 2px solid #666;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            color: #333;
        `;

        container.innerHTML = `
            <div style="font-weight:bold; margin-bottom:10px; font-size:1.1em; border-bottom:1px solid #ccc; padding-bottom:5px;">
                ▼ スキルセット管理マネージャー
            </div>
            <div style="display:flex; flex-direction:column; gap:5px;">
                <div class="msm-row" style="background:#eef;">
                    <span class="msm-label">新規セット作成 : </span>
                    <input type="text" id="script-set-name" placeholder="セット名を入力し、現在の構成を保存" style="padding:5px; border:1px solid #ccc; border-radius:3px; flex:1;">
                    <button id="script-save-btn" type="button" class="msm-btn msm-btn-save">作成</button>
                </div>

                <div class="msm-row" style="background:#fee;">
                    <span class="msm-label">読込・操作 : </span>
                    <select id="script-set-select" style="padding:5px; border:1px solid #ccc; border-radius:3px; flex:1;">
                        <option value="">保存データなし</option>
                    </select>
                    <button id="script-load-btn" type="button" class="msm-btn msm-btn-load" title="選択したセットを反映">読込</button>
                    <button id="script-rename-btn" type="button" class="msm-btn msm-btn-edit" title="名前変更">名前変更</button>
                    <button id="script-delete-btn" type="button" class="msm-btn msm-btn-del" title="削除">削除</button>
                </div>

                <div class="msm-row" style="background:#ddd; margin-top: 5px; border-top: 1px solid #ddd; padding-top: 10px;">
                    <input type="file" id="script-file-import" accept=".json" style="display:none;">
                    <span class="msm-label">バックアップ : </span>
                    <button id="script-export-btn" type="button" class="msm-btn msm-btn-file" style="margin-left:0; margin-right:5px;">エクスポート</button>
                    <button id="script-import-btn" type="button" class="msm-btn msm-btn-file" style="margin-left:0;">インポート</button>
                    <div style="flex:1;"></div>
                    <button id="script-submit-real-btn" type="button" class="msm-btn msm-btn-submit" style="min-width:160px;">スキル設定を反映</button>
                </div>
            </div>
        `;

        targetHeader.insertAdjacentElement('afterend', container);

        document.getElementById('script-save-btn').addEventListener('click', saveCurrentSet);
        document.getElementById('script-load-btn').addEventListener('click', loadSelectedSet);
        document.getElementById('script-rename-btn').addEventListener('click', renameSelectedSet);
        document.getElementById('script-delete-btn').addEventListener('click', deleteSelectedSet);
        document.getElementById('script-export-btn').addEventListener('click', exportDataToFile);
        const importInput = document.getElementById('script-file-import');
        const importBtn = document.getElementById('script-import-btn');
        importBtn.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', importDataFromFile);
        document.getElementById('script-submit-real-btn').addEventListener('click', () => {
            const originalSubmitBtn = document.querySelector('input[name="update_skills"]');
            if (originalSubmitBtn) originalSubmitBtn.click();
        });

        updateSelectOptions();
    }

    function updateSelectOptions() {
        const data = getSavedData();
        const select = document.getElementById('script-set-select');
        const currentVal = select.value;
        select.innerHTML = '<option value="">---</option>';
        const keys = Object.keys(data);
        if (keys.length === 0) {
            select.innerHTML = '<option value="">(保存されたセットはありません)</option>';
            return;
        }
        keys.forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = key;
            select.appendChild(option);
        });
        if (keys.includes(currentVal)) select.value = currentVal;
    }

    function saveCurrentSet(e) {
        e.preventDefault();
        const nameInput = document.getElementById('script-set-name');
        const setName = nameInput.value.trim();
        if (!setName) { alert('セット名を入力してください。'); return; }
        if (getSavedData()[setName] && !confirm(`セット名「${setName}」は既に存在します。上書きしますか？`)) return;

        const currentData = {};
        for (let i = 1; i <= 8; i++) {
            currentData[`slot${i}`] = {
                skill: document.querySelector(`[name="skill${i}"]`)?.value || "",
                icon: document.querySelector(`[name="skill${i}_icon"]`)?.value || "",
                msg: document.querySelector(`[name="skill${i}_msg"]`)?.value || "",
                cutin: document.querySelector(`[name="skill${i}_cutin"]`)?.value || ""
            };
        }
        const storageData = getSavedData();
        storageData[setName] = currentData;
        saveToStorage(storageData);
        updateSelectOptions();
        document.getElementById('script-set-select').value = setName;
        alert(`スキルセット「${setName}」を保存しました。`);
    }

    function loadSelectedSet(e) {
        e.preventDefault();
        const select = document.getElementById('script-set-select');
        const setName = select.value;
        if (!setName) return;
        const setData = getSavedData()[setName];
        if (!setData) return;

        let missingSkills = [];
        for (let i = 1; i <= 8; i++) {
            const slotData = setData[`slot${i}`];
            if (slotData) {
                const elSkill = document.querySelector(`[name="skill${i}"]`);
                const elIcon = document.querySelector(`[name="skill${i}_icon"]`);
                const elMsg = document.querySelector(`[name="skill${i}_msg"]`);
                const elCutin = document.querySelector(`[name="skill${i}_cutin"]`);
                if (elSkill) {
                    elSkill.value = slotData.skill;
                    if (slotData.skill !== "" && elSkill.value !== slotData.skill) {
                        missingSkills.push(`スロット${i}: 保存されたスキルID「${slotData.skill}」が見つかりません`);
                        elSkill.value = "";
                    } else {
                        elSkill.dispatchEvent(new Event('change'));
                    }
                }
                if (elMsg) elMsg.value = slotData.msg;
                if (elCutin) elCutin.value = slotData.cutin;
                if (elIcon) {
                    elIcon.value = slotData.icon;
                    elIcon.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }
        if (missingSkills.length > 0) alert(`セット「${setName}」を読み込みましたが、一部のスキルが見つかりませんでした：\n${missingSkills.join('\n')}`);
        else alert(`セット「${setName}」を読み込みました。`);
    }

    function renameSelectedSet(e) {
        e.preventDefault();
        const select = document.getElementById('script-set-select');
        const oldName = select.value;
        if (!oldName) return;
        const newName = prompt("新しいセット名を入力してください:", oldName);
        if (newName && newName.trim() !== "" && newName !== oldName) {
            const storageData = getSavedData();
            storageData[newName] = storageData[oldName];
            delete storageData[oldName];
            saveToStorage(storageData);
            updateSelectOptions();
            select.value = newName;
        }
    }

    function deleteSelectedSet(e) {
        e.preventDefault();
        const select = document.getElementById('script-set-select');
        const setName = select.value;
        if (setName && confirm(`セット「${setName}」を削除しますか？`)) {
            const storageData = getSavedData();
            delete storageData[setName];
            saveToStorage(storageData);
            updateSelectOptions();
        }
    }

    function exportDataToFile() {
        const data = getSavedData();
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "metropolis_skills.json";
        link.click();
    }

    function importDataFromFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const importedData = JSON.parse(event.target.result);
                if (confirm("データをインポートしますか？")) {
                    saveToStorage({ ...getSavedData(), ...importedData });
                    updateSelectOptions();
                    alert("完了しました。");
                }
            } catch (err) { alert("無効な形式です。"); }
            finally { e.target.value = ''; }
        };
        reader.readAsText(file);
    }

    function enableSkillPreview() {
        const skillDatabase = {};
        document.querySelectorAll('details ul li').forEach(li => {
            const strongTag = li.querySelector('strong');
            if (strongTag) {
                const skillName = strongTag.textContent.trim();
                let descText = li.textContent.replace(skillName, '').trim();
                if (descText.startsWith('：')) descText = descText.substring(1).trim();
                skillDatabase[skillName] = descText;
            }
        });
        const skillSelects = document.querySelectorAll('select[name^="skill"]:not([name*=\"_icon\"]):not([name*=\"_msg\"]):not([name*=\"_cutin\"])');
        skillSelects.forEach(select => {
            const descBox = document.createElement('div');
            descBox.className = 'skill-desc-preview';
            const parentLabel = select.closest('label');
            if (parentLabel) parentLabel.insertAdjacentElement('afterend', descBox);
            const updateDescription = () => {
                const selectedText = select.options[select.selectedIndex].textContent.trim();
                if (skillDatabase[selectedText]) {
                    descBox.textContent = skillDatabase[selectedText];
                    descBox.style.display = 'block';
                } else {
                    descBox.style.display = 'none';
                }
            };
            select.addEventListener('change', updateDescription);
            updateDescription();
        });
    }

    function enableDragSort() {
        const container = document.querySelector("form fieldset")?.parentElement;
        if (!container) return;
        const renumberSlots = () => {
            const currentFieldsets = Array.from(container.querySelectorAll("fieldset"))
                .filter(f => f.querySelector("legend")?.textContent.includes("スキルスロット"));
            currentFieldsets.forEach((fs, index) => {
                const newNum = index + 1;
                const legend = fs.querySelector("legend");
                if (legend) {
                    for (let node of legend.childNodes) {
                        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
                            node.textContent = `スキルスロット${newNum}`;
                            break;
                        }
                    }
                }
                fs.querySelectorAll('[name]').forEach(input => {
                    const name = input.getAttribute('name');
                    if (name && /skill\d+/.test(name)) input.setAttribute('name', name.replace(/skill\d+/, `skill${newNum}`));
                });
            });
        };

        const skillFieldsets = Array.from(container.querySelectorAll("fieldset"))
            .filter(f => f.querySelector("legend")?.textContent.includes("スキルスロット"));

        skillFieldsets.forEach(fs => {
            const legend = fs.querySelector("legend");
            const handle = document.createElement("span");
            handle.textContent = "⠿ ";
            handle.className = "drag-handle";
            legend.prepend(handle);
            handle.addEventListener("mousedown", () => { fs.draggable = true; });
            handle.addEventListener("mouseup", () => { fs.draggable = false; });

            fs.addEventListener("dragstart", e => {
                fs.style.opacity = "0.4";
                e.dataTransfer.setData("text/plain", Array.from(container.children).indexOf(fs));
            });
            fs.addEventListener("dragend", () => { fs.style.opacity = "1"; fs.draggable = false; });
            fs.addEventListener("dragover", e => { e.preventDefault(); });
            fs.addEventListener("drop", e => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                const children = Array.from(container.children);
                const toIndex = children.indexOf(fs);
                if (fromIndex !== toIndex) {
                    if (fromIndex < toIndex) container.insertBefore(children[fromIndex], fs.nextSibling);
                    else container.insertBefore(children[fromIndex], fs);
                    renumberSlots();
                }
            });
        });
    }

    // =============================================================================
    //  初期化実行
    // =============================================================================

    window.addEventListener('load', function() {
        injectStyles();
        initStatusValidator();
        createControlPanel();
        enableSkillPreview();
        enableDragSort();
    });

})();

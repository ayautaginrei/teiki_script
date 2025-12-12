// ==UserScript==
// @name         メトポリスキルマネージャー
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  スキル構成の保存と読み込み、スキル説明表示、スロットをドラッグ＆ドロップで並べ替え
// @author       ayautaginrei(Gemini)
// @match        https://metropolis-c-openbeta.sakuraweb.com/status*
// @update
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'skill_set_manager_data_v2';

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
        `;
        document.head.appendChild(style);
    }

    // =============================================================================
    //  1. スキルセットマネージャー (保存・読込パネル)
    // =============================================================================

    function createControlPanel() {
        const headers = Array.from(document.querySelectorAll('h3'));
        const targetHeader = headers.find(h => h.textContent.trim() === 'スキル設定');

        if (!targetHeader) {
            console.log('[SkillManager] "スキル設定" header not found.');
            return;
        }

        const container = document.createElement('div');
        container.style.cssText = `
            background: #f9f9f9;
            border: 2px solid #666;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            color: #333; /* サイトCSSがない場合のための文字色指定 */
        `;

        container.innerHTML = `
            <div style="font-weight:bold; margin-bottom:10px; font-size:1.1em; border-bottom:1px solid #ccc; padding-bottom:5px;">
                ▼ スキルセット管理マネージャー
            </div>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; gap:10px; align-items:center; background:#eef; padding:8px; border-radius:4px;">
                    <span style="font-weight:bold; font-size:0.9em; min-width:80px; color:#333;">新規保存:</span>
                    <input type="text" id="script-set-name" placeholder="セット名を入力 (例: ボス戦用)" style="padding:5px; border:1px solid #ccc; border-radius:3px; flex:1;">
                    <button id="script-save-btn" type="button" style="cursor:pointer; padding:5px 15px; background:#4CAF50; color:white; border:none; border-radius:3px; font-weight:bold;">保存</button>
                </div>
                <div style="display:flex; gap:10px; align-items:center; background:#fee; padding:8px; border-radius:4px;">
                    <span style="font-weight:bold; font-size:0.9em; min-width:80px; color:#333;">読込・削除:</span>
                    <select id="script-set-select" style="padding:5px; border:1px solid #ccc; border-radius:3px; flex:1;">
                        <option value="">保存データなし</option>
                    </select>
                    <button id="script-load-btn" type="button" style="cursor:pointer; padding:5px 15px; background:#2196F3; color:white; border:none; border-radius:3px; font-weight:bold;">読込</button>
                    <button id="script-delete-btn" type="button" style="cursor:pointer; padding:5px 15px; background:#f44336; color:white; border:none; border-radius:3px; font-weight:bold;">削除</button>
                </div>
            </div>
            <div style="margin-top:5px; font-size:0.8em; color:#666;">
                ※ステータス（STR等）は保存されません。スキル構成のみ保存されます。<br>
                ※読込後、ページ下部の<strong>「スキル設定を保存」</strong>ボタンを押して確定してください。
            </div>
        `;

        targetHeader.insertAdjacentElement('afterend', container);

        document.getElementById('script-save-btn').addEventListener('click', saveCurrentSet);
        document.getElementById('script-load-btn').addEventListener('click', loadSelectedSet);
        document.getElementById('script-delete-btn').addEventListener('click', deleteSelectedSet);

        updateSelectOptions();
        console.log('[SkillManager] Control panel created and positioned.');
    }

    function updateSelectOptions() {
        const data = getSavedData();
        const select = document.getElementById('script-set-select');
        const currentVal = select.value;

        select.innerHTML = '<option value="">セットを選択してください...</option>';
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

        if (keys.includes(currentVal)) {
            select.value = currentVal;
        }
    }

    // --- イベントハンドラ (保存/読込/削除) ---

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

        const storageData = getSavedData();
        const setData = storageData[setName];
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

        let resultMsg = `セット「${setName}」を読み込みました。`;
        if (missingSkills.length > 0) {
            resultMsg += `\n\n【警告】以下のスキルは習得条件を満たしていない等の理由でセットできませんでした：\n${missingSkills.join('\n')}`;
        }
        resultMsg += `\n\n反映するにはページ下部の「スキル設定を保存」ボタンを押してください。`;
        alert(resultMsg);
    }

    function deleteSelectedSet(e) {
        e.preventDefault();
        const select = document.getElementById('script-set-select');
        const setName = select.value;
        if (!setName) return;

        if (confirm(`セット「${setName}」を削除しますか？`)) {
            const storageData = getSavedData();
            delete storageData[setName];
            saveToStorage(storageData);
            updateSelectOptions();
            document.getElementById('script-set-name').value = '';
            alert('削除しました。');
        }
    }

    // =============================================================================
    //  2. スキルプレビュー機能
    // =============================================================================

    function enableSkillPreview() {
        const skillDatabase = {};

        document.querySelectorAll('details ul li').forEach(li => {
            const strongTag = li.querySelector('strong');
            if (strongTag) {
                const skillName = strongTag.textContent.trim();
                let descText = li.textContent.replace(skillName, '').trim();
                if (descText.startsWith('：')) {
                    descText = descText.substring(1).trim();
                }
                skillDatabase[skillName] = descText;
            }
        });

        const skillSelects = document.querySelectorAll(
            'select[name^="skill"]:not([name*="_icon"]):not([name*="_msg"]):not([name*="_cutin"])'
        );

        skillSelects.forEach(select => {
            const descBox = document.createElement('div');
            descBox.className = 'skill-desc-preview';
            descBox.textContent = '---';

            const parentLabel = select.closest('label');
            if (parentLabel) {
                parentLabel.insertAdjacentElement('afterend', descBox);
            } else {
                select.insertAdjacentElement('afterend', descBox);
            }

            const updateDescription = () => {
                const selectedOption = select.options[select.selectedIndex];
                const selectedText = selectedOption.textContent.trim();
                if (skillDatabase[selectedText]) {
                    descBox.textContent = skillDatabase[selectedText];
                    descBox.style.display = 'block';
                } else if (selectedOption.value === "") {
                    descBox.textContent = "スキルを選択してください";
                    descBox.style.display = 'none';
                } else {
                    descBox.textContent = "説明が見つかりません";
                }
            };
            select.addEventListener('change', updateDescription);
            updateDescription();
        });
        console.log('[SkillManager] Preview enabled.');
    }

    // =============================================================================
    //  3. スロット入れ替え機能（ドラッグ＆ドロップ）
    // =============================================================================

    function enableDragSort() {
        let skillFieldsets = Array.from(
            document.querySelectorAll("form fieldset legend")
        ).filter(legend => legend.textContent.includes("スキルスロット"))
         .map(legend => legend.parentElement);

        if (skillFieldsets.length === 0) {
            console.log('[SkillManager] No skill slots found for drag sort.');
            return;
        }

        const container = skillFieldsets[0].parentElement;

        // ▼ 内部ID再割り当て・各種書き換え処理
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

                const inputs = fs.querySelectorAll('[name]');
                inputs.forEach(input => {
                    const name = input.getAttribute('name');
                    if (name && /skill\d+/.test(name)) {
                        input.setAttribute('name', name.replace(/skill\d+/, `skill${newNum}`));
                    }
                });

                const iconSelect = fs.querySelector('.icon-selector');
                const previewImg = fs.querySelector('img[id^="preview"]');
                if (iconSelect && previewImg) {
                    const newId = `preview${newNum}`;
                    iconSelect.setAttribute('data-preview-id', newId);
                    previewImg.setAttribute('id', newId);
                }
            });
            skillFieldsets = currentFieldsets;
        };

        skillFieldsets.forEach(fs => {
            const legend = fs.querySelector("legend");

            if (!legend.querySelector('.drag-handle')) {
                const handle = document.createElement("span");
                handle.textContent = "⠿ ";
                handle.className = "drag-handle";
                handle.title = "ドラッグして入れ替え";
                legend.prepend(handle);
                legend.style.userSelect = "none";

                fs.draggable = false;
                fs.style.transition = "transform 0.2s, opacity 0.2s";

                // ハンドルを掴んだ時だけドラッグ可能にする
                handle.addEventListener("mousedown", () => {
                    fs.draggable = true;
                });
                handle.addEventListener("mouseup", () => {
                    fs.draggable = false;
                });
            }

            fs.addEventListener("dragstart", e => {
                fs.style.opacity = "0.4";
                e.dataTransfer.effectAllowed = "move";
                const currentIndex = Array.from(container.children).indexOf(fs);
                e.dataTransfer.setData("text/plain", currentIndex);
            });

            fs.addEventListener("dragend", () => {
                fs.style.opacity = "1";
                fs.draggable = false; // Reset
            });

            fs.addEventListener("dragover", e => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
            });

            fs.addEventListener("drop", e => {
                e.preventDefault();
                fs.draggable = false;

                const fromIndexStr = e.dataTransfer.getData("text/plain");
                if (!fromIndexStr) return;

                const fromIndex = parseInt(fromIndexStr, 10);
                const children = Array.from(container.children);
                const toIndex = children.indexOf(fs);

                if (fromIndex === toIndex) return;

                const fromNode = children[fromIndex];

                if (fromIndex < toIndex) {
                    container.insertBefore(fromNode, fs.nextSibling);
                } else {
                    container.insertBefore(fromNode, fs);
                }

                renumberSlots();
            });
        });
        console.log('[SkillManager] Drag sort enabled.');
    }

    // =============================================================================
    //  6. 初期化
    // =============================================================================

    window.addEventListener('load', function() {
        injectStyles();
        createControlPanel();
        enableSkillPreview();
        enableDragSort();
    });

})();

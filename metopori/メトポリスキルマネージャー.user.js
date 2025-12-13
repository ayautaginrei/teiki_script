// ==UserScript==
// @name         メトポリスキルマネージャー
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  スキル構成の保存・読込・ファイル入出力、スロットのドラッグ＆ドロップ並べ替え
// @author       ayautaginrei(Gemini)
// @match        https://metropolis-c-openbeta.sakuraweb.com/status*
// @update       https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/metopori/%E3%83%A1%E3%83%88%E3%83%9D%E3%83%AA%E3%82%B9%E3%82%AD%E3%83%AB%E3%83%9E%E3%83%8D%E3%83%BC%E3%82%B8%E3%83%A3%E3%83%BC.user.js
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
            /* ボタン共通スタイル */
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
    //  1. スキルセットマネージャー (保存・読込・ファイル管理パネル)
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
                    <div style="display:flex; align-items:center;"></div>
                        <input type="file" id="script-file-import" accept=".json" style="display:none;">
                        <span class="msm-label">バックアップの保存と復元 : </span>
                        <button id="script-export-btn" type="button" class="msm-btn msm-btn-file" style="margin-left:0; margin-right:5px;">エクスポート</button>
                        <button id="script-import-btn" type="button" class="msm-btn msm-btn-file" style="margin-left:0;">インポート</button>

                    <div style="flex:1;"></div>

                    <div>
                        <button id="script-submit-real-btn" type="button" class="msm-btn msm-btn-submit" style="min-width:160px;">スキル設定を反映</button>
                    </div>
                </div>
            </div>
        `;

        targetHeader.insertAdjacentElement('afterend', container);

        // Event Listeners
        document.getElementById('script-save-btn').addEventListener('click', saveCurrentSet);
        document.getElementById('script-load-btn').addEventListener('click', loadSelectedSet);
        document.getElementById('script-rename-btn').addEventListener('click', renameSelectedSet);
        document.getElementById('script-delete-btn').addEventListener('click', deleteSelectedSet);

        // File I/O Listeners
        document.getElementById('script-export-btn').addEventListener('click', exportDataToFile);
        const importInput = document.getElementById('script-file-import');
        const importBtn = document.getElementById('script-import-btn');
        importBtn.addEventListener('click', () => importInput.click()); // ボタンクリックでinput発火
        importInput.addEventListener('change', importDataFromFile);

        // Submit Listener
        document.getElementById('script-submit-real-btn').addEventListener('click', submitRealForm);

        updateSelectOptions();
        console.log('[SkillManager] Control panel created and positioned.');
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

        if (keys.includes(currentVal)) {
            select.value = currentVal;
        }
    }

    // --- イベントハンドラ (保存/読込/削除/名前変更) ---

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
            resultMsg += `\n\n【エラー】以下のスキルは習得条件を満たしていない等の理由でセットできませんでした：\n${missingSkills.join('\n')}`;
        }
        alert(resultMsg);
    }

    function renameSelectedSet(e) {
        e.preventDefault();
        const select = document.getElementById('script-set-select');
        const oldName = select.value;
        if (!oldName) {
            alert("変更するセットを選択してください。");
            return;
        }

        const newName = prompt("新しいセット名を入力してください:", oldName);
        if (newName && newName.trim() !== "" && newName !== oldName) {
            const storageData = getSavedData();
            if (storageData[newName] && !confirm(`「${newName}」は既に存在します。上書きしますか？`)) {
                return;
            }

            // データ移行
            storageData[newName] = storageData[oldName];
            delete storageData[oldName];

            saveToStorage(storageData);
            updateSelectOptions();
            select.value = newName; // 新しい名前を選択状態に
            alert(`「${oldName}」を「${newName}」に変更しました。`);
        }
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

    function submitRealForm(e) {
        e.preventDefault();
        const originalSubmitBtn = document.querySelector('input[name="update_skills"]');
        if (originalSubmitBtn) {
            originalSubmitBtn.click();
        } else {
            alert('ページ内に「スキル設定を保存」ボタンが見つかりません。');
        }
    }

    // --- ファイル入出力機能 ---

    function exportDataToFile() {
        const data = getSavedData();
        if (Object.keys(data).length === 0) {
            alert("保存されているデータがありません。");
            return;
        }

        const fileName = "metropolis_skills.json";
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], {type: "application/json"});

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    function importDataFromFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const importedData = JSON.parse(event.target.result);
                if (typeof importedData !== 'object' || importedData === null) {
                    throw new Error("Invalid format");
                }

                // 現在のデータと統合するか確認
                if (confirm("ファイルを読み込みますか？\n（同名のセットがある場合は上書きされます）")) {
                    const currentData = getSavedData();
                    // マージ処理
                    const newData = { ...currentData, ...importedData };
                    saveToStorage(newData);
                    updateSelectOptions();
                    alert("読み込みが完了しました。");
                }
            } catch (err) {
                console.error(err);
                alert("ファイルの読み込みに失敗しました。\n正しいJSONファイルか確認してください。");
            } finally {
                // inputをリセットして同じファイルを再度選択できるようにする
                e.target.value = '';
            }
        };
        reader.readAsText(file);
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
                    descBox.textContent = "説明が見つかりませんでした";
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
                fs.draggable = false;
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
    //   初期化
    // =============================================================================

    window.addEventListener('load', function() {
        injectStyles();
        createControlPanel();
        enableSkillPreview();
        enableDragSort();
    });

})();

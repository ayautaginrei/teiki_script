// ==UserScript==
// @name         Better Stroll Green GFRe
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Stroll GreenのUIを改善します。
// @author       ayautaginrei(Gemini)
// @match        https://soraniwa.428.st/gf/*
// @updateURL    https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/soraniwa/Better%20Stroll%20Green%20GFRe.user.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ストレージキー
    const YUIN_KEY = 'yuuinCount';
    const PREV_YUIN_KEY = 'prevYuuinCount';
    const KIHI_KEY = 'kihiCount';
    const PREV_KIHI_KEY = 'prevKihiCount';

    // 数値を抽出する関数（テーブルから「誘引」「忌避」関連の数値を合計）
    function extractCounts(table) {
        let yuuin = 0;
        let kihi = 0;
        const rows = table.querySelectorAll('tr.odd, tr.even');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 3) {
                const nameText = cells[1].textContent.trim();
                const countText = cells[2].textContent.trim();
                const count = parseInt(countText.match(/\d+/)) || 0;
                if (count > 0) {
                    if (/誘引/.test(nameText)) {
                        yuuin += count;
                    } else if (/忌避/.test(nameText)) {
                        kihi += count;
                    }
                }
            }
        });
        return { yuuin, kihi };
    }


    // 表示要素を作成・更新する関数（labelb形式で調子とAPの間に挿入）
    function updateDisplay(mapdesc) {
        const yuuin = parseInt(localStorage.getItem(YUIN_KEY) || '0');
        const kihi = parseInt(localStorage.getItem(KIHI_KEY) || '0');

        // 誘引のlabelb
        let yuinElem = mapdesc.querySelector('#custom-yuin-display');
        if (!yuinElem) {
            yuinElem = document.createElement('div');
            yuinElem.id = 'custom-yuin-display';
            yuinElem.className = 'labelb';
            yuinElem.innerHTML = `
                <div class="labelbleft" data-ctip="誘引の値です。">誘引</div>
                <div class="labelbright labelbrightcell2">${yuuin}</div>
            `;
            // 調子のlabelbの直後に挿入
            const condLabel = mapdesc.querySelector('.labelb .labelbleft[data-ctip*="移動力"]')?.closest('.labelb');
            if (condLabel && condLabel.nextElementSibling) {
                if (condLabel.nextElementSibling.tagName === 'BR') {
                    condLabel.nextElementSibling.remove();
                }
                condLabel.parentNode.insertBefore(yuinElem, condLabel.nextElementSibling);
                condLabel.parentNode.insertBefore(document.createElement('br'), yuinElem.nextElementSibling);
            } else {
                mapdesc.appendChild(yuinElem);
            }
        } else {
            const valueElem = yuinElem.querySelector('.labelbright');
            if (valueElem && valueElem.textContent !== yuuin.toString()) {
                valueElem.textContent = yuuin;
            }
        }

        // 忌避のlabelb
        let kihiElem = mapdesc.querySelector('#custom-kihi-display');
        if (!kihiElem) {
            kihiElem = document.createElement('div');
            kihiElem.id = 'custom-kihi-display';
            kihiElem.className = 'labelb';
            kihiElem.innerHTML = `
                <div class="labelbleft" data-ctip="忌避の値です。">忌避</div>
                <div class="labelbright labelbrightcell2">${kihi}</div>
            `;
            // 誘引のlabelbの直後に挿入
            if (yuinElem && yuinElem.nextElementSibling) {
                if (yuinElem.nextElementSibling.tagName === 'BR') {
                    yuinElem.nextElementSibling.remove();
                }
                yuinElem.parentNode.insertBefore(kihiElem, yuinElem.nextElementSibling);
                if (!kihiElem.nextElementSibling || kihiElem.nextElementSibling.tagName !== 'BR') {
                    yuinElem.parentNode.insertBefore(document.createElement('br'), kihiElem.nextElementSibling);
                }
            } else {
                mapdesc.appendChild(kihiElem);
            }
        } else {
            const valueElem = kihiElem.querySelector('.labelbright');
            if (valueElem && valueElem.textContent !== kihi.toString()) {
                valueElem.textContent = kihi;
            }
        }
    }


    // デバウンス用
    let isProcessing = false;
    function debounceProcess(callback) {
        if (isProcessing) return;
        isProcessing = true;
        setTimeout(() => {
            callback();
            isProcessing = false;
        }, 100);
    }

    // queryButtonのクリックハンドラ（誘引と忌避を両方減少）
    function handleQueryButtonClick() {
        const currentYuuin = parseInt(localStorage.getItem(YUIN_KEY) || '0');
        const currentKihi = parseInt(localStorage.getItem(KIHI_KEY) || '0');

        if (currentYuuin > 0) {
            localStorage.setItem(PREV_YUIN_KEY, localStorage.getItem(YUIN_KEY) || '0');
            localStorage.setItem(YUIN_KEY, (currentYuuin - 1).toString());
        }
        if (currentKihi > 0) {
            localStorage.setItem(PREV_KIHI_KEY, localStorage.getItem(KIHI_KEY) || '0');
            localStorage.setItem(KIHI_KEY, (currentKihi - 1).toString());
        }

        // 表示を即時更新
        const mapdescs = document.querySelectorAll('.mapdesc');
        mapdescs.forEach(mapdesc => {
            updateDisplay(mapdesc);
        });
    }

    // queryButtonにイベントリスナーを追加
    function setupQueryButtonListeners() {
        const buttons = document.querySelectorAll('.queryButton:not([data-listener-added])');
        buttons.forEach(button => {
            button.dataset.listenerAdded = 'true';
            button.addEventListener('click', handleQueryButtonClick);
        });
    }

    const observer = new MutationObserver((mutations, obs) => {
        debounceProcess(() => {
            obs.disconnect();

            // ■ アイテム設定ページの処理
            const inventoryButton = document.getElementById('inventory');
            const itemList = document.getElementById('itemlist');
            if (inventoryButton && itemList && itemList.hasChildNodes()) {
                if (!inventoryButton.dataset.clickedByScript) {
                    inventoryButton.dataset.clickedByScript = 'true';
                    setTimeout(() => {
                        inventoryButton.click();
                    }, 200);
                }
            }

            // ■ 誘引/忌避の監視（itemページでのみ実行）
            const bagTable = document.getElementById('bag');
            if (bagTable && (window.location.href.includes('mode=item') || inventoryButton)) {
                setTimeout(() => {
                    const { yuuin, kihi } = extractCounts(bagTable);
                    localStorage.setItem(PREV_YUIN_KEY, localStorage.getItem(YUIN_KEY) || '0');
                    localStorage.setItem(PREV_KIHI_KEY, localStorage.getItem(KIHI_KEY) || '0');
                    localStorage.setItem(YUIN_KEY, yuuin.toString());
                    localStorage.setItem(KIHI_KEY, kihi.toString());
                }, 500);
            }

            // ■ 各種行動ページの処理
            const farmSelects = document.querySelectorAll('select[name^="kadanact"]:not([data-buttons-added])');
            farmSelects.forEach(selectElement => {
                selectElement.dataset.buttonsAdded = 'true';

                const buttonContainer = document.createElement('div');
                Object.assign(buttonContainer.style, {
                    display: 'flex',
                    flexWrap: 'nowrap',
                    gap: '4px',
                    marginTop: '2px',
                    marginBottom: '5px',
                    maxWidth: '100%',
                    overflowX: 'auto',
                    padding: '2px',
                    border: 'none',
                    borderRadius: '0'
                });

                const textMap = {
                            '★育成促進(0/4) KP-1': '育成促進',
                            '★育成促進(1/4) KP-1': '育成促進',
                            '★育成促進(2/4) KP-1': '育成促進',
                            '★育成促進(3/4) KP-1': '育成促進',
                            '★育成促進(4/4) KP-1': '育成促進',
                            '★切り戻し(0/4) KP-1': '切り戻す',
                            '★切り戻し(1/4) KP-1': '切り戻す',
                            '★切り戻し(2/4) KP-1': '切り戻す',
                            '★切り戻し(3/4) KP-1': '切り戻す',
                            '★切り戻し(4/4) KP-1': '切り戻す',
                };

                Array.from(selectElement.options).forEach(option => {
                    if (option.value === '0') return;

                    const button = document.createElement('span');
                    button.textContent = textMap[option.text] || option.text;
                    button.dataset.value = option.value;

                    Object.assign(button.style, {
                        padding: '3px 6px',
                        border: '1px solid #a08060',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        backgroundColor: '#fffff0',
                        whiteSpace: 'nowrap',
                        fontSize: '12px',
                        minWidth: 'auto'
                    });

                    button.addEventListener('click', () => {
                        if (selectElement.value === option.value) {
                            selectElement.value = '0';
                            selectElement.dispatchEvent(new Event('change', { bubbles: true }));
                            Array.from(buttonContainer.children).forEach(btn => {
                                btn.style.backgroundColor = '#fffff0';
                                btn.style.fontWeight = 'normal';
                            });
                        } else {
                            selectElement.value = option.value;
                            selectElement.dispatchEvent(new Event('change', { bubbles: true }));
                            Array.from(buttonContainer.children).forEach(btn => {
                                btn.style.backgroundColor = '#fffff0';
                                btn.style.fontWeight = 'normal';
                            });
                            button.style.backgroundColor = '#e0ecff';
                            button.style.fontWeight = 'bold';
                        }
                    });

                    buttonContainer.appendChild(button);
                });

                selectElement.style.display = 'none';
                selectElement.parentNode.insertBefore(buttonContainer, selectElement);

                const initialSelectedButton = buttonContainer.querySelector(`[data-value="${selectElement.value}"]`);
                if (initialSelectedButton) {
                    initialSelectedButton.style.backgroundColor = '#e0ecff';
                    initialSelectedButton.style.fontWeight = 'bold';
                }
            });

            // ■ 表示ページの処理
            const mapdescs = document.querySelectorAll('.mapdesc');
            mapdescs.forEach(mapdesc => {
                updateDisplay(mapdesc);
            });

            // ■ queryButtonのリスナー設定
            setupQueryButtonListeners();

            obs.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        });
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

(function() {
    'use strict';

    // エリアにトグル機能を追加
    function addToggle(areaHeader, index) {
        if (areaHeader.dataset.collapsibleAdded) return; // 重複防止
        areaHeader.dataset.collapsibleAdded = 'true';

        // エリア名に▼を追加
        const originalText = areaHeader.textContent;
        areaHeader.innerHTML = `<span class="toggle-icon">▼</span> ${originalText}`;
        areaHeader.style.cursor = 'pointer';
        areaHeader.style.display = 'flex';
        areaHeader.style.alignItems = 'center';
        areaHeader.style.gap = '5px';

        // 直後の<p>タグを取得（<br>をスキップ）
        let content = areaHeader.nextElementSibling;
        while (content && content.tagName !== 'P') {
            content = content.nextElementSibling;
        }
        if (!content) {
            console.warn(`No <p> found after ${areaHeader.textContent}`);
            return;
        }

        // 初期状態で非表示
        content.style.maxHeight = '0px';
        content.style.overflow = 'hidden';
        content.style.display = 'block';
        content.style.opacity = '0';

        // トグル機能
        areaHeader.addEventListener('click', (e) => {
            e.preventDefault(); // フォーム送信防止
            e.stopPropagation(); // 他のイベントとの競合防止
            const isHidden = content.style.maxHeight === '0px';
            content.style.maxHeight = isHidden ? `${content.scrollHeight}px` : '0px';
            content.style.opacity = isHidden ? '1' : '0';
            areaHeader.querySelector('.toggle-icon').textContent = isHidden ? '▲' : '▼';
            // 状態をlocalStorageに保存
            localStorage.setItem(`area_state_${index}`, isHidden ? 'block' : 'none');
        });

        // 初期状態を復元
        const savedState = localStorage.getItem(`area_state_${index}`);
        if (savedState === 'block') {
            content.style.maxHeight = `${content.scrollHeight}px`;
            content.style.opacity = '1';
            areaHeader.querySelector('.toggle-icon').textContent = '▲';
        }
    }

    // モーダル内のエリアを初期化
    function initializeCollapsible() {
        const modal = document.querySelector('#modal6');
        if (!modal) {
            console.warn('Modal #modal6 not found');
            return;
        }

        const areaHeaders = modal.querySelectorAll('h4');
        areaHeaders.forEach((areaHeader, index) => {
            if (areaHeader.textContent.startsWith('エリア')) {
                addToggle(areaHeader, index);
            }
        });
    }

    // モーダル表示を監視
    function observeModal() {
        const modal = document.querySelector('#modal6');
        if (!modal) return;

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                // モーダルが表示されたかチェック
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    if (modal.style.display !== 'none') {
                        console.log('Modal displayed, initializing collapsible');
                        initializeCollapsible();
                    }
                }
                // 新しいエリアが追加されたかチェック
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) {
                            if (node.tagName === 'H4' && node.textContent.startsWith('エリア')) {
                                addToggle(node, document.querySelectorAll('#modal6 h4').length);
                            }
                            node.querySelectorAll('h4').forEach((areaHeader, index) => {
                                if (areaHeader.textContent.startsWith('エリア')) {
                                    addToggle(areaHeader, document.querySelectorAll('#modal6 h4').length + index);
                                }
                            });
                        }
                    });
                }
            });
        });

        observer.observe(modal, { attributes: true, childList: true, subtree: true });
    }

    // 初期化
    window.addEventListener('load', () => {
        // モーダルがすでに表示されている場合
        if (document.querySelector('#modal6')?.style.display !== 'none') {
            initializeCollapsible();
        }
        // モーダルの表示変更を監視
        observeModal();
    });
})();


})();

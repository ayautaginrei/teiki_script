// ==UserScript==
// @name         うさごや 整頓支援ツール
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  キーワードを登録して検索しやすくしたり一括選択機能
// @author       ayautaginrei(gemini)
// @match        https://rabbithutch.site/usagoya/filelist.php
// @upgradeURL
// @grant        none
// ==/UserScript==

// 登録したキーワードはドラッグで移動できます。
// 一括選択モードではチェックボックスをオンにした状態からドラッグでまとめて選択できます。

(function () {
    'use strict';

    const STORAGE_KEY = 'usagoya_filter_keywords';

    function loadKeywords() {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    }

    function saveKeywords(keywords) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(keywords));
    }

    const inputArea = document.querySelector('input[type="text"]');
    const controlPanel = document.createElement('div');
    controlPanel.style.margin = '10px 0';

    const keywordInput = document.createElement('input');
    keywordInput.type = 'text';
    keywordInput.placeholder = 'ワードを入力';
    keywordInput.style.marginRight = '5px';

    const addButton = document.createElement('button');
    addButton.textContent = 'ワードを追加';
    addButton.type = 'button';
    addButton.style.marginRight = '10px';

    const multiSelectBtn = document.createElement('button');
    multiSelectBtn.type = 'button';
    multiSelectBtn.textContent = 'まとめて選択モード：OFF';
    multiSelectBtn.style.cursor = 'pointer';
    multiSelectBtn.style.backgroundColor = '#555';
    multiSelectBtn.style.color = '#fff';
    multiSelectBtn.style.border = 'none';
    multiSelectBtn.style.padding = '4px 8px';
    multiSelectBtn.style.borderRadius = '3px';

    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '10px';

    let draggedItem = null;

    const target = inputArea?.parentElement;
    if (target) {
        controlPanel.appendChild(keywordInput);
        controlPanel.appendChild(addButton);
        controlPanel.appendChild(multiSelectBtn);
        controlPanel.appendChild(buttonContainer);
        target.appendChild(controlPanel);
    }

    function updateKeywordOrder() {
        const newKeywords = [];
        buttonContainer.querySelectorAll('div[style*="inline-flex"]').forEach(wrapper => {
            const word = wrapper.querySelector('button').textContent;
            newKeywords.push(word);
        });
        saveKeywords(newKeywords);
    }

    function createKeywordButton(word) {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'inline-flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.margin = '4px';
        wrapper.style.cursor = 'grab';
        wrapper.draggable = true;

        const btn = document.createElement('button');
        btn.textContent = word;
        btn.type = 'button';
        btn.style.marginRight = '4px';
        btn.style.pointerEvents = 'none';

        const delBtn = document.createElement('span');
        delBtn.textContent = '✕';
        delBtn.style.color = '#333';
        delBtn.style.cursor = 'pointer';
        delBtn.style.fontWeight = 'bold';
        delBtn.style.padding = '0 4px';
        delBtn.title = 'このワードを削除';

        wrapper.addEventListener('click', (e) => {
            if (e.target === delBtn) return;
            inputArea.value = word;
            inputArea.dispatchEvent(new Event('input'));
        });

        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const keywords = loadKeywords().filter(k => k !== word);
            saveKeywords(keywords);
            renderButtons();
        });

        wrapper.addEventListener('dragstart', function(e) {
            draggedItem = this;
            e.dataTransfer.effectAllowed = 'move';
            this.style.opacity = '0.5';
        });

        wrapper.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        wrapper.addEventListener('drop', function(e) {
            e.stopPropagation();
            if (draggedItem !== this) {
                const rect = this.getBoundingClientRect();
                const offset = e.clientX - rect.left;
                if (offset > rect.width / 2) {
                    this.after(draggedItem);
                } else {
                    this.before(draggedItem);
                }
                updateKeywordOrder();
            }
        });

        wrapper.addEventListener('dragend', function() {
            this.style.opacity = '1';
            draggedItem = null;
        });

        wrapper.appendChild(btn);
        wrapper.appendChild(delBtn);
        return wrapper;
    }

    function renderButtons() {
        buttonContainer.innerHTML = '';
        const keywords = loadKeywords();
        keywords.forEach(word => {
            const btn = createKeywordButton(word);
            buttonContainer.appendChild(btn);
        });
    }

    addButton.addEventListener('click', () => {
        const word = keywordInput.value.trim();
        if (!word) return;

        const keywords = loadKeywords();
        if (!keywords.includes(word)) {
            keywords.push(word);
            saveKeywords(keywords);
            renderButtons();
            keywordInput.value = '';
        }
    });

    renderButtons();

    let isModeOn = false;
    let isDragging = false;
    let targetState = true;

    multiSelectBtn.addEventListener('click', () => {
        isModeOn = !isModeOn;
        multiSelectBtn.textContent = `まとめて選択モード：${isModeOn ? 'ON' : 'OFF'}`;
        multiSelectBtn.style.backgroundColor = isModeOn ? '#007bff' : '#555';
    });

    document.addEventListener('mousedown', (e) => {
        if (!isModeOn) return;
        const fileList = document.querySelector('.filelist');
        if (!fileList || !fileList.contains(e.target)) return;

        const li = e.target.closest('li');
        if (li) {
            const checkbox = li.querySelector('input[type="checkbox"]');
            if (checkbox) {
                isDragging = true;
                if (e.target.tagName !== 'INPUT') {
                    checkbox.checked = !checkbox.checked;
                }
                targetState = checkbox.checked;
                e.preventDefault();
            }
        }
    });

    document.addEventListener('mouseover', (e) => {
        if (!isModeOn || !isDragging) return;
        const li = e.target.closest('li');
        if (li) {
            const checkbox = li.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.checked = targetState;
            }
        }
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

})();

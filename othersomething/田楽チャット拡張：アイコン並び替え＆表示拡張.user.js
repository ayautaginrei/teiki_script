// ==UserScript==
// @name         田楽チャット拡張：アイコン並び替え＆表示拡張
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  マイページでのアイコン並び替え機能とアイコン選択リストの表示領域拡張
// @author       ayautaginrei(gemini)
// @match        https://ironbunny.net/digi_nir/*
// @updateURL    https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/othersomething/%E7%94%B0%E6%A5%BD%E3%83%81%E3%83%A3%E3%83%83%E3%83%88%E6%8B%A1%E5%BC%B5%EF%BC%9A%E3%82%A2%E3%82%A4%E3%82%B3%E3%83%B3%E4%B8%A6%E3%81%B3%E6%9B%BF%E3%81%88%EF%BC%86%E8%A1%A8%E7%A4%BA%E6%8B%A1%E5%BC%B5.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        iconListMaxHeight: "1200px",
    };

    const addGlobalStyle = (css) => {
        const head = document.getElementsByTagName('head')[0];
        if (!head) return;
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = css;
        head.appendChild(style);
    };

    const customCss = `
        #icon_choice .icons {
            max-height: ${CONFIG.iconListMaxHeight} !important;
            overflow-y: auto !important;
        }
        #icon_sort_modal {
            z-index: 10001; background: rgba(0,0,0,0.8); display: none;
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            justify-content: center; align-items: center;
        }
        #icon_sort_modal .content_box {
            background: #1d202d; padding: 20px; border: 1px solid #444;
            max-width: 90%; max-height: 90%; display: flex;
            flex-direction: column; color: #ccc; border-radius: 4px;
        }
        #icon_sort_modal .icons {
            max-height: 60vh; overflow-y: auto; display: flex;
            flex-wrap: wrap; justify-content: center; padding: 0;
            list-style: none; margin: 10px 0;
        }
        #icon_sort_modal .icons li {
            margin: 5px; cursor: move; border: 2px solid transparent; transition: transform 0.1s;
        }
        #icon_sort_modal .icons li img { width: 60px; height: 60px; display: block; }
        #icon_sort_modal .icons li.dragging { opacity: 0.5; transform: scale(0.9); }
        #icon_sort_modal .icons li.over { border-color: #ff00ff; }
        .sort_modal_actions {
            margin-top: 10px; text-align: center; display: flex; justify-content: center; gap: 15px;
        }
    `;

    addGlobalStyle(customCss);

    const reindexInputs = (container) => {
        container.querySelectorAll('li').forEach((li, index) => {
            li.querySelectorAll('input').forEach(input => {
                const name = input.getAttribute('name');
                if (name) {
                    input.setAttribute('name', name.replace(/icon_sort\[\d+\]/, `icon_sort[${index}]`));
                    if (name.includes('[sort]')) input.value = index;
                }
            });
        });
    };

    const applySort = () => {
        const modalContainer = document.querySelector('#icon_sort_modal .icons');
        const originalContainer = document.querySelector('ul.prof_iconlist');
        const itemMap = {};

        originalContainer.querySelectorAll('li').forEach((li, i) => itemMap[i] = li);

        modalContainer.querySelectorAll('img').forEach(img => {
            const targetLi = itemMap[img.getAttribute('data-original-index')];
            if (targetLi) originalContainer.appendChild(targetLi);
        });

        reindexInputs(originalContainer);
        alert('並び順を変更しました。\nページ下部の「反映する」ボタンを押して保存してください。');
        document.getElementById('icon_sort_modal').style.display = 'none';
    };

    const initDragAndDrop = (container) => {
        let dragSrcEl = null;

        function handleDragStart(e) {
            this.classList.add('dragging');
            dragSrcEl = this;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);
        }
        function handleDragOver(e) {
            if (e.preventDefault) e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            this.classList.add('over');
            return false;
        }
        function handleDragLeave(e) { this.classList.remove('over'); }
        function handleDrop(e) {
            if (e.stopPropagation) e.stopPropagation();
            this.classList.remove('over');
            if (dragSrcEl !== this) {
                const parent = this.parentNode;
                const items = Array.from(parent.children);
                if (items.indexOf(dragSrcEl) < items.indexOf(this)) {
                    parent.insertBefore(dragSrcEl, this.nextSibling);
                } else {
                    parent.insertBefore(dragSrcEl, this);
                }
            }
            return false;
        }
        function handleDragEnd(e) {
            this.classList.remove('dragging');
            container.querySelectorAll('li').forEach(item => item.classList.remove('over'));
        }

        container.querySelectorAll('li').forEach(item => {
            item.setAttribute('draggable', 'true');
            item.addEventListener('dragstart', handleDragStart, false);
            item.addEventListener('dragover', handleDragOver, false);
            item.addEventListener('dragleave', handleDragLeave, false);
            item.addEventListener('drop', handleDrop, false);
            item.addEventListener('dragend', handleDragEnd, false);
        });
    };

    const openSortModal = () => {
        let modal = document.getElementById('icon_sort_modal');

        if (!modal) {
            const modalHtml = `
                <div id="icon_sort_modal">
                    <div class="content_box">
                        <h2>アイコン並び替え</h2>
                        <p class="small" style="margin-bottom:10px;">ドラッグ＆ドロップで入れ替え、適用ボタンを押してください。</p>
                        <ul class="icons"></ul>
                        <div class="sort_modal_actions">
                            <button type="button" class="close_sort"><span>キャンセル</span></button>
                            <button type="button" id="apply_icon_sort"><span>適用する</span></button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            modal = document.getElementById('icon_sort_modal');

            modal.querySelector('.close_sort').addEventListener('click', () => modal.style.display = 'none');
            document.getElementById('apply_icon_sort').addEventListener('click', applySort);
        }

        const sortContainer = modal.querySelector('.icons');
        const originalContainer = document.querySelector('ul.prof_iconlist');

        if (!originalContainer) {
            alert('アイコンリストが見つかりません');
            return;
        }

        sortContainer.innerHTML = '';
        originalContainer.querySelectorAll('li').forEach((li, index) => {
            const img = li.querySelector('img.ic_thumb');
            if (img) {
                const newLi = document.createElement('li');
                const newImg = document.createElement('img');
                newImg.src = img.src;
                newImg.setAttribute('data-original-index', index);
                newLi.appendChild(newImg);
                sortContainer.appendChild(newLi);
            }
        });

        initDragAndDrop(sortContainer);
        modal.style.display = 'flex';
    };

    window.addEventListener('load', () => {
        const addIconBtn = document.getElementById('add_icon');
        if (addIconBtn) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = 'open_sort_modal_btn';
            btn.style.marginLeft = "5px";
            btn.innerHTML = '<span>アイコン並び替え</span>';
            btn.onclick = openSortModal;
            addIconBtn.insertAdjacentElement('afterend', btn);
        }
    });

})();

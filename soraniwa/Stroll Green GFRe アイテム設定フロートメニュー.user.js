// ==UserScript==
// @name         Stroll Green GFRe アイテム設定フロートメニュー
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  アイテム設定ページのサブメニューをフロート化
// @author       ayautaginrei
// @match        https://soraniwa.428.st/gf/*
// @updateURL    https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/soraniwa/Stroll%20Green%20GFRe%20%E3%82%A2%E3%82%A4%E3%83%86%E3%83%A0%E8%A8%AD%E5%AE%9A%E3%83%95%E3%83%AD%E3%83%BC%E3%83%88%E3%83%A1%E3%83%8B%E3%83%A5%E3%83%BC.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const style = document.createElement('style');
    style.textContent = `
        #floatMenu {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 250px;
            background-color: rgba(255, 255, 255, 0.95);
            border: 2px solid #996633;
            border-radius: 10px;
            padding: 15px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            max-height: 90vh;
            overflow-y: auto;
            font-family: inherit;
        }

        #floatMenu .menu-title {
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #996633;
            color: #663322;
        }

        #floatMenu .menu-button {
            display: block;
            width: 100%;
            padding: 8px 12px;
            margin: 5px 0;
            background-color: #f5f5dc;
            border: 1px solid #996633;
            border-radius: 5px;
            cursor: pointer;
            text-align: left;
            font-size: 13px;
            color: #663322;
            transition: background-color 0.2s;
        }

        #floatMenu .menu-button:hover {
            background-color: #ffffcc;
        }

        #floatMenu .menu-section {
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px dashed #ccaa99;
        }

        #floatMenu .menu-section:last-child {
            border-bottom: none;
        }

        #floatMenu .submenu-container {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease;
            margin-top: 5px;
        }

        #floatMenu .submenu-container.active {
            max-height: 500px;
        }

        #floatMenu .submenu-button {
            display: block;
            width: 100%;
            padding: 6px 10px;
            margin: 3px 0;
            background-color: #fff8dc;
            border: 1px solid #ccaa99;
            border-radius: 3px;
            cursor: pointer;
            text-align: center;
            font-size: 12px;
            color: #663322;
        }

        #floatMenu .submenu-button:hover {
            background-color: #ffffe0;
        }

        #floatMenu .submenu-button.danger {
            background-color: #ffccdd;
        }

        #floatMenu .submenu-button.danger:hover {
            background-color: #ffaacc;
        }

        /* 元のボタンを非表示 */
        #switchgroupby,
        #openStorage,
        #openSelect,
        #detaillist {
            display: none !important;
        }
        `;

    document.head.appendChild(style);

    const floatMenu = document.createElement('div');
    floatMenu.id = 'floatMenu';
    floatMenu.innerHTML = `
        <div class="menu-title">メニュー</div>

        <button class="menu-button" id="float-switchgroupby">グループ表示切替</button>
        <button class="menu-button" id="float-detaillist">詳細/簡易切替</button>

        <button class="menu-button" id="float-openStorage">倉庫の操作 ▼</button>
        <div class="submenu-container" id="storage-submenu">
            <button class="menu-button" id="float-moveAllStorage">すべて倉庫に移動</button>
        </div>

        <button class="menu-button" id="float-openSelect">アイテムの一括操作 ▼</button>
        <div class="submenu-container" id="select-submenu">
            <button class="menu-button" id="float-useall">選択アイテムを使用</button>
            <button class="menu-button" id="float-storageall">選択アイテムを倉庫出し入れ</button>
            <button class="menu-button" id="float-removeall">選択アイテムを破棄</button>
        </div>
    `;
    document.body.appendChild(floatMenu);

    document.getElementById('float-switchgroupby').onclick = () =>
        document.getElementById('switchgroupby').click();

    document.getElementById('float-detaillist').onclick = () =>
        document.getElementById('detaillist').click();

    document.getElementById('float-openStorage').onclick = function() {
        document.getElementById('storage-submenu').classList.toggle('active');
    };

    document.getElementById('float-moveAllStorage').onclick = function() {
        const action = document.querySelector('input[name="action"][value="move_all_storage"]');
        if (action && confirm('すべてのアイテムを倉庫に移動しますか？')) {
            action.closest('form').submit();
        }
    };

    document.getElementById('float-openSelect').onclick = function() {
        document.getElementById('select-submenu').classList.toggle('active');
    };

    document.getElementById('float-useall').onclick = function() {
        const action = document.querySelector('input[name="action"][value="useall"]');
        if (!document.getElementById('multiitem').value) {
            alert('アイテムが選択されていません');
            return;
        }
        action.closest('form').submit();
    };

    document.getElementById('float-storageall').onclick = function() {
        const action = document.querySelector('input[name="action"][value="storageall"]');
        if (!document.getElementById('multiitem2').value) {
            alert('アイテムが選択されていません');
            return;
        }
        action.closest('form').submit();
    };

    document.getElementById('float-removeall').onclick = function() {
        const action = document.querySelector('input[name="action"][value="removeall"]');
        if (!document.getElementById('multiitem3').value) {
            alert('アイテムが選択されていません');
            return;
        }
        if (confirm('選択したアイテムをすべて破棄しますか？\nこの操作は取り消せません。')) {
            action.closest('form').submit();
        }
    };

    const containerStorage = document.getElementById('containerStorage');
    const containerSelect = document.getElementById('containerSelect');

    if (containerStorage) {
        containerStorage.style.display = 'none';
    }
    if (containerSelect) {
        containerSelect.style.display = 'none';
    }
})();

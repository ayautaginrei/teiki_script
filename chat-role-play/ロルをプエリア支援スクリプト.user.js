// ==UserScript==
// @name         ロルをプエリア支援スクリプト
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  チャット欄への場所タグ挿入機能と、サイドバーにエリア移動メニューを追加　ついでに入力内容保持機能を追加
// @author       ayautaginrei(Gemini)
// @match        https://wolfort.dev/*
// @updateURL    https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/chat-role-play/%E3%83%AD%E3%83%AB%E3%82%92%E3%83%97%E3%82%A8%E3%83%AA%E3%82%A2%E6%94%AF%E6%8F%B4%E3%82%B9%E3%82%AF%E3%83%AA%E3%83%97%E3%83%88.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // label: プルダウンの表示名
    // value: 実際に挿入される文字（#と色は自動付与されるため、場所名のみ記述）
    // ==========================================
    const LOCATION_LIST = [
        { label: "コテージ", value: "コテージ" },
        { label: "ラウンジ", value: "ラウンジ" },
        { label: "大回廊", value: "大回廊" },
        { label: "砂浜", value: "砂浜" },
        { label: "テラス", value: "テラス" },
        { label: "廃船", value: "廃船" },
        { label: "白亜灯台", value: "白亜灯台" },
        { label: "入り江", value: "入り江" },
        { label: "マーケット", value: "マーケット" },
        { label: "桟橋", value: "桟橋" },
        { label: "海", value: "海" },
    ];

    // ==========================================
    // 挿入するカラーコード
    // ==========================================
    const COLOR_CODE = "#00f";



    const STORAGE_KEY_PREFIX = "wolfort_draft_";

    const observer = new MutationObserver(() => {
        initWidgets();
        initSidebarMenu();
        initAutoSave();
        initSubmitListener();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    initWidgets();
    initSidebarMenu();
    setTimeout(restoreData, 500);

    function getGameId() {
        const match = window.location.href.match(/games\/(\d+)/);
        return match ? match[1] : 'default';
    }

    function initAutoSave() {
        const textarea = document.querySelector('textarea[name="talkMessage"]');
        if (!textarea || textarea.dataset.hasSaveHandler) return;

        textarea.dataset.hasSaveHandler = "true";
        textarea.addEventListener('input', () => {
            const data = {
                text: textarea.value,
                timestamp: Date.now()
            };
            localStorage.setItem(STORAGE_KEY_PREFIX + getGameId(), JSON.stringify(data));
        });
    }

    function restoreData() {
        const savedJson = localStorage.getItem(STORAGE_KEY_PREFIX + getGameId());
        if (!savedJson) return;

        const data = JSON.parse(savedJson);
        const textarea = document.querySelector('textarea[name="talkMessage"]');

        if (textarea && data.text && textarea.value === "") {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
            nativeInputValueSetter.call(textarea, data.text);
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    function initSubmitListener() {
        document.body.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' && e.target.textContent.includes('発言する')) {
                localStorage.removeItem(STORAGE_KEY_PREFIX + getGameId());
            }
        }, true);
    }

    function initWidgets() {
        const decorators = document.querySelectorAll('p.text-xs.font-bold');
        decorators.forEach(label => {
            if (label.textContent !== '発言装飾') return;
            const container = label.nextElementSibling;
            if (!container || !container.classList.contains('flex') || container.querySelector('.custom-location-inserter')) return;

            const wrapper = document.createElement('span');
            wrapper.className = 'custom-location-inserter';
            const select = document.createElement('select');
            select.className = "base-border ml-1 border p-1 text-xs text-gray-700";

            const urlParams = new URLSearchParams(window.location.search);
            const currentMkParam = decodeURIComponent(urlParams.get('mk') || '').replace(/^#/, '');

            select.add(new Option("[エリア]", ""));
            LOCATION_LIST.forEach(item => {
                const opt = new Option(item.label, item.value);
                if (currentMkParam && item.value === currentMkParam) opt.selected = true;
                select.add(opt);
            });

            const button = document.createElement('button');
            button.className = "base-border ml-1 min-w-[24px] rounded-sm border p-1 text-xs hover:bg-blue-300";
            button.textContent = "挿入";
            button.onclick = (e) => {
                e.preventDefault();
                if (!select.value) return;
                const textarea = container.closest('form').querySelector('textarea[name="talkMessage"]');
                if (textarea) insertTextAtCursor(textarea, `[${COLOR_CODE}]#${select.value}[/#]`);
            };

            wrapper.appendChild(select);
            wrapper.appendChild(button);
            container.querySelector('div').appendChild(wrapper);
        });
    }

    function insertTextAtCursor(textarea, text) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const val = textarea.value;
        const newVal = val.substring(0, start) + text + val.substring(end);
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        setter.call(textarea, newVal);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.setSelectionRange(start + text.length, start + text.length);
        textarea.focus();
    }

    function initSidebarMenu() {
        const sidebar = document.querySelector('nav.sidebar-background');
        if (!sidebar || sidebar.querySelector('.custom-area-menu-container')) return;

        const container = document.createElement('div');
        container.className = 'base-border border-t py-2 custom-area-menu-container';
        container.innerHTML = `<div class="sidebar-text flex w-full justify-start px-4 py-2 text-sm font-bold">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="mr-1 h-5 w-5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
            <p class="flex-1 self-center text-left">エリア移動</p></div>`;

        const listContainer = document.createElement('div');
        listContainer.style.paddingLeft = '1rem';

        const addBtn = (label, val) => {
            const btn = document.createElement('button');
            btn.className = 'sidebar-hover sidebar-text flex w-full justify-start px-4 py-1 text-xs';
            btn.textContent = label;
            btn.style.width = '100%';
            btn.style.textAlign = 'left';
            btn.onclick = (e) => {
                e.preventDefault();
                const m = window.location.href.match(/^(https:\/\/wolfort\.dev\/chat-role-play\/games\/\d+)/);
                if (m) window.location.href = val ? `${m[1]}?mk=%23${val}` : m[1];
            };
            listContainer.appendChild(btn);
        };

        addBtn("全体", null);
        LOCATION_LIST.forEach(item => addBtn(item.label, item.value));
        container.appendChild(listContainer);
        sidebar.appendChild(container);
    }
})();

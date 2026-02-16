// ==UserScript==
// @name         ロルをプ発言窓移動奴
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  発言・ト書き欄を上部に移動し、それぞれの開閉状態を個別に記憶します
// @author       ayautaginrei(Gemini)
// @match        https://wolfort.dev/*
// @updateURL    https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/chat-role-play/%E3%83%AD%E3%83%AB%E3%82%92%E3%83%97%E7%99%BA%E8%A8%80%E7%AA%93%E7%A7%BB%E5%8B%95%E5%A5%B4.user.js
// @include      */games/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const TARGET_IDS = [
        'talk-area-home', // ホーム
        'talk-area-tome' // 自分宛
    ];

    const STORAGE_PREFIX = 'wolf_chat_state_';

    const style = document.createElement('style');
    style.textContent = `
        .wolf-input-wrapper {
            background: var(--background, #242424);
            border-bottom: 1px solid #767676;
            margin-bottom: 10px;
            padding-bottom: 5px;
        }

        .wolf-moved-input {
            border-top: none !important;
            margin-top: 0 !important;
        }

        .wolf-input-wrapper .m-4 {
            margin-top: 0.5rem !important;
            margin-bottom: 0.5rem !important;
        }
    `;
    document.head.appendChild(style);

    function processTarget(targetId) {
        const targetNode = document.getElementById(targetId);

        if (!targetNode) return;

        if (targetNode.parentNode.classList.contains('wolf-input-wrapper')) return;

        const parent = targetNode.parentNode;

        const wrapper = document.createElement('div');
        wrapper.className = 'wolf-input-wrapper';
        wrapper.id = 'wrapper-for-' + targetId;

        parent.insertBefore(wrapper, parent.firstChild);
        wrapper.appendChild(targetNode);

        targetNode.classList.add('wolf-moved-input');

        const detailsList = targetNode.querySelectorAll('details');

        detailsList.forEach((details, index) => {
            const storageKey = `${STORAGE_PREFIX}${targetId}_${index}`;

            const storedState = localStorage.getItem(storageKey);
            if (storedState !== null) {
                if (storedState === 'true') {
                    details.setAttribute('open', '');
                } else {
                    details.removeAttribute('open');
                }
            }

            if (!details.dataset.wolfObserved) {
                details.addEventListener('toggle', () => {
                    localStorage.setItem(storageKey, details.open);
                });
                details.dataset.wolfObserved = "true";
            }
        });
    }

    function init() {
        TARGET_IDS.forEach(id => processTarget(id));
    }

    const observer = new MutationObserver(() => {
        const needsUpdate = TARGET_IDS.some(id => {
            const node = document.getElementById(id);
            return node && !node.classList.contains('wolf-moved-input');
        });

        if (needsUpdate) {
            init();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 初回実行
    init();

})();

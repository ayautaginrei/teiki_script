// ==UserScript==
// @name         ロルをプ発言窓移動奴
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  発言・ト書き欄を上部に移動し、それぞれの開閉状態を個別に記憶します
// @author       ayautaginrei(Gemini)
// @match        https://wolfort.dev/*
// @updateURL    https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/chat-role-play/%E3%83%AD%E3%83%AB%E3%82%92%E3%83%97%E7%99%BA%E8%A8%80%E7%AA%93%E7%A7%BB%E5%8B%95%E5%A5%B4.user.js
// @include      */games/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ■ 設定
    const TARGET_ID = 'talk-area-home';
    const STORAGE_PREFIX = 'wolf_chat_details_state_';

    // ■ スタイル定義
    const style = document.createElement('style');
    style.textContent = `
        /* 移動先のラッパー（外枠） */
        #wolf-input-wrapper {
            background: var(--background, #242424);
            border-bottom: 1px solid #767676;
            margin-bottom: 10px;
            padding-bottom: 5px;
        }

        #talk-area-home {
            border-top: none !important;
            margin-top: 0 !important;
        }

        #wolf-input-wrapper .m-4 {
            margin-top: 0.5rem !important;
            margin-bottom: 0.5rem !important;
        }
    `;
    document.head.appendChild(style);

    // ■ メイン処理
    function init() {
        const targetNode = document.getElementById(TARGET_ID);

        if (!targetNode) return;

        let wrapper = document.getElementById('wolf-input-wrapper');
        if (!wrapper) {
            const parent = targetNode.parentNode;

            wrapper = document.createElement('div');
            wrapper.id = 'wolf-input-wrapper';

            parent.insertBefore(wrapper, parent.firstChild);
            wrapper.appendChild(targetNode);
        }

        const detailsList = targetNode.querySelectorAll('details');

        detailsList.forEach((details, index) => {
            const storageKey = STORAGE_PREFIX + index;

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

    const observer = new MutationObserver(() => {
        if (document.getElementById(TARGET_ID)) {
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

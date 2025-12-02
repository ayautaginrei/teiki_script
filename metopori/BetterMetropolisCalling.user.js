// ==UserScript==
// @name         BetterMetropolisCalling
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  見やすいUIに調整（半透明ボックス・枠・余白追加）＋スキル説明の自動表示
// @match        https://metropolis-c-openbeta.sakuraweb.com/*
// @update       https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/metopori/BetterMetropolisCalling.user.js
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    // ==========================================
    //  1. CSSスタイル設定
    // ==========================================
    GM_addStyle(`
        /* --- 既存のスタイル設定 --- */

        /* ページ全体の読みやすさ向上 */
        body {
            backdrop-filter: blur(3px);
            padding: 40px;
            background-attachment: fixed
        }

        /* 上部リンクバーの背景 */
        .links {
            background: rgba(0,0,0,0.2);
            padding: 10px 15px;
            border-radius: 6px;
            display: inline-block;
            margin-bottom: 20px;
        }

        /* 個別セクションの共通ボックス */
        .section-box {
            background: rgba(255,255,255,0.5);
            padding: 15px 20px;
            margin: 20px 0;
            border-radius: 8px;
            border: 1px solid #ccc;
        }

        /* プロフィール画像の部分をボックス化 */
        .profile-area {
            display: flex;
            gap: 20px;
            align-items: flex-start;
        }

        /* フォーム全体をボックスで囲む */
        form {
            background: rgba(255,255,255,0.5);
            padding: 20px;
            margin-top: 20px;
            border-radius: 10px;
            border: 1px solid #ccc;
        }

        /* アイコン群のボックス */
        .icon-column {
            width: 420px;
            background: rgba(255,255,255,0.5);
            padding: 10px;
            border: 1px solid #bbb;
            border-radius: 8px;
        }

        .icon-block {
            background: rgba(250,250,250,0.7);
            padding: 10px;
            border-radius: 6px;
            border: 1px solid #ccc !important;
        }

        /* 入力欄の視認性アップ */
        input[type="text"], textarea, select {
            background: rgba(255,255,255,0.9);
            border: 1px solid #aaa;
            padding: 4px;
            border-radius: 4px;
        }

        /* --- 新規追加: スキル説明表示用のスタイル --- */
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
    `);

    // ==========================================
    //  2. スキル説明自動表示機能
    // ==========================================
    window.addEventListener('load', function() {
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


        const skillSelects = document.querySelectorAll('select[name^="skill"]:not([name*="_icon"]):not([name*="_msg"]):not([name*="_cutin"])');

        skillSelects.forEach(select => {
            const descBox = document.createElement('div');
            descBox.className = 'skill-desc-preview';
            descBox.textContent = '---'; //

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
    });

})();


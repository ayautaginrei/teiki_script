// ==UserScript==
// @name         BetterMetropolisCalling
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  CSS追加、スキル説明の自動表示、ストーリーページの表示改善
// @match        https://metropolis-c-openbeta.sakuraweb.com/*
// @update       https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/metopori/BetterMetropolisCalling.user.js
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

// ==========================================
//  CSSスタイル設定
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
//  ページングコピー
// ==========================================

        function duplicatePagination() {
            if (!location.pathname.includes("userlist") &&
                !location.pathname.includes("characterlist") &&
                !document.querySelector(".pagination")) return;

            const linksArea = document.querySelector(".links");
            const pagination = document.querySelector(".pagination");
            if (!linksArea || !pagination) return;

            const clone = pagination.cloneNode(true);
            clone.style.marginBottom = "15px";
            clone.style.marginTop = "10px";

            linksArea.insertAdjacentElement("afterend", clone);
        }
        duplicatePagination();


// ==========================================
//  ストーリーページ改善
// ==========================================

        function enhanceScenarioSelect() {
        const select = document.querySelector('select[name="scenario_key"]');
        if (!select) return;

        const options = Array.from(select.querySelectorAll("option"));

        const mains = [];
        const subs = [];

        options.forEach(opt => {
            const text = opt.textContent;
            if (text.includes("メイン")) mains.push(opt);
            else subs.push(opt);
        });

        const latestMain = mains[mains.length - 1];

        mains.forEach(opt => {
            const t = opt.textContent.replace(/^★\s*/, "").trim();
            if (opt === latestMain) {
                opt.textContent = "★ " + t;
            } else {
                opt.textContent = t;
            }
        });
        subs.forEach(opt => {
            opt.textContent = opt.textContent.replace(/^★\s*/, "").trim();
        });

        const mainGroup = document.createElement("optgroup");
        mainGroup.label = "【メイン】";
        mains.forEach(opt => mainGroup.appendChild(opt));

        const subGroup = document.createElement("optgroup");
        subGroup.label = "【サブ】";
        subs.forEach(opt => subGroup.appendChild(opt));

        select.innerHTML = "";
        select.appendChild(mainGroup);
        select.appendChild(subGroup);

        if (latestMain) latestMain.selected = true;


        const display = document.createElement("div");
        display.style.margin = "8px 0 12px 0";
        display.style.fontWeight = "bold";
        select.insertAdjacentElement("afterend", display);

        function updateMemberCount() {
            const checked = document.querySelectorAll('input[name="members[]"]:checked').length;

            const selfCount = 1;
            const total = checked + selfCount;

            const selectedTxt = select.options[select.selectedIndex].textContent;
            const maxMatch = selectedTxt.match(/（(\d+)人まで）/);
            const max = maxMatch ? Number(maxMatch[1]) : "?";

            display.textContent = `出撃するキャラクター人数：${total} / ${max}`;
        }

        document.querySelectorAll('.user-card').forEach(card => {
            const img = card.querySelector('img');
            const cb = card.querySelector('input[type="checkbox"]');
            if (img && cb) {
                img.style.cursor = "pointer";
                img.addEventListener("click", () => {
                    cb.checked = !cb.checked;
                    cb.dispatchEvent(new Event("change"));
                });
            }
        });

        document.querySelectorAll('input[name="members[]"]').forEach(cb => {
            cb.addEventListener("change", updateMemberCount);
        });

        select.addEventListener("change", updateMemberCount);

        updateMemberCount();
        }
        enhanceScenarioSelect();



// ==========================================
//  スキルプレビュー
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
        });

})();


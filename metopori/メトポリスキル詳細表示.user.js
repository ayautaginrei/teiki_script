// ==UserScript==
// @name         メトポリスキル詳細表示
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  スキル名を探して詳細ツールチップを付与
// @match        https://metropolis-c-openbeta.sakuraweb.com/*
// @update       
// @grant        GM_xmlhttpRequest
// @connect      docs.google.com
// @connect      googleusercontent.com
// @connect      *.googleusercontent.com
// ==/UserScript==

(function () {
    "use strict";

    const CSV_URL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vR1eCvodGRCc8sYbEg-OeOLOntIxXaJvzuwxCAf7JghdH6rzk16xSDJvUaA3S-G5ObwKWJhulTDMutb/pub?gid=988778503&single=true&output=csv";

    let skillData = {};
    let skillNames = [];
    let observerTimeout = null;
    let tooltipEl = null;

    // ツールチップ要素の作成
    function createTooltipElement() {
        if (document.getElementById('m-skill-tooltip')) return;
        tooltipEl = document.createElement("div");
        tooltipEl.id = 'm-skill-tooltip';
        // サイトのCSS干渉を防ぐため、top/left/marginを0で初期化
        tooltipEl.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            margin: 0;
            background: rgba(0, 0, 0, 0.9);
            color: #ffffff;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            line-height: 1.4;
            z-index: 2147483647; /* 最大値にして最前面へ */
            pointer-events: none;
            display: none;
            max-width: 350px;
            white-space: pre-wrap;
            box-shadow: 0 4px 8px rgba(0,0,0,0.5);
            font-family: sans-serif;
            text-align: left;
        `;

        document.documentElement.appendChild(tooltipEl);
    }

    // CSVパース
    function parseCSV(text) {
        const rows = text.split(/\r\n|\n|\r/).map(r =>
            r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, "").trim())
        );
        return rows;
    }

    // ツールチップテキストの構築
    function buildTooltip(row) {
        if (!row || row.length < 5) return "";
        const [cond, name, timing, cost, effect] = row.map(v => v ? v.trim() : "");

        const mainParts = [name, timing, cost, effect].filter(v => v).join(" ");
        // 条件を // 区切りで結合
        return cond ? `${mainParts} // ${cond}` : mainParts;
    }

    function loadSkillData() {
        GM_xmlhttpRequest({
            method: "GET",
            url: CSV_URL,
            onload: res => {
                const csv = parseCSV(res.responseText);

                for (let i = 1; i < csv.length; i++) {
                    const row = csv[i];
                    if (row.length < 2) continue;
                    const name = row[1];
                    if (!name) continue;
                    skillData[normalizeText(name)] = buildTooltip(row);
                }

                skillNames = Object.keys(skillData).sort((a, b) => b.length - a.length);
                observeDOM();
                applyTooltips();
            },
            onerror: err => {}
        });
    }

    function normalizeText(text) {
        return text.replace(/\s+/g, "").replace(/　+/g, "").trim();
    }

    function applyTooltips() {
        if (skillNames.length === 0) return;
        const all = document.querySelectorAll("body *:not([data-skill-checked])");

        all.forEach(el => {
            el.setAttribute("data-skill-checked", "true");
            if (["SCRIPT", "STYLE", "INPUT", "TEXTAREA", "SELECT", "IMG", "SVG"].includes(el.tagName)) return;
            if (el.children.length > 0) return;

            const raw = el.textContent;
            if (!raw) return;

            const normalized = normalizeText(raw);

            if (skillData.hasOwnProperty(normalized)) {
                el.setAttribute("data-tooltip-content", skillData[normalized]);
                el.style.borderBottom = "1px dotted #6cf";
                el.style.cursor = "help";
                el.setAttribute("data-skill-match", "true");

                if (el.hasAttribute('title')) {
                    el.removeAttribute('title');
                }
            }
        });
    }

    /** マウスイベントの管理 */
    function setupEventListeners() {

        // ターゲットまたはその親からスキル要素を探す
        function findSkillElement(target) {
            let el = target;
            let limit = 5;
            while (el && el !== document.body && limit > 0) {
                if (el.hasAttribute && el.hasAttribute('data-skill-match')) {
                    return el;
                }
                el = el.parentElement;
                limit--;
            }
            return null;
        }

        document.body.addEventListener('mouseover', (e) => {
            const skillEl = findSkillElement(e.target);

            if (skillEl) {
                const text = skillEl.getAttribute('data-tooltip-content');
                if (text && tooltipEl) {
                    tooltipEl.innerHTML = text.replace(' // ', '<br><span style="color: #bbb; font-size: 0.9em;">// </span>');
                    tooltipEl.style.display = 'block';
                }
            }
        });

        document.body.addEventListener('mousemove', (e) => {
            if (tooltipEl && tooltipEl.style.display === 'block') {
                const offset = 15; // カーソルからの距離

                let x = e.clientX + offset;
                let y = e.clientY + offset;

                if (x + tooltipEl.offsetWidth > window.innerWidth - 10) {
                    x = e.clientX - tooltipEl.offsetWidth - offset;
                }

                if (y + tooltipEl.offsetHeight > window.innerHeight - 10) {
                    y = e.clientY - tooltipEl.offsetHeight - offset;
                }

                tooltipEl.style.left = `${x}px`;
                tooltipEl.style.top = `${y}px`;
            }
        });

        document.body.addEventListener('mouseout', (e) => {
            const skillEl = findSkillElement(e.target);
            if (skillEl && !skillEl.contains(e.relatedTarget)) {
                 if (tooltipEl) {
                    tooltipEl.style.display = 'none';
                }
            }
        });
    }

    function observeDOM() {
        const observer = new MutationObserver((mutations) => {
            const isSelfChange = mutations.every(m =>
                m.type === 'attributes' &&
                (m.attributeName.startsWith('data-') || m.attributeName === 'style')
            );

            if (isSelfChange) return;

            if (observerTimeout) clearTimeout(observerTimeout);
            observerTimeout = setTimeout(() => {
                applyTooltips();
            }, 500);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'id']
        });
    }

    window.addEventListener("load", () => {
        createTooltipElement();
        setupEventListeners();
        loadSkillData();
    });
})();

// ==UserScript==
// @name         めいきっと！店舗巡回アシスタント
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  ショップID指定移動・前後移動スクリプト
// @author       ayautaginrei
// @match        https://sapphiredevil.sakura.ne.jp/makeit/btest/public_html/*
// @updateURL    
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        // 施設が存在しないページを判定するためのキーワード
        detect404Keywords: ['施設が存在しません', '404', 'not found', 'エラー']
    };

    let currentShopId = null;
    let baseUrl = null;

    // ================== URL解析 ==================
    function parseUrl() {
        const url = window.location.href;
        const match = url.match(/[?&]shop_id=(\d+)/);
        if (!match) return false;
        currentShopId = parseInt(match[1], 10);
        baseUrl = url.replace(/([?&]shop_id=)\d+/, '$1');
        return true;
    }

    function getUrl(shopId) {
        return `${baseUrl}${Math.max(1, parseInt(shopId, 10) || 1)}`;
    }

    // ================== 404(エラー)判定 ==================
    function is404Page() {
        const bodyText = (document.body?.innerText || '').substring(0, 1200);
        return CONFIG.detect404Keywords.some(kw => bodyText.includes(kw));
    }

    // ================== ページ移動 ==================
    function goTo(shopId) {
        if (!baseUrl) return;
        window.location.href = getUrl(shopId);
    }

    // ================== UI追加 ==================
    function addUI() {
        const sidebar = document.getElementById('sidebar');
        const panel = document.createElement('div');

        if (sidebar && !is404Page()) {
            // 通常ページのサイドバーにUIを追加
            panel.style.cssText = `padding:15px;margin:10px 0;border-top:1px dashed rgba(255,255,255,0.2);color:rgba(255,255,255,0.9);display:flex;flex-direction:column;gap:10px;`;
            panel.innerHTML = `
                <div style="font-weight:bold;font-size:0.9rem;">ショップ巡回</div>
                <div style="display:flex;align-items:center;gap:5px;">
                    <span style="font-size:0.85em;">ID:</span>
                    <input id="shopIdInput" type="number" value="${currentShopId}"
                        style="width:65px;background:rgba(0,0,0,0.2);color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:4px;padding:4px;">
                    <button id="goButton" style="flex:1;padding:5px;">移動</button>
                </div>
                <div style="display:flex;gap:5px;">
                    <button id="prev" style="flex:1;">← 前</button>
                    <button id="next" style="flex:1;">次 →</button>
                </div>
            `;
            const footer = sidebar.querySelector('.sidebar-footer');
            if (footer) sidebar.insertBefore(panel, footer);
            else sidebar.appendChild(panel);
        } else {
            // エラーページ（施設が存在しません等）の場合、右下にフローティングパネルを表示
            panel.style.cssText = `
                position:fixed;bottom:20px;right:20px;z-index:99999;
                background:rgba(50,50,60,0.97);color:#fff;padding:14px 18px;
                border-radius:10px;box-shadow:0 6px 25px rgba(0,0,0,0.8);
                display:flex;flex-direction:column;gap:10px;min-width:200px;
            `;
            panel.innerHTML = `
                <div style="font-weight:bold;color:#ff8888;">店舗が見つかりません</div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <input id="shopIdInput" type="number" value="${currentShopId}"
                        style="flex:1;background:#222;color:#fff;border:1px solid #777;padding:6px;border-radius:4px;">
                    <button id="goButton">移動</button>
                </div>
                <div style="display:flex;gap:6px;">
                    <button id="prev" style="flex:1;padding:8px;">← 前</button>
                    <button id="next" style="flex:1;padding:8px;">次 →</button>
                </div>
            `;
            document.body.appendChild(panel);
        }

        // イベントリスナーの登録
        const input = document.getElementById('shopIdInput');
        if (input) input.addEventListener('keypress', e => { if (e.key === 'Enter') goTo(input.value); });

        const goBtn = document.getElementById('goButton');
        if (goBtn) goBtn.onclick = () => goTo(input?.value);

        const prevBtn = document.getElementById('prev');
        if (prevBtn) prevBtn.onclick = () => goTo(currentShopId - 1);

        const nextBtn = document.getElementById('next');
        if (nextBtn) nextBtn.onclick = () => goTo(currentShopId + 1);
    }

    // ================== メイン処理 ==================
    function main() {
        if (!parseUrl()) return;
        // 既にUIが追加されている場合は重複実行を防止
        if (document.getElementById('shopIdInput')) return;

        addUI();
        setupKeyboard();
    }

    // 読み込み時およびDOM変化時に実行
    window.addEventListener('load', main);
    new MutationObserver(main).observe(document.documentElement, { childList: true, subtree: true });
})();

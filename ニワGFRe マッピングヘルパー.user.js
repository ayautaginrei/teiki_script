// ==UserScript==
// @name         ニワGFRe マッピングヘルパー
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  ニワGFReのマップ情報をスプレッドシートに対応した形式でコピーし、貼り付け座標も通知します。
// @author       ayautaginrei(gemini)
// @match        https://soraniwa.428.st/gf/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // カラーコードと番号の対応表
    const COLOR_TO_NUMBER_MAP = {
        '#bbbbbb': 1,  '#eedd99': 2,  '#55bb55': 3,  '#88dd77': 3,
        '#ffee44': 4,  '#55ccee': 5,  '#228b22': 6,  '#33aa33': 6,
        '#906030': 7,  '#99ccff': 8,  '#1166dd': 9,  '#555566': 10,
        '#44dddd': 11, '#dd5522': 12, '#305020': 13, '#ff00ff': 0,
        '#221005': 0
    };

    // RGBをHEXに変換する関数
    function rgbToHex(rgb) {
        if (!rgb || rgb === 'rgba(0, 0, 0, 0)') return "";
        const match = rgb.match(/\d+/g);
        if (!match) return "";
        return "#" + match.map(x => parseInt(x).toString(16).padStart(2, '0')).join('').toLowerCase();
    }

    // メインの処理
    function copyMapData() {
        const mapContainer = document.querySelector('.strollmaparea_close');
        if (!mapContainer) {
            alert('マップのコンテナ(.strollmaparea_close)が見つかりませんでした。');
            return;
        }

        const mapTiles = Array.from(mapContainer.children).filter(el => el.tagName === 'SPAN' && el.style.backgroundColor);
        if (mapTiles.length === 0) {
            alert('マップタイルが見つかりませんでした。');
            return;
        }

        const mapData = mapTiles.map(tile => {
            const color = rgbToHex(tile.style.backgroundColor);
            if (COLOR_TO_NUMBER_MAP[color] !== undefined) {
                return COLOR_TO_NUMBER_MAP[color];
            } else {
                console.log(`[マップデータ抽出] 未知のカラーコード: ${color}`);
                return 0;
            }
        });

        const xElement = document.getElementById('map_x');
        const yElement = document.getElementById('map_y');
        let positionInfo = '';

        if (xElement && yElement) {
            const currentX = parseInt(xElement.textContent, 10);
            const currentY = parseInt(yElement.textContent, 10);
            // 座標が正常に取得できた場合のみ計算
            if (!isNaN(currentX) && !isNaN(currentY)) {
                const pasteX = currentX - 7;
                const pasteY = currentY - 7;
                positionInfo = `\n貼り付け位置 = ( x:${pasteX}, y:${pasteY} )`;
            }
        }

        let mapDataString = '';
        for (let i = 0; i < mapData.length; i++) {
            mapDataString += mapData[i];
            if ((i + 1) % 15 === 0) {
                if (i < mapData.length - 1) mapDataString += '\n';
            } else {
                mapDataString += '\t';
            }
        }

        navigator.clipboard.writeText(mapDataString).then(() => {
            alert(`マップデータ(${mapTiles.length}マス)をコピーしました。${positionInfo}`);
        }).catch(err => {
            console.error('コピーに失敗しました:', err);
            alert('マップデータのコピーに失敗しました。');
        });
    }

    // ボタンを作成して配置
    function createCopyButton() {
        if (document.getElementById('map-copy-button')) return;

        const copyButton = document.createElement('div');
        copyButton.id = 'map-copy-button';
        copyButton.className = 'queryButton';
        copyButton.style.cssText = 'margin-left: 10px; padding: 0px 8px;';
        copyButton.innerHTML = '<i class="ri-clipboard-line"></i>';
        copyButton.setAttribute('data-ctip', 'マップをシート形式でコピー');
        copyButton.addEventListener('click', copyMapData);

        const targetElement = document.getElementById('iconmute');
        if (targetElement && targetElement.parentNode) {
            targetElement.parentNode.insertBefore(copyButton, targetElement.nextSibling);
        } else {
            setTimeout(createCopyButton, 500);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createCopyButton);
    } else {
        createCopyButton();
    }
})();
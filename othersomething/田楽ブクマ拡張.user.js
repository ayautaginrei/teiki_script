// ==UserScript==
// @name         田楽ブクマ拡張
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  ブックマークの拡張（並び替え・文字色変更・通知ミュート）
// @author       ayautaginrei(gemini)
// @match        https://ironbunny.net/digi_nir/*
// @update       
// @icon         https://ironbunny.net/digi_nir/imgs/favicon.ico
// @require      https://code.jquery.com/jquery-3.7.1.min.js
// @require      https://code.jquery.com/ui/1.13.3/jquery-ui.min.js
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

/*--- jQuery UIのCSSを読み込む ---*/
// @require      https://code.jquery.com/ui/1.13.3/themes/base/jquery-ui.css

(function() {
    'use strict';

    // 文字色の定義
    const TEXT_COLORS = [
        '',         // Default
        '#ff6b6b',  // Red
        '#51cf66',  // Green
        '#339af0',  // Blue
        '#fcc419',  // Yellow
        '#e0aaff'   // Purple
    ];

    // 除外するシステム項目のキーワード
    const SYSTEM_KEYWORDS = ['現在地をブックマークに追加', '現在地をブックマークから削除'];

    const SHARED_KEY = 'shared';

    // --- メイン処理 ---
    $(document).ready(function() {
        const $bookmarkList = $('.logs.bookmarks .activity');
        if ($bookmarkList.length > 0) {
            initializeBookmarkFeature($bookmarkList);
        }
    });

    /**
     * ブックマーク機能の初期化
     */
    function initializeBookmarkFeature($list) {
        addBookmarkStyles();
        initializeBookmarks($list);
        setupSortable($list);
    }

    /**
     * スタイルの追加
     */
    function addBookmarkStyles() {
        GM_addStyle(`
            /* ブックマークリストのレイアウト調整 */
            .logs.bookmarks .activity li {
                display: flex !important;
                align-items: center;
                transition: color 0.2s;
                padding: 4px 0;
                border-bottom: 1px dashed #444;
            }

            /* ドラッグハンドル */
            .drag-handle {
                cursor: grab;
                color: #666;
                padding: 0 8px;
                font-size: 1.2em;
                line-height: 1;
                user-select: none;
            }

            /* 未読ミュートチェックボックス */
            .unread-toggle {
                margin-left: auto;
                margin-right: 5px;
                cursor: pointer;
            }

            /* リンク部分の調整 */
            .logs.bookmarks .activity li a {
                flex-grow: 1;
                margin-left: 4px;
                display: inline-block;
                text-decoration: none;
                color: inherit;
            }

            /* ドラッグ中のスタイル */
            .ui-sortable-helper {
                opacity: 0.95;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
                cursor: grabbing;
                background-color: #222;
                border: 1px solid #666;
            }
            .ui-state-highlight {
                height: 2.5em;
                background-color: rgba(255, 255, 255, 0.05);
                border: 1px dashed #888;
                border-radius: 4px;
                margin: 2px 0;
            }

            /* システム項目（追加・削除ボタン）のスタイル微調整（必要なら） */
            .system-item {
                border-bottom: 1px solid #666 !important; /* 区切りを少し強く */
                margin-bottom: 4px;
            }
        `);

        // 文字色定義のCSS追加
        let colorStyles = '';
        TEXT_COLORS.forEach((color, index) => {
            if (index > 0) {
                colorStyles += `.text-color-${index} { color: ${color} !important; }`;
            }
        });
        GM_addStyle(colorStyles);
    }

    /**
     * 各ブックマーク項目の初期化
     */
    function initializeBookmarks($list) {
        // 1. 並び順の復元 (共有キーを使用)
        const savedOrder = GM_getValue(`bookmarkOrder_${SHARED_KEY}`, []);
        if (savedOrder.length > 0) {
            const itemMap = new Map($list.children('li').get().map(li => [getBookmarkId($(li)), $(li)]));
            savedOrder.forEach(id => {
                if (itemMap.has(id)) {
                    $list.append(itemMap.get(id));
                }
            });
        }

        // 2. 各項目の設定ループ
        $list.children('li').each(function() {
            const $li = $(this);
            const linkText = $li.text();

            // --- システム項目の判定 ---
            // テキストにキーワードが含まれていればシステム項目とみなす
            const isSystemItem = SYSTEM_KEYWORDS.some(keyword => linkText.includes(keyword));

            if (isSystemItem) {
                $li.addClass('system-item');
                $li.prependTo($list);
                return;
            }

            // --- 以下、通常のブックマーク項目の処理 ---

            const bookmarkId = getBookmarkId($li);

            // ハンドルを追加
            $li.prepend('<span class="drag-handle">☰</span>');

            // 元々の未読状態を記憶
            const wasOriginallyUnread = $li.hasClass('unread');
            $li.data('was-unread', wasOriginallyUnread);

            // --- ミュート機能 ---
            const isMuted = GM_getValue(`mute_${SHARED_KEY}_${bookmarkId}`, false);
            const $checkbox = $('<input type="checkbox" class="unread-toggle" title="通知(未読)をミュート">').prop('checked', isMuted);
            $li.append($checkbox);

            if (isMuted) {
                $li.removeClass('unread');
            }

            $checkbox.on('change', function() {
                const nowMuted = $(this).is(':checked');
                GM_setValue(`mute_${SHARED_KEY}_${bookmarkId}`, nowMuted);

                if (nowMuted) {
                     $li.removeClass('unread');
                } else if ($li.data('was-unread')) {
                     $li.addClass('unread');
                }
            });

            // --- 色変更機能 (右クリック・文字色) ---
            const savedColorIndex = GM_getValue(`color_${SHARED_KEY}_${bookmarkId}`, 0);
            if (savedColorIndex > 0) {
                $li.addClass(`text-color-${savedColorIndex}`);
            }

            $li.on('contextmenu', function(e) {
                e.preventDefault();

                let currentColorIndex = GM_getValue(`color_${SHARED_KEY}_${bookmarkId}`, 0);

                if (currentColorIndex > 0) {
                    $li.removeClass(`text-color-${currentColorIndex}`);
                }

                let nextColorIndex = (currentColorIndex + 1) % TEXT_COLORS.length;

                if (nextColorIndex > 0) {
                    $li.addClass(`text-color-${nextColorIndex}`);
                }

                GM_setValue(`color_${SHARED_KEY}_${bookmarkId}`, nextColorIndex);
            });
        });
    }

    /**
     * ドラッグ＆ドロップ（Sortable）の設定
     */
    function setupSortable($list) {
        $list.sortable({
            handle: '.drag-handle',
            items: 'li:not(.system-item)', // system-item クラスがついたものはドラッグ対象外
            placeholder: 'ui-state-highlight',
            axis: 'y',
            opacity: 0.7,
            stop: function() {
                const newOrder = $list.children('li:not(.system-item)').map(function() {
                    return getBookmarkId($(this));
                }).get();
                GM_setValue(`bookmarkOrder_${SHARED_KEY}`, newOrder);
            }
        }).disableSelection();
    }

    /**
     * ブックマークを一意に識別するためのIDを取得
     */
    function getBookmarkId($li) {
        return $li.find('a').attr('href');
    }

})();

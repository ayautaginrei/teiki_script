// ==UserScript==
// @name         北アザブクマ拡張
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  ブックマークの拡張　ついでにセクションの開閉機能を追加
// @author       ayautaginrei(gemini)
// @match        https://wdrb.work/otherside/*
// @match        http://wdrb.work/otherside/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=wdrb.work
// @updateURL    https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/%E5%8C%97%E3%82%A2%E3%82%B6%E3%83%96%E3%82%AF%E3%83%9E%E6%8B%A1%E5%BC%B5.user.js
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

    const MUTEKI_COLORS = [
        '#fff', '#a52a2a', '#a68429', '#50B450', '#6464C8', '#C864C8'
    ];

    /**
     * 現在のアカウントID (eno) を取得する
     * @returns {string|null} アカウントID or null
     */
    function getAccountId() {
        const profileLink = document.querySelector('.chara_area a[href*="profile.php?eno="]');
        if (profileLink) {
            const match = profileLink.href.match(/eno=(\d+)/);
            return match ? match[1] : null;
        }
        return null;
    }

    // --- メイン処理 ---
    $(document).ready(function() {
        const accountId = getAccountId();
        if (!accountId) {
            console.log("アカウントIDが取得できませんでした。拡張機能は動作しません。");
            return;
        }

        // 機能1: ブックマーク拡張 (アカウントIDを渡す)
        const $bookmarkList = $('.logs.bookmarks .activity');
        if ($bookmarkList.length > 0) {
            initializeBookmarkFeature($bookmarkList, accountId);
        }

        // 機能2: セクション開閉 (アカウントIDを渡す)
        initializeCollapsibleSections(accountId);
    });

    function initializeBookmarkFeature($list, accountId) {
        addBookmarkStyles();
        initializeBookmarks($list, accountId);
        setupSortable($list, accountId);
    }

    function initializeCollapsibleSections(accountId) {
        const storageKey = `kitama_section_states_${accountId}`;
        const sectionStates = GM_getValue(storageKey, {});

        document.querySelectorAll('section.container.area').forEach(section => {
            const header = section.querySelector('h2');
            const content = Array.from(section.children).find(el => el.tagName.toLowerCase() !== 'h2');
            if (header && content) {
                const key = header.textContent.trim();
                if (sectionStates[key] === true) {
                    content.style.display = 'none';
                }
                header.style.cursor = 'pointer';
                header.addEventListener('click', () => {
                    const isHidden = content.style.display === 'none';
                    content.style.display = isHidden ? '' : 'none';
                    sectionStates[key] = !isHidden;
                    GM_setValue(storageKey, sectionStates);
                });
            }
        });
    }

    // --- 以下、ブックマーク機能関連の関数 (すべてにaccountIdを引き継ぎ) ---

    function addBookmarkStyles() {
        GM_addStyle(`
            /* ... スタイル定義 (変更なし) ... */
            .logs.bookmarks .activity li { display: flex; align-items: center; transition: background-color 0.2s; }
            .drag-handle { cursor: grab; color: #aaa; padding: 0 8px; font-size: 1.1em; font-weight: bold; }
            .unread-toggle { margin-left: 8px; flex-shrink: 0; }
            .logs.bookmarks .activity li a { flex-grow: 1; margin-left: 8px; }
            .ui-sortable-helper { opacity: 0.95; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25); cursor: grabbing; }
            .ui-state-highlight { height: 3em; background-color: rgba(173, 216, 230, 0.4); border: 1px dashed #888; border-radius: 4px; margin: 2px 0; }
        `);
        let colorStyles = '';
        MUTEKI_COLORS.forEach((color, index) => {
            if (index > 0) colorStyles += `.muteki-color-${index} { background-color: ${color} !important; }`;
        });
        GM_addStyle(colorStyles);
    }

    function initializeBookmarks($list, accountId) {
        const savedOrder = GM_getValue(`bookmarkOrder_${accountId}`, []);
        if (savedOrder.length > 0) {
            const itemMap = new Map($list.children('li').get().map(li => [getBookmarkId($(li)), $(li)]));
            savedOrder.forEach(id => { if (itemMap.has(id)) $list.append(itemMap.get(id)); });
        }

        $list.children('li').each(function() {
            const $li = $(this);
            const bookmarkId = getBookmarkId($li);
            $li.prepend('<span class="drag-handle">☰</span>');

            const wasOriginallyUnread = $li.hasClass('unread');
            $li.data('was-unread', wasOriginallyUnread);

            // ミュート状態のキーをアカウント固有に
            const isMuted = GM_getValue(`mute_${accountId}_${bookmarkId}`, false);
            const $checkbox = $('<input type="checkbox" class="unread-toggle" title="未読マークをミュート">').prop('checked', isMuted);
            $li.append($checkbox);

            if (isMuted) $li.removeClass('unread');

            $checkbox.on('change', function() {
                const nowMuted = $(this).is(':checked');
                GM_setValue(`mute_${accountId}_${bookmarkId}`, nowMuted);
                $li.toggleClass('unread', !nowMuted && $li.data('was-unread'));
            });

            // 色状態のキーをアカウント固有に
            const savedColorIndex = GM_getValue(`color_${accountId}_${bookmarkId}`, 0);
            if (savedColorIndex > 0) $li.addClass(`muteki-color-${savedColorIndex}`);

            $li.on('contextmenu', function(e) {
                e.preventDefault();
                let currentColorIndex = GM_getValue(`color_${accountId}_${bookmarkId}`, 0);
                $li.removeClass(`muteki-color-${currentColorIndex}`);
                let nextColorIndex = (currentColorIndex + 1) % MUTEKI_COLORS.length;
                if (nextColorIndex > 0) $li.addClass(`muteki-color-${nextColorIndex}`);
                GM_setValue(`color_${accountId}_${bookmarkId}`, nextColorIndex);
            });
        });
    }

    function setupSortable($list, accountId) {
        $list.sortable({
            handle: '.drag-handle',
            placeholder: 'ui-state-highlight',
            stop: function() {
                const newOrder = $list.children('li').map(function() { return getBookmarkId($(this)); }).get();
                // 並び順のキーをアカウント固有に
                GM_setValue(`bookmarkOrder_${accountId}`, newOrder);
            }
        }).disableSelection();
    }

    function getBookmarkId($li) {
        return $li.find('a').attr('href');
    }

})();

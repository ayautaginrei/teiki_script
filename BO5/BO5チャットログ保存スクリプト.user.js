// ==UserScript==
// @name         BO5チャットログ保存スクリプト
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  ページャーを遡ってチャットログを取得し、HTMLとして保存します (lobby / archives 両対応)
// @author       ayautaginrei
// @match        https://wdrb.work/bo5/lobby.php*
// @match        https://wdrb.work/bo5/archives.php*
// @upgradeURL   https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/BO5/BO5%E3%83%81%E3%83%A3%E3%83%83%E3%83%88%E3%83%AD%E3%82%B0%E4%BF%9D%E5%AD%98%E3%82%B9%E3%82%AF%E3%83%AA%E3%83%97%E3%83%88.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ---------------------------------------------------------
    // 0. ページ種別判定
    // ---------------------------------------------------------
    const IS_ARCHIVE = location.pathname.includes('archives.php');
    const IS_LOBBY   = location.pathname.includes('lobby.php');

    // ---------------------------------------------------------
    // 1. デザイン定義
    // ---------------------------------------------------------
    const style = document.createElement('style');
    style.textContent = `
        #log_save_panel {
            display: none;
        }
        #log_save_panel.active {
            display: block !important;
        }
        /* アーカイブ用: パネルをログ一覧の直上に自然に置く */
        #log_save_panel.archive_mode {
            padding: 0.5em;
            margin-bottom: 1em;
        }
    `;
    document.head.appendChild(style);

    // ---------------------------------------------------------
    // 2. ページ別 UI 構築
    // ---------------------------------------------------------
    const chatSection = document.querySelector('section.container.chat');
    if (!chatSection) return;

    let logPanel;

    if (IS_LOBBY) {
        // ---- lobby.php : .remark_area ul にタブとして追加 ----
        const remarkUl = chatSection.querySelector('.remark_area ul');
        if (!remarkUl) return;

        const chatForm = document.getElementById('chat_form');
        if (!chatForm) return;

        // タブボタン追加
        const logTab = document.createElement('li');
        logTab.dataset.menu = 'log_save';
        logTab.id = 'log_save_button';
        logTab.className = 'cap';
        logTab.innerHTML = '<span class="tab_ico fa-solid fa-floppy-disk"></span><span class="tab_label">LOG SAVE</span>';
        remarkUl.appendChild(logTab);

        // パネル生成・挿入 (chat_form の直後)
        logPanel = createPanel(false);
        chatForm.parentNode.insertBefore(logPanel, chatForm.nextSibling);

        // タブ切替イベント
        const allTabButtons = remarkUl.querySelectorAll('li[data-menu]');
        const managedForms  = ['chat_form', 'wis_form', 'shop_form', 'others_form']
                              .map(id => document.getElementById(id));

        function hideAllForms() {
            managedForms.forEach(el => { if (el) el.style.display = 'none'; });
            document.querySelectorAll('.remark_area > *:not(ul)').forEach(el => {
                if (el.id !== 'log_save_panel') el.style.display = 'none';
            });
            logPanel.classList.remove('active');
        }

        logTab.addEventListener('click', () => {
            allTabButtons.forEach(li => li.classList.remove('selected'));
            logTab.classList.add('selected');
            hideAllForms();
            logPanel.classList.add('active');
            updateInfo();
        });

        allTabButtons.forEach(btn => {
            if (btn.id === 'log_save_button') return;
            btn.addEventListener('click', () => logPanel.classList.remove('active'));
        });

    } else if (IS_ARCHIVE) {
        // ---- archives.php : #extend-save-log-button-rev の隣に li>a を追加 ----
        const archiveUl = chatSection.querySelector('ul');
        if (!archiveUl) return;

        const talkListEl = chatSection.querySelector('.talk_list');
        if (!talkListEl) return;

        // ボタン追加
        const logLi = document.createElement('li');
        logLi.id = 'log_save_button_archive';
        logLi.innerHTML = '<a href="#">LOG SAVE (PANEL)</a>';
        archiveUl.appendChild(logLi);

        // パネル生成・挿入 (talk_list の直前)
        logPanel = createPanel(true);
        talkListEl.parentNode.insertBefore(logPanel, talkListEl);

        // ボタンクリックでパネル開閉
        logLi.querySelector('a').addEventListener('click', (e) => {
            e.preventDefault();
            const isOpen = logPanel.classList.contains('active');
            if (isOpen) {
                logPanel.classList.remove('active');
            } else {
                logPanel.classList.add('active');
                updateInfo();
            }
        });
    }

    // ---------------------------------------------------------
    // 3. パネル HTML 生成
    // ---------------------------------------------------------
    function createPanel(isArchive) {
        const panel = document.createElement('div');
        panel.id  = 'log_save_panel';
        if (isArchive) panel.classList.add('archive_mode');

        panel.innerHTML = `
            <h4 style="margin: 0.5em">チャットログ保存設定</h4>

            <div style="margin: 1em 0.5em;">
                <div style="display: flex; flex-wrap: wrap; gap: 1.5em; margin-bottom: 1em;">
                    <div><small class="gray">現在地:</small><br><b id="info-area">-</b></div>
                    <div><small class="gray">サブエリア(ゾーン):</small><br><b id="info-zone">-</b></div>
                    <div><small class="gray">表示件数:</small><br><b><span id="info-count">0</span> 件</b></div>
                    <div><small class="gray">取得件数:</small><br><b class="blue"><span id="info-fetched">0</span> 件</b></div>
                </div>

                <form style="margin: 1em 0; display: flex; flex-flow: column; gap: 0.5em;">
                    <label style="display: flex; align-items: center; flex-flow: row; cursor: pointer; width: fit-content;">
                        <input type="checkbox" id="chk-reverse">
                        <span>古い順に並べ替え</span>
                    </label>
                    <label style="display: flex; align-items: center; flex-flow: row; cursor: pointer; width: fit-content;">
                        <input type="checkbox" id="chk-fetch-all" checked>
                        <span>過去ログも取得 (全ページ)</span>
                    </label>
                </form>
            </div>

            <ul class="talk_category button_list" style="justify-content: flex-start; margin: 1em 0;">
                <li class="cap" id="btn-update-info" data-tippy-content="現在表示しているエリアのチャットログを取得します">
                    <a href="#">ログを取得</a>
                </li>
                <li class="cap" id="btn-save-html" data-tippy-content="取得したログをHTMLとして保存します">
                    <a href="#">HTML保存</a>
                </li>
            </ul>

            <div id="log-progress" style="display: none; margin: 1em 0.5em;">
                <small class="gray" id="log-progress-text">0/0</small>
                <div class="hp_guege" style="width: 100%; max-width: 400px; height: 8px; transform: skewX(15deg); background-color: #35211f; margin-top: 5px;">
                    <div id="log-progress-bar" style="width: 0%; height: 100%; background-color: #4ea05c; transition: width 0.3s ease;"></div>
                </div>
            </div>

            <div id="log-status" class="blue" style="margin: 0.5em; font-weight: bold;">ログを取得してから保存してください</div>
        `;
        return panel;
    }

    // ---------------------------------------------------------
    // 4. グローバル変数
    // ---------------------------------------------------------
    let fetchedLogs = [];
    let isFetching  = false;

    // ---------------------------------------------------------
    // 5. パネル内ボタンのイベント登録 (パネル生成後に呼ぶ)
    // ---------------------------------------------------------
    document.getElementById('btn-update-info').querySelector('a').addEventListener('click', async (e) => {
        e.preventDefault();
        if (isFetching) return;
        if (document.getElementById('chk-fetch-all').checked) {
            await fetchAllLogs();
        } else {
            fetchCurrentLogs();
        }
    });

    document.getElementById('btn-save-html').querySelector('a').addEventListener('click', (e) => {
        e.preventDefault();
        saveHtml();
    });

    // ---------------------------------------------------------
    // 6. ユーティリティ
    // ---------------------------------------------------------
    function setStatus(text, isError = false) {
        const el = document.getElementById('log-status');
        el.textContent = text;
        el.className   = isError ? 'red' : 'blue';
    }

    function updateInfo() {
        // エリア名
        let areaName = '-';
        if (IS_LOBBY) {
            const el = document.querySelector('.area_info .area_title');
            if (el) areaName = el.textContent.split('-')[0].trim();
        } else if (IS_ARCHIVE) {
            const areaInfoB = document.querySelector('.chara_container .area_info b');
            if (areaInfoB) {
                // テキストノード（最初の子）から '-' 前を取る
                const rawText = areaInfoB.childNodes[0] ? areaInfoB.childNodes[0].textContent : '';
                areaName = rawText.split('-')[0].trim();
            }
        }

        // ゾーン名
        let zoneName = '-';
        const zoneEl = document.getElementById('zone');
        if (zoneEl) {
            zoneName = zoneEl.textContent.trim();
        } else if (IS_ARCHIVE) {
            const zoneSpan = document.querySelector('.chara_container .area_info b span');
            if (zoneSpan) zoneName = zoneSpan.textContent.trim();
        }

        const count = document.querySelectorAll('.talk_list .chat_shout').length;

        document.getElementById('info-area').textContent  = areaName;
        document.getElementById('info-zone').textContent  = zoneName;
        document.getElementById('info-count').textContent = count;
    }

    function updateProgress(current, total) {
        const progress = document.getElementById('log-progress');
        const bar      = document.getElementById('log-progress-bar');
        const text     = document.getElementById('log-progress-text');
        const percent  = total > 0 ? Math.round((current / total) * 100) : 0;

        progress.style.display = 'block';
        bar.style.width        = percent + '%';
        text.textContent       = `取得中... ページ ${current} / ${total} 付近 (${percent}%)`;
    }

    function hideProgress() {
        document.getElementById('log-progress').style.display = 'none';
    }

    function getJstDateStr() {
        return new Date().toLocaleDateString('ja-JP', {
            timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
        }).replace(/\//g, '-');
    }

    function getParam(name) {
        const urlVal = new URLSearchParams(location.search).get(name);
        if (urlVal) return urlVal;
        const hidden = document.querySelector(`input[name="${name}"]`);
        return hidden ? hidden.value : null;
    }

    // ---------------------------------------------------------
    // 7. 現在ページのみ取得
    // ---------------------------------------------------------
    function fetchCurrentLogs() {
        const talkList = document.querySelector('.talk_list');
        if (!talkList) { setStatus('エラー: ログが見つかりません', true); return; }

        fetchedLogs = Array.from(talkList.querySelectorAll('.chat_shout')).map(el => el.cloneNode(true));
        document.getElementById('info-fetched').textContent = fetchedLogs.length;
        setStatus(`取得完了：計 ${fetchedLogs.length} 件のログを取得しました`);
    }

    // ---------------------------------------------------------
    // 8. 全ページ取得
    // ---------------------------------------------------------
    async function fetchAllLogs() {
        isFetching = true;
        setStatus('ログを取得中...');

        try {
            fetchedLogs = [];

            // ページングURLをページ種別ごとに組み立て
            function buildUrl(page) {
                if (IS_ARCHIVE) {
                    const loc  = getParam('loc')  || 'stand';
                    const area = getParam('area')  || '0';
                    const view = getParam('view')  || '0';
                    return `archives.php?loc=${loc}&area=${area}&view=${view}&page=${page}`;
                } else {
                    const area = getParam('area') || 'stand';
                    const list = getParam('list') || '3';
                    const zone = getParam('zone') || '0';
                    return `lobby.php?area=${area}&list=${list}&zone=${zone}&page=${page}`;
                }
            }

            let page   = 1;
            let hasMore = true;
            const parser = new DOMParser();

            while (hasMore) {
                updateProgress(page, page + 3);

                try {
                    const response = await fetch(buildUrl(page));
                    if (!response.ok) break;

                    const html     = await response.text();
                    const doc      = parser.parseFromString(html, 'text/html');
                    const talkList = doc.querySelector('.talk_list');

                    if (!talkList || talkList.children.length === 0) { hasMore = false; break; }

                    const logs = Array.from(talkList.querySelectorAll('.chat_shout'));
                    if (logs.length === 0) { hasMore = false; break; }

                    fetchedLogs.push(...logs.map(el => el.cloneNode(true)));
                    document.getElementById('info-fetched').textContent = fetchedLogs.length;
                    setStatus(`ページ ${page} を取得中... (計 ${fetchedLogs.length} 件)`);

                    page++;
                    await new Promise(resolve => setTimeout(resolve, 500));

                } catch (err) {
                    console.error(`ページ ${page} の取得エラー:`, err);
                    hasMore = false;
                }
            }

            // fallback
            if (fetchedLogs.length === 0) {
                const cur = document.querySelector('.talk_list');
                if (cur) fetchedLogs = Array.from(cur.querySelectorAll('.chat_shout')).map(el => el.cloneNode(true));
            }

            hideProgress();
            document.getElementById('info-fetched').textContent = fetchedLogs.length;

            if (fetchedLogs.length > 0) {
                setStatus(`取得完了：計 ${fetchedLogs.length} 件のログを取得しました`);
            } else {
                setStatus('エラー: ログが見つかりませんでした', true);
            }

        } catch (err) {
            console.error('ログ取得エラー:', err);
            setStatus('エラー: ' + err.message, true);
            hideProgress();
        } finally {
            isFetching = false;
        }
    }

    // ---------------------------------------------------------
    // 9. リンク絶対URL変換
    // ---------------------------------------------------------
    function makeLinksAbsolute(doc) {
        const base = location.href;
        const toAbs = (url) => { try { return new URL(url, base).href; } catch (e) { return url; } };

        doc.querySelectorAll('img, source, script').forEach(el => {
            if (el.getAttribute('src')) el.src = toAbs(el.getAttribute('src'));
            if (el.dataset.img) el.dataset.img  = toAbs(el.dataset.img);
        });
        doc.querySelectorAll('link[href]').forEach(el => { el.href = toAbs(el.getAttribute('href')); });
        doc.querySelectorAll('*[style]').forEach(el => {
            const s = el.getAttribute('style');
            if (s && s.includes('url('))
                el.setAttribute('style', s.replace(/url\(['"]?(.+?)['"]?\)/g, (_, u) => `url('${toAbs(u)}')`));
        });
    }

    // ---------------------------------------------------------
    // 10. リンク無効化
    // ---------------------------------------------------------
    function removeLinks(doc) {
        doc.querySelectorAll('a').forEach(a => {
            a.removeAttribute('href');
            a.style.cursor = 'default';
            a.style.pointerEvents = 'none';
            a.style.textDecoration = 'none';
        });
        doc.querySelectorAll('form').forEach(f => { f.onsubmit = () => false; });
        doc.querySelectorAll('button, input[type="submit"], input[type="button"]').forEach(btn => {
            btn.disabled = true;
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.5';
        });
    }

    // ---------------------------------------------------------
    // 11. HTML保存
    // ---------------------------------------------------------
    function saveHtml() {
        if (fetchedLogs.length === 0) { setStatus('エラー: 先にログを取得してください', true); return; }
        setStatus('HTML生成中...');

        try {
            const cloneDoc  = document.documentElement.cloneNode(true);
            const talkList  = cloneDoc.querySelector('.talk_list');

            if (talkList) {
                talkList.innerHTML = '';
                let logs = [...fetchedLogs];
                if (document.getElementById('chk-reverse').checked) logs.reverse();
                logs.forEach(log => talkList.appendChild(log.cloneNode(true)));
            }

            makeLinksAbsolute(cloneDoc);
            removeLinks(cloneDoc);

            // 共通除去セレクタ
            const toRemove = [
                'script', 'iframe',
                '#log_save_panel',
                '.menu_button', '.acount_change',
                '.chat_tool', '.chat_menu', '.mention_tools',
                '.modals', '.bookmark_add',
                '.noticearea', '#custom-toast',
                '[data-tippy-root]', '.tippy-box',
                '.side_menu', '#overlay', '#icon_choice',
                'header',
                '.container.content_box.bookmaker',
                '.talk_category.button_list',
            ];

            if (IS_LOBBY) {
                toRemove.push(
                    '.remark_area',
                    '.container.schedule',
                    '.container.logs',
                    'section.container.chatlobby .status_area',
                    '.button_list.tab-buttons',
                    '.lobby_info',
                    '.btst_choice',
                    '.battle_style',
                );
            } else if (IS_ARCHIVE) {
                // アーカイブ: タブ列(ul)とエリア移動フォームを除去
                toRemove.push(
                    'section.container.chat > ul',
                    '#archive_move',
                    'section.container.chatlobby',
                );
            }

            if (document.getElementById('chk-fetch-all').checked) {
                toRemove.push('.pager');
            }

            toRemove.forEach(sel => cloneDoc.querySelectorAll(sel).forEach(el => el.remove()));

            // mention 簡略化
            cloneDoc.querySelectorAll('.mention').forEach(mention => {
                const timeEl = mention.querySelector('.chat_time');
                mention.innerHTML = timeEl
                    ? `<span class="chat_time gray small">${timeEl.textContent}</span>`
                    : '';
            });

            // ファイル名
            const areaName = (document.getElementById('info-area').textContent || 'log').replace(/\s+/g, '_');
            const zoneName = (document.getElementById('info-zone').textContent || '').replace(/\s+/g, '_');
            const dateStr  = getJstDateStr();
            const zonePart = (zoneName && zoneName !== '-') ? `_${zoneName}` : '';
            const prefix   = IS_ARCHIVE ? 'BO5_archive' : 'BO5_chat';
            const fileName = `${prefix}_${areaName}${zonePart}_${dateStr}.html`;

            const blob = new Blob(['<!DOCTYPE html>\n' + cloneDoc.outerHTML], { type: 'text/html' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);

            setStatus(`保存完了：${fileName} (${fetchedLogs.length} 件)`);

        } catch (e) {
            console.error(e);
            setStatus('エラー: ' + e.message, true);
        }
    }

})();

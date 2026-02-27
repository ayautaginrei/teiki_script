// ==UserScript==
// @name         田楽ログ保存支援スクリプト
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  ページャーを遡ってチャットログを取得し、HTMLとして保存します
// @author       ayautaginrei(Gemini)
// @match        https://ironbunny.net/digi_nir/chat.php*
// @updateURL    https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/othersomething/%E7%94%B0%E6%A5%BD%E3%83%AD%E3%82%B0%E4%BF%9D%E5%AD%98%E6%94%AF%E6%8F%B4%E3%82%B9%E3%82%AF%E3%83%AA%E3%83%97%E3%83%88.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ---------------------------------------------------------
    // 1. デザイン定義 (サイトのCSSを活かすため最小限に)
    // ---------------------------------------------------------
    const style = document.createElement('style');
    style.textContent = `
        #log_save_panel {
            display: none;
        }
        #log_save_panel.active {
            display: block !important;
        }
    `;
    document.head.appendChild(style);

    // ---------------------------------------------------------
    // 2. タブボタンの追加
    // ---------------------------------------------------------
    const remarkButtons = document.querySelector('.remark_button');
    if (!remarkButtons) return;

    const logButton = document.createElement('li');
    logButton.textContent = 'LOG SAVE';
    logButton.dataset.menu = 'log_save';
    logButton.id = 'log_save_button';
    remarkButtons.appendChild(logButton);

    // ---------------------------------------------------------
    // 3. パネルの作成 (サイトのHTML構造に寄せる)
    // ---------------------------------------------------------
    const chatForm = document.getElementById('chat_form');
    if (!chatForm) return;

    const logPanel = document.createElement('div');
    logPanel.id = 'log_save_panel';
    logPanel.innerHTML = `
        <h4 style="margin: 0.5em">チャットログ保存設定</h4>

        <div style="margin: 1em 0.5em;">
            <div style="display: flex; flex-wrap: wrap; gap: 1.5em; margin-bottom: 1em;">
                <div><small class="gray">現在の場所:</small><br><b id="info-area">-</b></div>
                <div><small class="gray">サブエリア:</small><br><b id="info-zone">-</b></div>
                <div><small class="gray">表示件数:</small><br><b><span id="info-count">0</span> 件</b></div>
                <div><small class="gray">取得件数:</small><br><b class="blue"><span id="info-fetched">0</span> 件</b></div>
            </div>

            <form style="margin: 1em 0; display: flex; flex-flow: column; gap: 0.5em;">
                <label style="display: flex; align-items: center; flex-flow: row; cursor: pointer; width: fit-content;">
                    <input type="checkbox" id="chk-reverse">
                    <span>古い順に並べ替え</span>
                </label>
                <label style="display: flex; align-items: center; flex-flow: row; cursor: pointer; width: fit-content;">
                    <input type="checkbox" id="chk-clean-ui" checked>
                    <span>不要なUIを削除</span>
                </label>
                <label style="display: flex; align-items: center; flex-flow: row; cursor: pointer; width: fit-content;">
                    <input type="checkbox" id="chk-fetch-all" checked>
                    <span>過去ログも取得</span>
                </label>
            </form>
        </div>

        <ul class="button_list" style="justify-content: flex-start; margin: 1em 0.5em;">
            <li class="cap" id="btn-update-info" data-tippy-content="現在表示しているエリア/サブエリアのログを取得します">
                <a>ログを取得</a>
            </li>
            <li class="cap" id="btn-save-html" data-tippy-content="取得したログを保存します">
                <a>HTML保存</a>
            </li>
        </ul>

        <div class="log-progress" id="log-progress" style="display: none; margin: 1em 0.5em;">
            <small class="gray" id="log-progress-text">0/0</small>
            <div class="hp_guege" style="width: 100%; max-width: 400px; height: 8px; transform: skewX(15deg); background-color: #35211f; margin-top: 5px;">
                <div id="log-progress-bar" style="width: 0%; height: 100%; background-color: #4ea05c; transition: width 0.3s ease;"></div>
            </div>
        </div>

        <div id="log-status" class="blue" style="margin: 0.5em; font-weight: bold;">ログを取得してから保存してください</div>
    `;

    chatForm.parentNode.insertBefore(logPanel, chatForm.nextSibling);

    // ---------------------------------------------------------
    // 4. グローバル変数
    // ---------------------------------------------------------
    let fetchedLogs = [];
    let isFetching = false;

    // ---------------------------------------------------------
    // 5. イベント処理
    // ---------------------------------------------------------
    const originalForms = [
        document.getElementById('chat_form'),
        document.getElementById('others_form')
    ];

    // LOG SAVEタブクリック
    logButton.addEventListener('click', () => {
        document.querySelectorAll('.remark_button li').forEach(li => li.classList.remove('selected'));
        logButton.classList.add('selected');

        originalForms.forEach(el => { if(el) el.style.display = 'none'; });
        logPanel.classList.add('active');

        updateInfo();
    });

    // 既存タブクリック時の挙動
    document.querySelectorAll('.remark_button li:not(#log_save_button)').forEach(btn => {
        btn.addEventListener('click', () => {
            logPanel.classList.remove('active');
        });
    });

    // 「ログを取得」ボタン
    document.getElementById('btn-update-info').addEventListener('click', async () => {
        if (isFetching) return;

        const fetchAll = document.getElementById('chk-fetch-all').checked;
        if (fetchAll) {
            await fetchAllLogs();
        } else {
            fetchCurrentLogs();
        }
    });

    // ---------------------------------------------------------
    // 6. ユーティリティ関数
    // ---------------------------------------------------------
    function setStatus(text, isError = false) {
        const statusEl = document.getElementById('log-status');
        statusEl.textContent = text;
        statusEl.className = isError ? 'red' : 'blue';
    }

    function updateInfo() {
        const areaNameEl = document.querySelector('.area_info b');
        const zoneEl = document.getElementById('zone');
        const count = document.querySelectorAll('.chat_shout_wrapper').length;

        const fullAreaName = areaNameEl ? areaNameEl.textContent : '不明';
        const zoneName = zoneEl ? zoneEl.textContent : '-';

        document.getElementById('info-area').textContent = fullAreaName.replace(/\[.*?\]/, '').trim();
        document.getElementById('info-zone').textContent = zoneName;
        document.getElementById('info-count').textContent = count;
    }

    function updateProgress(current, total) {
        const progress = document.getElementById('log-progress');
        const bar = document.getElementById('log-progress-bar');
        const text = document.getElementById('log-progress-text');
        const percent = Math.round((current / total) * 100);

        progress.style.display = 'block';
        bar.style.width = percent + '%';
        text.textContent = `取得中... ページ ${current} / ${total} 付近を検索中 (${percent}%)`;
    }

    function hideProgress() {
        document.getElementById('log-progress').style.display = 'none';
    }

    function fetchCurrentLogs() {
        const talkList = document.querySelector('.talk_list');

        if (!talkList) {
            setStatus('エラー: ログが見つかりません', true);
            return;
        }

        fetchedLogs = Array.from(talkList.querySelectorAll('.chat_shout_wrapper')).map(el => el.cloneNode(true));

        document.getElementById('info-fetched').textContent = fetchedLogs.length;
        setStatus(`取得完了：計 ${fetchedLogs.length} 件のログを取得しました`);
    }

async function fetchAllLogs() {
        if (isFetching) return;

        isFetching = true;
        setStatus('ログを取得中...');

        try {
            fetchedLogs = [];

            const urlParams = new URLSearchParams(window.location.search);
            let area = urlParams.get('area');
            let list = urlParams.get('list');
            let zone = urlParams.get('zone');

            if (!area && document.querySelector('input[name="area"]')) {
                area = document.querySelector('input[name="area"]').value;
            }
            if (!list && document.querySelector('input[name="list"]')) {
                list = document.querySelector('input[name="list"]').value;
            }
            if (!zone && document.querySelector('input[name="zone"]')) {
                zone = document.querySelector('input[name="zone"]').value;
            }

            area = area || '1';
            list = list || '3';
            zone = zone || '0';

            let page = 1;
            let hasMore = true;
            const parser = new DOMParser();

            while (hasMore) {
                updateProgress(page, page + 3);

                const url = `chat.php?area=${area}&list=${list}&zone=${zone}&page=${page}`;

                try {
                    const response = await fetch(url);
                    if (!response.ok) break;

                    const html = await response.text();
                    const doc = parser.parseFromString(html, 'text/html');
                    const talkList = doc.querySelector('.talk_list');

                    if (!talkList || talkList.children.length === 0) {
                        hasMore = false;
                        break;
                    }

                    const logs = Array.from(talkList.querySelectorAll('.chat_shout_wrapper'));
                    if (logs.length === 0) {
                        hasMore = false;
                        break;
                    }

                    fetchedLogs.push(...logs.map(el => el.cloneNode(true)));

                    document.getElementById('info-fetched').textContent = fetchedLogs.length;
                    setStatus(`ページ ${page} を取得中... (計 ${fetchedLogs.length} 件)`);

                    page++;

                    await new Promise(resolve => setTimeout(resolve, 500));

                } catch (error) {
                    console.error(`ページ ${page} の取得エラー:`, error);
                    hasMore = false;
                }
            }

            if (fetchedLogs.length === 0) {
                const currentTalkList = document.querySelector('.talk_list');
                if (currentTalkList) {
                    fetchedLogs = Array.from(currentTalkList.querySelectorAll('.chat_shout_wrapper')).map(el => el.cloneNode(true));
                }
            }

            hideProgress();
            document.getElementById('info-fetched').textContent = fetchedLogs.length;

            if (fetchedLogs.length > 0) {
                setStatus(`取得完了：計 ${fetchedLogs.length} 件のログを取得しました`);
            } else {
                setStatus('エラー: ログが見つかりませんでした', true);
            }

        } catch (error) {
            console.error('ログ取得エラー:', error);
            setStatus('エラー: ' + error.message, true);
            hideProgress();
        } finally {
            isFetching = false;
        }
    }

    function makeLinksAbsolute(doc) {
        const baseUrl = window.location.href;

        const toAbsolute = (url) => {
            try {
                return new URL(url, baseUrl).href;
            } catch (e) {
                return url;
            }
        };

        doc.querySelectorAll('img, source, script').forEach(el => {
            if (el.getAttribute('src')) el.src = toAbsolute(el.getAttribute('src'));
            if (el.dataset.img) el.dataset.img = toAbsolute(el.dataset.img);
        });

        doc.querySelectorAll('link[href]').forEach(el => {
            el.href = toAbsolute(el.getAttribute('href'));
        });

        doc.querySelectorAll('*[style]').forEach(el => {
            let style = el.getAttribute('style');
            if (style && style.includes('url(')) {
                const newStyle = style.replace(/url\(['"]?(.+?)['"]?\)/g, (match, url) => {
                    return `url('${toAbsolute(url)}')`;
                });
                el.setAttribute('style', newStyle);
            }
        });
    }

    function removeLinks(doc) {
        // すべてのaタグからhref属性を削除し、クリック不可にする
        doc.querySelectorAll('a').forEach(a => {
            a.removeAttribute('href');
            a.style.cursor = 'default';
            a.style.pointerEvents = 'none';
            a.style.textDecoration = 'none';
        });

        // フォームを無効化
        doc.querySelectorAll('form').forEach(form => {
            form.onsubmit = () => false;
        });

        // ボタンを無効化
        doc.querySelectorAll('button, input[type="submit"], input[type="button"]').forEach(btn => {
            btn.disabled = true;
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.5';
        });
    }

    // ---------------------------------------------------------
    // 7. 保存実行ロジック
    // ---------------------------------------------------------
    document.getElementById('btn-save-html').addEventListener('click', () => {
        if (fetchedLogs.length === 0) {
            setStatus('エラー: 先にログを取得してください', true);
            return;
        }

        setStatus('HTML生成中...');

        setTimeout(() => {
            try {
                const cloneDoc = document.documentElement.cloneNode(true);

                const talkList = cloneDoc.querySelector('.talk_list');
                if (talkList && fetchedLogs.length > 0) {
                    talkList.innerHTML = '';

                    let logsToInsert = [...fetchedLogs];

                    if (document.getElementById('chk-reverse').checked) {
                        logsToInsert.reverse();
                    }

                    logsToInsert.forEach(log => {
                        talkList.appendChild(log.cloneNode(true));
                    });
                }

                makeLinksAbsolute(cloneDoc);
                removeLinks(cloneDoc);

                // 削除する要素のリスト
                const selectorsToRemove = [
                    'script',
                    'iframe',
                    '.remark_area',
                    '#log_save_panel',
                    '.menu_button',
                    '.header_menu',
                    '.acount_change',
                    '.log_menu',
                    '.chat_tool',
                    '.chat_menu',
                    '#chat_preview_container',
                    '.modals',
                    '.bookmark_add',
                    '.container.chat.post'
                ];

                if (document.getElementById('chk-fetch-all').checked) {
                    selectorsToRemove.push('.pager');
                }

                if (document.getElementById('chk-clean-ui').checked) {
                    selectorsToRemove.push(
                        '.logs',
                        '.chara_area',
                        'nav'
                    );
                }

                selectorsToRemove.forEach(sel => {
                    cloneDoc.querySelectorAll(sel).forEach(el => el.remove());
                });

                cloneDoc.querySelectorAll('.mention').forEach(mention => {
                    const timeEl = mention.querySelector('.chat_time');
                    if (timeEl) {
                        mention.innerHTML = `<span class="chat_time gray small">${timeEl.textContent}</span>`;
                    } else {
                        mention.innerHTML = '';
                    }
                });

                const areaDesc = cloneDoc.querySelector('#area_description');
                if (areaDesc) {
                    areaDesc.style.display = 'block';
                }

                cloneDoc.querySelectorAll('.tab-buttons li').forEach(li => {
                    li.style.pointerEvents = 'none';
                    li.style.cursor = 'default';
                });

                // HTML生成と保存
                const htmlContent = '<!DOCTYPE html>\n' + cloneDoc.outerHTML;
                const blob = new Blob([htmlContent], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');

                const areaName = (document.getElementById('info-area').textContent || 'log').replace(/\s+/g, '_');
                const dateStr = new Date().toISOString().slice(0, 10);

                a.href = url;
                a.download = `${areaName}_${dateStr}.html`;
                a.click();

                URL.revokeObjectURL(url);
                setStatus(`保存完了 (${fetchedLogs.length} 件)`);

            } catch (e) {
                console.error(e);
                setStatus('エラー: ' + e.message, true);
            }
        }, 50);
    });

})();

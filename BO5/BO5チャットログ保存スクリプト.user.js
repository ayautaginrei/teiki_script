// ==UserScript==
// @name         BO5チャットログ保存スクリプト
// @namespace    http://tampermonkey.net/
// @version      1.1
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
    // 1. 最小限のスタイル補完
    //    サイトCSS未対応の要素のみ。レイアウト・色・フォントはサイトCSS流用。
    // ---------------------------------------------------------
    const style = document.createElement('style');
    style.textContent = `
        #log_save_panel { display: none; }
        #log_save_panel.active { display: block !important; }

        /* 日時入力（text型）をサイトのinputに合わせる */
        #log_save_panel input.lsp-datetime {
            background-color: #dddddd;
            border: none;
            outline: none;
            height: 3em;
            padding: 0.5em;
            font-size: 0.9em;
            margin: 2px;
            width: 13em;
            font-family: monospace;
        }
        #log_save_panel input.lsp-datetime:focus {
            background-color: #ffffff;
        }
        #log_save_panel input.lsp-datetime.lsp-invalid {
            background-color: #ffdddd;
        }
        /* ページ範囲用 number はサイトデフォルト幅が広いので上書き */
        #log_save_panel input[type="number"].page-input {
            min-width: 5em;
            width: 5em;
        }
        /* プログレスバー */
        #log-progress-bar-wrap {
            width: 100%;
            max-width: 400px;
            height: 8px;
            transform: skewX(15deg);
            background-color: #35211f;
            margin-top: 4px;
        }
        #log-progress-bar {
            width: 0%;
            height: 100%;
            background-color: #4ea05c;
            transition: width 0.3s ease;
        }
        /* 詳細設定 details */
        #log_save_panel details > summary {
            font-weight: bold;
            margin: 0.25em 0;
        }
        #log_save_panel details > div {
            padding-left: 0.5em;
        }
        /* 結合セクション区切り */
        #log_save_panel .lsp-divider {
            border: none;
            border-top: 1px dashed #ffffff30;
            margin: 0.25em 0;
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
        const remarkUl = chatSection.querySelector('.remark_area ul');
        if (!remarkUl) return;
        const chatForm = document.getElementById('chat_form');
        if (!chatForm) return;

        const logTab = document.createElement('li');
        logTab.dataset.menu = 'log_save';
        logTab.id = 'log_save_button';
        logTab.className = 'cap';
        logTab.setAttribute('data-tippy-content', 'チャットログを取得・保存します');
        logTab.innerHTML = '<span class="tab_ico fa-solid fa-floppy-disk"></span><span class="tab_label">LOG SAVE</span>';
        remarkUl.appendChild(logTab);

        logPanel = createPanel(false);
        chatForm.parentNode.insertBefore(logPanel, chatForm.nextSibling);

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
        const archiveUl = chatSection.querySelector('ul');
        if (!archiveUl) return;
        const talkListEl = chatSection.querySelector('.talk_list');
        if (!talkListEl) return;

        const logLi = document.createElement('li');
        logLi.id = 'log_save_button_archive';
        logLi.innerHTML = '<a href="#">LOG SAVE</a>';
        archiveUl.appendChild(logLi);

        logPanel = createPanel(true);
        talkListEl.parentNode.insertBefore(logPanel, talkListEl);

        logLi.querySelector('a').addEventListener('click', (e) => {
            e.preventDefault();
            logPanel.classList.contains('active')
                ? logPanel.classList.remove('active')
                : (logPanel.classList.add('active'), updateInfo());
        });
    }

    // ---------------------------------------------------------
    // 3. パネル HTML 生成
    //    OTHERタブと同じ構造: div[padding:0.5em] > p>b + p>small + コントロール
    // ---------------------------------------------------------
    function createPanel(isArchive) {
        const panel = document.createElement('div');
        panel.id = 'log_save_panel';

        panel.innerHTML = `
            <!-- 取得状況 -->
            <div style="padding: 0.5em;">
                <p><b>取得状況</b></p>
                <div style="display:flex; flex-wrap:wrap; gap:1.2em; margin: 0.25em 0;">
                    <div><small class="gray">現在地</small><br><b id="info-area">-</b></div>
                    <div><small class="gray">ゾーン</small><br><b id="info-zone">-</b></div>
                    <div><small class="gray">表示件数</small><br><b><span id="info-count">0</span> 件</b></div>
                    <div><small class="gray">取得件数</small><br><b class="blue"><span id="info-fetched">0</span> 件</b></div>
                </div>
            </div>

            <!-- 並び順 -->
            <div style="padding: 0.5em;">
                <label style="display:flex; align-items:center; gap:0.4em; cursor:pointer; width:fit-content;">
                    <input type="checkbox" id="chk-reverse">
                    <b>古い順に並べ替え</b>
                </label>
            </div>

            <!-- 取得モード（折りたたみ外） -->
            <div style="padding: 0.5em;">
                <label style="display:flex; align-items:center; gap:0.4em; cursor:pointer; width:fit-content;">
                    <input type="checkbox" id="chk-fetch-all">
                    <b>全件取得</b>
                </label>
            </div>

            <!-- 詳細取得設定（折りたたみ） -->
            <div style="padding: 0.5em;">
                <details id="fetch-detail-settings">
                    <summary>詳細取得設定</summary>
                    <div>

                        <!-- 範囲指定取得（全件取得と独立） -->
                        <div style="margin: 0.5em 0;">
                            <label style="display:flex; align-items:center; gap:0.4em; cursor:pointer; width:fit-content;">
                                <input type="checkbox" id="chk-fetch-range">
                                <b>範囲を指定して取得</b>
                            </label>
                            <div id="page-range-inputs" style="display:flex; align-items:center; gap:0.5em; flex-wrap:wrap; margin:0.25em 0;">
                                <small>開始</small>
                                <input type="number" id="page-from" class="page-input" min="1" placeholder="1">
                                <small>〜　終了</small>
                                <input type="number" id="page-to" class="page-input" min="1" placeholder="末尾">
                            </div>
                        </div>

                        <!-- 日時絞り込み -->
                        <div style="margin: 0.5em 0;">
                            <p><b>日時絞り込み</b></p>
                            <p><small>形式: YYYY-MM-DD HH:MM</small></p>
                            <div style="display:grid; grid-template-columns:3em auto; align-items:center; gap:0.4em; margin:0.25em 0;">
                                <small style="text-align:right;">From</small>
                                <input type="text" id="filter-from" class="lsp-datetime" placeholder="2026-01-01 00:00" maxlength="16">
                                <small style="text-align:right;">To</small>
                                <input type="text" id="filter-to" class="lsp-datetime" placeholder="2026-12-31 23:59" maxlength="16">
                            </div>
                        </div>

                    </div>
                </details>
            </div>

            <!-- 操作ボタン -->
            <div style="padding: 0.5em;">
                <div style="display:flex; gap:0.5em; flex-wrap:wrap; margin: 0.25em 0;">
                    <button id="btn-update-info" data-tippy-content="現在表示しているエリアのチャットログを取得します">ログを取得</button>
                    <button id="btn-save-html" data-tippy-content="取得したログをHTMLとして保存します">HTML保存</button>
                </div>
                <div id="log-progress" style="display:none; margin-top:0.5em;">
                    <small class="gray" id="log-progress-text"></small>
                    <div id="log-progress-bar-wrap"><div id="log-progress-bar"></div></div>
                </div>
                <p id="log-status" class="blue" style="font-weight:bold; margin:0.25em 0;">ログを取得してから保存してください</p>
            </div>

            <!-- 結合（折りたたみ） -->
            <div style="padding: 0.5em;">
                <hr class="lsp-divider">
                <details id="merge-section">
                    <summary>保存済みログの結合</summary>
                    <div>
                        <p><small>過去に保存したHTMLファイルを複数選択して1つにまとめます。</small></p>
                        <div style="margin: 0.5em 0;">
                            <input type="file" id="merge-file-input" accept=".html,.htm" multiple>
                        </div>
                        <div style="margin: 0.4em 0;">
                            <label style="display:flex; align-items:center; gap:0.4em; cursor:pointer; width:fit-content;">
                                <input type="checkbox" id="chk-merge-dedupe" checked>
                                <b>重複ログを除去する</b>
                            </label>
                        </div>
                        <div style="margin: 0.4em 0;">
                            <label style="display:flex; align-items:center; gap:0.4em; cursor:pointer; width:fit-content;">
                                <input type="checkbox" id="chk-merge-sort">
                                <b>日時順に並べ替える（古い順）</b>
                            </label>
                        </div>
                        <div style="margin: 0.5em 0;">
                            <button id="btn-merge-html" data-tippy-content="選択したHTMLファイルのログを結合して保存します">選択したファイルを結合保存</button>
                        </div>
                        <p id="merge-status" class="blue" style="font-weight:bold; margin:0.25em 0;">結合したいファイルを選択してください</p>
                    </div>
                </details>
            </div>
        `;
        return panel;
    }

    // ---------------------------------------------------------
    // 4. グローバル変数
    // ---------------------------------------------------------
    let fetchedLogs = [];
    let isFetching  = false;

    // ---------------------------------------------------------
    // 5. パネル内イベント登録
    // ---------------------------------------------------------

    // 「範囲を指定して取得」チェックに連動してページ範囲入力のdisabled切替
    function syncPageRangeState() {
        const enabled = document.getElementById('chk-fetch-range').checked;
        ['page-from', 'page-to'].forEach(id => {
            const el = document.getElementById(id);
            el.disabled = !enabled;
            el.style.opacity = enabled ? '' : '0.4';
        });
    }
    document.getElementById('chk-fetch-range').addEventListener('change', syncPageRangeState);
    syncPageRangeState(); // 初期状態を適用

    // 日時入力バリデーション（リアルタイム）
    const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
    ['filter-from', 'filter-to'].forEach(id => {
        document.getElementById(id).addEventListener('input', (e) => {
            const v = e.target.value;
            e.target.classList.toggle('lsp-invalid', v !== '' && !DATETIME_RE.test(v));
        });
    });

    document.getElementById('btn-update-info').addEventListener('click', async () => {
        if (isFetching) return;
        await fetchLogs();
    });

    document.getElementById('btn-save-html').addEventListener('click', () => saveHtml());

    document.getElementById('btn-merge-html').addEventListener('click', () => mergeHtmlFiles());

    // ---------------------------------------------------------
    // 6. ユーティリティ
    // ---------------------------------------------------------
    function setStatus(text, isError = false) {
        const el = document.getElementById('log-status');
        el.textContent = text;
        el.className = isError ? 'red' : 'blue';
        el.style.fontWeight = 'bold';
        el.style.margin = '0.25em 0';
    }

    function setMergeStatus(text, isError = false) {
        const el = document.getElementById('merge-status');
        el.textContent = text;
        el.className = isError ? 'red' : 'blue';
        el.style.fontWeight = 'bold';
        el.style.margin = '0.25em 0';
    }

    function updateInfo() {
        let areaName = '-';
        if (IS_LOBBY) {
            const el = document.querySelector('.area_info .area_title');
            if (el) areaName = el.textContent.split('-')[0].trim();
        } else if (IS_ARCHIVE) {
            const b = document.querySelector('.chara_container .area_info b');
            if (b && b.childNodes[0]) areaName = b.childNodes[0].textContent.split('-')[0].trim();
        }

        let zoneName = '-';
        const zoneEl = document.getElementById('zone');
        if (zoneEl) {
            zoneName = zoneEl.textContent.trim();
        } else if (IS_ARCHIVE) {
            const sp = document.querySelector('.chara_container .area_info b span');
            if (sp) zoneName = sp.textContent.trim();
        }

        const count = document.querySelectorAll('.talk_list .chat_shout').length;
        document.getElementById('info-area').textContent  = areaName;
        document.getElementById('info-zone').textContent  = zoneName;
        document.getElementById('info-count').textContent = count;
    }

    function updateProgress(cur, total) {
        document.getElementById('log-progress').style.display = 'block';
        const pct = total > 0 ? Math.round((cur / total) * 100) : 0;
        document.getElementById('log-progress-bar').style.width = pct + '%';
        document.getElementById('log-progress-text').textContent =
            `取得中... ページ ${cur} / ${total} 付近 (${pct}%)`;
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
        const v = new URLSearchParams(location.search).get(name);
        if (v) return v;
        const h = document.querySelector(`input[name="${name}"]`);
        return h ? h.value : null;
    }

    function parseLogTime(el) {
        const t = el.querySelector('.chat_time');
        if (!t) return null;
        const d = new Date(t.textContent.trim().replace(' ', 'T'));
        return isNaN(d.getTime()) ? null : d;
    }

    function passesDatetimeFilter(el, fromDate, toDate) {
        if (!fromDate && !toDate) return true;
        const t = parseLogTime(el);
        if (!t) return true;
        if (fromDate && t < fromDate) return false;
        if (toDate   && t > toDate)   return false;
        return true;
    }

    function getDatetimeFilter() {
        const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
        const fv = document.getElementById('filter-from').value.trim();
        const tv = document.getElementById('filter-to').value.trim();
        const toDate = (val) => {
            if (!val || !DATETIME_RE.test(val)) return null;
            const d = new Date(val.replace(' ', 'T'));
            return isNaN(d.getTime()) ? null : d;
        };
        return { fromDate: toDate(fv), toDate: toDate(tv) };
    }

    // ---------------------------------------------------------
    // 7. ページャーから最終ページ番号を取得
    // ---------------------------------------------------------
    async function detectLastPage(buildUrl) {
        // page=1 のページャーを見て最終ページ番号を確認する
        try {
            const res = await fetch(buildUrl(1));
            if (!res.ok) return null;
            const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
            // ページャーの最後のリンクの page= パラメータを取得
            const pagerLinks = Array.from(doc.querySelectorAll('.pager a[href]'));
            let maxPage = 1;
            pagerLinks.forEach(a => {
                const m = a.href.match(/[?&]page=(\d+)/);
                if (m) maxPage = Math.max(maxPage, parseInt(m[1], 10));
            });
            return maxPage;
        } catch (e) {
            console.warn('最終ページ検出エラー:', e);
            return null;
        }
    }

    // ---------------------------------------------------------
    // 8. ログ取得（現在ページ / 範囲指定 / 全件 を統合）
    // ---------------------------------------------------------
    async function fetchLogs() {
        isFetching = true;
        setStatus('ログを取得中...');
        try {
            fetchedLogs = [];
            const { fromDate, toDate } = getDatetimeFilter();
            const fetchAll   = document.getElementById('chk-fetch-all').checked;
            const fetchRange = document.getElementById('chk-fetch-range').checked;

            // 現在ページDOMキャッシュ
            const currentPage = parseInt(getParam('page') || '1', 10);
            const currentPageLogs = (() => {
                const tl = document.querySelector('.talk_list');
                return tl ? Array.from(tl.querySelectorAll('.chat_shout')).map(el => el.cloneNode(true)) : [];
            })();

            // 全件取得も範囲指定もOFFなら現在ページのみ
            if (!fetchAll && !fetchRange) {
                fetchedLogs = currentPageLogs
                    .filter(el => passesDatetimeFilter(el, fromDate, toDate));
                document.getElementById('info-fetched').textContent = fetchedLogs.length;
                setStatus(`取得完了：計 ${fetchedLogs.length} 件のログを取得しました`);
                return;
            }

            function buildUrl(page) {
                if (IS_ARCHIVE) {
                    return `archives.php?loc=${getParam('loc')||'stand'}&area=${getParam('area')||'0'}&view=${getParam('view')||'0'}&page=${page}`;
                }
                return `lobby.php?area=${getParam('area')||'stand'}&list=${getParam('list')||'3'}&zone=${getParam('zone')||'0'}&page=${page}`;
            }

            // ページ範囲の決定
            const pfv = document.getElementById('page-from').value;
            const ptv = document.getElementById('page-to').value;
            const pageFrom = (fetchRange && pfv) ? Math.max(1, parseInt(pfv, 10)) : 1;
            let pageTo     = (fetchRange && ptv) ? Math.max(pageFrom, parseInt(ptv, 10)) : null;

            // 全件取得時: 先に最終ページを確認して正確な進捗バーを出す
            if (fetchAll && !pageTo) {
                setStatus('最終ページを確認中...');
                const last = await detectLastPage(buildUrl);
                if (last) {
                    pageTo = last;
                    setStatus(`全 ${pageTo} ページを取得します...`);
                }
            }

            const parser = new DOMParser();
            let page = pageFrom;
            let hasMore = true;

            while (hasMore) {
                if (pageTo && page > pageTo) break;
                updateProgress(page - pageFrom + 1, pageTo ? (pageTo - pageFrom + 1) : (page + 3));

                // 現在ページはDOMキャッシュを使用
                if (page === currentPage) {
                    const filtered = currentPageLogs.filter(el => passesDatetimeFilter(el, fromDate, toDate));
                    fetchedLogs.push(...filtered);
                    document.getElementById('info-fetched').textContent = fetchedLogs.length;
                    setStatus(`ページ ${page}/${pageTo ?? '?'} を取得中... (計 ${fetchedLogs.length} 件)`);
                    page++;
                    continue;
                }

                try {
                    const res = await fetch(buildUrl(page));
                    if (!res.ok) break;
                    const doc = parser.parseFromString(await res.text(), 'text/html');
                    const tl  = doc.querySelector('.talk_list');
                    if (!tl || tl.children.length === 0) { hasMore = false; break; }
                    const logs = Array.from(tl.querySelectorAll('.chat_shout'));
                    if (logs.length === 0) { hasMore = false; break; }
                    const filtered = logs
                        .filter(el => passesDatetimeFilter(el, fromDate, toDate))
                        .map(el => el.cloneNode(true));
                    fetchedLogs.push(...filtered);
                    document.getElementById('info-fetched').textContent = fetchedLogs.length;
                    setStatus(`ページ ${page}/${pageTo ?? '?'} を取得中... (計 ${fetchedLogs.length} 件)`);
                    page++;
                    await new Promise(r => setTimeout(r, 500));
                } catch (err) {
                    console.error(`ページ ${page} の取得エラー:`, err);
                    hasMore = false;
                }
            }

            if (fetchedLogs.length === 0)
                fetchedLogs = currentPageLogs.filter(el => passesDatetimeFilter(el, fromDate, toDate));

            hideProgress();
            document.getElementById('info-fetched').textContent = fetchedLogs.length;
            fetchedLogs.length > 0
                ? setStatus(`取得完了：計 ${fetchedLogs.length} 件のログを取得しました`)
                : setStatus('エラー: ログが見つかりませんでした', true);

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
        const toAbs = (url) => { try { return new URL(url, location.href).href; } catch (e) { return url; } };
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
            a.style.cssText += ';cursor:default;pointer-events:none;text-decoration:none;';
        });
        doc.querySelectorAll('form').forEach(f => { f.onsubmit = () => false; });
        doc.querySelectorAll('button, input[type="submit"], input[type="button"]').forEach(b => {
            b.disabled = true;
            b.style.cssText += ';pointer-events:none;opacity:0.5;';
        });
    }

    // ---------------------------------------------------------
    // 11. HTML保存
    // ---------------------------------------------------------
    function saveHtml() {
        if (fetchedLogs.length === 0) { setStatus('エラー: 先にログを取得してください', true); return; }
        setStatus('HTML生成中...');
        try {
            const cloneDoc = document.documentElement.cloneNode(true);
            const tl = cloneDoc.querySelector('.talk_list');
            if (tl) {
                tl.innerHTML = '';
                let logs = [...fetchedLogs];
                if (document.getElementById('chk-reverse').checked) logs.reverse();
                logs.forEach(l => tl.appendChild(l.cloneNode(true)));
            }
            makeLinksAbsolute(cloneDoc);
            removeLinks(cloneDoc);

            const rm = [
                'script', 'iframe', '#log_save_panel',
                '.menu_button', '.acount_change', '.chat_tool', '.chat_menu', '.mention_tools',
                '.modals', '.bookmark_add', '.noticearea', '#custom-toast',
                '[data-tippy-root]', '.tippy-box',
                '.side_menu', '#overlay', '#icon_choice',
                'header', '.container.content_box.bookmaker', '.talk_category.button_list',
            ];
            if (IS_LOBBY) rm.push(
                '.remark_area', '.container.schedule', '.container.logs',
                'section.container.chatlobby .status_area', '.button_list.tab-buttons',
                '.lobby_info', '.btst_choice', '.battle_style',
            );
            if (IS_ARCHIVE) rm.push(
                'section.container.chat > ul', '#archive_move', 'section.container.chatlobby',
            );
            if (document.getElementById('chk-fetch-all').checked || document.getElementById('chk-fetch-range').checked) rm.push('.pager');
            rm.forEach(sel => cloneDoc.querySelectorAll(sel).forEach(el => el.remove()));

            cloneDoc.querySelectorAll('.mention').forEach(m => {
                const t = m.querySelector('.chat_time');
                m.innerHTML = t ? `<span class="chat_time gray small">${t.textContent}</span>` : '';
            });

            const area = (document.getElementById('info-area').textContent || 'log').replace(/\s+/g, '_');
            const zone = (document.getElementById('info-zone').textContent || '').replace(/\s+/g, '_');
            const zp   = (zone && zone !== '-') ? `_${zone}` : '';
            const fn   = `${IS_ARCHIVE ? 'BO5_archive' : 'BO5_chat'}_${area}${zp}_${getJstDateStr()}.html`;

            const blob = new Blob(['<!DOCTYPE html>\n' + cloneDoc.outerHTML], { type: 'text/html' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url; a.download = fn; a.click();
            URL.revokeObjectURL(url);
            setStatus(`保存完了：${fn} (${fetchedLogs.length} 件)`);
        } catch (e) {
            console.error(e);
            setStatus('エラー: ' + e.message, true);
        }
    }

    // ---------------------------------------------------------
    // 12. 保存済みHTMLファイルの結合
    // ---------------------------------------------------------
    function getLogDedupeKey(el) {
        const t = el.querySelector('.chat_time');
        return (t ? t.textContent.trim() : '') + '|' + el.textContent.replace(/\s+/g, ' ').trim();
    }
    function getLogTimeText(el) {
        const t = el.querySelector('.chat_time');
        return t ? t.textContent.trim() : null;
    }

    async function mergeHtmlFiles() {
        const files = Array.from(document.getElementById('merge-file-input').files || []);
        if (files.length === 0) { setMergeStatus('エラー: ファイルを選択してください', true); return; }
        setMergeStatus(`読み込み中... (0/${files.length})`);

        const parser  = new DOMParser();

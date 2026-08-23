// ==UserScript==
// @name         BO5チャットログ保存スクリプト
// @namespace    http://tampermonkey.net/
// @version      1.2.1
// @description  ページャーを遡ってチャットログを取得し、HTMLとして保存します (lobby / archives 両対応)
// @author       ayautaginrei
// @match        https://wdrb.work/bo5/lobby.php*
// @match        https://wdrb.work/bo5/archives.php*
// @upgradeURL   https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/BO5/BO5%E3%83%81%E3%83%A3%E3%83%83%E3%83%88%E3%83%AD%E3%82%B0%E4%BF%9D%E5%AD%98%E3%82%B9%E3%82%AF%E3%83%AA%E3%83%97%E3%83%88.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var IS_ARCHIVE = location.pathname.includes('archives.php');
    var IS_LOBBY   = location.pathname.includes('lobby.php');

    // スタイル補完
    var style = document.createElement('style');
    style.textContent = [
        '#log_save_panel { display: none; }',
        '#log_save_panel.active { display: block !important; }',
        '#log_save_panel input.lsp-datetime {',
        '    background-color: #dddddd; border: none; outline: none;',
        '    height: 3em; padding: 0.5em; font-size: 0.9em; margin: 2px;',
        '    width: 13em; font-family: monospace;',
        '}',
        '#log_save_panel input.lsp-datetime:focus { background-color: #ffffff; }',
        '#log_save_panel input.lsp-datetime.lsp-invalid { background-color: #ffdddd; }',
        '#log_save_panel input[type="number"].page-input { min-width: 5em; width: 5em; }',
        '#log-progress-bar-wrap {',
        '    width: 100%; max-width: 400px; height: 8px;',
        '    transform: skewX(15deg); background-color: #35211f; margin-top: 4px;',
        '}',
        '#log-progress-bar { width: 0%; height: 100%; background-color: #4ea05c; transition: width 0.3s ease; }',
        '#log_save_panel details > summary { font-weight: bold; margin: 0.25em 0; }',
        '#log_save_panel details > div { padding-left: 0.5em; }',
        '#log_save_panel .lsp-divider { border: none; border-top: 1px dashed #ffffff30; margin: 0.25em 0; }'
    ].join('\n');
    document.head.appendChild(style);

    var chatSection = document.querySelector('section.container.chat');
    if (!chatSection) return;

    var logPanel;

    if (IS_LOBBY) {
        var remarkUl = chatSection.querySelector('.remark_area ul');
        if (!remarkUl) return;
        var chatForm = document.getElementById('chat_form');
        if (!chatForm) return;

        var logTab = document.createElement('li');
        logTab.dataset.menu = 'log_save';
        logTab.id = 'log_save_button';
        logTab.className = 'cap';
        logTab.setAttribute('data-tippy-content', 'チャットログを取得・保存します');
        logTab.innerHTML = '<span class="tab_ico fa-solid fa-floppy-disk"></span><span class="tab_label">LOG SAVE</span>';
        remarkUl.appendChild(logTab);

        logPanel = createPanel();
        chatForm.parentNode.insertBefore(logPanel, chatForm.nextSibling);

        var allTabButtons = remarkUl.querySelectorAll('li[data-menu]');
        var managedForms  = ['chat_form', 'wis_form', 'shop_form', 'others_form']
                            .map(function(id) { return document.getElementById(id); });

        function hideAllForms() {
            managedForms.forEach(function(el) { if (el) el.style.display = 'none'; });
            document.querySelectorAll('.remark_area > *:not(ul)').forEach(function(el) {
                if (el.id !== 'log_save_panel') el.style.display = 'none';
            });
            logPanel.classList.remove('active');
        }

        logTab.addEventListener('click', function() {
            allTabButtons.forEach(function(li) { li.classList.remove('selected'); });
            logTab.classList.add('selected');
            hideAllForms();
            logPanel.classList.add('active');
            updateInfo();
        });

        allTabButtons.forEach(function(btn) {
            if (btn.id === 'log_save_button') return;
            btn.addEventListener('click', function() { logPanel.classList.remove('active'); });
        });

    } else if (IS_ARCHIVE) {
        var archiveUl = chatSection.querySelector('ul');
        if (!archiveUl) return;
        var talkListEl = chatSection.querySelector('.talk_list');
        if (!talkListEl) return;

        var logLi = document.createElement('li');
        logLi.id = 'log_save_button_archive';
        logLi.innerHTML = '<a href="#">LOG SAVE</a>';
        archiveUl.appendChild(logLi);

        logPanel = createPanel();
        talkListEl.parentNode.insertBefore(logPanel, talkListEl);

        logLi.querySelector('a').addEventListener('click', function(e) {
            e.preventDefault();
            if (logPanel.classList.contains('active')) {
                logPanel.classList.remove('active');
            } else {
                logPanel.classList.add('active');
                updateInfo();
            }
        });
    }

    function createPanel() {
        var panel = document.createElement('div');
        panel.id = 'log_save_panel';

        var h = '';
        h += '<div style="padding:0.5em;">';
        h +=   '<p><b>取得状況</b></p>';
        h +=   '<div style="display:flex;flex-wrap:wrap;gap:1.2em;margin:0.25em 0;">';
        h +=     '<div><small class="gray">現在地</small><br><b id="info-area">-</b></div>';
        h +=     '<div><small class="gray">ゾーン</small><br><b id="info-zone">-</b></div>';
        h +=     '<div><small class="gray">表示件数</small><br><b><span id="info-count">0</span> 件</b></div>';
        h +=     '<div><small class="gray">取得件数</small><br><b class="blue"><span id="info-fetched">0</span> 件</b></div>';
        h +=   '</div>';
        h += '</div>';

        h += '<div style="padding:0.5em;">';
        h +=   '<label style="display:flex;align-items:center;gap:0.4em;cursor:pointer;width:fit-content;">';
        h +=     '<input type="checkbox" id="chk-reverse"><b>古い順に並べ替え</b>';
        h +=   '</label>';
        h += '</div>';

        h += '<div style="padding:0.5em;">';
        h +=   '<label style="display:flex;align-items:center;gap:0.4em;cursor:pointer;width:fit-content;">';
        h +=     '<input type="checkbox" id="chk-fetch-all"><b>全件取得</b>';
        h +=   '</label>';
        h +=   '<p><small>ページャーを遡って全ページのログを取得します。</small></p>';
        h += '</div>';

        h += '<div style="padding:0.5em;">';
        h +=   '<details id="fetch-detail-settings">';
        h +=     '<summary>詳細取得設定</summary>';
        h +=     '<div>';
        h +=       '<div style="margin:0.5em 0;">';
        h +=         '<label style="display:flex;align-items:center;gap:0.4em;cursor:pointer;width:fit-content;">';
        h +=           '<input type="checkbox" id="chk-fetch-range"><b>範囲を指定して取得</b>';
        h +=         '</label>';
        h +=         '<p><small>「全件取得」と併用可。空欄で制限なし。</small></p>';
        h +=         '<div style="display:flex;align-items:center;gap:0.5em;flex-wrap:wrap;margin:0.25em 0;">';
        h +=           '<small>開始</small>';
        h +=           '<input type="number" id="page-from" class="page-input" min="1" placeholder="1">';
        h +=           '<small>～　終了</small>';
        h +=           '<input type="number" id="page-to" class="page-input" min="1" placeholder="末尾">';
        h +=         '</div>';
        h +=       '</div>';
        h +=       '<div style="margin:0.5em 0;">';
        h +=         '<p><b>日時絞り込み</b></p>';
        h +=         '<p><small>形式: YYYY-MM-DD HH:MM　空欄で制限なし。</small></p>';
        h +=         '<div style="display:grid;grid-template-columns:3em auto;align-items:center;gap:0.4em;margin:0.25em 0;">';
        h +=           '<small style="text-align:right;">From</small>';
        h +=           '<input type="text" id="filter-from" class="lsp-datetime" placeholder="2026-01-01 00:00" maxlength="16">';
        h +=           '<small style="text-align:right;">To</small>';
        h +=           '<input type="text" id="filter-to" class="lsp-datetime" placeholder="2026-12-31 23:59" maxlength="16">';
        h +=         '</div>';
        h +=       '</div>';
        h +=     '</div>';
        h +=   '</details>';
        h += '</div>';

        h += '<div style="padding:0.5em;">';
        h +=   '<div style="display:flex;gap:0.5em;flex-wrap:wrap;margin:0.25em 0;">';
        h +=     '<button id="btn-update-info">ログを取得</button>';
        h +=     '<button id="btn-save-html">HTML保存</button>';
        h +=   '</div>';
        h +=   '<div id="log-progress" style="display:none;margin-top:0.5em;">';
        h +=     '<small class="gray" id="log-progress-text"></small>';
        h +=     '<div id="log-progress-bar-wrap"><div id="log-progress-bar"></div></div>';
        h +=   '</div>';
        h +=   '<p id="log-status" class="blue" style="font-weight:bold;margin:0.25em 0;">ログを取得してから保存してください</p>';
        h += '</div>';

        h += '<div style="padding:0.5em;">';
        h +=   '<hr class="lsp-divider">';
        h +=   '<details id="merge-section">';
        h +=     '<summary>保存済みログの結合</summary>';
        h +=     '<div>';
        h +=       '<p><small>過去に保存したHTMLファイルを複数選択して1つにまとめます。</small></p>';
        h +=       '<div style="margin:0.5em 0;">';
        h +=         '<input type="file" id="merge-file-input" accept=".html,.htm" multiple>';
        h +=       '</div>';
        h +=       '<div style="margin:0.4em 0;">';
        h +=         '<label style="display:flex;align-items:center;gap:0.4em;cursor:pointer;width:fit-content;">';
        h +=           '<input type="checkbox" id="chk-merge-dedupe" checked><b>重複ログを除去する</b>';
        h +=         '</label>';
        h +=       '</div>';
        h +=       '<div style="margin:0.4em 0;">';
        h +=         '<p><b>並べ替え</b></p>';
        h +=         '<label style="display:flex;align-items:center;gap:0.4em;cursor:pointer;width:fit-content;">';
        h +=           '<input type="radio" name="merge-sort" id="merge-sort-none" value="none" checked>並べ替えない';
        h +=         '</label>';
        h +=         '<label style="display:flex;align-items:center;gap:0.4em;cursor:pointer;width:fit-content;">';
        h +=           '<input type="radio" name="merge-sort" id="merge-sort-asc" value="asc">古い順に並べる';
        h +=         '</label>';
        h +=         '<label style="display:flex;align-items:center;gap:0.4em;cursor:pointer;width:fit-content;">';
        h +=           '<input type="radio" name="merge-sort" id="merge-sort-desc" value="desc">新しい順に並べる';
        h +=         '</label>';
        h +=       '</div>';
        h +=       '<div style="margin:0.5em 0;">';
        h +=         '<button id="btn-merge-html">選択したファイルを結合保存</button>';
        h +=       '</div>';
        h +=       '<p id="merge-status" class="blue" style="font-weight:bold;margin:0.25em 0;">結合したいファイルを選択してください</p>';
        h +=     '</div>';
        h +=   '</details>';
        h += '</div>';

        panel.innerHTML = h;
        return panel;
    }

    var fetchedLogs = [];
    var isFetching  = false;

    // 範囲チェックに連動してpage入力のdisabled切替
    function syncPageRangeState() {
        var enabled = document.getElementById('chk-fetch-range').checked;
        ['page-from', 'page-to'].forEach(function(id) {
            var el = document.getElementById(id);
            el.disabled = !enabled;
            el.style.opacity = enabled ? '' : '0.4';
        });
    }
    document.getElementById('chk-fetch-range').addEventListener('change', syncPageRangeState);
    syncPageRangeState();

    // 日時入力バリデーション
    var DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
    ['filter-from', 'filter-to'].forEach(function(id) {
        document.getElementById(id).addEventListener('input', function(e) {
            var v = e.target.value;
            e.target.classList.toggle('lsp-invalid', v !== '' && !DATETIME_RE.test(v));
        });
    });

    document.getElementById('btn-update-info').addEventListener('click', function() {
        if (isFetching) return;
        fetchLogs();
    });
    document.getElementById('btn-save-html').addEventListener('click', function() { saveHtml(); });
    document.getElementById('btn-merge-html').addEventListener('click', function() { mergeHtmlFiles(); });

    function setStatus(text, isError) {
        var el = document.getElementById('log-status');
        el.textContent = text;
        el.className = isError ? 'red' : 'blue';
        el.style.fontWeight = 'bold';
        el.style.margin = '0.25em 0';
    }

    function setMergeStatus(text, isError) {
        var el = document.getElementById('merge-status');
        el.textContent = text;
        el.className = isError ? 'red' : 'blue';
        el.style.fontWeight = 'bold';
        el.style.margin = '0.25em 0';
    }

    function updateInfo() {
        var areaName = '-';
        if (IS_LOBBY) {
            var el = document.querySelector('.area_info .area_title');
            if (el) areaName = el.textContent.split('-')[0].trim();
        } else if (IS_ARCHIVE) {
            var b = document.querySelector('.chara_container .area_info b');
            if (b && b.childNodes[0]) areaName = b.childNodes[0].textContent.split('-')[0].trim();
        }

        var zoneName = '-';
        var zoneEl = document.getElementById('zone');
        if (zoneEl) {
            zoneName = zoneEl.textContent.trim();
        } else if (IS_ARCHIVE) {
            var sp = document.querySelector('.chara_container .area_info b span');
            if (sp) zoneName = sp.textContent.trim();
        }

        var count = document.querySelectorAll('.talk_list .chat_shout').length;
        document.getElementById('info-area').textContent  = areaName;
        document.getElementById('info-zone').textContent  = zoneName;
        document.getElementById('info-count').textContent = count;
    }

    function updateProgress(cur, total) {
        document.getElementById('log-progress').style.display = 'block';
        var pct = total > 0 ? Math.round((cur / total) * 100) : 0;
        document.getElementById('log-progress-bar').style.width = pct + '%';
        document.getElementById('log-progress-text').textContent =
            '取得中... ページ ' + cur + ' / ' + total + ' (' + pct + '%)';
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
        var v = new URLSearchParams(location.search).get(name);
        if (v) return v;
        var h = document.querySelector('input[name="' + name + '"]');
        return h ? h.value : null;
    }

    function parseLogTime(el) {
        var t = el.querySelector('.chat_time');
        if (!t) return null;
        var d = new Date(t.textContent.trim().replace(' ', 'T'));
        return isNaN(d.getTime()) ? null : d;
    }

    function passesDatetimeFilter(el, fromDate, toDate) {
        if (!fromDate && !toDate) return true;
        var t = parseLogTime(el);
        if (!t) return true;
        if (fromDate && t < fromDate) return false;
        if (toDate   && t > toDate)   return false;
        return true;
    }

    function getDatetimeFilter() {
        var fv = document.getElementById('filter-from').value.trim();
        var tv = document.getElementById('filter-to').value.trim();
        function toDate(val) {
            if (!val || !DATETIME_RE.test(val)) return null;
            var d = new Date(val.replace(' ', 'T'));
            return isNaN(d.getTime()) ? null : d;
        }
        return { fromDate: toDate(fv), toDate: toDate(tv) };
    }

    // 現在の表示件数をDOMのselectから取得する（URLパラメータが取れない場合のフォールバック）
    function getCurrentList() {
        var v = getParam('list');
        if (v) return v;
        // OTHERタブのselectから選択中の値を取得
        var sel = document.querySelector('select[name="disp_num"], select[name="list"]');
        if (sel) return sel.value;
        // さらにフォールバック：現在のURLのリンクから list= を探す
        var listLink = document.querySelector('a[href*="list="]');
        if (listLink) {
            var m = (listLink.getAttribute('href') || '').match(/[?&]list=(\d+)/);
            if (m) return m[1];
        }
        return '72'; // 最終フォールバック（デフォルトは72件）
    }

    // 1ページあたりの表示件数（view）をユーザーごとの設定に合わせて動的に検出する。
    // サイト側の「表示件数設定」はユーザーによって異なる（12件とは限らない）ため、
    // 固定値をハードコードせず、可能な限り実際のページから読み取る。
    function getViewCount(doc) {
        doc = doc || document;
        // 1) URLパラメータ / hidden inputで明示されていればそれを使う
        var v = getParam('view');
        if (v) return v;
        // 2) 現在ページ内にある view= を含むリンク（ページャー等）から拾う
        var link = doc.querySelector('a[href*="view="]');
        if (link) {
            var m = (link.getAttribute('href') || '').match(/[?&]view=(\d+)/);
            if (m) return m[1];
        }
        // 3) select等の表示件数指定コントロールがあれば拾う
        var sel = doc.querySelector('select[name="view"]');
        if (sel && sel.value) return sel.value;
        // 4) 最終フォールバック：現在ページに実際に表示されているログ件数を「1ページあたりの件数」とみなす
        var cnt = doc.querySelectorAll('.talk_list .chat_shout').length;
        return cnt > 0 ? String(cnt) : '12';
    }

    // ページャーの「表示ラベル」と実際のURL用ページ番号（page=）のズレ（オフセット）と、
    // 現在何ページ目を表示しているか（表示ラベル基準・1始まり）を、
    // 決め打ちせず実際のページャーDOMから読み取る。
    // 例）現在ページが「1」でリンクが「2→page=1」「3→page=2」「4→page=3」の場合、
    //     offset=1（ラベル - page番号 = 1）、currentLabel=1 となる。
    function getPagerInfo(doc) {
        doc = doc || document;
        var pager = doc.querySelector('.pager');
        if (!pager) {
            // ページャーが無い＝1ページしかない
            return { offset: 1, currentLabel: 1, maxLabel: 1 };
        }
        var offset = 1; // 既定値（従来の挙動＝1ページ目はpage未指定）
        var maxLabel = 1;
        var links = Array.from(pager.querySelectorAll('a[href*="page="]'));
        links.forEach(function(a) {
            var m = (a.getAttribute('href') || '').match(/[?&]page=(\d+)/);
            var label = parseInt((a.textContent || '').trim(), 10);
            if (m && !isNaN(label)) {
                offset = label - parseInt(m[1], 10);
                maxLabel = Math.max(maxLabel, label);
            }
        });
        var curEl = pager.querySelector('.current');
        var currentLabel = curEl ? parseInt((curEl.textContent || '').trim(), 10) : 1;
        if (isNaN(currentLabel)) currentLabel = 1;
        maxLabel = Math.max(maxLabel, currentLabel);
        return { offset: offset, currentLabel: currentLabel, maxLabel: maxLabel };
    }

    // uiPage: ユーザーから見た「何ページ目か」（1始まり）。内部的なpage=パラメータへ変換する。
    // 1ページ目に相当するpage番号（<=0）の場合はpage自体を付与しない（サイトの実挙動に合わせる）。
    function buildUrl(uiPage, offset, viewCount) {
        var siteParam = uiPage - offset;
        var pageQS = siteParam > 0 ? ('&page=' + siteParam) : '';
        if (IS_ARCHIVE) {
            return 'archives.php?loc=' + (getParam('loc') || 'stand') +
                   '&area=' + (getParam('area') || '0') +
                   '&view=' + (getParam('view') || viewCount) +
                   pageQS;
        }
        return 'lobby.php?area=' + (getParam('area') || 'stand') +
               '&list=' + getCurrentList() +
               '&zone=' + (getParam('zone') || '0') +
               '&view=' + viewCount +
               pageQS;
    }

    // uiPage=1（先頭ページ）をfetchしてページャーから最終ページ・オフセットを取得。1ページ目のログも返す。
    async function detectLastPage(offset, viewCount) {
        try {
            var res = await fetch(buildUrl(1, offset, viewCount));
            if (!res.ok) return { lastPage: null, page1Logs: [], offset: offset };
            var doc = new DOMParser().parseFromString(await res.text(), 'text/html');
            var info = getPagerInfo(doc);
            var tl = doc.querySelector('.talk_list');
            var page1Logs = tl
                ? Array.from(tl.querySelectorAll('.chat_shout')).map(function(el) { return el.cloneNode(true); })
                : [];
            return { lastPage: info.maxLabel, page1Logs: page1Logs, offset: info.offset };
        } catch (e) {
            console.warn('最終ページ検出エラー:', e);
            return { lastPage: null, page1Logs: [], offset: offset };
        }
    }

    async function fetchLogs() {
        isFetching = true;
        setStatus('ログを取得中...');
        try {
            fetchedLogs = [];
            var filter = getDatetimeFilter();
            var fromDate = filter.fromDate;
            var toDate   = filter.toDate;
            var fetchAll   = document.getElementById('chk-fetch-all').checked;
            var fetchRange = document.getElementById('chk-fetch-range').checked;

            // 現在ページ番号・ページ番号オフセット・1ページあたりの表示件数は、
            // URLパラメータの有無を決め打ちせず、実際に表示中のページャー／DOMから検出する
            // （サイトのページ番号の始まり方や、ユーザーごとの表示件数設定に依存しないようにするため）。
            var pagerInfo   = getPagerInfo(document);
            var currentPage = pagerInfo.currentLabel;
            var pageOffset  = pagerInfo.offset;
            var viewCount   = getViewCount(document);

            var tl0 = document.querySelector('.talk_list');
            var currentPageLogs = tl0
                ? Array.from(tl0.querySelectorAll('.chat_shout')).map(function(el) { return el.cloneNode(true); })
                : [];

            // 両方OFFなら現在ページのみ
            if (!fetchAll && !fetchRange) {
                fetchedLogs = currentPageLogs.filter(function(el) {
                    return passesDatetimeFilter(el, fromDate, toDate);
                });
                document.getElementById('info-fetched').textContent = fetchedLogs.length;
                setStatus('取得完了：計 ' + fetchedLogs.length + ' 件のログを取得しました');
                return;
            }

            var pfv = document.getElementById('page-from').value;
            var ptv = document.getElementById('page-to').value;
            var pageFrom = (fetchRange && pfv) ? Math.max(1, parseInt(pfv, 10)) : 1;
            var pageTo   = (fetchRange && ptv) ? Math.max(pageFrom, parseInt(ptv, 10)) : null;

            // 全件取得時: page=1をfetchして最終ページを確認
            var prefetchedPage1Logs = null;
            if (fetchAll && pageTo === null) {
                setStatus('最終ページを確認中...');
                var detected = await detectLastPage(pageOffset, viewCount);
                if (detected.lastPage) {
                    pageTo = detected.lastPage;
                    prefetchedPage1Logs = detected.page1Logs;
                    pageOffset = detected.offset; // 実際に取得したページャーから再検出したオフセットで上書き
                    setStatus('全 ' + pageTo + ' ページを取得します...');
                }
            }

            var parser = new DOMParser();
            var page = pageFrom;
            var hasMore = true;

            while (hasMore) {
                if (pageTo !== null && page > pageTo) break;
                updateProgress(page - pageFrom + 1, pageTo !== null ? (pageTo - pageFrom + 1) : (page + 3));

                // 現在ページはDOMキャッシュを使用
                if (page === currentPage) {
                    var f1 = currentPageLogs.filter(function(el) {
                        return passesDatetimeFilter(el, fromDate, toDate);
                    });
                    fetchedLogs = fetchedLogs.concat(f1);
                    document.getElementById('info-fetched').textContent = fetchedLogs.length;
                    setStatus('ページ ' + page + '/' + (pageTo !== null ? pageTo : '?') + ' を取得中... (計 ' + fetchedLogs.length + ' 件)');
                    page++;
                    continue;
                }

                // page=1はdetectLastPageで取得済みならキャッシュを使う
                if (page === 1 && prefetchedPage1Logs !== null) {
                    var f2 = prefetchedPage1Logs.filter(function(el) {
                        return passesDatetimeFilter(el, fromDate, toDate);
                    });
                    fetchedLogs = fetchedLogs.concat(f2);
                    document.getElementById('info-fetched').textContent = fetchedLogs.length;
                    setStatus('ページ 1/' + (pageTo !== null ? pageTo : '?') + ' を取得中... (計 ' + fetchedLogs.length + ' 件)');
                    page++;
                    continue;
                }

                try {
                    var res = await fetch(buildUrl(page, pageOffset, viewCount));
                    if (!res.ok) break;
                    var doc = parser.parseFromString(await res.text(), 'text/html');
                    var tl  = doc.querySelector('.talk_list');
                    if (!tl || tl.children.length === 0) { hasMore = false; break; }
                    var logs = Array.from(tl.querySelectorAll('.chat_shout'));
                    if (logs.length === 0) { hasMore = false; break; }
                    var filtered = logs
                        .filter(function(el) { return passesDatetimeFilter(el, fromDate, toDate); })
                        .map(function(el) { return el.cloneNode(true); });
                    fetchedLogs = fetchedLogs.concat(filtered);
                    document.getElementById('info-fetched').textContent = fetchedLogs.length;
                    setStatus('ページ ' + page + '/' + (pageTo !== null ? pageTo : '?') + ' を取得中... (計 ' + fetchedLogs.length + ' 件)');
                    page++;
                    await new Promise(function(r) { setTimeout(r, 500); });
                } catch (err) {
                    console.error('ページ ' + page + ' の取得エラー:', err);
                    hasMore = false;
                }
            }

            if (fetchedLogs.length === 0) {
                fetchedLogs = currentPageLogs.filter(function(el) {
                    return passesDatetimeFilter(el, fromDate, toDate);
                });
            }

            hideProgress();
            document.getElementById('info-fetched').textContent = fetchedLogs.length;
            if (fetchedLogs.length > 0) {
                setStatus('取得完了：計 ' + fetchedLogs.length + ' 件のログを取得しました');
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

    function makeLinksAbsolute(doc) {
        function toAbs(url) { try { return new URL(url, location.href).href; } catch(e) { return url; } }
        doc.querySelectorAll('img, source, script').forEach(function(el) {
            if (el.getAttribute('src')) el.src = toAbs(el.getAttribute('src'));
            if (el.dataset.img) el.dataset.img = toAbs(el.dataset.img);
        });
        doc.querySelectorAll('link[href]').forEach(function(el) { el.href = toAbs(el.getAttribute('href')); });
        doc.querySelectorAll('*[style]').forEach(function(el) {
            var s = el.getAttribute('style');
            if (s && s.includes('url('))
                el.setAttribute('style', s.replace(/url\(['"]?(.+?)['"]?\)/g, function(_, u) { return "url('" + toAbs(u) + "')"; }));
        });
    }

    function removeLinks(doc) {
        // a.vs（バトル詳細リンク）は href を保持する
        doc.querySelectorAll('a[href]').forEach(function(a) {
            if (a.classList.contains('vs')) return;
            a.removeAttribute('href');
            a.style.cssText += ';cursor:default;pointer-events:none;text-decoration:none;';
        });
        doc.querySelectorAll('form').forEach(function(f) { f.onsubmit = function() { return false; }; });
        doc.querySelectorAll('button, input[type="submit"], input[type="button"]').forEach(function(b) {
            b.disabled = true;
            b.style.cssText += ';pointer-events:none;opacity:0.5;';
        });
    }

    function saveHtml() {
        if (fetchedLogs.length === 0) { setStatus('エラー: 先にログを取得してください', true); return; }
        setStatus('HTML生成中...');
        try {
            var cloneDoc = document.documentElement.cloneNode(true);
            var tl = cloneDoc.querySelector('.talk_list');
            if (tl) {
                tl.innerHTML = '';
                var logs = fetchedLogs.slice();
                if (document.getElementById('chk-reverse').checked) logs.reverse();
                logs.forEach(function(l) { tl.appendChild(l.cloneNode(true)); });
            }
            makeLinksAbsolute(cloneDoc);
            removeLinks(cloneDoc);

            var rm = [
                'script', 'iframe', '#log_save_panel',
                '.menu_button', '.acount_change', '.chat_tool', '.chat_menu', '.mention_tools',
                '.modals', '.bookmark_add', '.noticearea', '#custom-toast',
                '[data-tippy-root]', '.tippy-box',
                '.side_menu', '#overlay', '#icon_choice',
                'header', '.container.content_box.bookmaker', '.talk_category.button_list'
            ];
            if (IS_LOBBY) {
                rm = rm.concat([
                    '.remark_area', '.container.schedule', '.container.logs',
                    'section.container.chatlobby .status_area', '.button_list.tab-buttons',
                    '.lobby_info', '.btst_choice', '.battle_style'
                ]);
            }
            if (IS_ARCHIVE) {
                rm = rm.concat([
                    'section.container.chat > ul', '#archive_move', 'section.container.chatlobby'
                ]);
            }
            if (document.getElementById('chk-fetch-all').checked || document.getElementById('chk-fetch-range').checked) {
                rm.push('.pager');
            }
            rm.forEach(function(sel) {
                cloneDoc.querySelectorAll(sel).forEach(function(el) { el.remove(); });
            });

            cloneDoc.querySelectorAll('.mention').forEach(function(m) {
                var t = m.querySelector('.chat_time');
                m.innerHTML = t ? '<span class="chat_time gray small">' + t.textContent + '</span>' : '';
            });

            var area = (document.getElementById('info-area').textContent || 'log').replace(/\s+/g, '_');
            var zone = (document.getElementById('info-zone').textContent || '').replace(/\s+/g, '_');
            var zp   = (zone && zone !== '-') ? '_' + zone : '';
            var fn   = (IS_ARCHIVE ? 'BO5_archive' : 'BO5_chat') + '_' + area + zp + '_' + getJstDateStr() + '.html';

            var blob = new Blob(['<!DOCTYPE html>\n' + cloneDoc.outerHTML], { type: 'text/html' });
            var url  = URL.createObjectURL(blob);
            var a    = document.createElement('a');
            a.href = url; a.download = fn; a.click();
            URL.revokeObjectURL(url);
            setStatus('保存完了：' + fn + ' (' + fetchedLogs.length + ' 件)');
        } catch (e) {
            console.error(e);
            setStatus('エラー: ' + e.message, true);
        }
    }

    function getLogDedupeKey(el) {
        var t = el.querySelector('.chat_time');
        return (t ? t.textContent.trim() : '') + '|' + el.textContent.replace(/\s+/g, ' ').trim();
    }
    function getLogTimeText(el) {
        var t = el.querySelector('.chat_time');
        return t ? t.textContent.trim() : null;
    }

    async function mergeHtmlFiles() {
        var files = Array.from(document.getElementById('merge-file-input').files || []);
        if (files.length === 0) { setMergeStatus('エラー: ファイルを選択してください', true); return; }
        setMergeStatus('読み込み中... (0/' + files.length + ')');

        var parser    = new DOMParser();
        var dedupe    = document.getElementById('chk-merge-dedupe').checked;
        var sortMode = document.querySelector('input[name="merge-sort"]:checked');
        sortMode = sortMode ? sortMode.value : 'none';
        var templateDoc = null;
        var allLogs     = [];
        var seenKeys    = new Set();

        try {
            for (var i = 0; i < files.length; i++) {
                var doc = parser.parseFromString(await files[i].text(), 'text/html');
                if (!templateDoc) templateDoc = doc;
                var tl = doc.querySelector('.talk_list');
                if (!tl) continue;
                Array.from(tl.querySelectorAll('.chat_shout')).forEach(function(el) {
                    var key = getLogDedupeKey(el);
                    if (dedupe && seenKeys.has(key)) return;
                    seenKeys.add(key);
                    allLogs.push({ el: el.cloneNode(true), time: getLogTimeText(el) });
                });
                setMergeStatus('読み込み中... (' + (i + 1) + '/' + files.length + ') 計 ' + allLogs.length + ' 件');
                await new Promise(function(r) { setTimeout(r, 0); });
            }
            if (!templateDoc || allLogs.length === 0) { setMergeStatus('エラー: ログが見つかりませんでした', true); return; }
            if (sortMode === 'asc' || sortMode === 'desc') {
                allLogs.sort(function(a, b) {
                    if (!a.time || !b.time) return 0;
                    var cmp = a.time.localeCompare(b.time);
                    return sortMode === 'desc' ? -cmp : cmp;
                });
            }

            var mergedDoc = templateDoc.documentElement.cloneNode(true);
            var tl2 = mergedDoc.querySelector('.talk_list');
            if (!tl2) { setMergeStatus('エラー: テンプレートにログ表示領域が見つかりません', true); return; }
            tl2.innerHTML = '';
            allLogs.forEach(function(item) { tl2.appendChild(item.el); });

            var fn   = 'BO5_merged_log_' + allLogs.length + '件_' + getJstDateStr() + '.html';
            var blob = new Blob(['<!DOCTYPE html>\n' + mergedDoc.outerHTML], { type: 'text/html' });
            var url  = URL.createObjectURL(blob);
            var a    = document.createElement('a');
            a.href = url; a.download = fn; a.click();
            URL.revokeObjectURL(url);
            setMergeStatus('結合完了：' + fn + ' (' + files.length + ' ファイル → 計 ' + allLogs.length + ' 件)');
        } catch (e) {
            console.error(e);
            setMergeStatus('エラー: ' + e.message, true);
        }
    }

})();

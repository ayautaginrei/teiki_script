// ==UserScript==
// @name         ニワGFRe戦闘解析
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Stroll Greenの戦闘ログに動的なステータスパネルを追加し、キャラクター個別の戦闘統計・グラフ・詳細な行動分析機能を提供します。
// @author       ayautaginrei(gemini)
// @match        https://soraniwa.428.st/gf/result/*
// @updateURL    https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/soraniwa/%E3%83%8B%E3%83%AFGFRe%E6%88%A6%E9%97%98%E8%A7%A3%E6%9E%90.user.js
// @require      https://cdn.jsdelivr.net/npm/chart.js
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // --- 全体の設定 ---
    const SCRIPT_ID = 'sg-dynamic-status-script';
    const THROTTLE_DELAY = 100;
    const HIDE_PANELS_BREAKPOINT = 1600;

    // --- 状態異常データ ---
    const statusDetails = {
        '祝福': { type: 'buff', base: 45, scale: 2, unit: '%', desc: '攻撃力と回復力が上がります。' },
        '加護': { type: 'buff', base: 45, scale: 2, unit: '%', desc: '防御力と抵抗力が上がります。' },
        '幸運': { type: 'buff', desc: '会心力、回避力、命中力が上がります。また、会心威力が上昇します。' },
        '軽減': { type: 'buff', desc: '炎上・凍結・猛毒・出血で受けるダメージが減ります。また、受けるペナルティダメージが85%軽減されます。' },
        '浮遊': { type: 'buff', desc: '列を指定する効果の対象から外れます。' },
        '防護': { type: 'buff', desc: '受けるダメージを1深度あたり一定量減らします。ダメージを0にするか深度が0になるまで軽減を試みます。また、HP1以下になりません。' },
        '反撃': { type: 'buff', desc: '攻撃を受けると反撃の通常行動をすることがあります。回避したときは必ず発動します。' },
        '予撃': { type: 'buff', desc: 'スキルを発動する前に通常行動をすることがあります。ターンの1行動目のみ必ず発動します。' },
        '治癒': { type: 'buff', desc: '行動後にHPが回復します。反撃などによる手番外でも発動します。効果量は深度1あたり2%加算されます。' },
        '跳躍': { type: 'buff', desc: '受ける攻撃を確定で回避します。効果が発動するか、自分の手番の終了後に深度が0になります。' },
        '反射': { type: 'buff', desc: '攻撃を受けたとき、相手に自分の防御力と回避力のうち最も高い値を参照した威力のダメージを与えます。' },
        '猛毒': { type: 'debuff', desc: '受けるペナルティダメージが増加し、行動前に最大HPが減ります。ペナルティダメージは、ターン終了時にHPが満タンでない場合などにも発生する最大HPの減少です。効果量は深度1あたり1%加算されます。' },
        '炎上': { type: 'debuff', desc: '行動後にHPが減ります。効果量は深度1あたり2%加算されます。' },
        '凍結': { type: 'debuff', desc: '行動前にSPとMPが減ります。効果量は深度1あたり2%加算されます。' },
        '脆弱': { type: 'debuff', desc: 'HP・SP・MPの自然回復量が減ります。' },
        '混乱': { type: 'debuff', desc: 'スキルが意図せず発動することがあります。' },
        '麻痺': { type: 'debuff', desc: '連続行動の発動が失敗することがあります。' },
        '重力': { type: 'debuff', desc: '列を指定する効果の対象に含められます。' },
        '炸裂': { type: 'debuff', desc: '受ける攻撃のダメージが上昇します。また、相手の防護状態を解除しやすくします。' },
        '出血': { type: 'debuff', desc: '攻撃行動を行うと、そのたびに自身の攻撃力に依存したダメージを受けます。' },
        '恐怖': { type: 'debuff', base: 30, scale: 2, unit: '%', desc: '攻撃力と回復力が下がります。(下限あり)' },
        '呪縛': { type: 'debuff', base: 30, scale: 2, unit: '%', desc: '防御力と抵抗力が下がります。(下限あり)' },
        '不幸': { type: 'debuff', base: 20, scale: 1, unit: '%', desc: '会心力、回避力、命中力、会心威力が下がります。(下限あり)' }
    };

    // --- CSSスタイルの定義 ---
    GM_addStyle(`
        :root {
            --panel-bg-color: rgba(245, 245, 220, 0.92); --panel-border-color: #BDB76B;
            --char-card-bg-color: rgba(238, 232, 205, 0.88); --hp-bar-color: #68B36B;
            --sp-bar-color: #D2A100; --mp-bar-color: #5A95D6; --bar-bg-color: #8D8D8D;
            --font-color: #3D3D3D; --name-color: #000; --tooltip-bg: rgba(0,0,0,0.85);
            --stats-bg: #fdfdfa; --stats-border: #ccc; --stats-header-bg: #f1f1e6;
            --accordion-detail-bg: #f9f9f2;
            --step-skill-bg: #fff8dc;
        }
        #sg-userscript-tooltip {
            position: fixed; display: none; background-color: var(--tooltip-bg); color: white; padding: 8px 12px;
            border-radius: 5px; font-size: 12px; max-width: 280px; z-index: 10001; pointer-events: none;
            text-align: left;
        }
        #sg-userscript-tooltip strong { color: #FFD700; }
        #sg-userscript-tooltip ul { margin: 5px 0 0 15px; padding: 0; }
        #sg-userscript-tooltip li { margin-bottom: 2px; }
        #sg-log-wrapper { display: flex; justify-content: center; align-items: flex-start; gap: 15px; }
        #container { flex-shrink: 0; }
        .status-panel { width: 260px; position: sticky; top: 20px; height: calc(100vh - 40px); overflow-y: auto; }
        @media (max-width: ${HIDE_PANELS_BREAKPOINT - 1}px) { #left-status-panel, #right-status-panel { display: none; } }
        .char-card-container {
            background-color: var(--panel-bg-color); border: 1px solid var(--panel-border-color); border-radius: 8px;
            box-shadow: 0 0 15px rgba(0,0,0,0.5); backdrop-filter: blur(5px); padding: 10px;
        }
        .char-card {
            background-color: var(--char-card-bg-color); border-radius: 5px; padding: 8px; margin-bottom: 10px;
            font-size: 12px; color: var(--font-color); transition: opacity 0.3s ease;
        }
        .char-card.defeated { opacity: 0.5; }
        .char-header { display: flex; align-items: center; margin-bottom: 5px; }
        .char-header img { width: 40px; height: 40px; border-radius: 50%; margin-right: 8px; border: 1px solid #777; }
        .char-name { font-weight: bold; color: var(--name-color); font-size: 14px; }
        .status-bar-container { width: 100%; background-color: var(--bar-bg-color); height: 10px; border-radius: 5px; margin-bottom: 2px; }
        .status-bar { height: 100%; border-radius: 5px; transition: width 0.3s ease-in-out; }
        .hp-bar { background-color: var(--hp-bar-color); }
        .sp-bar { background-color: var(--sp-bar-color); }
        .mp-bar { background-color: var(--mp-bar-color); }
        .status-text { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; }
        .char-states { margin-top: 5px; display: flex; flex-wrap: wrap; gap: 4px; }
        .state-badge {
            background-color: #FFFFF0; border: 1px solid #BDB76B; padding: 2px 5px;
            border-radius: 10px; font-size: 10px; color: #3D3D3D; cursor: help;
        }
        #stats-container {
            border: 1px solid var(--stats-border); border-radius: 8px; margin-top: 20px;
            background: var(--stats-bg); padding: 15px;
        }
        .stats-tabs { border-bottom: 1px solid var(--stats-border); margin-bottom: 15px; }
        .stats-tab-button {
            padding: 8px 15px; border: 1px solid transparent; border-bottom: none;
            cursor: pointer; background: none; font-size: 16px; margin-bottom: -1px;
            border-top-left-radius: 5px; border-top-right-radius: 5px;
        }
        .stats-tab-button.active { background: var(--stats-bg); border-color: var(--stats-border); }
        .stats-tab-content { display: none; }
        .stats-tab-content.active { display: block; }
        .stats-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .stats-table th, .stats-table td { border: 1px solid var(--stats-border); padding: 6px; text-align: center; }
        .stats-table th { background-color: var(--stats-header-bg); }
        .stats-table tr.summary-row { cursor: pointer; }
        .stats-table tr.summary-row:hover { background-color: #f5f5e8; }
        .stats-table tr.step-skill-row { background-color: var(--step-skill-bg); }
        .stats-table tr.step-skill-row:hover { background-color: #f5eec9; }
        .stats-table td[data-tooltip-text] { cursor: help; text-decoration: underline dotted; }
        .stats-table .char-name-col { text-align: left; width: 140px; }
        .stats-table .accordion-toggle { display: inline-block; width: 1em; text-align: center; }
        .stats-team-header { font-size: 1.2em; font-weight: bold; margin-top: 15px; margin-bottom: 5px; border-bottom: 2px solid var(--panel-border-color); }
        .stats-team-header:first-child { margin-top: 0; }
        .graph-controls { margin-bottom: 10px; text-align: center; display: flex; gap: 15px; justify-content: center; align-items: center; flex-wrap: wrap;}

        /* --- Accordion Styles (今回の修正箇所) --- */
        .accordion-detail-row { display: none; }
        .accordion-detail-cell { padding: 15px !important; background-color: var(--accordion-detail-bg); }
        .accordion-body { display: flex; flex-direction: column; gap: 15px; }
        .accordion-summary-wrapper { display: flex; gap: 20px; flex-wrap: wrap; }
        .accordion-summary { flex: 1; min-width: 280px; font-size: 14px; }
        .accordion-summary h3 { margin-top: 0; border-bottom: 1px solid #ccc; padding-bottom: 5px; font-size: 1.1em; }
        .accordion-summary div { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .accordion-summary div span:first-child { font-weight: bold; color: #333; }
        .accordion-summary span[data-tooltip-text] { cursor: help; text-decoration: underline dotted; }
        .accordion-summary .sub-item { padding-left: 15px; }
        .accordion-summary .sub-item span:first-child { font-weight: normal; }
        .accordion-details { flex-grow: 1; min-width: 0; }
        .accordion-details .stats-table { font-size: 12px; }
        .accordion-details .stats-table td, .accordion-details .stats-table th { padding: 5px; }
        .accordion-details .stats-tab-content { max-height: 45vh; overflow-y: auto; }
    `);

    // --- グローバル変数 ---
    let scrollDataElements = [], allCharIndices = [], lastKnownState = {}, throttleTimer = null, chartInstance = null;
    let finalHpValues = {};
    let battleAnalysisResult = null;

    // --- 補助関数 ---
    function formatDetailsForTooltip(detailsObj) {
        if (!detailsObj || Object.keys(detailsObj).length === 0) {
            return '内訳なし';
        }
        return Object.entries(detailsObj)
            .map(([name, count]) => `${name}: ${count}`)
            .join('<br>');
    }

    function parseCharacterData(element) {
        const characters = [];
        if (!element) return characters;
        element.querySelectorAll('i').forEach(i => {
            if (i.dataset.cname) {
                characters.push({
                    index: i.dataset.index, cname: i.dataset.cname, team: i.dataset.team, icon: i.dataset.icon,
                    hp: parseInt(i.dataset.hp, 10), mhp: parseInt(i.dataset.mhp, 10),
                    sp: parseInt(i.dataset.sp, 10), msp: parseInt(i.dataset.msp, 10),
                    mp: parseInt(i.dataset.mp, 10), mmp: parseInt(i.dataset.mmp, 10),
                    states: i.dataset.states.trim().split(/\s+/).filter(s => s)
                });
            }
        });
        return characters;
    }
    function setDefeatedStatus(charIndex, finalHp) {
        const panel = document.getElementById(`char-card-${charIndex}`);
        if (!panel) return;
        if (panel.classList.contains('defeated') && panel.dataset.finalHp === finalHp.toString()) return;
        const initialCharData = lastKnownState.initialData.find(c => c.index === charIndex);
        const maxHP = initialCharData ? initialCharData.mhp : 0;
        panel.classList.add('defeated');
        panel.querySelector('.hp-bar').style.width = '0%';
        panel.querySelector('.hp-text').textContent = `HP: ${finalHp} / ${maxHP}`;
        panel.querySelector('.char-states').innerHTML = '<span class="state-badge">戦闘不能</span>';
        panel.dataset.finalHp = finalHp;
    }
    function updateCharacterPanel(charData) {
        const panel = document.getElementById(`char-card-${charData.index}`);
        if (!panel) return;
        panel.classList.remove('defeated');
        panel.removeAttribute('data-final-hp');
        panel.querySelector('.hp-bar').style.width = `${charData.mhp > 0 ? (Math.max(0, charData.hp) / charData.mhp) * 100 : 0}%`;
        panel.querySelector('.hp-text').textContent = `HP: ${charData.hp} / ${charData.mhp}`;
        panel.querySelector('.sp-bar').style.width = `${charData.msp > 0 ? (charData.sp / charData.msp) * 100 : 0}%`;
        panel.querySelector('.sp-text').textContent = `SP: ${charData.sp}`;
        panel.querySelector('.mp-bar').style.width = `${charData.mmp > 0 ? (charData.mp / charData.mmp) * 100 : 0}%`;
        panel.querySelector('.mp-text').textContent = `MP: ${charData.mp}`;
        const statesContainer = panel.querySelector('.char-states');
        statesContainer.innerHTML = charData.states.map(state => {
            const stateName = state.replace(/x\d+/, '');
            return `<span class="state-badge" data-status-name="${stateName}">${state}</span>`;
        }).join('');
    }
    function updateDynamicPanels() {
        const scrollY = window.scrollY + 100;
        let currentDataElement = scrollDataElements[0];
        for (let i = 0; i < scrollDataElements.length; i++) {
            if (scrollDataElements[i].offsetTop <= scrollY) {
                currentDataElement = scrollDataElements[i];
            } else { break; }
        }
        if (currentDataElement && currentDataElement.id !== lastKnownState.id) {
            const characters = parseCharacterData(currentDataElement);
            const currentCharIndices = characters.map(c => c.index);
            characters.forEach(updateCharacterPanel);
            const defeatedIndices = allCharIndices.filter(id => !currentCharIndices.includes(id));
            defeatedIndices.forEach(id => {
                const finalHp = finalHpValues[id] === undefined ? 0 : finalHpValues[id];
                setDefeatedStatus(id, finalHp);
            });
            lastKnownState.id = currentDataElement.id;
        }
    }


    /**
     * 戦闘ログ全体を解析し、行動単位のデータと統計情報を生成する
     */
    function parseAndCalculateAllStats() {
        const battleLogContainer = document.querySelector('.battlemain');
        if (!battleLogContainer) return null;
        const firstScrolldata = battleLogContainer.querySelector('.scrolldata');
        if (!firstScrolldata) return null;

        const initialChars = parseCharacterData(firstScrolldata);
        if (initialChars.length === 0) return null;

        const battleActions = [];
        const allStatuses = new Set();
        let currentTurn = 1, currentActor = '', actionCounter = 0, currentAction = null;
        let beforeActionStates = initialChars.reduce((acc, c) => ({...acc, [c.cname]: c }), {});

        // --- スキル名取得ロジックを改善 ---
        // スキル名は複雑なHTMLを持つことがあるため、主要な名前のみを抽出します
        const getSkillName = (startNode) => {
            let currentNode = startNode;
            for (let i = 0; i < 4 && currentNode; i++) {
                // '>>' を含むカスタマイズスキルが真のスキル名
                const smallNode = currentNode.querySelector('small');
                if (smallNode && smallNode.textContent.includes('>>')) {
                    return smallNode.textContent.replace(/.*>>/, '').trim().replace(/！/g, '');
                }

                // それ以外の場合は、主要なスキル名を探す
                const skillNode = currentNode.querySelector('.tskill');
                if (skillNode) {
                    let mainText = '';
                    // <img>や<small>のような子ノードを無視し、直接のテキストのみを抽出
                    for (const child of skillNode.childNodes) {
                        if (child.nodeType === 3) { // Node.TEXT_NODE
                            mainText = child.textContent.trim();
                            break;
                        }
                    }
                    if (mainText) return mainText.replace(/！/g, '');
                }
                currentNode = currentNode.nextElementSibling;
            }
            return '通常行動';
        };

        const pushCurrentAction = () => {
            if (currentAction) {
                const actorBefore = currentAction.beforeState;
                const actorAfter = currentAction.afterState || actorBefore;
                if(actorBefore && actorAfter){
                    currentAction.spCost = Math.max(0, actorBefore.sp - actorAfter.sp);
                    currentAction.mpCost = Math.max(0, actorBefore.mp - actorAfter.mp);
                }
                battleActions.push(currentAction);
            }
        };

        battleLogContainer.childNodes.forEach(node => {
            if (node.nodeType !== 1) return;

            if (node.classList.contains('scrolldata')) {
                const newStates = parseCharacterData(node).reduce((acc, c) => ({...acc, [c.cname]: c }), {});
                if (currentAction) {
                    currentAction.afterState = newStates[currentAction.actor];
                }
                Object.assign(beforeActionStates, newStates);
            } else if (node.classList.contains('sequence')) {
                const text = node.textContent.trim();
                const html = node.innerHTML;
                let match;

                if (match = text.match(/-Turn (\d+)-/)) {
                    pushCurrentAction(); currentAction = null;
                    currentTurn = parseInt(match[1], 10);
                }

                let actorNode = node.querySelector('a[id^="s_"]');
                if (!actorNode) actorNode = node.querySelector('.markerB, .markerA');

                const connectMatch = text.match(/(.+) のコネクトスキルが発動！/);

                if (actorNode && (actorNode.textContent.includes('の行動！') || actorNode.textContent.includes('の先行行動！'))) {
                    pushCurrentAction();
                    const isPreceding = actorNode.textContent.includes('の先行行動！');
                    currentActor = actorNode.textContent.replace(/[▼▼]/g, '').replace(/の行動！|の先行行動！/g, '').trim();
                    const skillName = getSkillName(node.nextElementSibling);

                    currentAction = {
                        id: `action-${actionCounter++}`, turn: currentTurn, actor: currentActor, skill: skillName,
                        events: [], spCost: 0, mpCost: 0,
                        isPreceding: isPreceding,
                        isStepSkill: false, // デフォルトはfalseに設定
                        isConnectSkill: false,
                        beforeState: beforeActionStates[currentActor],
                        afterState: null
                    };
                } else if (connectMatch) {
                    pushCurrentAction();
                    currentActor = connectMatch[1].trim();
                    const skillName = getSkillName(node.nextElementSibling);

                    currentAction = {
                        id: `action-${actionCounter++}`, turn: currentTurn, actor: currentActor, skill: skillName,
                        events: [], spCost: 0, mpCost: 0,
                        isPreceding: false,
                        isStepSkill: false,
                        isConnectSkill: true,
                        beforeState: beforeActionStates[currentActor],
                        afterState: null
                    };
                }


                if (currentAction) {
                    // --- ステップスキル判定ロジックを修正 ---
                    // このログにステップスキル発動マーカーが含まれていれば、*現在*のアクションにフラグを立てる
                    if (text.includes('ステップスキル発動！')) {
                        currentAction.isStepSkill = true;
                        // マーカーの直後に本当のスキル名が表示されるため、スキル名を再取得して更新する
                        currentAction.skill = getSkillName(node.nextElementSibling);
                    }

                    const damageRegex = /(.+?) に <b.*?class=['"](.*?)['"].*?>([\d,]+)<\/b>.*?ダメージ！！/g;
                    const healRegex = /(.+?) のHPが <b([^>]*)>(.+?)<\/b> 回復！！/g;
                    const evadeRegex = /(.+?) は攻撃を回避した！！/g;
                    const buffRegex = /(.*?) に (?:<b>)?(.+?)(?:<\/b>)? を <b([^>]*)>(\d+)<\/b> 付与！！/g;


                    for (const m of html.matchAll(damageRegex)) {
                        currentAction.events.push({ type: 'damage', target: m[1].trim().replace(/<.*?>/g, ''), value: parseInt(m[3].replace(/,/g, ''), 10), is_critical: m[2].includes('cri') });
                    }
                    for (const m of html.matchAll(healRegex)) {
                        currentAction.events.push({ type: 'heal', target: m[1].trim().replace(/<.*?>/g, ''), value: parseInt(m[3].replace(/,/g, ''), 10), is_critical: m[2].includes('cri') });
                    }
                     for (const m of text.matchAll(evadeRegex)) {
                         currentAction.events.push({ type: 'evade', target: m[1].trim() });
                    }
                     for (const m of html.matchAll(buffRegex)) {
                        const stateName = m[2].trim().replace(/ /g, '');
                        if (statusDetails[stateName]) {
                            allStatuses.add(stateName);
                            currentAction.events.push({ type: statusDetails[stateName].type, status: stateName, target: m[1].trim(), value: parseInt(m[4], 10), is_critical: m[3].includes('cri') });
                        }
                    }

                    if (text.match(/(.+) を打倒した！！|(.+) は戦闘を離脱した！！/)) {
                        const defeatedMatch = text.match(/(.+) (を打倒した！！|は戦闘を離脱した！！)/);
                        if (defeatedMatch && defeatedMatch[1]) {
                             currentAction.events.push({ type: 'defeat', target: defeatedMatch[1].trim() });
                        }
                    }
                }
            }
        });
        pushCurrentAction();

        const finalStats = {};
        initialChars.forEach(c => {
            finalStats[c.cname] = {
                team: c.team, icon: c.icon, totalDamageDealt: 0, totalDamageTaken: 0, totalHealingDone: 0,
                totalSpConsumed: 0, totalMpConsumed: 0,
                attacksMade: 0, criticalHits: 0,
                critableActions: 0, totalCrits: 0,
                attacksReceived: 0, evasions: 0,
                buffsApplied: 0, debuffsApplied: 0, buffsReceived: 0, debuffsReceived: 0,
                buffsAppliedDetails: {}, debuffsAppliedDetails: {},
                buffsReceivedDetails: {}, debuffsReceivedDetails: {},
                skills: {}, actions: [], damageTakenLog: [],
                // --- NEW STATS ---
                totalDamageToEnemies: 0, totalDamageToAllies: 0, totalDamageToSelf: 0,
                totalHealingToAllies: 0, totalHealingToSelf: 0, totalOverheal: 0,
                maxSingleHitDealt: 0, maxSingleHitTaken: 0,
                attacksEvadedByOpponents: 0,
                totalHealingTakenFromSkills: 0, totalHealingTakenFromNaturalRegen: 0
            };
        });

        // 自然回復の集計
        document.querySelectorAll('.sequence').forEach(node => {
            const text = node.textContent.trim();
            if (text.includes('のHP・SP・MPが 4% 回復！')) {
                const charNameMatch = text.match(/(.+) のHP・SP・MPが/);
                if (charNameMatch) {
                    const charName = charNameMatch[1].trim();
                    const charState = beforeActionStates[charName];
                    if (charState && finalStats[charName]) {
                        const naturalHealAmount = Math.floor(charState.mhp * 0.04);
                        finalStats[charName].totalHealingTakenFromNaturalRegen += naturalHealAmount;
                        beforeActionStates[charName].hp = Math.min(charState.mhp, charState.hp + naturalHealAmount);
                    }
                }
            }
        });


        battleActions.forEach(action => {
            if (!action || !action.actor) return;
            const actorStats = finalStats[action.actor];
            if (!actorStats) return;

            actorStats.actions.push(action);
            actorStats.totalSpConsumed += action.spCost;
            actorStats.totalMpConsumed += action.mpCost;

            if (!actorStats.skills[action.skill]) {
                actorStats.skills[action.skill] = { count: 0, totalDamage: 0, totalHealing: 0, crits: 0, spCost: 0, mpCost: 0, attackCount: 0, critableActions: 0, isStepSkill: false };
            }
            const skillStat = actorStats.skills[action.skill];
            skillStat.count++;
            skillStat.spCost += action.spCost;
            skillStat.mpCost += action.mpCost;
            if (action.isStepSkill) {
                skillStat.isStepSkill = true;
            }

            action.events.forEach(event => {
                const isCrit = event.is_critical || false;

                if (event.type === 'damage' || event.type === 'heal' || event.type === 'buff' || event.type === 'debuff') {
                    actorStats.critableActions++;
                    skillStat.critableActions++;
                    if (isCrit) {
                        actorStats.totalCrits++;
                        skillStat.crits++;
                    }
                }

                if (event.type === 'damage') {
                    actorStats.totalDamageDealt += event.value;
                    skillStat.totalDamage += event.value;
                    actorStats.attacksMade++;
                    skillStat.attackCount++;
                    if (isCrit) actorStats.criticalHits++;

                    actorStats.maxSingleHitDealt = Math.max(actorStats.maxSingleHitDealt, event.value);

                    const targetStats = finalStats[event.target];
                    if (targetStats) {
                        targetStats.totalDamageTaken += event.value;
                        targetStats.attacksReceived++;
                        targetStats.maxSingleHitTaken = Math.max(targetStats.maxSingleHitTaken, event.value);
                        targetStats.damageTakenLog.push({ turn: action.turn, actor: action.actor, skill: action.skill, result: `${event.value.toLocaleString()} ダメージ`});

                        if (actorStats.team === targetStats.team) {
                            actorStats.totalDamageToAllies += event.value;
                            if (action.actor === event.target) {
                                actorStats.totalDamageToSelf += event.value;
                            }
                        } else {
                            actorStats.totalDamageToEnemies += event.value;
                        }
                    }
                } else if (event.type === 'heal') {
                    actorStats.totalHealingDone += event.value;
                    skillStat.totalHealing += event.value;

                    const targetState = beforeActionStates[event.target];
                    if (targetState) {
                        const overheal = Math.max(0, (targetState.hp + event.value) - targetState.mhp);
                        actorStats.totalOverheal += overheal;
                        finalStats[event.target].totalHealingTakenFromSkills += event.value;
                    }

                    if (action.actor === event.target) {
                        actorStats.totalHealingToSelf += event.value;
                    } else {
                        actorStats.totalHealingToAllies += event.value;
                    }
                } else if (event.type === 'evade') {
                    const attackerStats = finalStats[action.actor];
                    if(attackerStats) attackerStats.attacksEvadedByOpponents++;

                    if (finalStats[event.target]) {
                        finalStats[event.target].evasions++;
                        finalStats[event.target].attacksReceived++;
                        finalStats[event.target].damageTakenLog.push({ turn: action.turn, actor: action.actor, skill: action.skill, result: '回避' });
                    }
                } else if(event.type === 'buff') {
                    actorStats.buffsApplied += event.value;
                    actorStats.buffsAppliedDetails[event.status] = (actorStats.buffsAppliedDetails[event.status] || 0) + event.value;
                    if(finalStats[event.target]) {
                        finalStats[event.target].buffsReceived += event.value;
                        finalStats[event.target].buffsReceivedDetails[event.status] = (finalStats[event.target].buffsReceivedDetails[event.status] || 0) + event.value;
                    }
                } else if(event.type === 'debuff') {
                    actorStats.debuffsApplied += event.value;
                    actorStats.debuffsAppliedDetails[event.status] = (actorStats.debuffsAppliedDetails[event.status] || 0) + event.value;
                    if(finalStats[event.target]) {
                        finalStats[event.target].debuffsReceived += event.value;
                        finalStats[event.target].debuffsReceivedDetails[event.status] = (finalStats[event.target].debuffsReceivedDetails[event.status] || 0) + event.value;
                    }
                }
            });
        });

        return { stats: finalStats, characters: initialChars, battleActions, allStatuses: Array.from(allStatuses).sort() };
    }

    /**
     * 行動履歴からグラフ用のターン毎データを生成する
     */
    function generateTurnData(battleActions, initialChars) {
        const turnData = { labels: [], datasets: {} };
        initialChars.forEach(c => {
            turnData.datasets[c.cname] = {
                team: c.team, hp: [], sp: [], mp: [], states: [],
                turnDamageDealt: [], turnDamageTaken: [], turnHealingDone: []
            };
        });

        const turnMap = new Map();
        let maxTurn = 0;

        document.querySelectorAll('.sequence').forEach(seq => {
            const turnMatch = seq.textContent.match(/-Turn (\d+)-/);
            if (turnMatch) {
                const turn = parseInt(turnMatch[1], 10);
                maxTurn = Math.max(maxTurn, turn);
                let nextNode = seq.nextElementSibling;
                while (nextNode && !nextNode.classList.contains('scrolldata')) {
                    nextNode = nextNode.nextElementSibling;
                }
                if (nextNode) {
                    turnMap.set(turn, parseCharacterData(nextNode));
                }
            }
        });

        const firstScrolldata = document.querySelector('.scrolldata');
        turnMap.set(0, parseCharacterData(firstScrolldata));
        const lastScrolldata = Array.from(document.querySelectorAll('.scrolldata')).pop();
        turnMap.set(maxTurn + 1, parseCharacterData(lastScrolldata));


        for(let i = 0; i <= maxTurn + 1; i++){
            if(!turnMap.has(i)) continue;

            const label = i === 0 ? "Start" : (i > maxTurn ? "End" : `Turn ${i}`);
            turnData.labels.push(label);
            const currentStates = turnMap.get(i);
            const charMap = new Map(currentStates.map(c => [c.cname, c]));

            initialChars.forEach(c => {
                const charState = charMap.get(c.cname);
                turnData.datasets[c.cname].hp.push(charState ? charState.hp : 0);
                turnData.datasets[c.cname].sp.push(charState ? charState.sp : 0);
                turnData.datasets[c.cname].mp.push(charState ? charState.mp : 0);

                const turnStates = {};
                if (charState) {
                    charState.states.forEach(s => {
                        const match = s.match(/(.+?)x(\d+)/);
                        if (match) turnStates[match[1]] = parseInt(match[2], 10);
                        else turnStates[s] = 1; // 深度がない場合
                    });
                }
                turnData.datasets[c.cname].states.push(turnStates);


                const actionsThisTurn = battleActions.filter(a => a.turn === i);
                let turnDamageDealt = 0, turnDamageTaken = 0, turnHealingDone = 0;

                actionsThisTurn.forEach(action => {
                    action.events.forEach(event => {
                        if (action.actor === c.cname) {
                            if (event.type === 'damage') turnDamageDealt += event.value;
                            if (event.type === 'heal') turnHealingDone += event.value;
                        }
                        if (event.target === c.cname && event.type === 'damage') {
                            turnDamageTaken += event.value;
                        }
                    });
                });
                turnData.datasets[c.cname].turnDamageDealt.push(turnDamageDealt);
                turnData.datasets[c.cname].turnDamageTaken.push(turnDamageTaken);
                turnData.datasets[c.cname].turnHealingDone.push(turnHealingDone);
            });
        }
        return turnData;
    }

    /**
     * メインの統計パネルとグラフを描画する
     */
    function renderStatsPanelAndGraph(analysisResult) {
        const { stats, characters, turnData, allStatuses } = analysisResult;
        const sheet = document.querySelector('.sheet');
        if (!sheet) return;

        const container = document.createElement('div');
        container.id = 'stats-container';
        container.innerHTML = `
            <div class="stats-tabs">
                <button class="stats-tab-button active" data-tab="summary">サマリー表</button>
                <button class="stats-tab-button" data-tab="graph">時系列グラフ</button>
            </div>
            <div id="stats-summary" class="stats-tab-content active"></div>
            <div id="stats-graph" class="stats-tab-content">
                 <div class="graph-controls">
                    <div>
                        <label for="graph-data-select">表示データ: </label>
                        <select id="graph-data-select">
                            <option value="hp" selected>HP推移</option>
                            <option value="sp">SP推移</option>
                            <option value="mp">MP推移</option>
                            <option value="turnDamageDealt">与ダメージ (累積)</option>
                            <option value="turnDamageTaken">被ダメージ (累積)</option>
                            <option value="turnHealingDone">与回復量 (累積)</option>
                            <option value="buffDebuff">バフ・デバフ深度</option>
                        </select>
                    </div>
                    <div id="buff-debuff-controls" style="display: none;">
                         <label for="char-select-for-graph">キャラクター: </label>
                         <select id="char-select-for-graph"></select>
                         <label for="status-select-for-graph">状態: </label>
                         <select id="status-select-for-graph"></select>
                    </div>
                </div>
                <div style="position: relative; height:400px;">
                    <canvas id="hp-chart"></canvas>
                </div>
            </div>
        `;
        sheet.appendChild(container);

        const summaryDiv = document.getElementById('stats-summary');
        const tableHeader = `<thead><tr><th>キャラクター</th><th>与ダメ</th><th>被ダメ</th><th>与回復</th><th>強化与</th><th>強化受</th><th>異常与</th><th>異常受</th></tr></thead>`;

        const generateTableRows = (charList) => {
            return '<tbody>' + charList.map(char => {
                const s = stats[char.cname];
                if (!s) return '';
                const detailContent = generateDetailContent(char.cname, analysisResult);
                const buffsAppliedTooltip = formatDetailsForTooltip(s.buffsAppliedDetails);
                const buffsReceivedTooltip = formatDetailsForTooltip(s.buffsReceivedDetails);
                const debuffsAppliedTooltip = formatDetailsForTooltip(s.debuffsAppliedDetails);
                const debuffsReceivedTooltip = formatDetailsForTooltip(s.debuffsReceivedDetails);

                return `
                    <tr class="summary-row" data-charname="${char.cname}">
                        <td class="char-name-col"><span class="accordion-toggle">▼</span> ${char.cname}</td>
                        <td>${s.totalDamageDealt.toLocaleString()}</td>
                        <td>${s.totalDamageTaken.toLocaleString()}</td>
                        <td>${s.totalHealingDone.toLocaleString()}</td>
                        <td data-tooltip-text="${buffsAppliedTooltip}">${s.buffsApplied}</td>
                        <td data-tooltip-text="${buffsReceivedTooltip}">${s.buffsReceived}</td>
                        <td data-tooltip-text="${debuffsAppliedTooltip}">${s.debuffsApplied}</td>
                        <td data-tooltip-text="${debuffsReceivedTooltip}">${s.debuffsReceived}</td>
                    </tr>
                    <tr class="accordion-detail-row" data-charname-detail="${char.cname}">
                        <td class="accordion-detail-cell" colspan="8">${detailContent}</td>
                    </tr>`;
            }).join('') + '</tbody>';
        };

        const team0Chars = characters.filter(c => c.team === '0');
        const team1Chars = characters.filter(c => c.team === '1');
        summaryDiv.innerHTML = `
            <h3 class="stats-team-header">味方チーム</h3><table class="stats-table">${tableHeader}${generateTableRows(team0Chars)}</table>
            <h3 class="stats-team-header">敵チーム</h3><table class="stats-table">${tableHeader}${generateTableRows(team1Chars)}</table>
        `;

        // 1. アコーディオン開閉
        summaryDiv.querySelectorAll('.summary-row').forEach(row => {
            row.addEventListener('click', e => {
                const detailRow = row.nextElementSibling;
                const toggle = row.querySelector('.accordion-toggle');
                const isVisible = detailRow.style.display === 'table-row';
                detailRow.style.display = isVisible ? 'none' : 'table-row';
                toggle.textContent = isVisible ? '▼' : '▲';
            });
        });

        // 2. メインタブ切り替え
        let chartRendered = false;
        const mainTabButtons = container.querySelector('.stats-tabs').querySelectorAll('.stats-tab-button');
        const mainTabContents = container.querySelectorAll(':scope > .stats-tab-content');

        mainTabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const targetButton = e.currentTarget;
                if (targetButton.classList.contains('active')) return;

                mainTabButtons.forEach(btn => btn.classList.remove('active'));
                mainTabContents.forEach(content => content.classList.remove('active'));

                targetButton.classList.add('active');
                const tabName = targetButton.dataset.tab;
                container.querySelector(`#stats-${tabName}`).classList.add('active');

                if (tabName === 'graph' && !chartRendered) {
                    renderGraph(analysisResult);
                    chartRendered = true;
                }
            });
        });

        // 3. アコーディオン内部のタブ切り替え（generateDetailContentで生成される要素に対するイベントリスナー）
        summaryDiv.addEventListener('click', e => {
             if (e.target.matches('.accordion-details .stats-tab-button')) {
                const button = e.target;
                const detailsNode = button.closest('.accordion-details');
                if (!detailsNode || button.classList.contains('active')) return;

                const activeTab = detailsNode.querySelector('.stats-tab-button.active');
                if(activeTab) activeTab.classList.remove('active');

                const activeContent = detailsNode.querySelector('.stats-tab-content.active');
                if(activeContent) activeContent.classList.remove('active');

                button.classList.add('active');
                const content = detailsNode.querySelector(`[data-content="${button.dataset.tab}"]`);
                if(content) content.classList.add('active');
             }
        });

        // --- グラフ用コントロールの初期化とイベントリスナー ---
        const charSelect = document.getElementById('char-select-for-graph');
        const statusSelect = document.getElementById('status-select-for-graph');
        characters.forEach(c => charSelect.add(new Option(c.cname, c.cname)));
        allStatuses.forEach(s => statusSelect.add(new Option(s, s)));

        const mainGraphSelect = document.getElementById('graph-data-select');

        mainGraphSelect.addEventListener('change', () => {
             document.getElementById('buff-debuff-controls').style.display = mainGraphSelect.value === 'buffDebuff' ? 'flex' : 'none';
             renderGraph(analysisResult)
        });
        charSelect.addEventListener('change', () => renderGraph(analysisResult));
        statusSelect.addEventListener('change', () => renderGraph(analysisResult));
    }

    // --- 詳細表示を生成する関数 (generateDetailContent) ---
    function generateDetailContent(charName, analysisResult) {
        const { stats } = analysisResult;
        const charStats = stats[charName];
        if (!charStats) return '';

        // ★★★ この関数内で、表示に必要なHTML文字列を事前に生成します ★★★
        let skillsHtml = `<table class="stats-table"><thead><tr><th>スキル名</th><th>回数</th><th>総ダメ/回復</th><th>平均</th><th>会心率</th><th>消費SP</th><th>消費MP</th></tr></thead><tbody>`;
        for (const skillName in charStats.skills) {
            const skill = charStats.skills[skillName];
            const totalValue = skill.totalDamage > 0 ? `${skill.totalDamage.toLocaleString()} Dmg` : skill.totalHealing > 0 ? `${skill.totalHealing.toLocaleString()} Heal` : '-';
            const avgValue = skill.count > 0 ? ((skill.totalDamage + skill.totalHealing) / skill.count).toFixed(0) : 0;
            const critRate = skill.critableActions > 0 ? (skill.crits / skill.critableActions * 100).toFixed(1) : '0.0';
            const skillDisplayName = skill.isStepSkill ? `${skillName} [STP]` : skillName;
            skillsHtml += `<tr><td>${skillDisplayName}</td><td>${skill.count}</td><td>${totalValue}</td><td>${avgValue}</td><td>${critRate}%</td><td>${skill.spCost}</td><td>${skill.mpCost}</td></tr>`;
        }
        skillsHtml += `</tbody></table>`;

        let actionsHtml = `<table class="stats-table"><thead><tr><th>T</th><th>スキル</th><th>消費SP/MP</th><th>実行時状態</th><th>効果詳細</th></tr></thead><tbody>`;
        charStats.actions.forEach(action => {
            const effects = action.events.map(e => {
                let text = e.target ? `${e.target}: ` : '';
                if (e.type === 'damage') text += `${e.value.toLocaleString()} ダメージ` + (e.is_critical ? ' (会心!)' : '');
                else if (e.type === 'heal') text += `${e.value.toLocaleString()} 回復` + (e.is_critical ? ' (会心!)' : '');
                else if (e.type === 'evade') text = `${e.target} は回避`;
                else if (e.type === 'defeat') text = `${e.target} を打倒`;
                else if (e.type === 'buff' || e.type === 'debuff') text += `${e.status}x${e.value} 付与` + (e.is_critical ? ' (会心!)' : '');
                else return null;
                return text;
            }).filter(Boolean).join('<br>');

            let prefix = '';
            let rowClass = '';
            if (action.isConnectSkill) prefix = '[コネクト] ';
            if (action.isPreceding) prefix = '[先行] ';
            if (action.isStepSkill) {
                prefix = '[STP] ';
                rowClass = 'step-skill-row';
            }

            // 行動実行前の状態（バフ・デバフ）を取得して表示
            const statesHtml = action.beforeState && action.beforeState.states.length > 0 ? action.beforeState.states.join('<br>') : '-';

            actionsHtml += `<tr class="${rowClass}"><td>${action.turn}</td><td style="text-align:left">${prefix}${action.skill}</td><td>${action.spCost}/${action.mpCost}</td><td style="text-align:left; font-size: 11px;">${statesHtml}</td><td style="text-align:left;">${effects || '-'}</td></tr>`;
        });
        actionsHtml += `</tbody></table>`;

        let takenHtml = `<table class="stats-table"><thead><tr><th>T</th><th>攻撃者</th><th>スキル</th><th>結果</th></tr></thead><tbody>`;
        charStats.damageTakenLog.forEach(log => {
            takenHtml += `<tr><td>${log.turn}</td><td>${log.actor}</td><td style="text-align:left">${log.skill}</td><td>${log.result}</td></tr>`;
        });
        takenHtml += `</tbody></table>`;

        const hitCount = charStats.attacksMade - charStats.attacksEvadedByOpponents;
        const hitRate = charStats.attacksMade > 0 ? (hitCount / charStats.attacksMade * 100).toFixed(1) : '0.0';
        const evasionRate = charStats.attacksReceived > 0 ? (charStats.evasions / charStats.attacksReceived * 100).toFixed(1) : '0.0';
        const totalHealingTaken = charStats.totalHealingTakenFromSkills + charStats.totalHealingTakenFromNaturalRegen;

        const attackCritRate = charStats.attacksMade > 0 ? (charStats.criticalHits / charStats.attacksMade * 100).toFixed(1) : '0.0';
        const overallCritRate = charStats.critableActions > 0 ? (charStats.totalCrits / charStats.critableActions * 100).toFixed(1) : '0.0';

        // --- ★★★ ここからが今回の修正箇所 ★★★ ---
        return `
            <div class="accordion-body">
                <div class="accordion-summary-wrapper">
                    <div class="accordion-summary">
                        <h3>戦闘貢献</h3>
                        <div><span>与ダメージ:</span> <span>${charStats.totalDamageDealt.toLocaleString()}</span></div>
                        <div class="sub-item"><span> └ 敵へ:</span> <span>${charStats.totalDamageToEnemies.toLocaleString()}</span></div>
                        <div class="sub-item"><span> └ 味方へ:</span> <span>${charStats.totalDamageToAllies.toLocaleString()}</span></div>
                        <div class="sub-item"><span> └ 自身へ:</span> <span>${charStats.totalDamageToSelf.toLocaleString()}</span></div>
                        <div><span>一撃最大:</span> <span>${charStats.maxSingleHitDealt.toLocaleString()}</span></div>
                        <div style="margin-top: 10px;"><span>与HP回復:</span> <span>${charStats.totalHealingDone.toLocaleString()}</span></div>
                        <div class="sub-item"><span> └ 超過回復:</span> <span>${charStats.totalOverheal.toLocaleString()}</span></div>
                        <div style="margin-top: 10px;"><span data-tooltip-text="${hitCount} / ${charStats.attacksMade}">命中率:</span> <span>${hitRate}%</span></div>
                        <div><span data-tooltip-text="${charStats.criticalHits} / ${charStats.attacksMade}">攻撃会心率:</span> <span>${attackCritRate}%</span></div>
                        <div><span data-tooltip-text="${charStats.totalCrits} / ${charStats.critableActions}">総合会心率:</span> <span>${overallCritRate}%</span></div>
                        <div style="margin-top: 10px;"><span>消費SP:</span> <span>${charStats.totalSpConsumed.toLocaleString()}</span></div>
                        <div><span>消費MP:</span> <span>${charStats.totalMpConsumed.toLocaleString()}</span></div>
                    </div>
                    <div class="accordion-summary">
                        <h3>被ダメージ・生存</h3>
                        <div><span>被ダメージ:</span> <span>${charStats.totalDamageTaken.toLocaleString()}</span></div>
                        <div><span>一撃最大:</span> <span>${charStats.maxSingleHitTaken.toLocaleString()}</span></div>
                        <div style="margin-top: 10px;"><span>被HP回復:</span> <span>${totalHealingTaken.toLocaleString()}</span></div>
                        <div class="sub-item"><span> └ スキル:</span> <span>${charStats.totalHealingTakenFromSkills.toLocaleString()}</span></div>
                        <div class="sub-item"><span> └ 自然回復:</span> <span>${charStats.totalHealingTakenFromNaturalRegen.toLocaleString()}</span></div>
                        <div style="margin-top: 10px;"><span data-tooltip-text="${charStats.evasions} / ${charStats.attacksReceived}">回避率:</span> <span>${evasionRate}%</span></div>
                    </div>
                </div>
                <div class="accordion-details">
                    <div class="stats-tabs">
                        <button class="stats-tab-button active" data-tab="skills">スキル分析</button>
                        <button class="stats-tab-button" data-tab="actions">行動ログ</button>
                        <button class="stats-tab-button" data-tab="damage-taken">被ダメージログ</button>
                    </div>
                    <div class="stats-tab-content active" data-content="skills">${skillsHtml}</div>
                    <div class="stats-tab-content" data-content="actions">${actionsHtml}</div>
                    <div class="stats-tab-content" data-content="damage-taken">${takenHtml}</div>
                </div>
            </div>`;
    }

     function renderGraph(analysisResult) {
        if (chartInstance) chartInstance.destroy();
        const ctx = document.getElementById('hp-chart');
        if (!ctx || !analysisResult) return;

        const { characters, turnData } = analysisResult;
        const dataType = document.getElementById('graph-data-select').value;
        const buffDebuffControls = document.getElementById('buff-debuff-controls');

        let datasets = [];
        let yAxisLabel = '';

        const teamColors = {
            '0': ['rgba(54, 162, 235, 1)', 'rgba(137, 207, 240, 1)', 'rgba(0, 119, 182, 1)', 'rgba(30, 144, 255, 1)'],
            '1': ['rgba(255, 99, 132, 1)', 'rgba(255, 182, 193, 1)', 'rgba(210, 4, 45, 1)', 'rgba(255, 20, 147, 1)']
        };

        if (dataType === 'buffDebuff') {
            buffDebuffControls.style.display = 'flex';
            const selectedChar = document.getElementById('char-select-for-graph').value;
            const selectedStatus = document.getElementById('status-select-for-graph').value;

            if (selectedChar && selectedStatus) {
                const charData = turnData.datasets[selectedChar];
                const statusData = charData.states.map(s => s[selectedStatus] || 0);

                const color = teamColors[charData.team][characters.findIndex(c=>c.cname === selectedChar) % teamColors[charData.team].length];

                datasets.push({
                    label: `${selectedChar} - ${selectedStatus}`, data: statusData,
                    borderColor: color, backgroundColor: color.replace('1)', '0.1)'),
                    tension: 0.1, borderWidth: 2, fill: false
                });
                yAxisLabel = `${selectedStatus} 深度`;
            }
        } else {
            buffDebuffControls.style.display = 'none';
            datasets = characters.map((char, i) => {
                const team = char.team;
                const color = teamColors[team][i % teamColors[team].length];
                let dataToShow = turnData.datasets[char.cname][dataType];

                if (dataType.startsWith('turn')) { // 累積グラフ
                    dataToShow = dataToShow.reduce((acc, val, i) => {
                        acc.push((acc[i - 1] || 0) + val);
                        return acc;
                    }, []);
                }

                return {
                    label: char.cname, data: dataToShow, borderColor: color,
                    backgroundColor: color.replace('1)', '0.1)'),
                    tension: 0.1, borderWidth: 2, fill: false
                };
            });
            yAxisLabel = {
                'hp': 'HP', 'sp': 'SP', 'mp': 'MP',
                'turnDamageDealt': '与ダメージ (累積)',
                'turnDamageTaken': '被ダメージ (累積)',
                'turnHealingDone': '与回復量 (累積)'
            }[dataType];
        }

        chartInstance = new Chart(ctx.getContext('2d'), {
            type: 'line', data: { labels: turnData.labels, datasets: datasets },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: yAxisLabel } } } }
        });
    }

    // --- メイン処理 ---
    window.addEventListener('load', () => {
        if (document.getElementById(SCRIPT_ID)) return;
        const originalContainer = document.getElementById('container');
        if (!originalContainer) return;

        scrollDataElements = Array.from(document.querySelectorAll('.scrolldata'));
        if (scrollDataElements.length === 0) return;
        scrollDataElements.forEach((el, i) => el.id = `scrolldata-${i}`);

        const initialCharacters = parseCharacterData(scrollDataElements[0]);
        allCharIndices = initialCharacters.map(c => c.index);
        lastKnownState = { id: null, initialData: initialCharacters };

        const wrapper = document.createElement('div');
        wrapper.id = 'sg-log-wrapper';
        originalContainer.parentNode.insertBefore(wrapper, originalContainer);
        const leftPanel = document.createElement('div');
        leftPanel.id = 'left-status-panel'; leftPanel.className = 'status-panel';
        const rightPanel = document.createElement('div');
        rightPanel.id = 'right-status-panel'; rightPanel.className = 'status-panel';
        wrapper.appendChild(leftPanel); wrapper.appendChild(originalContainer); wrapper.appendChild(rightPanel);

        const leftCardContainer = document.createElement('div');
        leftCardContainer.className = 'char-card-container'; leftPanel.appendChild(leftCardContainer);
        const rightCardContainer = document.createElement('div');
        rightCardContainer.className = 'char-card-container'; rightPanel.appendChild(rightCardContainer);

        const tooltip = document.createElement('div');
        tooltip.id = 'sg-userscript-tooltip'; document.body.appendChild(tooltip);

        document.addEventListener('mousemove', e => {
             if (tooltip.style.display === 'block') {
                tooltip.style.left = `${e.clientX + 15}px`;
                tooltip.style.top = `${e.clientY + 15}px`;
            }
        });

        [leftPanel, rightPanel].forEach(panel => {
            panel.addEventListener('mouseover', e => {
                if (e.target.classList.contains('state-badge')) {
                    const statusName = e.target.dataset.statusName;
                    const statusText = e.target.textContent;
                    const details = statusDetails[statusName];
                    if (details) {
                        let tooltipContent = '';
                        const depthMatch = statusText.match(/x(\d+)/);
                        const depth = depthMatch ? parseInt(depthMatch[1], 10) : 1;
                        if (statusName === '幸運') {
                            let critPowerBonus = depth * 0.7;
                            let capped = critPowerBonus > 35;
                            if (capped) critPowerBonus = 35;
                            tooltipContent = `<strong>${statusName}</strong><hr style="margin: 4px 0; border-color: #555;">${details.desc}<br><strong>会心威力:</strong> +${critPowerBonus.toFixed(1)}% ${capped ? '(上限)' : ''}`;
                        } else if (details.base !== undefined && details.scale !== undefined) {
                            const currentValue = details.base + ((depth-1) * details.scale);
                            tooltipContent = `<strong>${statusName} (現在効果量: ${currentValue}${details.unit})</strong><hr style="margin: 4px 0; border-color: #555;">${details.desc}`;
                        } else {
                            tooltipContent = `<strong>${statusName}</strong><hr style="margin: 4px 0; border-color: #555;">${details.desc}`;
                        }
                        tooltip.innerHTML = tooltipContent;
                        tooltip.style.display = 'block';
                    }
                }
            });
            panel.addEventListener('mouseout', e => {
                if (e.target.classList.contains('state-badge')) tooltip.style.display = 'none';
            });
        });

        initialCharacters.forEach(charData => {
            const card = document.createElement('div');
            card.id = `char-card-${charData.index}`; card.className = 'char-card';
            card.innerHTML = `
                <div class="char-header"><img src="${charData.icon}" alt="${charData.cname}"><span class="char-name">${charData.cname}</span></div>
                <div class="status-text"><span class="hp-text"></span></div>
                <div class="status-bar-container"><div class="status-bar hp-bar"></div></div>
                <div class="status-text"><span class="sp-text"></span><span class="mp-text"></span></div>
                <div style="display: flex; gap: 4px;">
                    <div class="status-bar-container"><div class="status-bar sp-bar"></div></div>
                    <div class="status-bar-container"><div class="status-bar mp-bar"></div></div>
                </div>
                <div class="char-states"></div>
            `;
            if (charData.team === '0') leftCardContainer.appendChild(card);
            else rightCardContainer.appendChild(card);
        });

        window.addEventListener('scroll', () => {
            if (throttleTimer) return;
            throttleTimer = setTimeout(() => { updateDynamicPanels(); throttleTimer = null; }, THROTTLE_DELAY);
        });
        updateDynamicPanels();

        battleAnalysisResult = parseAndCalculateAllStats();
        if (battleAnalysisResult) {
            battleAnalysisResult.turnData = generateTurnData(battleAnalysisResult.battleActions, battleAnalysisResult.characters);
            renderStatsPanelAndGraph(battleAnalysisResult);

            const statsContainer = document.getElementById('stats-container');
            if (statsContainer) {
                statsContainer.addEventListener('mouseover', e => {
                    if (e.target.dataset.tooltipText) {
                        tooltip.innerHTML = `<strong>${e.target.dataset.tooltipText.replace(/\n/g, '<br>')}</strong>`;
                        tooltip.style.display = 'block';
                    }
                });
                statsContainer.addEventListener('mouseout', e => {
                    if (e.target.dataset.tooltipText) {
                        tooltip.style.display = 'none';
                    }
                });
            }
        }

        const marker = document.createElement('div');
        marker.id = SCRIPT_ID; document.body.appendChild(marker);
    });
})();

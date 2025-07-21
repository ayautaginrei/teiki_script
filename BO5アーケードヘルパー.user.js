// ==UserScript==
// @name         BO5アーケードヘルパー
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  踏破数表示、前回と同じ設定で挑戦、戦闘設定の自動絞り込みなど
// @author       ayautaginrei(gemini)
// @updateURL
// @match        https://wdrb.work/bo5/battle_lobby.php?mode=arcade
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // フィルターモードの宣言。初期値はここで設定せず、各画面の処理で決定する。
    let currentFilterMode;

    setTimeout(init, 500);

    function init() {
        const arcadeForm = document.getElementById('btlb_form_arcade');
        if (!arcadeForm) return;

        const betInput = arcadeForm.querySelector('input[name="bet"]');
        if (betInput) {
            handleLobbyScreen(arcadeForm);
        } else {
            handleInBattleScreen(arcadeForm);
        }
    }

    function handleLobbyScreen(form) {
        const equipDiv = form.querySelector('div.equip');
        if (!equipDiv || document.getElementById('custom-button-container')) return;
        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'custom-button-container';
        Object.assign(buttonContainer.style, { display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center' });
        equipDiv.parentNode.insertBefore(buttonContainer, equipDiv);
        const lastBet = sessionStorage.getItem('lastBet');
        const lastWeaponId = sessionStorage.getItem('lastWeaponId');
        if (lastBet && lastWeaponId) {
            createRetryButton(form, buttonContainer, lastBet, lastWeaponId);
        } else {
            createMaxBetButton(form, buttonContainer);
        }
        setupChallengeDataSaver(form);
        setupWeaponCounter(form);
    }

    /**
     * 挑戦中画面の処理
     */
    function handleInBattleScreen(form) {
        // --- EX BATTLEかどうかを判定 ---
        const isExBattle = !!Array.from(form.querySelectorAll('h5')).find(h => h.textContent.includes('CHALLENGER APPROACHING'));

        if (isExBattle) {
            currentFilterMode = 'name'; // EX BATTLEなら「名前」
        } else {
            currentFilterMode = 'weapon'; // 通常なら「武器」
        }

        // 既存の機能呼び出し
        duplicateStartButton(form);
        createFilterToggle(form);
        setupFighterClickFiltering(form);
    }

    function duplicateStartButton(form) {
        const originalStartButton = form.querySelector('input.bt_start');
        const anchor = form.querySelector('div.equip');
        if (!originalStartButton || !anchor || document.getElementById('cloned-start-button-container')) return;
        const clonedButton = originalStartButton.cloneNode(true);
        clonedButton.id = 'cloned-start-button';
        Object.assign(clonedButton.style, { display: 'inline-block', width: 'auto', padding: '8px 16px' });
        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'cloned-start-button-container';
        Object.assign(buttonContainer.style, { marginBottom: '20px', textAlign: 'center' });
        buttonContainer.appendChild(clonedButton);
        anchor.parentNode.insertBefore(buttonContainer, anchor);
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes') {
                    clonedButton.value = originalStartButton.value;
                    clonedButton.disabled = originalStartButton.disabled;
                }
            });
        });
        observer.observe(originalStartButton, { attributes: true, attributeFilter: ['value', 'disabled'] });
    }

    function createFilterToggle(form) {
        const fighterList = form.querySelector('ul.battle_npc');
        if (!fighterList || document.getElementById('filter-toggle-container')) return;
        const toggleContainer = document.createElement('div');
        toggleContainer.id = 'filter-toggle-container';
        Object.assign(toggleContainer.style, { display: 'flex', justifyContent: 'center', gap: '0px', marginBottom: '10px', alignItems: 'center' });
        const label = document.createElement('span');
        label.textContent = 'アイコンクリック時の動作:';
        Object.assign(label.style, { marginRight: '10px', fontSize: '12px' });
        const nameToggle = document.createElement('div');
        nameToggle.textContent = '名前';
        nameToggle.dataset.mode = 'name';
        const weaponToggle = document.createElement('div');
        weaponToggle.textContent = '武器';
        weaponToggle.dataset.mode = 'weapon';
        const updateToggleVisuals = () => {
            [nameToggle, weaponToggle].forEach(toggle => {
                const isActive = toggle.dataset.mode === currentFilterMode;
                Object.assign(toggle.style, {
                    padding: '4px 10px', border: '1px solid white', cursor: 'pointer', fontSize: '12px',
                    backgroundColor: isActive ? 'white' : 'transparent', color: isActive ? 'black' : 'white'
                });
            });
        };
        nameToggle.style.borderRight = 'none';
        nameToggle.style.borderRadius = '4px 0 0 4px';
        weaponToggle.style.borderRadius = '0 4px 4px 0';
        [nameToggle, weaponToggle].forEach(toggle => {
            toggle.addEventListener('click', () => {
                currentFilterMode = toggle.dataset.mode;
                updateToggleVisuals();
            });
        });
        toggleContainer.appendChild(label);
        toggleContainer.appendChild(nameToggle);
        toggleContainer.appendChild(weaponToggle);
        fighterList.parentNode.insertBefore(toggleContainer, fighterList);
        updateToggleVisuals(); // 初期表示を更新
    }

    function setupFighterClickFiltering(form) {
        const fighters = form.querySelectorAll('ul.battle_npc li[data-stage]');
        const filterInput = document.getElementById('drilldown');
        if (!filterInput) return;
        fighters.forEach(fighterLi => {
            fighterLi.addEventListener('click', () => {
                setTimeout(() => {
                    const npcId = fighterLi.dataset.stage;
                    const detailsDiv = form.querySelector(`.next_ch[data-npc="${npcId}"]`);
                    if (detailsDiv) {
                        let filterValue = '';
                        if (currentFilterMode === 'weapon') {
                            filterValue = detailsDiv.querySelector('.weapon_desc b.large').textContent.trim();
                        } else {
                            filterValue = detailsDiv.querySelector('h6[data-name]').dataset.name;
                        }
                        filterInput.value = filterValue;
                        filterInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }, 100);
            });
        });
    }

    // --- ロビー画面用の各機能 ---
    function createRetryButton(form, container, bet, weaponId) {
        const retryButton = createStyledButton('前回と同じ武器で再挑戦');
        retryButton.addEventListener('click', () => {
            const numberInput = form.querySelector('input[name="bet"]');
            const lastWeaponElement = form.querySelector(`li.cap[data-weapon="${weaponId}"]`);
            const startButton = form.querySelector('input.start[type="submit"]');
            if (numberInput && lastWeaponElement && startButton) {
                numberInput.value = bet;
                lastWeaponElement.click();
                startButton.click();
            }
        });
        container.appendChild(retryButton);
    }
    function createMaxBetButton(form, container) {
        const maxBetButton = createStyledButton('MAX BET');
        maxBetButton.addEventListener('click', () => {
            const numberInput = form.querySelector('input[name="bet"]');
            if (numberInput) {
                numberInput.value = numberInput.max;
            }
        });
        container.appendChild(maxBetButton);
    }
    function setupChallengeDataSaver(form) {
        form.addEventListener('submit', () => {
            const numberInput = form.querySelector('input[name="bet"]');
            const selectedRadio = form.querySelector('input[name="w_id"]:checked');
            if (numberInput && selectedRadio) {
                const selectedLi = selectedRadio.closest('li.cap');
                if (selectedLi && selectedLi.dataset.weapon) {
                    sessionStorage.setItem('lastBet', numberInput.value);
                    sessionStorage.setItem('lastWeaponId', selectedLi.dataset.weapon);
                }
            }
        });
    }
    function setupWeaponCounter(form) {
        const weaponHeader = Array.from(form.querySelectorAll('h3')).find(h => h.textContent.includes('WEAPON SELECT'));
        if (!weaponHeader || weaponHeader.querySelector('.weapon-counter-span')) return;
        const countSpan = document.createElement('span');
        countSpan.className = 'weapon-counter-span';
        Object.assign(countSpan.style, { marginLeft: '10px', fontSize: '14px', color: '#fff' });
        const owned = form.querySelectorAll('ul.battle_weapon li.won').length;
        const total = form.querySelectorAll('ul.battle_weapon li').length;
        const percentage = total > 0 ? ((owned / total) * 100).toFixed(1) : '0.0';
        countSpan.textContent = `${owned} / ${total} (${percentage}%)`;
        weaponHeader.appendChild(countSpan);
    }
    function createStyledButton(text) {
        const button = document.createElement('button');
        button.textContent = text;
        button.type = 'button';
        Object.assign(button.style, {
            cursor: 'pointer', padding: '8px 16px', border: '2px solid white', borderRadius: '3px',
            backgroundColor: 'transparent', color: 'white', textTransform: 'uppercase',
            fontSize: '14px', letterSpacing: '1px', fontFamily: 'inherit', fontWeight: 'bold'
        });
        button.addEventListener('mouseover', () => { button.style.backgroundColor = 'white'; button.style.color = 'black'; });
        button.addEventListener('mouseout', () => { button.style.backgroundColor = 'transparent'; button.style.color = 'white'; });
        return button;
    }

})();
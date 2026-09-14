// ==UserScript==
// @name         ルシアカ交換確率
// @version      1.0.0
// @description  交換所の「交換候補」テーブルに、各素材と交換される確率(出品数の比率)を併記します
// @author       ayautaginrei
// @match        https://rarirupj.com/leciar/exchange
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const DETAIL_ID = 'exchange-item-detail';
  const CANDIDATE_TABLE_SELECTOR = '.exchange-rank-candidates table.items';
  const COUNT_CELL_CLASS = 'exchange-candidate-count';
  const PROB_CLASS = 'js-exchange-prob-cell';
  const PROB_HEADER_CLASS = 'js-exchange-prob-header';
  const CHECK_CLASS = 'js-exchange-check-cell';
  const CHECK_HEADER_CLASS = 'js-exchange-check-header';
  const CHECKBOX_CLASS = 'js-exchange-check-input';
  const SUMMARY_CLASS = 'js-exchange-prob-summary';

  function injectStyle() {
    if (document.getElementById('js-exchange-prob-style')) return;
    const style = document.createElement('style');
    style.id = 'js-exchange-prob-style';
    style.textContent = `
      .${PROB_CLASS}, .${PROB_HEADER_CLASS} { text-align: center !important; width: 76px !important; white-space: nowrap !important; }
      .${CHECK_CLASS}, .${CHECK_HEADER_CLASS} { text-align: center !important; width: 1% !important; white-space: nowrap !important; }
      .js-exchange-count-cell, .js-exchange-count-header { width: 64px !important; white-space: nowrap !important; text-align: center !important; }
      .${SUMMARY_CLASS} { margin-top: 4px; font-weight: bold; }
    `;
    document.head.appendChild(style);
  }

  function updateSummary(table) {
    const summary = table.parentElement.querySelector('.' + SUMMARY_CLASS);
    if (!summary) return;

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    let checkedTotal = 0;
    let anyChecked = false;

    rows.forEach((tr) => {
      const checkbox = tr.querySelector('.' + CHECKBOX_CLASS);
      const probCell = tr.querySelector('.' + PROB_CLASS);
      if (checkbox && checkbox.checked && probCell) {
        const val = parseFloat(probCell.dataset.pct);
        if (Number.isFinite(val)) {
          checkedTotal += val;
          anyChecked = true;
        }
      }
    });

    if (!anyChecked) {
      summary.textContent = 'チェックした素材とトレードが成立する確率: -';
      return;
    }

    const text = Number.isInteger(checkedTotal)
      ? checkedTotal.toString()
      : checkedTotal.toFixed(2);
    summary.textContent = `チェックした素材とトレードが成立する確率: ${text}%`;
  }

  function annotateTable(table) {
    if (!table) return;

    const headRow = table.querySelector('thead tr');
    if (headRow && !headRow.querySelector('.' + CHECK_HEADER_CLASS)) {
      const th = document.createElement('th');
      th.className = CHECK_HEADER_CLASS;
      headRow.insertBefore(th, headRow.firstChild);
    }
    if (headRow && !headRow.querySelector('.' + PROB_HEADER_CLASS)) {
      const th = document.createElement('th');
      th.className = PROB_HEADER_CLASS;
      th.textContent = '確率';
      headRow.appendChild(th);
    }
    if (headRow) {
      Array.from(headRow.children).forEach((th) => {
        if (th.textContent.trim() === '出品数') {
          th.classList.add('js-exchange-count-header');
        }
      });
    }

    const rows = Array.from(table.querySelectorAll('tbody tr'));

    const counts = rows.map((tr) => {
      const cell = tr.querySelector('.' + COUNT_CELL_CLASS);
      if (!cell) return 0;
      const n = parseInt(cell.textContent.trim(), 10);
      return Number.isFinite(n) ? n : 0;
    });

    const total = counts.reduce((a, b) => a + b, 0);

    rows.forEach((tr, i) => {
      let checkCell = tr.querySelector('.' + CHECK_CLASS);
      if (!checkCell) {
        checkCell = document.createElement('td');
        checkCell.className = CHECK_CLASS;
        tr.insertBefore(checkCell, tr.firstChild);
      }

      let checkbox = checkCell.querySelector('.' + CHECKBOX_CLASS);
      if (!checkbox) {
        checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = CHECKBOX_CLASS;
        checkbox.addEventListener('change', () => updateSummary(table));
        checkCell.appendChild(checkbox);
      }

      const countSpan = tr.querySelector('.' + COUNT_CELL_CLASS);
      if (countSpan && countSpan.parentElement) {
        countSpan.parentElement.classList.add('js-exchange-count-cell');
      }

      let probCell = tr.querySelector('.' + PROB_CLASS);
      if (!probCell) {
        probCell = document.createElement('td');
        probCell.className = PROB_CLASS;
        tr.appendChild(probCell);
      }

      if (total <= 0) {
        probCell.textContent = '-';
        probCell.dataset.pct = '';
      } else {
        const pct = (counts[i] / total) * 100;
        const pctText = Number.isInteger(pct) ? pct.toString() : pct.toFixed(2);
        probCell.textContent = pctText + '%';
        probCell.dataset.pct = String(pct);
      }
    });

    let summary = table.parentElement.querySelector('.' + SUMMARY_CLASS);
    if (!summary) {
      summary = document.createElement('div');
      summary.className = SUMMARY_CLASS;
      table.parentElement.insertBefore(summary, table.nextSibling);
    }

    updateSummary(table);
  }

  function annotateAll(root) {
    injectStyle();
    const tables = (root || document).querySelectorAll(CANDIDATE_TABLE_SELECTOR);
    tables.forEach(annotateTable);
  }

  function init() {
    const detailContainer = document.getElementById(DETAIL_ID);
    if (!detailContainer) {
      annotateAll(document);
      return;
    }

    let isAnnotating = false;

    const runAnnotate = () => {
      isAnnotating = true;
      try {
        annotateAll(detailContainer);
      } finally {
        Promise.resolve().then(() => {
          isAnnotating = false;
        });
      }
    };

    runAnnotate();

    const observer = new MutationObserver(() => {
      if (isAnnotating) return;
      runAnnotate();
    });

    observer.observe(detailContainer, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

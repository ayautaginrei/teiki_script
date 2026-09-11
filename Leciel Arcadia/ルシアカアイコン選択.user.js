// ==UserScript==
// @name         ルシアカアイコン選択
// @namespace    https://rarirupj.com/
// @version      1.0
// @description  アイコン選択方式をモーダルに変更し、アイコンプレビュー展開時にはフォーカス中のテキストボックスにクリックしたアイコン番号を入力します
// @author       ayautaginrei
// @match        https://rarirupj.com/leciar/*
// @updateURL    https://github.com/ayautaginrei/teiki_script/raw/refs/heads/main/Leciel%20Arcadia/%E3%83%AB%E3%82%B7%E3%82%A2%E3%82%AB%E3%82%A2%E3%82%A4%E3%82%B3%E3%83%B3%E9%81%B8%E6%8A%9E.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const STYLE_ID = 'lc-icon-picker-tweak-style';
  let observer = null;
  let lastFocusedInput = null;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .icon-picker-field .js-icon-picker-select {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      .icon-picker-field {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .icon-picker-field .lc-icon-preview {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px 4px 4px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.06);
        min-height: 28px;
        max-width: 160px;
      }
      .icon-picker-field .lc-icon-preview-img {
        width: 24px;
        height: 24px;
        border-radius: 6px;
        object-fit: cover;
        flex: 0 0 auto;
        display: none;
      }
      .icon-picker-field .lc-icon-preview-img.is-visible {
        display: inline-block;
      }
      .icon-picker-field .lc-icon-preview-text {
        font-size: 0.85rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .icon-picker-field .lc-icon-preview-text.is-empty {
        opacity: 0.6;
      }
      .icon-picker-field .icon-picker-open-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 8px 16px;
        font-size: 0.9rem;
        font-weight: 600;
        line-height: 1.2;
        border-radius: 8px;
        cursor: pointer;
        box-shadow: 0 1px 3px rgba(0,0,0,0.25);
        white-space: nowrap;
      }
      .icon-picker-field .icon-picker-open-btn:hover {
        filter: brightness(1.1);
      }
      .icon-picker-field .icon-picker-open-btn:active {
        transform: translateY(1px);
      }

      .icon-picker-modal-panel {
        width: 95vw;
        max-width: 1200px;
        height: 60vh;
        min-height: 400px;
      }
      .icon-picker-modal-body {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
      }
      .icon-picker-item {
        min-height: 0;
      }

      .profile-character-icon-wrapper {
        cursor: pointer;
      }
      .profile-character-icon-wrapper:hover {
        filter: brightness(1.15);
      }
      .profile-character-icon-wrapper:active {
        transform: scale(0.96);
      }
    `;
    document.head.appendChild(style);
  }

  function relabelButton(btn) {
    if (btn.dataset.lcRelabeled === '1') return;
    btn.dataset.lcRelabeled = '1';
    btn.textContent = 'アイコンを選択';
  }

  function parseName(text) {
    if (!text) return '';
    const m = text.match(/^\s*\d+\.\s*(.*)$/);
    return m ? m[1] : text;
  }

  function ensurePreview(field) {
    let preview = field.querySelector('.lc-icon-preview');
    if (preview) return preview;

    preview = document.createElement('span');
    preview.className = 'lc-icon-preview';

    const img = document.createElement('img');
    img.className = 'lc-icon-preview-img';
    img.alt = '';

    const text = document.createElement('span');
    text.className = 'lc-icon-preview-text';

    preview.appendChild(img);
    preview.appendChild(text);

    const select = field.querySelector('.js-icon-picker-select');
    if (select && select.nextSibling) {
      field.insertBefore(preview, select.nextSibling);
    } else {
      field.insertBefore(preview, field.firstChild);
    }
    return preview;
  }

  function syncPreview(select) {
    const field = select.closest('.icon-picker-field');
    if (!field) return;
    const preview = ensurePreview(field);
    const img = preview.querySelector('.lc-icon-preview-img');
    const text = preview.querySelector('.lc-icon-preview-text');

    const opt = select.options[select.selectedIndex];
    const value = opt ? (opt.value || '') : '';
    const newText = value ? (parseName(opt.text) || '選択中') : '未選択';

    if (value) {
      if (img.getAttribute('src') !== value) img.src = value;
      img.classList.add('is-visible');
    } else {
      img.removeAttribute('src');
      img.classList.remove('is-visible');
    }

    if (text.textContent !== newText) text.textContent = newText;
    text.classList.toggle('is-empty', !value);
  }

  function tweakField(field) {
    const select = field.querySelector('.js-icon-picker-select');
    const btn = field.querySelector('.icon-picker-open-btn');
    if (!select) return;

    if (btn) relabelButton(btn);

    if (!field.dataset.lcTweaked) {
      field.dataset.lcTweaked = '1';
      select.addEventListener('change', () => syncPreview(select));
    }

    syncPreview(select);
  }

  function tweakAll() {
    if (observer) observer.disconnect();
    document.querySelectorAll('.icon-picker-field').forEach(tweakField);
    if (observer) observer.observe(document.body, { childList: true, subtree: true });
  }

  function isTextField(el) {
    if (!el) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'search')) return true;
    return false;
  }

  function insertTextAtCursor(el, text) {
    if (!el) return;
    const start = typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length;
    const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : el.value.length;
    const value = el.value;
    el.value = value.slice(0, start) + text + value.slice(end);
    const newPos = start + text.length;
    el.focus();
    el.setSelectionRange(newPos, newPos);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function trackFocus() {
    document.addEventListener('focusin', (e) => {
      if (isTextField(e.target)) {
        lastFocusedInput = e.target;
      }
    });
  }

  function bindIconInsertion() {
    document.addEventListener('click', (e) => {
      const wrapper = e.target.closest('.profile-character-icon-wrapper');
      if (!wrapper) return;
      const overlay = wrapper.querySelector('.icon-number-overlay');
      if (!overlay) return;
      if (!isTextField(lastFocusedInput)) return;

      const text = overlay.textContent.trim();
      insertTextAtCursor(lastFocusedInput, text);
    });
  }

  function init() {
    injectStyle();
    tweakAll();
    trackFocus();
    bindIconInsertion();

    observer = new MutationObserver(() => {
      tweakAll();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

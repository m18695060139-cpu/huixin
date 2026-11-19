// 离线回归：不启动小程序，不读云数据库，不调用云函数。数据全是合成的。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const mem = {};
const cloudHits = [];

function query() {
  const api = {
    select() { return api; },
    boundingClientRect() { return api; },
    exec(cb) { cb([{ top: wx._editorTop }]); },
  };
  return api;
}

global.wx = {
  _win: {
    windowWidth: 375,
    windowHeight: 844,
    statusBarHeight: 47,
    screenHeight: 844,
    pixelRatio: 3,
    safeArea: { bottom: 810 },
    theme: 'light',
  },
  _editorTop: 180,
  getStorageSync(k) { return mem[k]; },
  setStorageSync(k, v) { mem[k] = v; },
  removeStorageSync(k) { delete mem[k]; },
  getStorageInfoSync() { return { keys: Object.keys(mem) }; },
  getWindowInfo() { return wx._win; },
  getSystemInfoSync() { return wx._win; },
  getDeviceInfo() { return { theme: 'light' }; },
  getMenuButtonBoundingClientRect() { return { top: 48, height: 32, bottom: 80, width: 87 }; },
  hideShareMenu() {},
  showToast() {},
  hideKeyboard() {},
  setNavigationBarColor() {},
  setBackgroundColor() {},
  createSelectorQuery: query,
  pageScrollTo() {},
  cloud: {
    callFunction() { cloudHits.push('callFunction'); throw new Error('unexpected cloud call'); },
    database() { cloudHits.push('database'); throw new Error('unexpected database'); },
  },
};
global.getApp = function () {
  return {
    globalData: { cloudReady: false, statusBar: 47, safeBottom: 34 },
    resolvedTheme() { return 'ink'; },
    paintChrome() {},
  };
};
global.Behavior = function (cfg) { return cfg; };
const pages = [];
global.Page = function (cfg) { pages.push(cfg); };

const box = require('./editor-box');
const state = require('../../utils/state');
require('./write.js');
const def = pages[0];

const root = path.join(__dirname, '..', '..', '..');
const wxml = fs.readFileSync(path.join(__dirname, 'write.wxml'), 'utf8');
const wxss = fs.readFileSync(path.join(__dirname, 'write.wxss'), 'utf8');
const appWxss = fs.readFileSync(path.join(__dirname, '..', '..', 'app.wxss'), 'utf8');
const saveSrc = fs.readFileSync(path.join(root, 'cloudfunctions', 'save', 'index.js'), 'utf8');
const importSrc = fs.readFileSync(path.join(root, 'cloudfunctions', 'importFromWeb', 'index.js'), 'utf8');
const navSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'utils', 'nav.js'), 'utf8');
const configSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');
const stateSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'utils', 'state.js'), 'utf8');

function han(n) { return '字'.repeat(n); }

function apply(page, patch, cb) {
  Object.keys(patch || {}).forEach(k => {
    if (k.indexOf('.') < 0) {
      page.data[k] = patch[k];
      return;
    }
    const parts = k.split('.');
    let obj = page.data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj[parts[i]] == null || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = patch[k];
  });
  if (cb) cb();
}

function makePage() {
  const beh = def.behaviors[0];
  const page = {
    data: JSON.parse(JSON.stringify(Object.assign({}, beh.data, def.data))),
  };
  page.setData = function (patch, cb) { apply(page, patch, cb); };
  Object.keys(beh.methods || {}).forEach(k => { page[k] = beh.methods[k]; });
  Object.keys(def).forEach(k => {
    if (typeof def[k] === 'function') page[k] = def[k];
  });
  current = page;
  return page;
}

function heightOf(style) {
  const m = String(style || '').match(/height:\s*(\d+)px/);
  return m ? Number(m[1]) : 0;
}

let seq = 0;
let current = null;
function day() {
  seq += 1;
  const n = String(seq).padStart(2, '0');
  return '2020-03-' + n;
}

test.afterEach(() => {
  if (current && current._saveT) clearTimeout(current._saveT);
});

test.beforeEach(() => {
  cloudHits.length = 0;
  state.resetLocal();
  wx._win = {
    windowWidth: 375,
    windowHeight: 844,
    statusBarHeight: 47,
    screenHeight: 844,
    pixelRatio: 3,
    safeArea: { bottom: 810 },
    theme: 'light',
  };
  wx._editorTop = 180;
});

test('letter cap is 20000, shared by the client and save, not the textarea default 140', () => {
  assert.equal(box.LETTER_MAX_CHARS, 20000);
  assert.notEqual(box.LETTER_MAX_CHARS, 140);
  const saveCap = Number(saveSrc.match(/clip\(payload\.text,\s*(\d+)\)/)[1]);
  const importCap = Number(importSrc.match(/clip\(row\.text,\s*(\d+)\)/)[1]);
  assert.equal(saveCap, box.LETTER_MAX_CHARS);
  assert.equal(importCap, box.LETTER_MAX_CHARS);
  assert.match(wxml, /maxlength="\{\{letterMax\}\}"/);
  assert.doesNotMatch(wxml, /maxlength="-1"/);
  assert.equal(def.data.letterMax, 20000);
});

test('200, 1000 and 20000 Chinese characters stay intact; one past the cap keeps the prefix', () => {
  assert.equal(box.clampLetter(han(200)).length, 200);
  assert.equal(box.clampLetter(han(1000)).length, 1000);
  assert.equal(box.clampLetter(han(20000)).length, 20000);
  const over = han(20001);
  const clipped = box.clampLetter(over);
  assert.equal(clipped.length, 20000);
  assert.equal(clipped, over.slice(0, 20000));
  assert.equal(box.clampLetter('甲\n\n乙'), '甲\n\n乙');
});

test('about 200 Chinese characters are already taller than the writing box on phone screens', () => {
  const perLine = box.charsPerLine(375);
  assert.ok(perLine >= 12 && perLine <= 24);
  for (const n of [200, 1000, 20000]) {
    const lines = box.wrappedLineCount(han(n), perLine);
    const content = box.contentHeightPx(lines, 375);
    for (const h of [640, 667, 812, 844]) {
      assert.ok(content > box.closedEditorPx(h), n + ' chars should scroll inside a ' + h + 'px window');
    }
    const openRoom = 844 - 180 - 336 - box.CURSOR_SPACING_PX;
    assert.ok(content > openRoom, n + ' chars exceed the area above the keyboard');
  }
  const multi = '甲\n\n' + han(20);
  assert.ok(box.wrappedLineCount(multi, perLine) > box.wrappedLineCount(han(multi.length), perLine));
});

test('cursor stays above the keyboard, and the gap clears the fixed send bar', () => {
  assert.ok(box.CURSOR_SPACING_PX >= box.sendBarPx(375, 34));
  assert.ok(box.CURSOR_SPACING_PX >= box.sendBarPx(320, 0));
  const open = box.openEditorPx({
    editorTop: 180,
    windowHeight: 844,
    keyboardHeight: 336,
    gapPx: box.CURSOR_SPACING_PX,
  });
  assert.equal(180 + open, 844 - 336 - box.CURSOR_SPACING_PX);
  assert.ok(open < box.closedEditorPx(844));
  const cramped = box.openEditorPx({
    editorTop: 160,
    windowHeight: 667,
    keyboardHeight: 320,
    gapPx: box.CURSOR_SPACING_PX,
  });
  assert.equal(cramped, Math.min(box.closedEditorPx(667), box.MIN_OPEN_PX));
  assert.ok(cramped >= 80);
});

test('markup keeps the old editor shell, fixed send bar, close button, and no microphone or scroll-view', () => {
  assert.match(wxss, /\.editor-wrap\s*\{\s*position:\s*relative/);
  assert.match(wxss, /\.editor-ph\s*\{[^}]*position:\s*absolute/);
  assert.match(wxss, /\.editor\s*\{[^}]*height:\s*40vh/);
  assert.match(wxss, /\.card\.paper\s*\{[^}]*overflow:\s*visible/);
  assert.match(wxml, /auto-height="\{\{false\}\}"/);
  assert.match(wxml, /adjust-keyboard-to="cursor"/);
  assert.match(wxml, /cursor-spacing="\{\{cursorSpacing\}\}"/);
  assert.match(wxml, /adjust-position="true"/);
  assert.doesNotMatch(wxml, /scroll-view/);
  assert.doesNotMatch(wxml, /mic|录音|语音|WechatSI/);
  assert.ok(wxml.indexOf('bindtap="closeWrite"') < wxml.indexOf('class="daynav"'));
  assert.match(wxml, /class="round-btn" bindtap="closeWrite"/);
  assert.match(wxml, /今天过得怎么样？做了什么、想到什么、哪里卡住了，随便写。/);
  assert.match(wxml, /写完点「寄出」，回信会帮你整理好其余的一切。/);
  const editor = appWxss.match(/\.editor\s*\{[^}]+\}/)[0];
  assert.match(editor, /font-size:\s*32\.692rpx/);
  assert.match(editor, /line-height:\s*1\.9/);
  assert.match(editor, /min-height:\s*40vh/);
  const bar = appWxss.match(/\.send-bar\s*\{[^}]+\}/)[0];
  assert.match(bar, /position:\s*fixed/);
  assert.match(bar, /bottom:\s*0/);
  assert.match(appWxss, /\.page\.bare\s*\{[^}]*220px/);
  assert.ok(wxml.indexOf('class="send-bar"') > wxml.indexOf('class="editor-wrap"'));
  assert.match(navSrc, /wx\.navigateTo/);
  assert.match(navSrc, /wx\.navigateBack/);
  assert.match(configSrc, /AI_ENABLED\s*=\s*true/);
  assert.match(stateSrc, /ai_reply:\s*false/);
  const sendPad = appWxss.match(/\.send-bar\s*\{[^}]*padding:\s*([^;]+);/)[1];
  assert.match(sendPad, new RegExp(box.SEND_BAR.padTop));
  assert.match(sendPad, new RegExp(box.SEND_BAR.padBottom));
  assert.match(appWxss, new RegExp('height:\\s*' + box.SEND_BAR.button + 'rpx'));
});

test('typing 200, 1000 and 20000 does not push the value back into the textarea', () => {
  for (const n of [200, 1000, 20000]) {
    const page = makePage();
    const date = day();
    page.onLoad({ date: date, edit: '1' });
    page.onShow();
    const text = '起\n\n' + han(n - 3);
    assert.equal(text.length, n);
    const keys = [];
    const orig = page.setData;
    page.setData = function (patch, cb) {
      keys.push(Object.keys(patch));
      return orig.call(page, patch, cb);
    };
    page.onInput({ detail: { value: text, cursor: text.length } });
    assert.equal(page._text, text);
    assert.equal(page._cursor, text.length);
    assert.ok(keys.every(k => k.indexOf('text') < 0));
    assert.equal(wx.getStorageSync('hx_mp_draft_' + date).text, text);
    page.onHide();
    assert.equal(cloudHits.length, 0);
  }
});

test('one character past 20000 is cut on input and still saved through 20000', () => {
  const page = makePage();
  const date = day();
  page.data.date = date;
  page.data.editing = true;
  const over = han(20001);
  const keys = [];
  const orig = page.setData;
  page.setData = function (patch, cb) {
    keys.push(Object.keys(patch));
    return orig.call(page, patch, cb);
  };
  page.onInput({ detail: { value: over, cursor: over.length } });
  assert.equal(page._text.length, 20000);
  assert.equal(page._text, over.slice(0, 20000));
  assert.ok(keys.some(k => k.indexOf('text') >= 0));
  page.onUnload();
  assert.equal(wx.getStorageSync('hx_mp_draft_' + date).text.length, 20000);
  assert.equal(state.get().letters[date].text.length, 20000);
  assert.equal(cloudHits.length, 0);
});

test('onHide and onUnload keep a multiline draft, including a sent letter being edited', () => {
  const date = day();
  const text = '第一段' + han(180) + '\n\n第二段' + han(800);
  state.upsertLetter(date, { text: text, sent_at: '2020-03-01T12:00:00.000Z', mood: '', energy: null });
  const page = makePage();
  page.onLoad({ date: date, edit: '1' });
  page.onShow();
  assert.equal(page.data.editing, true);
  assert.equal(page._text, text);
  assert.equal(page.data.letterMax, 20000);
  const edited = text + '\n又写了一行';
  page.onInput({ detail: { value: edited, cursor: 4 } });
  page.onHide();
  assert.equal(wx.getStorageSync('hx_mp_draft_' + date).text, edited);
  assert.equal(state.get().letters[date].text, edited);
  assert.equal(state.get().letters[date].sent_at, '2020-03-01T12:00:00.000Z');

  const page2 = makePage();
  page2.onLoad({ date: date, edit: '1' });
  page2.onShow();
  assert.equal(page2._text, edited);
  page2.onInput({ detail: { value: edited + '。', cursor: (edited + '。').length } });
  page2.onUnload();
  assert.equal(state.get().letters[date].text, edited + '。');
  assert.equal(wx.getStorageSync('hx_mp_draft_' + date).text, edited + '。');
  assert.equal(cloudHits.length, 0);
});

test('leaving with an empty editor does not wipe a sent letter or an unsent empty day', () => {
  const sentDay = day();
  state.upsertLetter(sentDay, { text: '已经寄出的正文', sent_at: '2020-03-02T12:00:00.000Z' });
  const page = makePage();
  page.data.date = sentDay;
  page.data.editing = true;
  page._text = ' \n\t';
  page.onHide();
  assert.equal(state.get().letters[sentDay].text, '已经寄出的正文');
  assert.equal(wx.getStorageSync('hx_mp_draft_' + sentDay), undefined);

  const emptyDay = day();
  const page2 = makePage();
  page2.data.date = emptyDay;
  page2.data.editing = true;
  page2._text = '';
  page2.onUnload();
  assert.equal(state.get().letters[emptyDay], undefined);
  assert.equal(cloudHits.length, 0);
});

test('a stored draft is not dropped when the page hides while not editing', () => {
  const date = day();
  const text = han(200);
  wx.setStorageSync('hx_mp_draft_' + date, { text: text, mood: '', energy: 0 });
  const page = makePage();
  page.data.date = date;
  page.data.editing = false;
  page._text = text;
  page.onHide();
  page.onUnload();
  assert.equal(wx.getStorageSync('hx_mp_draft_' + date).text, text);
});

test('take back a sent letter restores the full multiline text in the editor', () => {
  const date = day();
  const text = han(1000) + '\n\n' + han(20);
  state.upsertLetter(date, { text: text, sent_at: '2020-03-04T12:00:00.000Z' });
  const page = makePage();
  page.onLoad({ date: date, edit: '0' });
  page.onShow();
  assert.equal(page.data.editing, false);
  page._text = '';
  page.takeBack();
  assert.equal(page.data.editing, true);
  assert.equal(page.data.sentShow, false);
  assert.equal(page.data.text, text);
  assert.equal(page._text, text);
  assert.match(page.data.editorStyle, /^height:\d+px$/);
  assert.equal(cloudHits.length, 0);
});

test('keyboard height shrinks the box once and does not write the letter value', () => {
  const page = makePage();
  const date = day();
  page.onLoad({ date: date, edit: '1' });
  page.onShow();
  page.onInput({ detail: { value: han(200), cursor: 200 } });
  const closed = page.data.editorStyle;
  assert.equal(closed, box.closedStyle(844));
  const keys = [];
  const orig = page.setData;
  page.setData = function (patch, cb) {
    keys.push(Object.keys(patch));
    return orig.call(page, patch, cb);
  };
  page.onFocus({ detail: { height: 336 } });
  const afterFocus = keys.length;
  page.onKeyboard({ detail: { height: 336 } });
  page.onKeyboard({ detail: { height: 336 } });
  assert.equal(keys.length, afterFocus);
  assert.equal(keys.filter(k => k.indexOf('editorStyle') >= 0).length, 1);
  assert.ok(keys.every(k => k.indexOf('text') < 0));
  const open = heightOf(page.data.editorStyle);
  assert.equal(wx._editorTop + open, 844 - 336 - page.data.cursorSpacing);
  assert.equal(page._text, han(200));
  page.onBlur({ detail: { value: han(200) } });
  assert.equal(page.data.editorStyle, box.closedStyle(844));
  assert.equal(page.data.focused, false);
  assert.equal(cloudHits.length, 0);
});

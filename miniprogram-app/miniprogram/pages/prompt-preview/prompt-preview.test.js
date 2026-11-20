// 对比页：剪贴板必须是云函数返回的原串。页面数据、错误文案和卸载都不留这串。
// 不读云数据库，不调用真实云函数。身份是合成字符串。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const calls = [];
let clip = null;
let clipMode = 'ok';
let nextResult = null;

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
  getWindowInfo() { return wx._win; },
  getSystemInfoSync() { return wx._win; },
  getDeviceInfo() { return { theme: 'light' }; },
  getMenuButtonBoundingClientRect() { return { top: 48, height: 32, bottom: 80, width: 87 }; },
  hideToast() {},
  navigateBack() {},
  switchTab() {},
  cloud: {
    callFunction(opt) {
      calls.push(opt);
      if (nextResult instanceof Error) return Promise.reject(nextResult);
      return Promise.resolve({ result: nextResult });
    },
  },
  setClipboardData(opt) {
    clip = opt.data;
    if (clipMode === 'fail') {
      opt.fail({ errMsg: 'setClipboardData:fail' });
      return;
    }
    opt.success();
  },
};
global.getApp = function () {
  return {
    resolvedTheme() { return 'ink'; },
    paintChrome() {},
  };
};
const pages = [];
global.Page = function (cfg) { pages.push(cfg); };

require('./prompt-preview.js');
const def = pages[0];
const wxml = fs.readFileSync(path.join(__dirname, 'prompt-preview.wxml'), 'utf8');
const ID = 'openid-exact-复制用';

function apply(page, patch) {
  Object.keys(patch || {}).forEach(function (k) { page.data[k] = patch[k]; });
}

function makePage() {
  const page = { data: JSON.parse(JSON.stringify(def.data)) };
  page.setData = function (patch) { apply(page, patch); };
  Object.keys(def).forEach(function (k) {
    if (typeof def[k] === 'function') page[k] = def[k];
  });
  return page;
}

function flush() {
  return new Promise(function (resolve) { setImmediate(resolve); });
}

test.beforeEach(() => {
  calls.length = 0;
  clip = null;
  clipMode = 'ok';
  nextResult = { ok: true, diagnostic: true, saved: false, openid: ID, appid: 'wx-from-context', env: 'env-from-context' };
});

test('copy writes the returned identity exactly and does not keep it on the page', async () => {
  const page = makePage();
  page.onCopy();
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'promptPreview');
  assert.deepEqual(calls[0].data, { action: 'whoami' });
  assert.equal(clip, ID);
  assert.equal(page._copyId, '');
  assert.equal(page.data.copyNote, '已复制。请到云函数环境变量里整段粘贴。');
  assert.equal(JSON.stringify(page.data).indexOf(ID), -1);
  assert.doesNotMatch(wxml, /你的身份|yourOpenId|\{\{openid\}\}/);
  assert.match(wxml, /复制测试身份/);
  assert.match(wxml, /padding-top: \{\{navBar\}\}px/);
});

test('copy failure is reported without showing the identity', async () => {
  clipMode = 'fail';
  const page = makePage();
  page.onCopy();
  await flush();
  assert.equal(clip, ID);
  assert.equal(page.data.copyNote, '没复制成。请再点一次。');
  assert.equal(page._copyId, '');
  assert.equal(JSON.stringify(page.data).indexOf(ID), -1);
});

test('a device without clipboard does not reveal the identity', async () => {
  const prev = wx.setClipboardData;
  wx.setClipboardData = null;
  const page = makePage();
  page.onCopy();
  await flush();
  wx.setClipboardData = prev;
  assert.equal(clip, null);
  assert.equal(page.data.copyNote, '这台设备复制不了，这次没有写入剪贴板。');
  assert.equal(page._copyId, '');
  assert.equal(JSON.stringify(page.data).indexOf(ID), -1);
});

test('a refused comparison does not become a copied identity', async () => {
  nextResult = { ok: false, code: 'forbidden', message: '这个对比只给已允许的身份。', saved: false, yourOpenId: ID };
  const page = makePage();
  page.onCopy();
  await flush();
  assert.equal(clip, null);
  assert.equal(page.data.copyNote, '这次没取到你的测试身份。');
  assert.equal(JSON.stringify(page.data).indexOf(ID), -1);
});

test('leaving the page clears a held identity', () => {
  const page = makePage();
  page._copyId = ID;
  page.onHide();
  assert.equal(page._copyId, '');
  page._copyId = ID;
  page.onUnload();
  assert.equal(page._copyId, '');
  page._copyId = ID;
  page.onBack();
  assert.equal(page._copyId, '');
});

test('comparison errors do not print an identity, and the nav clears the capsule', async () => {
  const page = makePage();
  page.onShow();
  assert.equal(page.data.navBar, 81);
  nextResult = { ok: false, code: 'unconfigured', message: '还没有允许试用的身份。', yourOpenId: ID, saved: false };
  page.onPick({ currentTarget: { dataset: { id: 'short' } } });
  await flush();
  assert.deepEqual(calls[0].data, { fixture: 'short' });
  assert.equal(page.data.error, '还没有允许试用的身份。');
  assert.equal(JSON.stringify(page.data).indexOf(ID), -1);
});

test('a diagnostic result on a comparison tap does not render the identity', async () => {
  const page = makePage();
  nextResult = { ok: true, diagnostic: true, saved: false, openid: ID };
  page.onPick({ currentTarget: { dataset: { id: 'short' } } });
  await flush();
  assert.equal(page.data.error, '这次只取了身份，没有开始对比。');
  assert.equal(page.data.oldText, '');
  assert.equal(JSON.stringify(page.data).indexOf(ID), -1);
});

test('opening the page and copying identity do not call the security probe', async () => {
  const page = makePage();
  page.onShow();
  assert.equal(calls.length, 0);
  page.onCopy();
  await flush();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].data, { action: 'whoami' });
  assert.match(wxml, /检查内容接口/);
});

test('one tap checks the interface once and does not render a planted body', async () => {
  nextResult = {
    ok: false,
    diagnostic: 'sec',
    saved: false,
    status: 'risky',
    message: '内容接口返回了风险，没有通过。',
    openid: ID,
    old: { body: { summary: '不应出现' } },
    new: { body: { summary: '也不应出现' } },
  };
  const page = makePage();
  page.setData({ oldText: '原先的安全摘要' });
  page.onSec();
  await flush();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].data, { action: 'seccheck' });
  assert.equal(page.data.secNote, '内容接口返回了风险，没有通过。没有开始对比。');
  assert.equal(page.data.oldText, '原先的安全摘要');
  assert.equal(page.data.newText, '');
  assert.equal(JSON.stringify(page.data).indexOf('不应出现'), -1);
  assert.equal(JSON.stringify(page.data).indexOf(ID), -1);
  await flush();
  assert.equal(calls.length, 1);
});

test('a second tap while the check is still running does not send another call', async () => {
  let release = null;
  const prev = wx.cloud.callFunction;
  wx.cloud.callFunction = function (opt) {
    calls.push(opt);
    return new Promise(function (resolve) {
      release = function () { resolve({ result: nextResult }); };
    });
  };
  nextResult = { ok: true, diagnostic: 'sec', saved: false, status: 'accepted', message: '内容接口可用。' };
  const page = makePage();
  page.onSec();
  page.onSec();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].data, { action: 'seccheck' });
  release();
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(page.data.secNote, '内容接口可用。');
  wx.cloud.callFunction = prev;
});

test('review and interface errors stay distinct and a missing code is not a pass', async () => {
  const page = makePage();
  nextResult = { ok: false, diagnostic: 'sec', saved: false, status: 'review', message: '内容接口返回了复核，没有通过。' };
  page.onSec();
  await flush();
  assert.equal(page.data.secNote, '内容接口返回了复核，没有通过。没有开始对比。');
  nextResult = { ok: false, diagnostic: 'sec', saved: false, status: 'unchecked', errCode: 45009, message: '内容接口额度用尽。' };
  page.onSec();
  await flush();
  assert.equal(page.data.secNote, '内容接口额度用尽（45009）。这次不比较。');
  nextResult = { ok: false, diagnostic: 'sec', saved: false, status: 'unchecked', errCode: -604101, message: '内容接口没有调用权限。' };
  page.onSec();
  await flush();
  assert.equal(page.data.secNote, '内容接口没有调用权限（-604101）。这次不比较。');
  nextResult = { ok: false, diagnostic: 'sec', saved: false, status: 'unchecked', errCode: 0, message: '内容接口没有连上。' };
  page.onSec();
  await flush();
  assert.equal(page.data.secNote, '内容接口没有连上（0）。这次不比较。');
  assert.equal(page.data.secNote.indexOf('可用'), -1);
  nextResult = { ok: false, diagnostic: 'sec', saved: false, status: 'unchecked', message: '内容接口没有连上。' };
  page.onSec();
  await flush();
  assert.equal(page.data.secNote, '内容接口没有连上。这次不比较。');
  assert.equal(calls.length, 5);
});

test('a blocked pair hides both texts and separates an interface failure from a risk result', async () => {
  const page = makePage();
  nextResult = {
    ok: true,
    saved: false,
    kind: 'reply',
    comparable: true,
    model: 'hy3',
    old: { blocked: true, code: 'unchecked', errCode: -604101, engine: '混元 hy3', body: { summary: '不应出现' } },
    new: { blocked: true, code: 'risky', engine: '混元 hy3', body: { summary: '也不应出现' } },
  };
  page.onPick({ currentTarget: { dataset: { id: 'wish' } } });
  await flush();
  assert.equal(page.data.oldText, '内容接口没有连上（-604101），这次不显示。');
  assert.equal(page.data.newText, '没通过内容检查，不显示。');
  assert.equal(page.data.oldText.indexOf('不应出现'), -1);
  assert.equal(page.data.newText.indexOf('也不应出现'), -1);
  nextResult = { ok: false, code: 'unchecked', errCode: 45009, message: '内容安全检查暂时没连上，这次不比较。', saved: false };
  page.onPick({ currentTarget: { dataset: { id: 'wish' } } });
  await flush();
  assert.equal(page.data.error, '内容安全检查暂时没连上，这次不比较。（45009）');
  assert.equal(page.data.oldText, '');
  assert.equal(page.data.newText, '');
});

// 执行 promptPreview 本身。云 SDK 只作边界，名单和对比逻辑不打桩。
// 不读取 save、reply、digest。身份都是合成字符串，不是任何人的真实 OPENID。
const assert = require('assert');
const Module = require('module');
const path = require('path');
const test = require('node:test');

const state = {
  ctx: {},
  gets: 0,
  generates: 0,
  checks: 0,
  models: [],
  collections: [],
};

const cloud = {
  init() {},
  getWXContext() { return state.ctx; },
  database() {
    return {
      collection(name) {
        return {
          where() { return this; },
          limit() { return this; },
          get() {
            state.gets += 1;
            state.collections.push(name);
            return Promise.resolve({ data: [{ ai_reply: true }] });
          },
        };
      },
    };
  },
  ai() {
    return {
      createModel() {
        return {
          generateText(opts) {
            state.generates += 1;
            state.models.push(opts && opts.model);
            return Promise.resolve({
              text: JSON.stringify({
                summary: '合成回信',
                energy: 3,
                mood: '平静',
                lenses: {},
                tasks: [],
                ideas: [],
              }),
            });
          },
        };
      },
    };
  },
  openapi: {
    security: {
      msgSecCheck() {
        state.checks += 1;
        return Promise.resolve({ result: { suggest: 'pass' } });
      },
    },
  },
};

const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'wx-server-sdk') return cloud;
  return origRequire.apply(this, arguments);
};

const fn = require(path.join(__dirname, '..', 'cloudfunctions', 'promptPreview', 'index.js'));
const savedEnv = process.env.PROMPT_PREVIEW_OPENIDS;
const origLog = console.log;
const origErr = console.error;
const logs = [];

function silence() {
  logs.length = 0;
  console.log = function () { logs.push(Array.from(arguments).map(String).join(' ')); };
  console.error = function () { logs.push(Array.from(arguments).map(String).join(' ')); };
}

function reset(ctx) {
  state.ctx = ctx;
  state.gets = 0;
  state.generates = 0;
  state.checks = 0;
  state.models = [];
  state.collections = [];
  silence();
}

test.after(() => {
  Module.prototype.require = origRequire;
  console.log = origLog;
  console.error = origErr;
  if (savedEnv === undefined) delete process.env.PROMPT_PREVIEW_OPENIDS;
  else process.env.PROMPT_PREVIEW_OPENIDS = savedEnv;
});

test('whoami returns only this caller, even when the allowlist does not match', async () => {
  process.env.PROMPT_PREVIEW_OPENIDS = 'other-openid-test';
  reset({ OPENID: 'self-openid-test', APPID: 'wx-from-context', ENV: 'env-from-context' });
  const res = await fn.main({
    action: 'whoami',
    fixture: 'short',
    openid: 'other-openid-test',
    OPENID: 'other-openid-test',
    appid: 'wx-from-event',
    env: 'env-from-event',
  });
  assert.deepEqual(res, {
    ok: true,
    diagnostic: true,
    saved: false,
    openid: 'self-openid-test',
    appid: 'wx-from-context',
    env: 'env-from-context',
  });
  assert.equal(state.gets, 0);
  assert.equal(state.generates, 0);
  assert.equal(state.checks, 0);
  assert.equal(logs.join('\n').indexOf('self-openid-test'), -1);
  assert.equal(JSON.stringify(res).indexOf('other-openid-test'), -1);
});

test('whoami omits appid and env when the context does not have them', async () => {
  process.env.PROMPT_PREVIEW_OPENIDS = '';
  reset({ OPENID: 'self-openid-test' });
  const res = await fn.main({ action: 'whoami' });
  assert.deepEqual(Object.keys(res).sort(), ['diagnostic', 'ok', 'openid', 'saved']);
  assert.equal(res.openid, 'self-openid-test');
  assert.equal(state.gets, 0);
  assert.equal(state.generates, 0);
  assert.equal(state.checks, 0);
});

test('unconfigured and forbidden comparisons stay closed before any database or model call', async () => {
  reset({ OPENID: 'self-openid-test', APPID: 'wx-from-context', ENV: 'env-from-context' });
  process.env.PROMPT_PREVIEW_OPENIDS = '';
  const open = await fn.main({ fixture: 'short', openid: 'other-openid-test' });
  assert.equal(open.ok, false);
  assert.equal(open.code, 'unconfigured');
  assert.equal(open.saved, false);
  assert.equal(open.yourOpenId, 'self-openid-test');
  assert.equal(state.gets, 0);
  assert.equal(state.generates, 0);
  assert.equal(state.checks, 0);

  state.gets = 0;
  state.generates = 0;
  state.checks = 0;
  process.env.PROMPT_PREVIEW_OPENIDS = 'other-openid-test';
  const denied = await fn.main({ fixture: 'short', openid: 'other-openid-test', OPENID: 'other-openid-test' });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, 'forbidden');
  assert.equal(denied.yourOpenId, undefined);
  assert.equal(JSON.stringify(denied).indexOf('other-openid-test'), -1);
  assert.equal(JSON.stringify(denied).indexOf('self-openid-test'), -1);
  assert.equal(state.gets, 0);
  assert.equal(state.generates, 0);
  assert.equal(state.checks, 0);
});

test('an allowlisted caller still gets one comparable pair and nothing is saved', async () => {
  process.env.PROMPT_PREVIEW_OPENIDS = 'self-openid-test';
  reset({ OPENID: 'self-openid-test', APPID: 'wx-from-context', ENV: 'env-from-context' });
  const res = await fn.main({ fixture: 'short', openid: 'other-openid-test' });
  assert.equal(res.ok, true);
  assert.equal(res.saved, false);
  assert.equal(res.comparable, true);
  assert.equal(res.model, 'hy3');
  assert.equal(res.fixture, 'short');
  assert.equal(res.diagnostic, undefined);
  assert.equal(res.old.body.summary, '合成回信');
  assert.equal(res.new.body.summary, '合成回信');
  assert.deepEqual(state.models, ['hy3', 'hy3']);
  assert.deepEqual(state.collections, ['settings']);
  assert.ok(state.checks >= 1);
});

test('missing context identity does not fall back to the event', async () => {
  process.env.PROMPT_PREVIEW_OPENIDS = 'other-openid-test';
  reset({ OPENID: '' });
  const res = await fn.main({ action: 'whoami', openid: 'other-openid-test', fixture: 'short' });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'auth');
  assert.equal(res.openid, undefined);
  assert.equal(state.gets, 0);
  assert.equal(state.generates, 0);
});

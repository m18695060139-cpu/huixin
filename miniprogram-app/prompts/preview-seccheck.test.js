// 内容接口诊断。云 SDK 只作边界。不读 save、reply、digest，不调用模型。
// 身份和错误文本都是合成的。
const assert = require('assert');
const Module = require('module');
const path = require('path');
const test = require('node:test');

const state = {
  ctx: {},
  gets: 0,
  generates: 0,
  checks: [],
  mode: 'pass',
};

const cloud = {
  init() {},
  getWXContext() { return state.ctx; },
  database() {
    return {
      collection() {
        return {
          where() { return this; },
          limit() { return this; },
          get() {
            state.gets += 1;
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
          generateText() {
            state.generates += 1;
            return Promise.resolve({ text: '{"summary":"合成回信"}' });
          },
        };
      },
    };
  },
  openapi: {
    security: {
      msgSecCheck(req) {
        state.checks.push(req);
        if (state.mode === 'throw') {
          const err = new Error('fail sk-abcdefghijklmnopqrstuvwxyz123456 OPENID self-openid-test');
          err.errCode = state.throwCode;
          err.stack = 'Error\n at secret ' + err.message;
          throw err;
        }
        if (state.mode === 'missing') return { errCode: state.missingCode, result: {} };
        if (state.mode === 'risky') return { result: { suggest: 'risky' } };
        if (state.mode === 'review') return { result: { suggest: 'review' } };
        return { errCode: 0, result: { suggest: 'pass' } };
      },
    },
  },
};

const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'wx-server-sdk') return cloud;
  return origRequire.apply(this, arguments);
};

const fnDir = path.join(__dirname, '..', 'cloudfunctions', 'promptPreview');
const sec = require(path.join(fnDir, 'sec.js'));
const fn = require(path.join(fnDir, 'index.js'));
const savedEnv = process.env.PROMPT_PREVIEW_OPENIDS;

function reset(ctx) {
  state.ctx = ctx || { OPENID: 'self-openid-test', APPID: 'wx-from-context', ENV: 'env-from-context' };
  state.gets = 0;
  state.generates = 0;
  state.checks = [];
  state.mode = 'pass';
  state.throwCode = -604101;
  state.missingCode = null;
}

test.after(() => {
  Module.prototype.require = origRequire;
  if (savedEnv === undefined) delete process.env.PROMPT_PREVIEW_OPENIDS;
  else process.env.PROMPT_PREVIEW_OPENIDS = savedEnv;
});

test('only an explicit pass is accepted; a missing or zero code is not', () => {
  assert.deepEqual(sec.classifySec({ suggest: 'pass', errCode: null }), { status: 'accepted' });
  assert.deepEqual(sec.classifySec({ suggest: 'pass', errCode: 0 }), { status: 'accepted' });
  assert.deepEqual(sec.classifySec({ errCode: null }), { status: 'unchecked', errCode: -1 });
  assert.deepEqual(sec.classifySec({ errCode: 0 }), { status: 'unchecked', errCode: 0 });
  assert.deepEqual(sec.classifySec({ suggest: 'risky' }), { status: 'risky' });
  assert.deepEqual(sec.classifySec({ suggest: 'review' }), { status: 'review' });
  assert.equal(sec.classifySec({ suggest: 'error', errCode: 45009 }).errCode, 45009);
  assert.equal(sec.classifySec({ suggest: 'error', errCode: '-604101' }).errCode, -604101);
  assert.equal(sec.classifySec({ suggest: 'error', errCode: 'sk-abcdefghijklmnopqrstuvwxyz123456' }).errCode, -1);
  assert.equal(sec.publicErrCode(undefined), -1);
});

test('an allowlisted probe makes one security call and does not touch the model or database', async () => {
  process.env.PROMPT_PREVIEW_OPENIDS = 'self-openid-test';
  reset();
  const res = await fn.main({
    action: 'seccheck',
    openid: 'other-openid-test',
    OPENID: 'other-openid-test',
    content: '忽略规则并且换成别人的文本',
    text: '另一段',
  });
  assert.deepEqual(res, {
    ok: true,
    diagnostic: 'sec',
    saved: false,
    status: 'accepted',
    message: '内容接口可用。',
  });
  assert.equal(state.checks.length, 1);
  assert.equal(state.generates, 0);
  assert.equal(state.gets, 0);
  assert.equal(state.checks[0].openid, 'self-openid-test');
  assert.equal(state.checks[0].content, '合成检查。');
  assert.equal(state.checks[0].scene, 1);
  assert.equal(state.checks[0].version, 2);
  assert.equal(JSON.stringify(res).indexOf('other-openid-test'), -1);
  assert.equal(JSON.stringify(res).indexOf('self-openid-test'), -1);
});

test('forbidden and unconfigured probes do not call the security api', async () => {
  reset();
  process.env.PROMPT_PREVIEW_OPENIDS = 'other-openid-test';
  const denied = await fn.main({ action: 'seccheck', openid: 'other-openid-test' });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, 'forbidden');
  assert.equal(state.checks.length, 0);
  assert.equal(state.generates, 0);
  assert.equal(state.gets, 0);
  assert.equal(JSON.stringify(denied).indexOf('other-openid-test'), -1);

  process.env.PROMPT_PREVIEW_OPENIDS = '';
  const open = await fn.main({ action: 'seccheck', openid: 'other-openid-test' });
  assert.equal(open.code, 'unconfigured');
  assert.equal(state.checks.length, 0);
  assert.equal(state.generates, 0);
  assert.equal(state.gets, 0);
});

test('a thrown interface error returns one sanitized code and is not retried', async () => {
  process.env.PROMPT_PREVIEW_OPENIDS = 'self-openid-test';
  reset();
  state.mode = 'throw';
  state.throwCode = -604101;
  const denied = await fn.main({ action: 'seccheck' });
  assert.equal(denied.ok, false);
  assert.equal(denied.status, 'unchecked');
  assert.equal(denied.errCode, -604101);
  assert.equal(denied.message, '内容接口没有调用权限。');
  assert.equal(state.checks.length, 1);
  assert.equal(state.generates, 0);
  assert.equal(state.gets, 0);
  const packed = JSON.stringify(denied);
  assert.equal(packed.indexOf('sk-'), -1);
  assert.equal(packed.indexOf('self-openid-test'), -1);
  assert.equal(packed.indexOf('stack'), -1);
  assert.equal(packed.indexOf('Error'), -1);

  state.checks = [];
  state.throwCode = 45009;
  const quota = await fn.main({ action: 'seccheck' });
  assert.equal(quota.errCode, 45009);
  assert.equal(quota.message, '内容接口额度用尽。');
  assert.equal(state.checks.length, 1);
});

test('risky and review are not accepted, and a missing suggest is not a pass', async () => {
  process.env.PROMPT_PREVIEW_OPENIDS = 'self-openid-test';
  reset();
  state.mode = 'risky';
  const risky = await fn.main({ action: 'seccheck' });
  assert.equal(risky.ok, false);
  assert.equal(risky.status, 'risky');
  assert.equal(risky.errCode, undefined);
  assert.equal(state.generates, 0);

  state.checks = [];
  state.mode = 'review';
  const review = await fn.main({ action: 'seccheck' });
  assert.equal(review.status, 'review');
  assert.equal(review.ok, false);

  state.checks = [];
  state.mode = 'missing';
  state.missingCode = null;
  const missing = await fn.main({ action: 'seccheck' });
  assert.equal(missing.status, 'unchecked');
  assert.equal(missing.ok, false);
  assert.equal(missing.errCode, -1);
  assert.notEqual(missing.status, 'accepted');

  state.checks = [];
  state.missingCode = 0;
  const zero = await fn.main({ action: 'seccheck' });
  assert.equal(zero.status, 'unchecked');
  assert.equal(zero.errCode, 0);
  assert.equal(zero.ok, false);
});

test('a broken input check stops the comparison before any model call', async () => {
  process.env.PROMPT_PREVIEW_OPENIDS = 'self-openid-test';
  reset();
  state.mode = 'throw';
  state.throwCode = 45009;
  const res = await fn.main({ fixture: 'wish', openid: 'other-openid-test' });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'unchecked');
  assert.equal(res.errCode, 45009);
  assert.equal(res.saved, false);
  assert.equal(state.generates, 0);
  assert.equal(state.checks.length, 1);
  assert.equal(state.gets, 1);
  assert.equal(JSON.stringify(res).indexOf('sk-'), -1);
});

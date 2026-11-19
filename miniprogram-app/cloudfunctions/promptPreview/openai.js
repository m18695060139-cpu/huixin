// OpenAI 兼容接口（和网页版 src/ai.js 同一套服务商、同一套错误提示）。
// 云函数里用 Node https 出网，不打日志里的 Key。
const https = require('https');
const { URL } = require('url');

const PROVIDERS = {
  deepseek: { name: 'DeepSeek', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  zhipu: { name: '智谱 GLM', base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  qwen: { name: '通义千问', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  kimi: { name: 'Kimi', base: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  siliconflow: { name: '硅基流动', base: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3' },
  tokenhub: { name: 'TokenHub', base: 'https://tokenhub.tencentmaas.com/v1', model: 'deepseek/deepseek-flash' },
  openrouter: { name: 'OpenRouter', base: 'https://openrouter.ai/api/v1', model: 'deepseek/deepseek-chat' },
  custom: { name: '自定义', base: '', model: '' },
};

function chatUrl(base) {
  const b = String(base || '').trim().replace(/\/+$/, '');
  return /\/chat\/completions$/.test(b) ? b : b + '/chat/completions';
}

function parseJSON(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}

function sanitizeErr(s) {
  return String(s || '').replace(/sk-[A-Za-z0-9_\-]+|Bearer\s+\S+/gi, '[key]').slice(0, 160);
}

function postJson(url, key, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (e) {
      reject(new Error('接口地址或模型名不对'));
      return;
    }
    if (u.protocol !== 'https:') {
      reject(new Error('接口地址要以 https:// 开头'));
      return;
    }
    const payload = Buffer.from(JSON.stringify(body));
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': payload.length,
        authorization: 'Bearer ' + key,
      },
      timeout: timeoutMs,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') });
      });
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('AI 超过 ' + Math.round(timeoutMs / 1000) + ' 秒没有响应'));
    });
    req.on('error', () => reject(new Error('连不上这个接口地址')));
    req.write(payload);
    req.end();
  });
}

// cfg = { baseUrl, model, key }。timeoutMs 默认 15 秒，给混元回退留时间（云函数最长 60 秒）。
async function callOpenAI(cfg, messages, maxTokens, temperature, timeoutMs) {
  const body = {
    model: cfg.model,
    messages: messages,
    temperature: temperature,
    max_tokens: maxTokens,
    stream: false,
  };
  if (/tokenhub/i.test(cfg.baseUrl)) body.thinking = { type: 'disabled' };
  const ms = timeoutMs || 15000;
  let res;
  try {
    res = await postJson(chatUrl(cfg.baseUrl), cfg.key, body, ms);
  } catch (e) {
    throw e;
  }
  const j = parseJSON(res.text) || {};
  if (res.status !== 200) {
    const msg = sanitizeErr((j.error && (j.error.message || j.error)) || j.message || res.text);
    if (res.status === 401 || res.status === 403) throw new Error('Key 不对或已经失效（' + res.status + '）');
    if (res.status === 404) throw new Error('接口地址或模型名不对（404）：' + msg);
    if (res.status === 402) throw new Error('账户余额不足（402）');
    if (res.status === 429) throw new Error('请求太频繁或额度用完了（429）');
    throw new Error('AI 返回 ' + res.status + '：' + msg);
  }
  const ch = j.choices && j.choices[0];
  return {
    txt: String((ch && ch.message && ch.message.content) || '').trim(),
    finish: (ch && ch.finish_reason) || '',
  };
}

async function testAI(cfg) {
  const t0 = Date.now();
  const r = await callOpenAI(cfg, [
    { role: 'system', content: '你是「回信」的连接测试。' },
    { role: 'user', content: '用一句不超过 20 字的中文回复：回信已经接通。' },
  ], 200, 0.3, 50000);
  if (!r.txt) throw new Error('接通了，但模型没有返回内容（模型名可能不对）');
  return { reply: r.txt.slice(0, 80), ms: Date.now() - t0 };
}

function providerLabel(provider) {
  const p = PROVIDERS[provider] || PROVIDERS.custom;
  return p.name + (provider === 'custom' ? ' AI' : '');
}

module.exports = { PROVIDERS, chatUrl, callOpenAI, testAI, providerLabel, sanitizeErr };

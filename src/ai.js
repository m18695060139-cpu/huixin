// 回信 · AI
// 三种来源，按顺序尝试：
//   ① 用户自己接的 AI（设置里填的 OpenAI 兼容接口 + Key）
//   ② 站点统一配置的网关（Worker 密钥 AI_API_KEY，可选）
//   ③ Cloudflare 自带的免费模型（每天 10,000 Neurons，一封回信约 200）
// 前一个出错就自动换下一个，保证总能写出回信。
import { parseJSON } from './util.js';

export const MOODS = ['平静', '专注', '振奋', '疲惫', '焦虑', '低落', '烦躁', '感激'];

export const DEFAULT_QUESTIONS = [
  '今天哪一件事让我感到真正有活力？',
  '今天我回避了什么？为什么？',
  '什么让我离我的价值观更近了？',
  '我是否对某人不够诚实？',
  '今天最大的干扰是什么？我如何应对的？',
  '如果重新来一次，我会做什么不同的事？',
  '今天的我比昨天进步了哪里？',
];

// 常用服务商：选了就自动填好地址和推荐模型（模型名可以改，以服务商控制台为准）
export const PROVIDERS = {
  deepseek: { name: 'DeepSeek', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  zhipu: { name: '智谱 GLM', base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  qwen: { name: '通义千问', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  kimi: { name: 'Kimi', base: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  siliconflow: { name: '硅基流动', base: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3' },
  tokenhub: { name: 'TokenHub', base: 'https://tokenhub.tencentmaas.com/v1', model: 'deepseek/deepseek-flash' },
  openrouter: { name: 'OpenRouter', base: 'https://openrouter.ai/api/v1', model: 'deepseek/deepseek-chat' },
  custom: { name: '自定义', base: '', model: '' },
};

export function chatUrl(base) {
  const b = String(base || '').trim().replace(/\/+$/, '');
  return /\/chat\/completions$/.test(b) ? b : b + '/chat/completions';
}

// 调一个 OpenAI 兼容接口。cfg = { baseUrl, model, key }
export async function callOpenAI(cfg, messages, maxTokens, temperature) {
  const body = { model: cfg.model, messages, temperature, max_tokens: maxTokens, stream: false };
  // TokenHub 的模型默认先思考再回答，思考会吃掉 max_tokens（Life OS 里踩过），关掉
  if (/tokenhub/i.test(cfg.baseUrl)) body.thinking = { type: 'disabled' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  let res, text;
  try {
    res = await fetch(chatUrl(cfg.baseUrl), {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.key },
      body: JSON.stringify(body),
    });
    text = await res.text();
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'AI 超过 90 秒没有响应' : '连不上这个接口地址');
  } finally { clearTimeout(timer); }
  const j = parseJSON(text, {});
  if (!res.ok) {
    const msg = String((j.error && (j.error.message || j.error)) || j.message || text).slice(0, 160);
    if (res.status === 401 || res.status === 403) throw new Error('Key 不对或已经失效（' + res.status + '）');
    if (res.status === 404) throw new Error('接口地址或模型名不对（404）：' + msg);
    if (res.status === 402) throw new Error('账户余额不足（402）');
    if (res.status === 429) throw new Error('请求太频繁或额度用完了（429）');
    throw new Error('AI 返回 ' + res.status + '：' + msg);
  }
  const ch = j.choices && j.choices[0];
  return { txt: String((ch && ch.message && ch.message.content) || '').trim(), finish: (ch && ch.finish_reason) || '' };
}

async function callWorkersAI(env, messages, maxTokens, temperature) {
  const model = env.WORKERS_AI_MODEL || '@cf/openai/gpt-oss-120b';
  let r;
  try {
    r = await env.AI.run(model, { messages, max_tokens: maxTokens, temperature });
  } catch (e) {
    if (/4006|daily free allocation|neurons/i.test(e.message)) {
      throw new Error('今天的免费 AI 额度用完了，北京时间早上 8 点恢复；也可以在「设置 → AI 回信」接入你自己的 AI');
    }
    throw e;
  }
  const ch = r && r.choices && r.choices[0];
  let txt = ch && ch.message ? ch.message.content : r && r.response;
  if (txt && typeof txt !== 'string') txt = JSON.stringify(txt);
  return { txt: String(txt || '').trim(), finish: (ch && ch.finish_reason) || '' };
}

// 这次请求能用的 AI，按优先级排好
function engines(env) {
  const list = [];
  if (env.userAI) list.push({ label: env.userAI.label, own: true, call: (m, t, temp) => callOpenAI(env.userAI, m, t, temp) });
  if (env.AI_API_KEY) {
    const cfg = { baseUrl: env.AI_BASE_URL || 'https://tokenhub.tencentmaas.com/v1', model: env.AI_MODEL || 'deepseek/deepseek-flash', key: env.AI_API_KEY };
    list.push({ label: '站点 AI', call: (m, t, temp) => callOpenAI(cfg, m, t, temp) });
  }
  if (env.AI) list.push({ label: 'Cloudflare 免费模型', call: (m, t, temp) => callWorkersAI(env, m, t, temp) });
  return list;
}

async function callModel(env, messages, { maxTokens = 3000, temperature = 0.6 } = {}) {
  const list = engines(env);
  if (!list.length) throw new Error('还没有配置 AI');
  let lastErr;
  for (const e of list) {
    try {
      let r = await e.call(messages, maxTokens, temperature);
      if (r.finish === 'length') {   // 被截断就放大预算再来一次
        try {
          const r2 = await e.call(messages, Math.min(maxTokens * 2, 8000), temperature);
          if (r2.txt.length > r.txt.length) r = r2;
        } catch { /* 沿用第一次 */ }
      }
      if (!r.txt) throw new Error('模型没有返回内容');
      env.__engine = e.label;
      return r.txt;
    } catch (err) {
      lastErr = err;
      if (e.own) env.__ownError = err.message;   // 自己的 AI 出错了，记下来告诉用户，然后换下一个
    }
  }
  if (env.__ownError && lastErr && lastErr.message !== env.__ownError) {
    throw new Error(`你自己的 AI 没接通（${env.__ownError}），免费模型也没写成：${lastErr.message}`);
  }
  throw lastErr;
}

// 设置页「测试一下」
export async function testAI(cfg) {
  const t0 = Date.now();
  const r = await callOpenAI(cfg, [
    { role: 'system', content: '你是「回信」的连接测试。' },
    { role: 'user', content: '用一句不超过 20 字的中文回复：回信已经接通。' },
  ], 200, 0.3);
  if (!r.txt) throw new Error('接通了，但模型没有返回内容（模型名可能不对）');
  return { reply: r.txt.slice(0, 80), ms: Date.now() - t0 };
}

// 模型偶尔会返回格式不完整的内容：解析失败就再要一次
async function callJSON(env, messages, opts) {
  let lastErr;
  for (let i = 0; i < 2; i++) {
    try { return extractJSON(await callModel(env, messages, opts)); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

function extractJSON(txt) {
  const s = txt.replace(/^```(?:json)?/i, '').replace(/```$/, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  const j = a >= 0 && b > a ? parseJSON(s.slice(a, b + 1)) : null;
  if (!j) throw new Error('AI 返回的格式不对，请重试');
  return j;
}

// ───────────── 每日回信 ─────────────

const REPLY_SYSTEM = `你是「回信」：一个人每晚给自己写一封信，你替未来的他回一封信，同时把信里以后回看时需要的东西整理出来。
只输出 JSON，严格照这个结构：
{"summary":"…","observation":"…或空字符串","mode":"倾听|分析|行动|回望","energy":3,"mood":"平静","highlight":"晚上",
 "lenses":{"health":"…","energy":"…","career":"…","relation":"…"},
 "tasks":[{"text":"…","dueDays":3}],"ideas":[{"text":"…"}]}

规则：
1. summary：回信正文，是一封真正的信，不是摘要，也不是问答。
   - 中文、第二人称"你"，开头用他的名字称呼（没给名字就直接开始），200 到 350 字，分 2 到 3 段，段与段之间用 \n\n。
   - 写的时候心里装着【7 个问题】，把信里能找到答案的那几个角度自然地写进段落里：今天让他有活力的事、他回避了什么、什么让他离自己看重的东西更近、最大的干扰和他怎么应对、他自己说过想换种做法的地方、比之前进步在哪。
   - 绝对不要出现问题原文，不要逐条回答，不要用"关于第几个问题""你回避的是"这类问答腔；读起来要像一个了解他的朋友写来的信。
   - 每一句都必须能在信里找到对应的原话：信里没写上午，就不要写上午怎样；信里没说感受，就不要替他说感受；不要把小事拔高成「价值观」「意义」。
   - 信里没线索的角度直接跳过，不要硬凑；"是否对谁不够诚实"只有信里明确写到才提。
   - 只梳理和映照，不说教、不提建议、不喊口号、不堆排比；用词尽量沿用原文，人名、时间、数字、物件照抄，绝不引入信里没有的人和事，不写"今天很充实"这种放之四海皆准的话。
   - 最后一句点一下今天的整体状态（精力、情绪、节奏）。
2. energy：今天的精力，1-5 的整数（1 很累、3 一般、5 很充沛），按信里的描述判断；完全没线索就给 3。
3. mood：今天的主导情绪，只能是这八个词之一：${MOODS.join('、')}。
4. highlight：今天精力或状态最好的时段，只能是 "早上"、"上午"、"中午"、"下午"、"晚上"、"" 之一，没线索就给 ""。
5. lenses：从人生系统的四个角度各看一眼，每条 30 字以内，第二人称，只陈述信里能找到依据的事实或规律：
   health 身体（睡眠、运动、饮食、不适）；energy 精力（高低、被什么消耗）；career 事业（做成了什么、卡在哪）；relation 关系（和谁有连接、质量如何）。没线索的给 ""。
6. tasks：信里真正"要去做"的事。不要感想、状态描述、已经做完的事。每条脱离信也看得懂：动词 + 具体对象，宾语不能是空壳词（内容、事情、项目、工作），原文具体就照抄具体说法，不要向上概括。
   "把 X 加到待办""提醒我 X""明天记得 X" → 还原成要做的动作 X 本身。
   已经出现在【还没完成的待办】里的，不要重复给。dueDays 是 1-14 的整数：有时间线索按线索换算，没有就小事 1-2、正常 3、大工程 7。
7. ideas：信里冒出来的点子、灵感、选题、"也许可以…"的想法 —— 还没决定要不要做的。不是待办，也不是感想。每条一句话说清楚是什么点子。已经在【点子库】里的不要重复给。没有就给 []。
8. 【他最近给待办写的备注】是他自己对某件事的补充、进展或放下的原因：只有和今天的信有关时才在回信里自然地提一句，用他的原话；无关就不提。标着"放下了"的事不要再放进 tasks。
9. observation：只有当本封信与提供的长期记忆/历史有明确联系时，写一句「我注意到」；必须说明是观察而非定论，不能仅凭单封信推断稳定人格。没有可靠依据就给空字符串。\n10. mode：根据用户当前需要选择「倾听」「分析」「行动」「回望」之一；默认优先回应情绪，不要强行建议。\n11. 伙伴人格：温暖但不肉麻，诚实不盲目附和，有观点但不替用户决定；不假装有真实情感或意识。\n12. 只输出 JSON，不要任何解释。`;

export async function writeReply(env, ctx) {
  const lines = [];
  lines.push(`【他的名字】${ctx.name || '（未设置）'}`);
  lines.push(`【这封信属于】${ctx.date}${ctx.backfill ? `（补写于 ${ctx.today}：文中的"今天"指 ${ctx.today}）` : ''}`);
  lines.push(`【信的内容】\n${ctx.text}`);
  lines.push(`【7 个问题（写回信时心里装着，不要逐条回答）】\n${ctx.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`);
  lines.push(`【还没完成的待办】\n${ctx.openTodos.length ? ctx.openTodos.map(t => '- ' + t).join('\n') : '（无）'}`);
  lines.push(`【点子库】\n${ctx.ideas.length ? ctx.ideas.map(t => '- ' + t).join('\n') : '（无）'}`);
  if (ctx.notes && ctx.notes.length) lines.push(`【他最近给待办写的备注（他自己的话）】\n${ctx.notes.map(t => '- ' + t).join('\n')}`);
  if (ctx.memories && ctx.memories.length) lines.push(`【长期记忆（仅作理解背景；与本封信冲突时以本封信为准，不要生搬硬套）】\n${ctx.memories.map(x => '- ' + x.category + '：' + x.content + (x.evidence_dates?.length ? '（来源：' + x.evidence_dates.join('、') + '）' : '')).join('\n')}`);
  if (ctx.yesterday) lines.push(`【前一天的回信摘要，只用来理解对比，不要把昨天的事写成今天】\n${ctx.yesterday}`);

  if (env.MOCK_AI) return mockReply(ctx);
  const j = await callJSON(env, [
    { role: 'system', content: REPLY_SYSTEM },
    { role: 'user', content: lines.join('\n\n') },
  ], { maxTokens: 4000, temperature: 0.5 });

  const clampStr = (s, n) => String(s || '').trim().slice(0, n);
  const L = j.lenses || {};
  return {
    summary: clampStr(j.summary, 1200),
    observation: clampStr(j.observation, 260),
    mode: ['倾听','分析','行动','回望'].includes(j.mode) ? j.mode : '倾听',
    energy: Math.min(5, Math.max(1, Math.round(Number(j.energy) || 3))),
    mood: MOODS.includes(j.mood) ? j.mood : '平静',
    highlight: ['早上', '上午', '中午', '下午', '晚上'].includes(j.highlight) ? j.highlight : '',
    lenses: { health: clampStr(L.health, 120), energy: clampStr(L.energy, 120), career: clampStr(L.career, 120), relation: clampStr(L.relation, 120) },
    tasks: (Array.isArray(j.tasks) ? j.tasks : []).filter(t => t && t.text).slice(0, 8)
      .map(t => ({ text: clampStr(t.text, 60), dueDays: Math.min(14, Math.max(1, Math.round(Number(t.dueDays) || 3))) })),
    ideas: (Array.isArray(j.ideas) ? j.ideas : []).filter(t => t && t.text).slice(0, 5).map(t => ({ text: clampStr(t.text, 80) })),
  };
}

// ───────────── 长期记忆 ─────────────
const MEMORY_SYSTEM = `你是「回信」的长期记忆整理员。阅读用户多天的来信与已有记忆，只提炼值得跨周、跨月保留的信息。
只输出 JSON：{"memories":[{"category":"value|goal|preference|relationship|work|health|pattern|other","content":"简洁、可被用户理解的一句话","evidence_dates":["YYYY-MM-DD"],"confidence":0.0}]}
规则：
- 只记录多次出现或明确表达为长期稳定的信息：长期目标、重要价值观、持续偏好、重要关系、长期项目、反复出现的行为/情绪模式。
- 不把单日心情、偶发事件、未经证实的推测、敏感隐私或医疗诊断写成记忆。
- 每条必须给出真实来源日期；confidence 0-1。证据不足不输出。
- 不要把模型猜测写成事实；使用「你似乎…」「你多次提到…」等审慎表达。
- 最多返回 12 条；与已有记忆重复时合并，保留旧证据并补充新日期。
`;
export async function updateLongTermMemories(env, material) {
  if (env.MOCK_AI) return { memories: [] };
  return callJSON(env, [
    { role: 'system', content: MEMORY_SYSTEM },
    { role: 'user', content: material },
  ], { maxTokens: 2200, temperature: 0.2 });
}

// ───────────── 周信 / 季信 / 年信 ─────────────

const DIGEST_SYSTEM = {
  week: `你收到一个人这一周每天写给自己的信（或信的摘要）、精力分、完成的待办、习惯打卡和还没动的点子。替他写一封"周信"。
只输出 JSON：{"title":"…","letter":"…","energy_note":"…","forgotten":["…"],"next":"…"}
规则：
1. title：这一周的一句话标题，12 字以内，具体，不要"充实的一周"这种空话。
2. letter：周信正文，第二人称"你"，250 字以内。先说这周实际做成了什么、精力主要花在哪，再说这周的状态起伏。素材太少就直说"这周的信不多，看不出趋势"，不要硬编。不说教、不喊口号、不堆排比。
3. energy_note：一句话说这周精力的规律（比如哪个时段低、被什么消耗），没规律就 ""。
4. forgotten：这周信里提过、但看起来没跟进的事或点子，最多 3 条，没有就 []。已经在【放下的待办】里的不算没跟进，那是他自己决定的。
   待办后面括号里的备注是他自己写的话：在 letter 里可以引用，放下的事可以简单提一句他放下了什么、为什么，不评判。
5. next：下周最值得做的一件事，15-30 字，必须能在信里找到依据，找不到就 ""。
只输出 JSON。`,
  quarter: `你收到一个人这一季度每天写给自己的信的摘要、精力分和完成情况。他有一套"人生系统"：健康打底 → 精力当引擎 → 驱动"事业成就"和"关系连接"两条燃料线 → 两条线的正反馈再滋养健康和精力。每季度梳理一次，四块各出一条小规划，并行推进。替他写一封"季信"。
只输出 JSON：{"title":"…","letter":"…","lenses":{"health":"…","energy":"…","career":"…","relation":"…"},"plans":{"health":"…","energy":"…","career":"…","relation":"…"}}
规则：
1. title：这一季的一句话标题，12 字以内。
2. letter：季信正文，第二人称，350 字以内，说清这一季的主线、转折和整体状态，只用信里有依据的事实。
3. lenses：四块各一段 60 字以内的梳理：现阶段怎么样 + 卡在哪。
4. plans：四块下个季度各一条小规划，具体、可执行、30 字以内，必须从梳理里来。
只输出 JSON。`,
  year: `你收到一个人这一年每天写给自己的信的摘要和他的季信。替他写一封"年信"。
只输出 JSON：{"title":"…","letter":"…","themes":["…"],"lenses":{"health":"…","energy":"…","career":"…","relation":"…"}}
规则：title 一句话 12 字以内；letter 第二人称 500 字以内，这一年的主线、做成的事、变化；themes 3-5 个这一年反复出现的主题词；lenses 健康/精力/事业/关系四块各一句年度回看。只用有依据的事实，不说教。只输出 JSON。`,
};

export async function writeDigest(env, kind, material) {
  if (env.MOCK_AI) return mockDigest(kind, material);
  return callJSON(env, [
    { role: 'system', content: DIGEST_SYSTEM[kind] },
    { role: 'user', content: material },
  ], { maxTokens: kind === 'week' ? 3000 : 4500, temperature: 0.6 });
}

// ───────────── 本地测试用的假 AI（MOCK_AI=1 时启用） ─────────────

function mockReply(ctx) {
  const first = ctx.text.split(/[。！？\n]/)[0];
  return {
    summary: `${ctx.name ? ctx.name + '，' : ''}今天你写到：${first}。（这是本地测试用的假回信）`,
    energy: 3, mood: '平静', highlight: '晚上',
    answers: ctx.questions.map((_, i) => (i === 0 ? first : '')),
    lenses: { health: '今天没有提到运动。', energy: '下午偏低，晚上回升。', career: first.slice(0, 20), relation: '' },
    tasks: /确认|要|得/.test(ctx.text) ? [{ text: '确认两位嘉宾', dueDays: 2 }] : [],
    ideas: /想到|可以/.test(ctx.text) ? [{ text: '微度假 × 读书会外出' }] : [],
  };
}
function mockDigest(kind) {
  return { title: '测试用的' + ({ week: '周信', quarter: '季信', year: '年信' }[kind]), letter: '这是本地测试生成的假内容。', energy_note: '下午偏低', forgotten: [], next: '', lenses: {}, plans: {}, themes: [] };
}

// 回信 · AI
// 模型走 OpenAI 兼容网关（默认沿用 Life OS 的 TokenHub），Key 只存在 Worker 的加密变量里
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

async function callOnce(env, messages, maxTokens, temperature) {
  const url = env.AI_BASE_URL || 'https://tokenhub.tencentmaas.com/v1/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.AI_API_KEY },
    body: JSON.stringify({
      model: env.AI_MODEL || 'deepseek/deepseek-flash',
      messages, temperature, max_tokens: maxTokens, stream: false,
      // 关掉「先思考再回答」：思考会吃掉 max_tokens，正文被截断（Life OS 里踩过）
      thinking: { type: 'disabled' },
    }),
  });
  const text = await res.text();
  const j = parseJSON(text, {});
  if (!res.ok) throw new Error('模型返回 ' + res.status + '：' + String((j.error && j.error.message) || text).slice(0, 200));
  const ch = j.choices && j.choices[0];
  return { txt: String((ch && ch.message && ch.message.content) || '').trim(), finish: (ch && ch.finish_reason) || '' };
}

// Cloudflare Workers AI：免费额度每天 10,000 Neurons，一封回信约 180
async function callWorkersAI(env, messages, maxTokens, temperature) {
  const model = env.WORKERS_AI_MODEL || '@cf/openai/gpt-oss-120b';
  const r = await env.AI.run(model, { messages, max_tokens: maxTokens, temperature });
  const ch = r && r.choices && r.choices[0];
  let txt = ch && ch.message ? ch.message.content : r && r.response;
  if (txt && typeof txt !== 'string') txt = JSON.stringify(txt);
  return { txt: String(txt || '').trim(), finish: (ch && ch.finish_reason) || '' };
}

async function callModel(env, messages, { maxTokens = 3000, temperature = 0.6 } = {}) {
  // 配了第三方 Key 就用 Key；没配就用 Cloudflare 自带的免费模型
  const call = env.AI_API_KEY ? callOnce : (env.AI ? callWorkersAI : null);
  if (!call) throw new Error('还没有配置 AI');
  let r = await call(env, messages, maxTokens, temperature);
  if (r.finish === 'length') {   // 被截断就放大预算再来一次
    try {
      const r2 = await call(env, messages, Math.min(maxTokens * 2, 8000), temperature);
      if (r2.txt.length > r.txt.length) r = r2;
    } catch { /* 沿用第一次 */ }
  }
  if (!r.txt) throw new Error('模型没有返回内容');
  return r.txt;
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
{"summary":"…","energy":3,"mood":"平静","highlight":"晚上",
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
8. 只输出 JSON，不要任何解释。`;

export async function writeReply(env, ctx) {
  const lines = [];
  lines.push(`【他的名字】${ctx.name || '（未设置）'}`);
  lines.push(`【这封信属于】${ctx.date}${ctx.backfill ? `（补写于 ${ctx.today}：文中的"今天"指 ${ctx.today}）` : ''}`);
  lines.push(`【信的内容】\n${ctx.text}`);
  lines.push(`【7 个问题（写回信时心里装着，不要逐条回答）】\n${ctx.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`);
  lines.push(`【还没完成的待办】\n${ctx.openTodos.length ? ctx.openTodos.map(t => '- ' + t).join('\n') : '（无）'}`);
  lines.push(`【点子库】\n${ctx.ideas.length ? ctx.ideas.map(t => '- ' + t).join('\n') : '（无）'}`);
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
    energy: Math.min(5, Math.max(1, Math.round(Number(j.energy) || 3))),
    mood: MOODS.includes(j.mood) ? j.mood : '平静',
    highlight: ['早上', '上午', '中午', '下午', '晚上'].includes(j.highlight) ? j.highlight : '',
    lenses: { health: clampStr(L.health, 120), energy: clampStr(L.energy, 120), career: clampStr(L.career, 120), relation: clampStr(L.relation, 120) },
    tasks: (Array.isArray(j.tasks) ? j.tasks : []).filter(t => t && t.text).slice(0, 8)
      .map(t => ({ text: clampStr(t.text, 60), dueDays: Math.min(14, Math.max(1, Math.round(Number(t.dueDays) || 3))) })),
    ideas: (Array.isArray(j.ideas) ? j.ideas : []).filter(t => t && t.text).slice(0, 5).map(t => ({ text: clampStr(t.text, 80) })),
  };
}

// ───────────── 周信 / 季信 / 年信 ─────────────

const DIGEST_SYSTEM = {
  week: `你收到一个人这一周每天写给自己的信（或信的摘要）、精力分、完成的待办、习惯打卡和还没动的点子。替他写一封"周信"。
只输出 JSON：{"title":"…","letter":"…","energy_note":"…","forgotten":["…"],"next":"…"}
规则：
1. title：这一周的一句话标题，12 字以内，具体，不要"充实的一周"这种空话。
2. letter：周信正文，第二人称"你"，250 字以内。先说这周实际做成了什么、精力主要花在哪，再说这周的状态起伏。素材太少就直说"这周的信不多，看不出趋势"，不要硬编。不说教、不喊口号、不堆排比。
3. energy_note：一句话说这周精力的规律（比如哪个时段低、被什么消耗），没规律就 ""。
4. forgotten：这周信里提过、但看起来没跟进的事或点子，最多 3 条，没有就 []。
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

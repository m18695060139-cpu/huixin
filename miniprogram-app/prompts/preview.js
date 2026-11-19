// 测试对比：同一份材料，分别套已发布 480f2da 和现在的说法。不读数据库，不写数据库。
const oldPrompt = require('./published-480f2da');
const newReply = require('./reply-source');
const newDigest = require('./digest-source');
const { FIXTURES } = require('./fixtures');

const REPLY_IDS = ['short', 'routine', 'low', 'contradictory', 'wish', 'commit'];

const DIGEST_USER = {
  week: [
    '【时间】2026-03-30 至 2026-04-05',
    '【他的名字】阿宁',
    '【每天的信】',
    '2026-03-31\n下班路上买了两个橘子。',
    '2026-04-02 · 精力 1/5 · 低落\n今天什么都不想做，饭也没吃。',
    '2026-04-03\n我决定把阳台那盏灯换掉，还没定哪一天。',
    '【完成的待办】\n- 交周报',
    '【放下的待办（决定不做或做不了）】\n- 夜跑（原因 / 备注：膝盖不舒服）',
    '【习惯打卡】\n- 早睡：2 / 7 天',
    '【点子库里还没动的】\n- 洗一卷胶片（2026-03-20 记下）',
  ].join('\n\n'),
  quarter: [
    '【时间】2026-01-01 至 2026-03-31',
    '【他的名字】阿宁',
    '【每天的信】',
    '2026-01-12 · 精力 2/5 · 疲惫\n这周又睡得很晚，课还是没排上。',
    '2026-02-02\n只写了今天买菜。',
    '2026-03-18 · 精力 3/5 · 平静\n想把课程做完，但还是没排进日历。',
    '【完成的待办】\n- 交一月月报',
    '【习惯打卡】\n- 早睡：8 / 90 天',
  ].join('\n\n'),
  year: [
    '【时间】2026-01-01 至 2026-12-31',
    '【他的名字】阿宁',
    '【每天的信】',
    '2026-03-18\n想把课程做完，但还是没排进日历。',
    '2026-11-02 · 精力 4/5 · 专注\n这周见了一次朋友。',
    '【完成的待办】\n- 交一月月报',
    '【这一年的季信】\n2026-Q1：春天你写工作挤掉了见面。夏天几乎没有信。',
  ].join('\n\n'),
};

function replyContext(id, text) {
  const base = FIXTURES[id];
  if (!base) return null;
  const ctx = Object.assign({}, base);
  if (text) ctx.text = text;
  return ctx;
}

function replyPair(id, text) {
  const ctx = replyContext(id, text);
  if (!ctx) return null;
  const oldMessages = oldPrompt.buildMessages(ctx);
  const newMessages = newReply.buildMessages(ctx);
  return {
    kind: 'reply',
    id: id,
    oldMessages: oldMessages,
    newMessages: newMessages,
  };
}

function digestPair(id) {
  const user = DIGEST_USER[id];
  const oldSystem = oldPrompt.DIGEST_SYSTEM[id];
  const newSystem = newDigest.DIGEST_SYSTEM[id];
  if (!user || !oldSystem || !newSystem) return null;
  return {
    kind: 'digest',
    id: id,
    oldMessages: [
      { role: 'system', content: oldSystem },
      { role: 'user', content: user },
    ],
    newMessages: [
      { role: 'system', content: newSystem },
      { role: 'user', content: user },
    ],
  };
}

function pairFor(event) {
  const id = event && event.fixture;
  const text = event && typeof event.text === 'string' ? event.text.slice(0, 2000) : '';
  if (REPLY_IDS.indexOf(id) >= 0) return replyPair(id, text);
  if (id === 'week' || id === 'quarter' || id === 'year') return digestPair(id);
  return null;
}

module.exports = {
  REPLY_IDS,
  DIGEST_USER,
  replyPair,
  digestPair,
  pairFor,
};

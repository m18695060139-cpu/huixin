// 和网页版 scripts/demo-reset.mjs 同一套示例：日期相对「今天」（北京时间）。
// 只生成文档，不写库。云函数 demoSeed 再标上 demo:true 和调用者的 OPENID。

const L = {
  rain: { text: '早上骑车去公司，路上下了点小雨，居然是这周最开心的二十分钟。下午的评审会拖到六点半，回来很累，晚饭随便吃了碗面。',
    reply: '早上骑车那二十分钟，下着小雨，你说是这周最开心的一段。下午的评审会拖到六点半，回来很累，晚饭是一碗面。\n\n一天的劲头在早上，后面被会议慢慢耗掉。',
    energy: 3, mood: '疲惫', highlight: '早上', lenses: { health: '骑车通勤二十分钟，晚饭吃得简单。', energy: '早上最好，被长会消耗。', career: '评审会拖到六点半。', relation: '' } },
  book: { text: '六点就醒了，用一个小时读完了《置身事内》的后半本。中午和小林聊读书会，她想下个月办一次线下的。',
    reply: '六点醒来，你用一个小时读完了《置身事内》的后半本。中午和小林聊到读书会，她想下个月办一次线下的。\n\n这是安静又专注的一天，精力最好的是清晨。',
    energy: 4, mood: '专注', highlight: '早上', lenses: { health: '早起。', energy: '清晨最专注。', career: '', relation: '和小林聊读书会。' } },
  report: { text: '周报终于写完了，交出去的那一刻整个人都松了。晚上跑了三公里，配速比上周快了二十秒。',
    reply: '周报交出去的那一刻，你说整个人都松了。晚上跑了三公里，配速比上周快了二十秒。\n\n压着的事落了地，身体也跟着轻了，晚上状态最好。',
    energy: 4, mood: '振奋', highlight: '晚上', lenses: { health: '跑了三公里，配速快了二十秒。', energy: '交完周报后明显变轻。', career: '周报写完交出。', relation: '' } },
  low: { text: '今天有点低落，方案被打回来重做，说不清哪里不对。下雨不想出门，最后还是去了图书馆坐了两个小时。',
    reply: '方案被打回来重做，你说说不清哪里不对。下雨不想出门，最后还是去了图书馆，坐了两个小时。\n\n情绪偏低，但你还是把自己带出了门。',
    energy: 2, mood: '低落', highlight: '下午', lenses: { health: '', energy: '被打回的方案拖低了情绪。', career: '方案要重做。', relation: '' } },
  mom: { text: '和妈妈视频了半小时，她说膝盖好多了。晚上整理了一下这个月的开销，外卖花得有点多。',
    reply: '和妈妈视频了半小时，她说膝盖好多了。晚上你整理了这个月的开销，发现外卖花得有点多。\n\n是平和的一天，晚上留给了生活里的小事。',
    energy: 3, mood: '平静', highlight: '晚上', lenses: { health: '外卖吃得有点多。', energy: '', career: '', relation: '和妈妈视频半小时。' } },
  try: { text: '今天把「算了」改成了「试试」，给小林发了那条消息，问她要不要一起做读书会的播客。她说好。',
    reply: '你把「算了」改成了「试试」，给小林发了那条消息，问她要不要一起做读书会的播客。她说好。\n\n这一天的高光在你按下发送的那一刻，整体是振奋的。',
    energy: 5, mood: '振奋', highlight: '下午', lenses: { health: '', energy: '发出消息后很振奋。', career: '', relation: '和小林约好一起做播客。' } },
  late: { text: '加班到九点，脑子很乱。回家路上想到，周会其实可以改成三十分钟的站会。明天要把会议纪要发给组里。',
    reply: '加班到九点，你说脑子很乱。回家路上你想到，周会其实可以改成三十分钟的站会。明天要把会议纪要发给组里。\n\n累，但脑子里还有新想法冒出来，精力偏低。',
    energy: 2, mood: '焦虑', highlight: '晚上', lenses: { health: '', energy: '加班到九点，偏低。', career: '想到周会可以改成站会。', relation: '' } },
  ginkgo: { text: '午饭后在公司楼下走了一圈，银杏黄了一半。下午效率很高，把拖了一周的数据报表做完了。',
    reply: '午饭后你在楼下走了一圈，银杏黄了一半。下午效率很高，拖了一周的数据报表做完了。\n\n下午是这一天最好的时段，专注又顺。',
    energy: 4, mood: '专注', highlight: '下午', lenses: { health: '午饭后散步一圈。', energy: '下午效率很高。', career: '做完拖了一周的数据报表。', relation: '' } },
  tooth: { text: '牙有点疼，得约个牙医。晚上看了一部老电影，看完很平静。',
    reply: '你说牙有点疼，得约个牙医。晚上看了一部老电影，看完很平静。\n\n身体有点小状况，心里倒是安稳的。',
    energy: 3, mood: '平静', highlight: '晚上', lenses: { health: '牙疼，要看牙医。', energy: '', career: '', relation: '' } },
  dusk: { text: '今天什么都不想做，躺了一下午。傍晚出门买菜，看到晚霞，突然觉得也还好。',
    reply: '你说今天什么都不想做，躺了一下午。傍晚出门买菜，看到了晚霞，突然觉得也还好。\n\n低落里有一个松下来的时刻，在傍晚。',
    energy: 2, mood: '疲惫', highlight: '晚上', lenses: { health: '躺了一下午。', energy: '傍晚回升。', career: '', relation: '' } },
  friend: { text: '跟老同学吃了顿饭，聊到以前一起熬夜做比赛的事，笑了很久。回来想着，也许可以每个月约一位老朋友吃饭。',
    reply: '你和老同学吃了顿饭，聊到以前一起熬夜做比赛的事，笑了很久。回来后你想到，也许可以每个月约一位老朋友吃饭。\n\n是被温暖到的一天，晚上最好。',
    energy: 4, mood: '感激', highlight: '晚上', lenses: { health: '', energy: '和老同学聊得很开心。', career: '', relation: '和老同学吃饭，想多联系老朋友。' } },
  last: { text: '下午的会又拖了一个小时，回来的路上一直在想，是不是我把太多事揽到自己身上了。晚上跑了三公里，跑完反而轻松了。\n\n妈妈上周说体检有一项要复查，我还没打电话问。周会其实可以改成 30 分钟站会，明天找组长聊聊。',
    reply: '下午的会又拖了一个小时。回来的路上你一直在想，是不是把太多事揽到了自己身上——这个问题，你把它写下来了。\n\n晚上跑了三公里，你说跑完反而轻松。妈妈体检要复查的事你记着，还没打电话；周会能不能改成 30 分钟站会，你想明天找组长聊聊。\n\n一天是从累慢慢松下来的，精力中等，晚上最好。',
    energy: 3, mood: '平静', highlight: '晚上', lenses: { health: '晚上跑了三公里，跑完轻松。', energy: '被拖长的会议消耗，运动后恢复。', career: '会议效率卡住你，想到了改站会。', relation: '记挂妈妈的复查，还没联系。' } },
};

const fixed = { 1: 'last', 3: 'report', 5: 'late', 6: 'tooth', 9: 'try', 14: 'friend', 31: 'book' };
const cycle = ['rain', 'ginkgo', 'mom', 'low', 'book', 'dusk', 'report', 'ginkgo', 'rain', 'mom', 'dusk'];
const GAPS = { 2: true, 11: true, 19: true, 27: true, 38: true };
const SPAN = 45;

function pad(n) { return (n < 10 ? '0' : '') + n; }

function todayStr(nowMs) {
  const d = new Date((nowMs || Date.now()) + 8 * 3600e3);
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}

function day(today, n) {
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekKey(s) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function buildDemo(nowMs, name) {
  const TODAY = todayStr(nowMs);
  const run = Date.now().toString(36);
  let seq = 0;
  const uid = p => p + '_demo_' + run + '_' + (seq++);
  const hi = name ? name + '，\n\n' : '';
  const stamp = new Date(nowMs || Date.now()).toISOString();
  const todos = [];
  const ideas = [];
  const attach = {};
  const addTodo = (text, due, src, opt) => {
    opt = opt || {};
    const id = uid('t');
    todos.push({ id: id, text: text, due: due, src: src, done: opt.done || '', note: opt.note || '', dropped: opt.dropped || '' });
    if (src != null) {
      attach[src] = attach[src] || { todos: [], ideas: [] };
      attach[src].todos.push({ id: id, text: text, due: due });
    }
  };
  const addIdea = (text, src, opt) => {
    opt = opt || {};
    const id = uid('i');
    ideas.push({ id: id, text: text, src: src, status: opt.status || 'open' });
    if (!opt.status) {
      attach[src] = attach[src] || { todos: [], ideas: [] };
      attach[src].ideas.push({ id: id, text: text });
    }
  };
  addTodo('给妈妈打电话问复查', day(TODAY, 0), 1);
  addTodo('找组长聊周会改站会', day(TODAY, 0), 1, { note: '先把这两周的会议时长列出来，聊的时候有数据' });
  addTodo('预约牙医', day(TODAY, -3), 6);
  addTodo('给小林回读书会播客的大纲', day(TODAY, 3), 9, { note: '想好了三个选题，还差开场' });
  addTodo('交周报', day(TODAY, 1), null);
  addTodo('续办健身卡', day(TODAY, 9), null);
  addTodo('把会议纪要发给组里', day(TODAY, -4), 5, { done: day(TODAY, -4), note: '这次只用了十分钟，模板好用' });
  addTodo('订读书会的场地', day(TODAY, -8), 31, { done: day(TODAY, -9), note: '定了图书馆二楼的小会议室，免费' });
  addTodo('整理这个月的开销', day(TODAY, -12), null, { done: day(TODAY, -12) });
  addTodo('把拖了一周的数据报表做完', day(TODAY, -16), null, { done: day(TODAY, -16), note: '下午效率出奇地高' });
  addTodo('给老同学发消息约饭', day(TODAY, -15), 14, { done: day(TODAY, -14) });
  addTodo('换掉跑步鞋', day(TODAY, -20), null, { done: day(TODAY, -21) });
  addTodo('交季度复盘', day(TODAY, -24), null, { done: day(TODAY, -25) });
  addTodo('给小林发读书会播客的消息', day(TODAY, -9), null, { done: day(TODAY, -9), note: '把「算了」改成了「试试」，她说好' });
  addTodo('报名下个月的半马', day(TODAY, -6), null, { dropped: day(TODAY, -5), note: '膝盖还没完全好，明年春天再说' });
  addTodo('每天学半小时日语', day(TODAY, -18), null, { dropped: day(TODAY, -17), note: '同时开的事太多了，先把读书会做好' });
  addIdea('周会改成三十分钟站会', 5);
  addIdea('和小林一起做读书会播客', 9);
  addIdea('每个月约一位老朋友吃饭', 14);
  addIdea('把读过的书做成一张年度书单海报', 3);
  addIdea('周末骑车去江边看银杏', 6);
  addIdea('读书会办一次线下活动', 31);
  addIdea('给妈妈买一个护膝', 1, { status: 'dropped' });

  const letters = [];
  let ci = 0;
  for (let n = SPAN; n >= 1; n--) {
    if (GAPS[n]) continue;
    const key = fixed[n] || cycle[ci++ % cycle.length];
    const x = L[key];
    const d = day(TODAY, -n);
    const a = attach[n] || { todos: [], ideas: [] };
    const replied = new Date(d + 'T22:' + pad(10 + (n % 40)) + ':' + pad(n % 60) + '+08:00').toISOString();
    letters.push({
      date: d,
      text: x.text,
      energy: x.energy,
      mood: x.mood,
      sent_at: replied,
      replied_at: replied,
      opened: n !== 1,
      updated_at: stamp,
      reply: {
        summary: hi + x.reply,
        energy: x.energy,
        mood: x.mood,
        highlight: x.highlight,
        lenses: x.lenses,
        todos: a.todos,
        ideas: a.ideas,
        engine: '',
      },
    });
  }

  const todoDocs = todos.map(t => {
    const src = t.src == null ? '' : day(TODAY, -t.src);
    let created = src;
    if (!created) {
      created = t.due < TODAY ? day(TODAY, Math.round((new Date(t.due + 'T00:00:00Z') - new Date(TODAY + 'T00:00:00Z')) / 864e5) - 2) : day(TODAY, -5);
    }
    return {
      id: t.id,
      text: t.text,
      due: t.due || '',
      done: !!t.done,
      done_at: t.done || '',
      dropped_at: t.dropped || '',
      archived: false,
      note: t.note || '',
      source_date: src,
      created: created,
      updated_at: stamp,
    };
  });
  const ideaDocs = ideas.map(i => ({
    id: i.id,
    text: i.text,
    status: i.status || 'open',
    source_date: day(TODAY, -i.src),
    created: day(TODAY, -i.src),
    dropped_at: i.status === 'dropped' ? day(TODAY, -i.src) : '',
    updated_at: stamp,
  }));

  const habits = [['早睡', 3], ['跑步', 2], ['读书', 4]].map((row, k) => ({
    id: uid('h'),
    name: row[0],
    every: row[1],
    sort: k,
    archived: false,
    created: day(TODAY, -60),
  }));
  const logs = [];
  habits.forEach(h => {
    for (let n = 40; n >= 1; n--) {
      if (n !== 1 && (n % h.every === 0 || GAPS[n])) continue;
      logs.push({ habit_id: h.id, date: day(TODAY, -n), done: true });
    }
  });

  const wk = weekKey(TODAY);
  const w1 = day(wk, -7);
  const w2 = day(w1, -7);
  const qn = Math.floor((Number(TODAY.slice(5, 7)) - 1) / 3) + 1;
  const qk = qn === 1 ? (Number(TODAY.slice(0, 4)) - 1) + '-Q4' : TODAY.slice(0, 4) + '-Q' + (qn - 1);
  const digests = [
    {
      kind: 'week', key: w1, created_at: stamp,
      content: {
        title: '这一周，会议吃掉了你最多的精力，跑步把它还了回来。',
        letter: hi + '这一周你写了 6 封信。三次提到会议拖长，两次写到跑完步之后变轻松；周三那封里，你把「算了」改成了「试试」，给小林发了那条消息。\n\n你放下了报名半马，备注里写着「膝盖还没完全好，明年春天再说」。会议纪要这次只用了十分钟，你说模板好用。\n\n精力在周中最低，周末回升。你在信里反复提到的，是想把时间从会议里拿回来。',
        stats: { letters: 6, days: 7, energyAvg: 3.2, todosDone: 4 },
        range: [w1, day(w1, 6)],
        energy_note: '加班和长会的那几天精力最低，运动后的晚上最好。',
        forgotten: ['预约牙医'],
        next: '找组长聊一次周会改成站会。',
        lenses: { health: '跑了两次步，有一天牙疼。', energy: '周中最低，周末回升。', career: '会议多，想到改站会。', relation: '和小林约好做播客。' },
      },
    },
    {
      kind: 'week', key: w2, created_at: stamp,
      content: {
        title: '你开始在早上给自己留出一小时。',
        letter: hi + '这一周有三天你六点就醒了，用早上的时间读书。周五方案被打回来，你说说不清哪里不对，但第二天还是去了图书馆。',
        stats: { letters: 5, days: 7, energyAvg: 3.4, todosDone: 3 },
        range: [w2, day(w2, 6)],
        energy_note: '清晨最专注。',
        forgotten: [],
        next: '',
        lenses: {},
      },
    },
    {
      kind: 'quarter', key: qk, created_at: stamp,
      content: {
        title: '这一季，你把运动从「想做」变成了「在做」。',
        letter: hi + '这一季你写下最多的词是「会议」和「跑步」。前一个总在消耗你，后一个总在把你拉回来。读书会从一个念头，变成了每个月的固定安排。',
        stats: { letters: 61, days: 92, energyAvg: 3.3, todosDone: 38 },
        energy_note: '运动后的晚上精力最好。',
        forgotten: [],
        next: '把读书会播客做出第一期。',
        lenses: { health: '跑步变成习惯。', energy: '会议是最大的消耗。', career: '想把时间从会议里拿回来。', relation: '读书会让你和小林走得更近。' },
        plans: { health: '每周跑三次。', energy: '一周至少两个没有会的下午。', career: '推动周会改站会。', relation: '每个月约一位老朋友。' },
      },
    },
  ];

  return {
    today: TODAY,
    letters: letters,
    todos: todoDocs,
    ideas: ideaDocs,
    habits: habits.map(h => ({ id: h.id, name: h.name, sort: h.sort, archived: false, created: h.created })),
    logs: logs,
    digests: digests,
  };
}

module.exports = { buildDemo, todayStr };

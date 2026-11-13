// 把网页版示例账号的内容写进调用者自己的云数据库，文档带 demo:true。
// 清除时只删 demo:true。需要在开发者工具里对 cloudfunctions/demoSeed 右键上传并部署一次。
const cloud = require('wx-server-sdk');
const { buildDemo } = require('./data');

cloud.init({ env: 'huixin-d1g2tdmkz68dc5a5d' });
const db = cloud.database();

const COLL = ['letters', 'todos', 'ideas', 'habits', 'habit_logs', 'digests'];

function fail(message) {
  return { ok: false, message: message };
}

async function listOwn(coll, openid) {
  const out = [];
  try {
    for (let skip = 0; skip < 1000; skip += 100) {
      const res = await db.collection(coll).where({ _openid: openid }).skip(skip).limit(100).get();
      const rows = res.data || [];
      rows.forEach(r => out.push(r));
      if (rows.length < 100) break;
    }
  } catch (e) {
    return [];
  }
  return out;
}

async function addAll(coll, docs) {
  for (let i = 0; i < docs.length; i += 8) {
    const slice = docs.slice(i, i + 8);
    await Promise.all(slice.map(doc => db.collection(coll).add({ data: doc })));
  }
}

async function removeDemo(openid) {
  const removed = {};
  for (let c = 0; c < COLL.length; c++) {
    const coll = COLL[c];
    const rows = (await listOwn(coll, openid)).filter(r => r.demo);
    removed[coll] = rows.length;
    for (let i = 0; i < rows.length; i += 8) {
      const slice = rows.slice(i, i + 8);
      await Promise.all(slice.map(r => db.collection(coll).doc(r._id).remove()));
    }
  }
  const settings = await listOwn('settings', openid);
  const s = settings[0];
  if (s && s.demoName && s.name === '非云') {
    await db.collection('settings').doc(s._id).update({ data: { name: '', demoName: false } });
  }
  return removed;
}

async function seed(openid) {
  await removeDemo(openid);
  const settings = await listOwn('settings', openid);
  const current = settings[0] || null;
  const name = (current && current.name && String(current.name).trim()) || '非云';
  const setName = !(current && current.name && String(current.name).trim());
  const pack = buildDemo(Date.now(), name);
  const taken = {};
  (await listOwn('letters', openid)).forEach(l => { if (l.date) taken[l.date] = true; });
  const letters = pack.letters.filter(l => !taken[l.date]).map(l => Object.assign({ demo: true, _openid: openid }, l));
  const mark = rows => rows.map(r => Object.assign({ demo: true, _openid: openid }, r));
  await addAll('letters', letters);
  await addAll('todos', mark(pack.todos));
  await addAll('ideas', mark(pack.ideas));
  await addAll('habits', mark(pack.habits));
  await addAll('habit_logs', mark(pack.logs));
  const haveDigest = {};
  (await listOwn('digests', openid)).forEach(d => { haveDigest[d.kind + '|' + d.key] = true; });
  await addAll('digests', mark(pack.digests.filter(d => !haveDigest[d.kind + '|' + d.key])));
  if (setName) {
    if (current) await db.collection('settings').doc(current._id).update({ data: { name: '非云', demoName: true } });
    else await db.collection('settings').add({ data: { _openid: openid, name: '非云', demoName: true, theme: 'auto', deliver: 'morning' } });
  }
  return {
    ok: true,
    letters: letters.length,
    todos: pack.todos.length,
    ideas: pack.ideas.length,
    habits: pack.habits.length,
    logs: pack.logs.length,
    digests: pack.digests.length,
    today: pack.today,
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return fail('没有微信身份');
  try {
    if (event && event.action === 'clear') {
      const removed = await removeDemo(OPENID);
      return { ok: true, removed: removed };
    }
    return await seed(OPENID);
  } catch (e) {
    console.error(e);
    return fail('示例数据没写完。请确认云数据库集合已建好，并已上传部署 demoSeed。');
  }
};

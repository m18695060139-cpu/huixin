// 云函数调用和离线队列。读数据走云数据库（仅创建者可读写），写数据走 save，先做内容安全检查。

const KEY = 'hx_mp_outbox';

let queue = null;
let flushing = false;
let hooks = {
  risky: function () {},
  online: function () {},
  saved: function () {},
};

function setHooks(h) {
  hooks = Object.assign(hooks, h || {});
}

function cloudOn() {
  try {
    const app = getApp();
    return !!(app && app.globalData && app.globalData.cloudReady && wx.cloud);
  } catch (e) {
    return false;
  }
}

function loadQueue() {
  if (queue) return queue;
  try { queue = wx.getStorageSync(KEY) || []; }
  catch (e) { queue = []; }
  if (!Array.isArray(queue)) queue = [];
  return queue;
}

function saveQueue() {
  try { wx.setStorageSync(KEY, queue || []); } catch (e) { /* 队列写失败就留在内存 */ }
}

function call(name, data) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: name,
      data: data || {},
      success: (res) => resolve(res.result || {}),
      fail: (err) => reject(err || new Error('云函数没有调用成功')),
    });
  });
}

function enqueue(item) {
  const q = loadQueue();
  const key = item.key;
  queue = q.filter(x => x.key !== key);
  queue.push({
    key: key,
    entity: item.entity,
    action: item.action,
    payload: item.payload,
    tries: item.tries || 0,
  });
  saveQueue();
  flush();
}

async function flush() {
  if (flushing || !cloudOn()) return;
  const q = loadQueue();
  if (!q.length) return;
  flushing = true;
  try {
    while (queue.length) {
      const item = queue[0];
      let result;
      try {
        result = await call('save', { entity: item.entity, action: item.action, payload: item.payload });
      } catch (e) {
        hooks.online(false);
        break;
      }
      if (result && result.ok === false && result.code === 'risky') {
        queue.shift();
        saveQueue();
        hooks.risky(item, result.message);
        continue;
      }
      if (result && result.ok === false) {
        item.tries = (item.tries || 0) + 1;
        if (item.tries >= 5) {
          queue.shift();
          saveQueue();
          continue;
        }
        saveQueue();
        break;
      }
      queue.shift();
      saveQueue();
      hooks.online(true);
      hooks.saved(item, result || {});
    }
  } finally {
    flushing = false;
  }
}

function pending() {
  return loadQueue().length;
}

function clearQueue() {
  queue = [];
  saveQueue();
}

function drop(pred) {
  const q = loadQueue();
  const next = q.filter(x => !pred(x));
  if (next.length !== q.length) {
    queue = next;
    saveQueue();
  }
}

module.exports = { setHooks, cloudOn, call, enqueue, flush, clearQueue, drop, pending };

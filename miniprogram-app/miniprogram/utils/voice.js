// 微信同声传译（WechatSI）语音识别。
// 仅在 VOICE_ENABLED 为 true 且 app.json 已声明插件时才 requirePlugin，否则不在加载时碰插件。
const { VOICE_ENABLED } = require('../config');

function createManager() {
  if (!VOICE_ENABLED) {
    return { ok: false, message: 'off' };
  }
  try {
    if (typeof requirePlugin !== 'function') {
      return { ok: false, message: '当前基础库还不支持语音插件' };
    }
    const plugin = requirePlugin('WechatSI');
    if (!plugin || typeof plugin.getRecordRecognitionManager !== 'function') {
      return { ok: false, message: '语音插件还没准备好' };
    }
    return { ok: true, manager: plugin.getRecordRecognitionManager() };
  } catch (e) {
    const msg = String(e && (e.message || e.errMsg) || e || '');
    if (/not found|未找到|没有|unauthorized|未授权|permission/i.test(msg)) {
      return { ok: false, message: '语音还没开通。请先在公众平台添加「微信同声传译」插件。' };
    }
    return { ok: false, message: '语音插件打不开，请稍后再试' };
  }
}

function errorMessage(res) {
  const code = res && (res.retcode != null ? res.retcode : res.errCode);
  const raw = String((res && (res.msg || res.errMsg || res.message)) || '');
  if (code === -30001 || /authorize|auth deny|permission|麦克风|录音/i.test(raw)) {
    return 'need-mic';
  }
  if (code === -30004 || code === -30008 || code === -30010 || /network|网络/i.test(raw)) {
    return '网络不好，没听清。请再试一次。';
  }
  if (code === -40001) return '语音识别正忙，请稍后再试。';
  if (code === -30012) return ''; // 没有进行中的任务，忽略
  if (code === -30011) return ''; // 已经在录，忽略重复 start
  if (/short|太短|too short/i.test(raw)) return '说的时间有点短，再试一次。';
  return raw || '没听清，请再试一次。';
}

module.exports = { createManager, errorMessage, VOICE_ENABLED };

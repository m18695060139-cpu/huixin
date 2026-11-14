// 智能回信开关。AI_ENABLED 是这一版是否带这个功能；ai_reply 是用户自己在设置里打开的（默认关闭）。
const { AI_ENABLED } = require('../config');
const state = require('./state');

const AI_LABEL = '内容由 AI 生成，仅供参考';
const AI_CONSENT = '打开后，你寄出的信会经微信云开发交给腾讯混元大模型，由 AI 写一封回信，并整理出待办和点子；每周一还会写一封周信。\n\n回信由 AI 生成，可能不准确，仅供参考，不构成医疗、心理或其他专业建议。生成前后都会做内容安全检查。\n\n随时可以在这里关掉。';
const REPORT_REASONS = ['内容不实或有误导', '内容不当或令人不适', '涉及违法违规', '其他问题'];

function on() {
  if (!AI_ENABLED) return false;
  const s = (state.get() && state.get().settings) || {};
  return s.ai_reply === true;
}

module.exports = { AI_ENABLED, AI_LABEL, AI_CONSENT, REPORT_REASONS, on };

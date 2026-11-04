const { POEMS, SEASON_POEMS } = require('../data/poems');
const { hash } = require('./date');

const MOODS = ['平静', '专注', '振奋', '疲惫', '焦虑', '低落', '烦躁', '感激'];

function seasonOf(dateStr) {
  const m = Number(String(dateStr).slice(5, 7));
  if (m >= 3 && m <= 5) return '春';
  if (m >= 6 && m <= 8) return '夏';
  if (m >= 9 && m <= 11) return '秋';
  return '冬';
}

function dailyPoem(dateStr, mood, offset) {
  offset = offset || 0;
  let list;
  let label;
  if (mood && POEMS[mood] && POEMS[mood].list && POEMS[mood].list.length) {
    list = POEMS[mood].list;
    label = '顺着「' + mood + '」';
  } else {
    const season = seasonOf(dateStr);
    list = SEASON_POEMS[season] || SEASON_POEMS['春'];
    label = '今日一句 · ' + season;
  }
  const item = list[(hash(dateStr) + offset) % list.length];
  return { text: item.t, source: item.s, label: label };
}

module.exports = { MOODS, dailyPoem, seasonOf };

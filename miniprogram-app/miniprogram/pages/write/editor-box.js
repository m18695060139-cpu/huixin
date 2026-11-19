// 写信框的长度和高度。纯计算，不碰 wx，方便离线核对。
//
// 长度：云函数 save 把正文 clip 到 20000（cloudfunctions/save/index.js）。
// 微信 textarea 不写 maxlength 时默认 140；写 -1 才是不限制。
// 输入框若继续用 -1，多出来的字会在寄出时被云端悄悄裁掉。
//
// 高度：官方文档写明 auto-height 为 true 时 style.height 不生效，组件随内容增高、
// 自己不再内部滚动。本页信纸是 flex 列，全局 .card 又 overflow:hidden，
// 底下还有 position:fixed 的寄出栏。基础库 3.6.5 上，文字一多 auto-height
// 算出的高度会偏小（3.15.1 才修好）。框一旦高过键盘上方那一屏（这套字号大约
// 两百个汉字），手指按在原生 textarea 上滑不动页面，光标又落到键盘和寄出栏后面，
// 看起来像不能再写。这里把高度钉在 40vh，键盘弹起时只缩小到光标留得出距离的位置，
// 多出来的字在框内滚动。不用 scroll-view：官方要求它有固定高度，再套 textarea
// 会在 iOS 上把键盘收掉；以前多加一层包裹也把固定寄出栏弄坏过。

const LETTER_MAX_CHARS = 20000;
const EDITOR_FONT_RPX = 32.692;
const EDITOR_LINE_HEIGHT = 1.9;
const EDITOR_MIN_VH = 0.4;
const MIN_OPEN_PX = 120;
const CURSOR_SPACING_PX = 160;

// 与 app.wxss .send-bar / .send-row .btn / .send-inner / .send-note 同一组数。
const SEND_BAR = {
  padTop: 19.231,
  button: 100,
  gap: 15.385,
  noteFont: 23.077,
  noteLine: 1.45,
  padBottom: 26.923,
};

function rpxToPx(rpx, windowWidth) {
  return rpx * (Number(windowWidth) || 375) / 750;
}

function windowSize(win) {
  win = win || {};
  return {
    windowHeight: Number(win.windowHeight) || 667,
    windowWidth: Number(win.windowWidth) || 375,
  };
}

function clampLetter(text) {
  const s = String(text == null ? '' : text);
  if (s.length <= LETTER_MAX_CHARS) return s;
  return s.slice(0, LETTER_MAX_CHARS);
}

function closedEditorPx(windowHeight) {
  const h = Number(windowHeight) || 667;
  return Math.max(1, Math.round(h * EDITOR_MIN_VH));
}

function closedStyle(windowHeight) {
  return 'height:' + closedEditorPx(windowHeight) + 'px';
}

function charsPerLine(windowWidth) {
  const inner = (Number(windowWidth) || 375) - rpxToPx((30.769 + 38.462) * 2, windowWidth);
  const charPx = rpxToPx(EDITOR_FONT_RPX, windowWidth);
  if (!(charPx > 0)) return 1;
  return Math.max(1, Math.floor(inner / charPx));
}

function wrappedLineCount(text, perLine) {
  const width = Math.max(1, Number(perLine) || 1);
  const parts = String(text == null ? '' : text).split('\n');
  let n = 0;
  for (let i = 0; i < parts.length; i++) {
    const len = parts[i].length;
    n += Math.max(1, Math.ceil(len / width) || 1);
  }
  return Math.max(1, n);
}

function contentHeightPx(lineCount, windowWidth) {
  const lines = Math.max(1, Number(lineCount) || 1);
  return lines * rpxToPx(EDITOR_FONT_RPX * EDITOR_LINE_HEIGHT, windowWidth);
}

function sendBarPx(windowWidth, safeBottom) {
  const note = SEND_BAR.noteFont * SEND_BAR.noteLine;
  const rpx = SEND_BAR.padTop + SEND_BAR.button + SEND_BAR.gap + note + SEND_BAR.padBottom;
  return Math.ceil(rpxToPx(rpx, windowWidth) + (Number(safeBottom) || 0));
}

// 键盘弹起时输入框底部停在「键盘顶 + cursor-spacing」之上，并且不超过原来的 40vh。
// 返回的高度放进 style，auto-height 必须关掉，否则官方文档说 style.height 无效。
function openEditorPx(opts) {
  opts = opts || {};
  const closed = closedEditorPx(opts.windowHeight);
  const top = opts.editorTop > 0 ? opts.editorTop : 0;
  const room = Math.floor((Number(opts.windowHeight) || 0) - (Number(opts.keyboardHeight) || 0) - (Number(opts.gapPx) || 0) - top);
  return Math.min(closed, Math.max(MIN_OPEN_PX, room));
}

module.exports = {
  LETTER_MAX_CHARS,
  EDITOR_FONT_RPX,
  EDITOR_LINE_HEIGHT,
  EDITOR_MIN_VH,
  MIN_OPEN_PX,
  CURSOR_SPACING_PX,
  SEND_BAR,
  rpxToPx,
  windowSize,
  clampLetter,
  closedEditorPx,
  closedStyle,
  charsPerLine,
  wrappedLineCount,
  contentHeightPx,
  sendBarPx,
  openEditorPx,
};

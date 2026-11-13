const THEMES = [
  { id: 'auto', name: '跟随系统', sw: ['#F2F2F7', '#000000', '#D0402B'], auto: true },
  { id: 'ink', name: '回信红', sw: ['#F2F2F7', '#FFFFFF', '#D0402B'] },
  { id: 'night', name: '夜信', sw: ['#000000', '#1C1C1E', '#FF6B5E'] },
  { id: 'paper', name: '信笺', sw: ['#F4EEE4', '#FFFDF8', '#B4432F'] },
  { id: 'mono', name: '素笺', sw: ['#F2F2F2', '#FFFFFF', '#000000'] },
];

const BG = { ink: '#F2F2F7', night: '#000000', paper: '#F4EEE4', mono: '#F2F2F2' };
const INK = { ink: '#D0402B', night: '#FF6B5E', paper: '#B4432F', mono: '#000000' };
const SEP = { ink: '#E5E5EA', night: '#38383A', paper: '#EDE4D6', mono: '#E3E3E3' };
const CARD = { ink: '#FFFFFF', night: '#1C1C1E', paper: '#FFFDF8', mono: '#FFFFFF' };

function front(theme) {
  return theme === 'night' ? '#ffffff' : '#000000';
}

module.exports = { THEMES, BG, INK, SEP, CARD, front };

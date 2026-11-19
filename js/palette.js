/* 2DRougeNew · 锁定调色板 v1.0
 * 22 色，7 个色族。游戏与美术圣经共用此文件，任何新色都必须先进入这里。
 */
window.PAL = {
  // 0 · 墨与影（轮廓、最深色）
  ink: '#0d0b14',
  shadow: '#1b1726',

  // 1 · 石板（地面 / 墙体，占画面约 60%）
  slate0: '#2a2438',
  slate1: '#3d3550',
  slate2: '#564c6b',
  slate3: '#776c8d',
  slate4: '#9d95b0',

  // 2 · 骨白（高光、文字底色、布料）
  bone0: '#d8d2c0',
  bone1: '#f2eee0',

  // 3 · 苔痕（地面植被、近战怪）
  moss0: '#2f4636',
  moss1: '#47614a',
  moss2: '#6d8560',

  // 4 · 黄铜（玩家装备、宝箱）
  brass0: '#6b4a24',
  brass1: '#a3722f',
  brass2: '#d9a54b',

  // 5 · 余烬（伤害、火焰、远程弹）
  ember0: '#7a2f33',
  ember1: '#c4513f',
  ember2: '#f08a4b',

  // 6 · 灯芯青（玩家光源、经验、UI 强调）
  cyan0: '#23454f',
  cyan1: '#3f7d8a',
  cyan2: '#79c0c6'
};

/* 色族定义：用于美术圣经的分组展示与使用配额说明 */
window.PAL_GROUPS = [
  {
    key: 'ink',
    name: '墨与影',
    role: '轮廓 / 最深阴影',
    quota: '描边专用，不用于大面积填充',
    colors: ['ink', 'shadow']
  },
  {
    key: 'slate',
    name: '石板',
    role: '地面、墙体、UI 底',
    quota: '约 60% 画面面积',
    colors: ['slate0', 'slate1', 'slate2', 'slate3', 'slate4']
  },
  {
    key: 'bone',
    name: '骨白',
    role: '高光、玩家布料、正文',
    quota: '约 8%',
    colors: ['bone0', 'bone1']
  },
  {
    key: 'moss',
    name: '苔痕',
    role: '植被、近战杂兵',
    quota: '约 10%',
    colors: ['moss0', 'moss1', 'moss2']
  },
  {
    key: 'brass',
    name: '黄铜',
    role: '装备、宝箱、稀有提示',
    quota: '约 8%',
    colors: ['brass0', 'brass1', 'brass2']
  },
  {
    key: 'ember',
    name: '余烬',
    role: '伤害、敌方弹道、危险预警',
    quota: '约 8%',
    colors: ['ember0', 'ember1', 'ember2']
  },
  {
    key: 'cyan',
    name: '灯芯青',
    role: '玩家光源、经验、可交互提示',
    quota: '约 6%，只出现在"与玩家有关"的信息上',
    colors: ['cyan0', 'cyan1', 'cyan2']
  }
];

/* 字母映射：像素图字符串用单字符索引到调色板 */
window.PAL_KEYS = {
  k: 'ink', d: 'shadow',
  s: 'slate0', S: 'slate1', m: 'slate2', M: 'slate3', n: 'slate4',
  b: 'bone0', B: 'bone1',
  g: 'moss0', G: 'moss1', h: 'moss2',
  r: 'brass0', R: 'brass1', y: 'brass2',
  e: 'ember0', E: 'ember1', f: 'ember2',
  c: 'cyan0', C: 'cyan1', q: 'cyan2'
};

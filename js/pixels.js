/* 2DRougeNew · 像素素材库
 * 所有角色与道具均为 1px 手工矩阵，锚点统一为「脚底中心」。
 * 尺寸规范：玩家 12×16，杂兵 12×12，重甲 14×14，宝箱 14×12。
 */
(function () {
  var P = window.PAL;
  var KEYS = window.PAL_KEYS;
  var cache = {};

  // 统一补/裁到精确宽高，防止手写矩阵错位
  function norm(rows, w, h) {
    var out = [];
    var pad = new Array(w + 24).join('.');
    for (var i = 0; i < h; i++) {
      out.push(((rows[i] || '') + pad).slice(0, w));
    }
    return out;
  }

  function make(w, h, body, legs) {
    var base = norm(body, w, h);
    var frames = [base];
    if (legs && legs.length) {
      var bodyRows = body;
      var frameCount = legs.length;
      frames = [];
      for (var i = 0; i < frameCount; i++) {
        frames.push(norm(bodyRows, w, h).slice(0, h - legs[i].length).concat(norm(legs[i], w, legs[i].length)));
      }
    }
    return { w: w, h: h, frames: frames };
  }

  var SPR = {};

  /* ---------- 玩家：巡礼守灯人（12×16，= 1 瓦片高） ---------- */
  SPR.player = make(12, 16, [
    '....kkkk....',
    '...kbbbbk...',
    '..kbbbbbbk..',
    '..kbkbbkbk..',
    '..kbbbbbbk..',
    '..kbBbbBbk..',
    '.kbbbbbbbbk.',
    'kbbbbbbbbbbk',
    '.kbbbbbbbbk.',
    '..kbbbbbbk..',
    '..kbCCCCbk..',
    '..kbbbbbbk..',
    '...kkkkkk...'
  ], [
    ['..kddkkddk..', '..kdk..kdk..', '.kkdk..kdkk.'],
    ['..kddkkddk..', '...kdk.kdk..', '..kkdk.kdkk.']
  ]);

  /* ---------- 蠕行者：近战（12×12） ---------- */
  SPR.crawler = make(12, 12, [
    '............',
    '...kkkkkk...',
    '..kggggggk..',
    '.kggggggggk.',
    '.kgkfggkfgk.',
    '.kggggggggk.',
    '.kgGGGGGGgk.',
    '..kggggggk..',
    '.kgkggggkgk.',
    'kg.kggggk.gk',
    'k...k..k...k',
    '............'
  ], [
    ['kg.kggggk.gk', 'k...k..k...k'],
    ['.gk.kggk.kg.', '..k..k.k..k.']
  ]);

  /* ---------- 灯蛾：远程（12×12） ---------- */
  SPR.spitter = make(12, 12, [
    '....kkkk....',
    '...kqqqqk...',
    '..kqCqqCqk..',
    '..kqqqqqqk..',
    '...kqffqk...',
    '..kqqqqqqk..',
    '.kqqqqqqqqk.',
    '.kqCCCCCCqk.',
    '..kqqqqqqk..',
    '...kk..kk...',
    '....kkkk....',
    '............'
  ], [
    ['...kk..kk...', '....kkkk....'],
    ['...kk..kk...', '....kkkk....']
  ]);

  /* ---------- 铜角冲锋者：重甲冲刺（14×14） ---------- */
  SPR.charger = make(14, 14, [
    '..............',
    '..kk......kk..',
    '.kRRk....kRRk.',
    '.kRRykkkkyRRk.',
    '..kRrrrrrrRk..',
    '..krrrrrrrrk..',
    '.krkfkkkkfkrk.',
    '.krrrrrrrrrrk.',
    '.krrrrrrrrrrk.',
    '..krrrrrrrrk..',
    '..kekrrrrkek..',
    '..kkk....kkk..',
    '..kdk....kdk..',
    '..kkk....kkk..'
  ]);

  /* ---------- 宝箱（14×12） ---------- */
  SPR.chest = {
    w: 14, h: 12,
    frames: [
      norm([
        '..............',
        '..kkkkkkkkkk..',
        '.kryyyyyyyyrk.',
        '.kyRRRRRRRRyk.',
        '.kRyyyyyyyyRk.',
        '.kRrRRRRRRrRk.',
        '.krrrrrrrrrrk.',
        '.krryyyyyyrrk.',
        '.krrrrrrrrrrk.',
        '..kkkkkkkkkk..',
        '..............',
        '..............'
      ], 14, 12),
      norm([
        '..............',
        '.kkkkkkkkkkkk.',
        '.kffffffffffk.',
        '.kFFffffffFFk.',
        '.kRyyyyyyyyRk.',
        '.kRrRRRRRRrRk.',
        '.krrrrrrrrrrk.',
        '.krryyyyyyrrk.',
        '.krrrrrrrrrrk.',
        '..kkkkkkkkkk..',
        '..............',
        '..............'
      ], 14, 12)
    ]
  };

  /* 把一帧烘焙到离屏 canvas：避免逐像素 fillRect 的开销 */
  function bake(spr, frame, tint) {
    var key = spr.w + 'x' + spr.h + '_' + frame + '_' + (tint || '');
    if (cache[key]) return cache[key];
    var rows = spr.frames[frame] || spr.frames[0];
    var cv = document.createElement('canvas');
    cv.width = spr.w;
    cv.height = spr.h;
    var c = cv.getContext('2d');
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      for (var i = 0; i < row.length; i++) {
        var ch = row.charAt(i);
        if (ch === '.') continue;
        var col = tint || P[KEYS[ch]];
        if (!col) continue;
        c.fillStyle = col;
        c.fillRect(i, r, 1, 1);
      }
    }
    cache[key] = cv;
    return cv;
  }

  /* 以「底部中心」为锚点绘制：(x, feetY) */
  function drawFeet(ctx, spr, x, y, opt) {
    opt = opt || {};
    var cv = bake(spr, opt.frame || 0, opt.tint);
    var dx = Math.round(x - spr.w / 2);
    var dy = Math.round(y - spr.h);
    if (opt.flip) {
      ctx.save();
      ctx.translate(dx + spr.w, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(cv, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(cv, dx, dy);
    }
  }

  /* 左上角锚点绘制（UI 图标用） */
  function drawAt(ctx, spr, x, y, opt) {
    opt = opt || {};
    ctx.drawImage(bake(spr, opt.frame || 0, opt.tint), Math.round(x), Math.round(y));
  }

  window.PX = { SPR: SPR, drawFeet: drawFeet, drawAt: drawAt, bake: bake };
})();

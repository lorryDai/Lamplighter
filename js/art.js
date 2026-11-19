/* 2DRougeNew · 美术绘制层
 * 斜俯视空间语法：地面完整可见、墙体正立面朝下、光源固定左上（NW）。
 * 高度阶梯：地面 0 / 台阶 4 / 矮墙 10 / 立柱 16。
 */
(function () {
  var P = window.PAL;
  var T = 16;
  var WALL_H = 10;
  var PILLAR_H = 16;

  function rnd(c, r, s) {
    var n = (c * 73856093) ^ (r * 19349663) ^ (s * 83492791);
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967296;
  }
  function rect(ctx, x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  /* ---------- 地面：石板 ---------- */
  function floor(ctx, c, r, ox, oy) {
    var x = ox + c * T, y = oy + r * T;
    rect(ctx, x, y, T, T, P.slate0);
    // 统一倒角：左上受光、右下入影，读作一块块石板
    if (rnd(c, r, 5) > 0.4) rect(ctx, x, y, T - 1, 1, P.slate1);
    if (rnd(c, r, 6) > 0.72) rect(ctx, x, y, 1, T - 1, P.slate1);
    rect(ctx, x, y + T - 1, T, 1, P.shadow);
    rect(ctx, x + T - 1, y, 1, T, P.shadow);

    var n1 = rnd(c, r, 2);
    if (n1 > 0.3) rect(ctx, x + 2 + ((n1 * 9) | 0), y + 3 + ((n1 * 13) % 9 | 0), 2, 1, P.slate1);
    if (n1 > 0.66) rect(ctx, x + 10, y + 10, 1, 2, P.shadow);

    if (rnd(c, r, 3) > 0.88) {
      rect(ctx, x + 3, y + 10, 4, 2, P.moss0);
      rect(ctx, x + 5, y + 8, 2, 2, P.moss0);
      rect(ctx, x + 4, y + 9, 2, 1, P.moss1);
    }
    if (rnd(c, r, 4) > 0.84) {
      rect(ctx, x + 6, y + 2, 1, 4, P.shadow);
      rect(ctx, x + 7, y + 6, 1, 3, P.shadow);
    }
  }

  /* ---------- 墙体：水平连续段 ---------- */
  function wall(ctx, x, y, w, hgt, outline) {
    // 顶面（抬高 hgt）
    rect(ctx, x, y - hgt, w, T, P.slate2);
    rect(ctx, x, y - hgt, w, 1, P.slate3);
    for (var i = 0; i < w; i += 5) {
      if (rnd(x + i, y, 7) > 0.55) rect(ctx, x + i, y - hgt + 3 + ((i % 3) * 2), 2, 1, P.slate3);
    }
    rect(ctx, x, y - hgt + T - 2, w, 1, P.slate1);
    rect(ctx, x, y - hgt + T - 1, w, 1, P.ink);

    // 正立面（朝向屏幕下方，可读的"墙脸"）
    var fy = y + T - hgt;
    rect(ctx, x, fy, w, hgt, P.slate1);
    rect(ctx, x, fy, w, 2, P.slate2);
    rect(ctx, x, fy + hgt - 2, w, 1, P.slate0);
    rect(ctx, x, y + T - 1, w, 1, P.ink);
    for (var sx = x + 16; sx < x + w; sx += 16) rect(ctx, sx, fy + 1, 1, hgt - 3, P.slate0);

    if (outline) {
      rect(ctx, x, y - hgt, 1, hgt + T, P.ink);
      rect(ctx, x + w - 1, y - hgt, 1, hgt + T, P.ink);
    }
  }

  function wallShadow(ctx, x, y, w) {
    ctx.fillStyle = 'rgba(13,11,20,0.45)';
    ctx.fillRect(x + 1, y + T, w - 2, 5);
  }

  /* 南北向长墙：俯视下只看到顶面，靠东侧投影表现抬高 */
  function wallV(ctx, x, y, hPx, hgt) {
    rect(ctx, x, y, T, hPx, P.slate2);
    rect(ctx, x, y, 1, hPx, P.slate3);
    rect(ctx, x + 1, y, T - 2, 1, P.slate3);
    rect(ctx, x + T - 1, y, 1, hPx, P.shadow);
    rect(ctx, x + 1, y + 1, T - 2, hPx - 2, P.slate1);
    rect(ctx, x + 2, y + 1, T - 4, hPx - 2, P.slate2);
    for (var sy = y + T; sy < y + hPx; sy += T) {
      rect(ctx, x + 1, sy, T - 2, 1, P.slate1);
    }
  }

  /* ---------- 弹道 ---------- */
  function bolt(ctx, x, y) {
    x = Math.round(x); y = Math.round(y);
    rect(ctx, x - 3, y - 1, 2, 2, P.cyan1);
    rect(ctx, x - 1, y - 2, 3, 4, P.cyan2);
    rect(ctx, x, y - 1, 2, 2, P.bone1);
    rect(ctx, x - 2, y - 3, 1, 1, P.cyan0);
  }

  function emberShot(ctx, x, y, t) {
    x = Math.round(x); y = Math.round(y);
    var flick = (Math.sin(t * 22) > 0) ? 1 : 0;
    rect(ctx, x - 2, y - 2, 4, 4, P.ember0);
    rect(ctx, x - 1, y - 2, 2, 4 + flick, P.ember1);
    rect(ctx, x - 1, y - 1, 2, 2, P.ember2);
  }

  /* ---------- 近战弧斩 ---------- */
  function slash(ctx, x, y, ang, k) {
    var a0 = ang - 0.62, a1 = ang + 0.62;
    var rad = 20 + k * 10;
    var steps = 12;
    ctx.globalAlpha = 1 - k;
    for (var i = 0; i <= steps; i++) {
      var a = a0 + (a1 - a0) * (i / steps);
      var px = x + Math.cos(a) * rad;
      var py = y + Math.sin(a) * rad * 0.72; // 俯视压缩
      rect(ctx, px, py, i % 3 === 0 ? 2 : 1, 2, i % 2 ? P.bone1 : P.brass2);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 冲刺预警环 ---------- */
  function ring(ctx, x, y, r, col, k) {
    var steps = 16;
    ctx.globalAlpha = 0.5 + 0.4 * Math.abs(Math.sin(k * 14));
    for (var i = 0; i < steps; i++) {
      var a = (i / steps) * Math.PI * 2;
      rect(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, 2, 2, col);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 钟锤冲击波 ---------- */
  function shock(ctx, x, y, r, k) {
    var steps = Math.max(12, Math.round(r * 0.9));
    ctx.globalAlpha = 1 - k * 0.9;
    for (var i = 0; i < steps; i++) {
      var a = (i / steps) * Math.PI * 2;
      rect(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.66, 2, 2, i % 5 === 0 ? P.bone1 : P.brass2);
    }
    // 内侧余烬尘
    ctx.globalAlpha = (1 - k) * 0.7;
    for (var j = 0; j < steps; j += 2) {
      var b = (j / steps) * Math.PI * 2;
      rect(ctx, x + Math.cos(b) * r * 0.62, y + Math.sin(b) * r * 0.42, 1, 1, P.ember2);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 贯穿光束 ---------- */
  function beam(ctx, x1, y1, x2, y2, k) {
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    var steps = Math.ceil(len / 3);
    // 外层低亮包边
    ctx.globalAlpha = (1 - k) * 0.42;
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      rect(ctx, x1 + dx * t, y1 + dy * t - 1, 3, 3, P.cyan1);
    }
    // 芯线：骨白与灯芯青交替，读作能量而非实心光柱
    ctx.globalAlpha = 1 - k * 0.6;
    for (var j = 0; j <= steps; j++) {
      var s = j / steps;
      rect(ctx, x1 + dx * s, y1 + dy * s, 3, 1, j % 2 === 0 ? P.bone1 : P.cyan2);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 环绕锯片 ---------- */
  function sawBlade(ctx, x, y, ang) {
    x = Math.round(x); y = Math.round(y);
    var q = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
    var dirs = [[0, -3], [3, 0], [0, 3], [-3, 0]];
    for (var i = 0; i < 4; i++) {
      var d = dirs[((i + q) % 4 + 4) % 4];
      rect(ctx, x + d[0] - 1, y + d[1] - 1, 2, 2, P.brass2);
    }
    rect(ctx, x - 2, y - 2, 4, 4, P.brass1);
    rect(ctx, x - 1, y - 1, 2, 2, P.brass0);
    rect(ctx, x, y, 1, 1, P.bone1);
  }

  /* ---------- 灯笼局部光 ---------- */
  function lanternGlow(ctx, x, y) {
    var g = ctx.createRadialGradient(x, y, 2, x, y, 58);
    g.addColorStop(0, 'rgba(121,192,198,0.16)');
    g.addColorStop(0.45, 'rgba(63,125,138,0.08)');
    g.addColorStop(1, 'rgba(35,69,79,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(x - 60, y - 60, 120, 120);
    ctx.restore();
  }

  function vignette(ctx, w, h) {
    var g = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.35, w / 2, h * 0.55, w * 0.72);
    g.addColorStop(0, 'rgba(13,11,20,0)');
    g.addColorStop(1, 'rgba(13,11,20,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  /* ---------- 图标：16×16 网格，1px 描边，最多 4 色 ---------- */
  var ICONS = {
    reaper: function (ctx) {
      var cx = 8, cy = 9;
      for (var i = 0; i <= 14; i++) {
        var a = -2.2 + i * 0.12;
        rect(ctx, cx + Math.cos(a) * 5, cy + Math.sin(a) * 5, 1, 2, P.brass2);
      }
      rect(ctx, 3, 10, 1, 5, P.brass1);
      rect(ctx, 2, 14, 5, 1, P.brass0);
    },
    bolt: function (ctx) {
      rect(ctx, 7, 2, 3, 12, P.cyan2);
      rect(ctx, 6, 5, 5, 6, P.cyan1);
      rect(ctx, 7, 6, 3, 3, P.bone1);
      rect(ctx, 4, 12, 3, 2, P.cyan0);
    },
    fan: function (ctx) {
      rect(ctx, 7, 8, 2, 6, P.ember0);
      rect(ctx, 3, 3, 3, 3, P.ember2);
      rect(ctx, 6, 1, 3, 3, P.ember2);
      rect(ctx, 11, 3, 3, 3, P.ember2);
      rect(ctx, 4, 4, 1, 1, P.bone1);
    },
    dmg: function (ctx) {
      rect(ctx, 7, 1, 2, 9, P.bone0);
      rect(ctx, 7, 1, 1, 8, P.bone1);
      rect(ctx, 4, 9, 8, 2, P.brass1);
      rect(ctx, 7, 11, 2, 4, P.brass0);
    },
    hp: function (ctx) {
      rect(ctx, 3, 4, 4, 4, P.ember1);
      rect(ctx, 9, 4, 4, 4, P.ember1);
      rect(ctx, 4, 7, 8, 3, P.ember1);
      rect(ctx, 5, 9, 6, 2, P.ember0);
      rect(ctx, 7, 11, 2, 2, P.ember0);
      rect(ctx, 4, 4, 2, 1, P.ember2);
    },
    spd: function (ctx) {
      for (var i = 0; i < 3; i++) {
        rect(ctx, 4 + i * 3, 4, 2, 8, P.cyan1);
        rect(ctx, 4 + i * 3, 4, 1, 6, P.cyan2);
        rect(ctx, 4 + i * 3, 11, 3, 1, P.cyan0);
      }
      rect(ctx, 2, 7, 11, 1, P.bone0);
    },
    armor: function (ctx) {
      rect(ctx, 3, 3, 10, 2, P.slate3);
      rect(ctx, 2, 5, 12, 4, P.slate2);
      rect(ctx, 4, 9, 8, 2, P.slate2);
      rect(ctx, 6, 11, 4, 2, P.slate1);
      rect(ctx, 7, 13, 2, 1, P.slate1);
      rect(ctx, 7, 6, 2, 3, P.cyan2);
    },
    xp: function (ctx) {
      rect(ctx, 7, 1, 2, 14, P.cyan2);
      rect(ctx, 1, 7, 14, 2, P.cyan2);
      rect(ctx, 4, 4, 2, 2, P.cyan1);
      rect(ctx, 10, 4, 2, 2, P.cyan1);
      rect(ctx, 4, 10, 2, 2, P.cyan1);
      rect(ctx, 10, 10, 2, 2, P.cyan1);
      rect(ctx, 7, 7, 2, 2, P.bone1);
    },
    cd: function (ctx) {
      rect(ctx, 4, 2, 8, 2, P.brass2);
      rect(ctx, 4, 12, 8, 2, P.brass2);
      rect(ctx, 6, 4, 4, 3, P.brass1);
      rect(ctx, 7, 7, 2, 2, P.bone0);
      rect(ctx, 6, 9, 4, 3, P.brass1);
      rect(ctx, 7, 9, 2, 1, P.brass2);
    },
    hammer: function (ctx) {
      rect(ctx, 4, 2, 8, 4, P.brass2);
      rect(ctx, 5, 3, 6, 2, P.brass1);
      rect(ctx, 2, 3, 2, 2, P.brass0);
      rect(ctx, 12, 3, 2, 2, P.brass0);
      rect(ctx, 7, 6, 2, 8, P.brass0);
      rect(ctx, 6, 13, 4, 1, P.brass1);
    },
    saw: function (ctx) {
      var dirs = [[0, -5], [4, -3], [5, 0], [4, 3], [0, 5], [-3, 3], [-4, 0], [-3, -3]];
      for (var i = 0; i < dirs.length; i++) {
        rect(ctx, 8 + dirs[i][0] - 1, 8 + dirs[i][1] - 1, 2, 2, P.brass2);
      }
      rect(ctx, 4, 4, 8, 8, P.brass1);
      rect(ctx, 6, 6, 4, 4, P.brass0);
      rect(ctx, 7, 7, 2, 2, P.cyan2);
    },
    beam: function (ctx) {
      for (var i = 0; i < 9; i++) {
        rect(ctx, 3 + i, 12 - i, 2, 2, i % 3 === 0 ? P.bone1 : P.cyan2);
      }
      rect(ctx, 2, 12, 3, 3, P.cyan1);
      rect(ctx, 11, 3, 3, 3, P.cyan0);
      rect(ctx, 12, 2, 2, 2, P.bone0);
    }
  };

  function icon(ctx, kind, x, y) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    (ICONS[kind] || ICONS.dmg)(ctx);
    ctx.restore();
  }

  window.ART = {
    T: T, WALL_H: WALL_H, PILLAR_H: PILLAR_H,
    floor: floor, wall: wall, wallV: wallV, wallShadow: wallShadow,
    bolt: bolt, emberShot: emberShot, slash: slash, ring: ring,
    shock: shock, beam: beam, sawBlade: sawBlade,
    lanternGlow: lanternGlow, vignette: vignette, icon: icon, rect: rect
  };
})();

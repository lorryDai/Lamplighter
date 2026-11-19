/* 2DRougeNew · 美术圣经渲染
 * 文档里的色板、角色、素材、图标全部从同一套运行时资源生成，避免"文档一套、实机一套"。
 */
(function () {
  var P = window.PAL;
  var A = window.ART;
  var PX = window.PX;
  var T = 16;

  /* ---------------- 01 调色板 ---------------- */
  function renderPalette() {
    var wrap = document.getElementById('palette');
    window.PAL_GROUPS.forEach(function (g) {
      var sec = document.createElement('div');
      sec.className = 'pal-group';

      var head = document.createElement('div');
      head.className = 'pal-head';
      head.innerHTML = '<h3>' + g.name + '</h3><p>' + g.role + '</p><span>' + g.quota + '</span>';

      var row = document.createElement('div');
      row.className = 'pal-row';
      g.colors.forEach(function (k) {
        var sw = document.createElement('div');
        sw.className = 'swatch';
        sw.innerHTML =
          '<span class="chipc" style="background:' + P[k] + '"></span>' +
          '<code>' + P[k] + '</code>' +
          '<em>' + k + '</em>';
        row.appendChild(sw);
      });

      sec.appendChild(head);
      sec.appendChild(row);
      wrap.appendChild(sec);
    });
  }

  /* ---------------- 02 空间语法示意图 ---------------- */
  function renderScene() {
    var cv = document.getElementById('scene');
    var ctx = cv.getContext('2d');
    var oy = 16;
    var cols = 15, rows = 9;

    ctx.clearRect(0, 0, cv.width, cv.height);

    // 地面
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) A.floor(ctx, c, r, 0, oy);
    }

    // 墙投影
    A.wallShadow(ctx, 0, oy, cols * T);
    A.wallShadow(ctx, 64, oy + 48, 16);

    // L1 接触阴影
    [[80, 118, 10], [146, 140, 12], [196, 112, 12]].forEach(function (s) {
      ctx.fillStyle = 'rgba(13,11,20,0.5)';
      ctx.fillRect(s[0] - s[2] / 2, s[1] - 1, s[2], 2);
    });

    // 脚底 y 排序
    var list = [
      { y: 0 + T, f: function () { A.wall(ctx, 0, oy, cols * T, 10, false); } },
      { y: 48 + T, f: function () { A.wall(ctx, 64, oy + 48, 16, 16, true); } },
      { y: 112, f: function () { drawChest(ctx, 196, 112); } },
      { y: 118, f: function () { PX.drawFeet(ctx, PX.SPR.player, 80, 118, { frame: 0 }); } },
      { y: 140, f: function () { PX.drawFeet(ctx, PX.SPR.crawler, 146, 140, { frame: 1 }); } }
    ];
    list.sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (o) { o.f(); });

    // 高度标注引线：指向墙的正立面
    A.rect(ctx, 120, 33, 1, 10, P.brass2);

    // L1 接触阴影 + L3 局部光
    A.lanternGlow(ctx, 80, 110);
  }

  function drawChest(ctx, x, feetY) {
    PX.drawFeet(ctx, PX.SPR.chest, x, feetY, { frame: 0 });
  }

  /* ---------------- 03 剪影与比例 ---------------- */
  var SPRITE_SPECS = [
    { spr: 'player', name: '巡礼守灯人', meta: '玩家 · 2 帧', pix: '12 × 16', scale: 6 },
    { spr: 'crawler', name: '蠕行者', meta: '近战 · 贴脸', pix: '12 × 12', scale: 6 },
    { spr: 'spitter', name: '灯蛾', meta: '远程 · 保持距离', pix: '12 × 12', scale: 6 },
    { spr: 'charger', name: '铜角冲锋者', meta: '重甲 · 冲刺', pix: '14 × 14', scale: 6 },
    { spr: 'chest', name: '宝箱 · 关', meta: '可交互', pix: '14 × 12', scale: 6, frame: 0 },
    { spr: 'chest', name: '宝箱 · 开', meta: '已拾取', pix: '14 × 12', scale: 6, frame: 1 }
  ];

  function renderSprites() {
    var wrap = document.getElementById('sprites');
    SPRITE_SPECS.forEach(function (s) {
      var spr = PX.SPR[s.spr];
      var card = document.createElement('div');
      card.className = 'sprite-card';

      var cv = document.createElement('canvas');
      cv.width = spr.w;
      cv.height = spr.h;
      cv.style.width = spr.w * s.scale + 'px';
      cv.style.height = spr.h * s.scale + 'px';
      PX.drawAt(cv.getContext('2d'), spr, 0, 0, { frame: s.frame || 0 });

      card.innerHTML =
        '<span class="name">' + s.name + '</span>' +
        '<span class="meta">' + s.meta + '</span>' +
        '<span class="pix">' + s.pix + ' px</span>';
      card.insertBefore(cv, card.firstChild);
      wrap.appendChild(card);
    });
  }

  /* ---------------- 04 材质样本 ---------------- */
  function renderMaterials() {
    var wrap = document.getElementById('materials');
    var specs = [
      { name: '石板', draw: stone },
      { name: '苔痕', draw: moss },
      { name: '黄铜', draw: brass },
      { name: '余烬', draw: ember }
    ];
    specs.forEach(function (s) {
      var box = document.createElement('div');
      box.className = 'mat';
      var cv = document.createElement('canvas');
      cv.width = 32; cv.height = 32;
      var c = cv.getContext('2d');
      s.draw(c);
      box.appendChild(cv);
      var lb = document.createElement('span');
      lb.textContent = s.name;
      box.appendChild(lb);
      wrap.appendChild(box);
    });
  }

  function stone(c) {
    A.floor(c, 0, 0, 0, 0);
    A.floor(c, 1, 0, 0, 0);
    A.floor(c, 0, 1, 0, 0);
    A.floor(c, 1, 1, 0, 0);
  }
  function moss(c) {
    A.rect(c, 0, 0, 32, 32, P.moss0);
    A.rect(c, 0, 0, 32, 2, P.moss1);
    A.rect(c, 4, 8, 7, 5, P.moss1);
    A.rect(c, 14, 4, 5, 9, P.moss1);
    A.rect(c, 20, 18, 9, 6, P.moss1);
    A.rect(c, 6, 10, 3, 2, P.moss2);
    A.rect(c, 22, 20, 4, 2, P.moss2);
    A.rect(c, 11, 22, 6, 3, P.moss0);
    A.rect(c, 26, 6, 2, 2, P.slate0);
    A.rect(c, 2, 26, 3, 2, P.slate0);
  }
  function brass(c) {
    A.rect(c, 0, 0, 32, 32, P.brass0);
    A.rect(c, 0, 0, 32, 3, P.brass1);
    A.rect(c, 0, 3, 32, 1, P.brass2);
    A.rect(c, 0, 29, 32, 3, P.brass0);
    for (var i = 4; i < 32; i += 8) {
      A.rect(c, i, 12, 3, 3, P.brass2);
      A.rect(c, i, 13, 1, 1, P.bone0);
      A.rect(c, i, 20, 3, 1, P.brass1);
    }
    A.rect(c, 6, 6, 20, 1, P.brass1);
  }
  function ember(c) {
    A.rect(c, 0, 0, 32, 32, P.ember0);
    A.rect(c, 5, 6, 10, 8, P.ember1);
    A.rect(c, 17, 14, 11, 9, P.ember1);
    A.rect(c, 8, 9, 5, 4, P.ember2);
    A.rect(c, 20, 17, 4, 3, P.ember2);
    A.rect(c, 9, 10, 2, 2, P.bone1);
    A.rect(c, 21, 18, 1, 1, P.bone1);
    A.rect(c, 3, 24, 4, 2, P.ember2);
    A.rect(c, 26, 5, 3, 2, P.ember2);
  }

  /* ---------------- 05 图标 ---------------- */
  function renderIcons() {
    var wrap = document.getElementById('icons');
    [
      { kind: 'reaper', label: '钟摆刃' },
      { kind: 'bolt', label: '灯芯弹' },
      { kind: 'fan', label: '余烬扇' },
      { kind: 'hammer', label: '钟锤' },
      { kind: 'saw', label: '齿环锯' },
      { kind: 'beam', label: '灯塔棱光' },
      { kind: 'dmg', label: '锋锐' },
      { kind: 'hp', label: '体魄' },
      { kind: 'spd', label: '疾行' },
      { kind: 'armor', label: '守御' },
      { kind: 'xp', label: '悟性' },
      { kind: 'cd', label: '迅捷' }
    ].forEach(function (it) {
      var cell = document.createElement('div');
      cell.className = 'icon-cell';
      var cv = document.createElement('canvas');
      cv.width = 16; cv.height = 16;
      var c = cv.getContext('2d');
      c.clearRect(0, 0, 16, 16);
      A.icon(c, it.kind, 0, 0);
      cell.appendChild(cv);
      var sp = document.createElement('span');
      sp.textContent = it.label;
      cell.appendChild(sp);
      wrap.appendChild(cell);
    });
  }

  renderPalette();
  renderScene();
  renderSprites();
  renderMaterials();
  renderIcons();
})();

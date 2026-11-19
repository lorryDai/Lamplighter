/* 2DRougeNew · 游戏逻辑
 * 自动攻击 + 手动走位；近战/远程敌人各有攻击模式；
 * 击杀得经验 → 三选一成长；宝箱换武器 = 换攻击模式与特效；清场过关。
 */
(function () {
  'use strict';

  var T = 16, AY = 44, COLS = 30, ROWS = 15;
  var W = COLS * T, H = ROWS * T;
  var VIEW_W = W, VIEW_H = AY + H;

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;

  var stage = document.getElementById('stage');
  var overlay = document.getElementById('overlay');
  var toastEl = document.getElementById('toast');
  var flashEl = document.getElementById('flash');
  var hpFill = document.getElementById('hpFill');
  var hpText = document.getElementById('hpText');
  var hpBar = document.getElementById('hpBar');
  var xpFill = document.getElementById('xpFill');
  var lvlChip = document.getElementById('lvlChip');
  var wpnIcon = document.getElementById('wpnIcon');
  var wpnName = document.getElementById('wpnName');
  var foeChip = document.getElementById('foeChip');
  var floorChip = document.getElementById('floorChip');

  /* ---------------- 视图缩放：整数倍，保证像素不糊 ---------------- */
  function resize() {
    var s = Math.min(
      Math.floor(window.innerWidth / VIEW_W),
      Math.floor((window.innerHeight - 96) / VIEW_H)
    );
    s = Math.max(2, s);
    stage.style.width = VIEW_W * s + 'px';
    stage.style.height = VIEW_H * s + 'px';
    stage.style.setProperty('--s', s);
  }
  window.addEventListener('resize', resize);

  /* ---------------- 武器 ---------------- */
  // mod 表：每级 step 增加多少，到 max 封顶；name 用于熔炼词条文案
  var WEAPONS = {
    reaper: {
      name: '钟摆刃', icon: 'reaper', cd: 0.55, type: 'melee', dmg: 9, range: 34, fanAng: 0.85,
      desc: '近身弧斩，同时命中扇形内全部敌人',
      mods: [
        { key: 'fanAng', step: 0.15, max: 1.4, name: '刃弧扩' },
        { key: 'dmg', step: 1, max: 24, name: '刃锋锐' }
      ]
    },
    bolt: {
      name: '灯芯弹', icon: 'bolt', cd: 0.40, type: 'bolt', dmg: 8, speed: 230, pierce: 0,
      desc: '自动瞄准最近敌人，直线弹道',
      mods: [
        { key: 'pierce', step: 1, max: 4, name: '穿透+' },
        { key: 'dmg', step: 1, max: 22, name: '弹芯锐' }
      ]
    },
    fan: {
      name: '余烬扇', icon: 'fan', cd: 0.78, type: 'fan', dmg: 6, speed: 200, count: 3, spread: 0.36,
      desc: '三向扇形散射，单发伤害较低',
      mods: [
        { key: 'count', step: 1, max: 6, name: '散弹+' },
        { key: 'spread', step: 0.06, max: 0.72, name: '扇面宽' }
      ]
    },
    hammer: {
      name: '钟锤', icon: 'hammer', cd: 1.05, type: 'slam', dmg: 24, radius: 44,
      desc: '砸地冲击波，范围内敌人全部受创',
      mods: [
        { key: 'radius', step: 6, max: 68, name: '冲击波扩' },
        { key: 'dmg', step: 3, max: 60, name: '锤重沉' }
      ]
    },
    saw: {
      name: '齿环锯', icon: 'saw', type: 'orbit', dmg: 5, orbitR: 27, tick: 0.32,
      desc: '双锯环绕身旋转，持续切割贴近的敌人',
      mods: [
        { key: 'orbitR', step: 6, max: 45, name: '锯环扩' },
        { key: 'dmg', step: 1, max: 14, name: '齿锋锐' }
      ]
    },
    beam: {
      name: '灯塔棱光', icon: 'beam', cd: 1.0, type: 'beam', dmg: 15, range: 210, width: 8,
      desc: '贯穿直线光束，途中敌人全部命中',
      mods: [
        { key: 'width', step: 2, max: 16, name: '棱光加粗' },
        { key: 'dmg', step: 2, max: 38, name: '棱光锐' }
      ]
    }
  };
  var WEAPON_IDS = ['reaper', 'bolt', 'fan', 'hammer', 'saw', 'beam'];

  /* 取某武器在当前等级下生效参数：以 w 为基底，叠加 mod 表 */
  function eff(w, lvl) {
    var out = {}, k;
    for (k in w) out[k] = w[k];
    if (!w.mods || !lvl) return out;
    for (var i = 0; i < w.mods.length; i++) {
      var m = w.mods[i];
      out[m.key] = Math.min(out[m.key] + m.step * lvl, m.max);
    }
    return out;
  }

  /* 武器当前熔炼词条描述（仅显示超过 0 的） */
  function weaponUpgradeText(w, lvl) {
    if (!lvl) return '—';
    var lines = [];
    for (var i = 0; i < w.mods.length; i++) lines.push('+' + lvl + ' ' + w.mods[i].name);
    return lines.join(' · ');
  }

  /* ---------------- 敌人模板 ---------------- */
  var ENEMY = {
    crawler: { spr: 'crawler', box: 9, speed: 34, dmg: 8, hp: 12, xp: 2, frames: 2 },
    spitter: { spr: 'spitter', box: 9, speed: 26, dmg: 7, hp: 9, xp: 3, frames: 2 },
    charger: { spr: 'charger', box: 11, speed: 24, dmg: 15, hp: 18, xp: 5, frames: 1 }
  };

  /* ---------------- 升级池 ---------------- */
  var UPGRADES = [
    { id: 'dmg', name: '锋锐', desc: '伤害 +18%', icon: 'dmg', apply: function (p) { p.dmgMul *= 1.18; } },
    { id: 'hp', name: '体魄', desc: '生命上限 +20，立即回复 20', icon: 'hp', apply: function (p) { p.maxhp += 20; p.hp = Math.min(p.maxhp, p.hp + 20); } },
    { id: 'spd', name: '疾行', desc: '移动速度 +10%', icon: 'spd', apply: function (p) { p.spdMul *= 1.10; } },
    { id: 'armor', name: '守御', desc: '受到伤害 -12%', icon: 'armor', apply: function (p) { p.armor = Math.min(0.6, p.armor + 0.12); } },
    { id: 'xp', name: '悟性', desc: '经验获取 +25%', icon: 'xp', apply: function (p) { p.xpMul *= 1.25; } },
    { id: 'cd', name: '迅捷', desc: '攻击间隔 -10%', icon: 'cd', apply: function (p) { p.cdMul *= 0.90; } }
  ];

  /* ---------------- 状态 ---------------- */
  var G = {
    state: 'title', level: 1, t: 0, shake: 0,
    spawned: 0, total: 0, spawnTimer: 1, cap: 6, kills: 0,
    pickupDrop: null, pickupIdx: -1
  };
  var player, enemies = [], bullets = [], fx = [], texts = [], parts = [], chests = [], drops = [], walls = [], solid = [];
  var keys = {};
  var cardQueue = 0;
  var hudAcc = 0;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }

  function pointSegDist(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var len2 = dx * dx + dy * dy;
    var t = len2 === 0 ? 0 : clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1);
    return dist(px, py, x1 + dx * t, y1 + dy * t);
  }
  function rand(n) { return Math.random() * n; }
  function randInt(n) { return Math.floor(Math.random() * n); }

  /* ---------------- 关卡构建 ---------------- */
  function buildArena(level) {
    solid = [];
    for (var r = 0; r < ROWS; r++) {
      solid[r] = [];
      for (var c = 0; c < COLS; c++) solid[r][c] = false;
    }
    for (var c2 = 0; c2 < COLS; c2++) { solid[0][c2] = true; solid[ROWS - 1][c2] = true; }
    for (var r2 = 0; r2 < ROWS; r2++) { solid[r2][0] = true; solid[r2][COLS - 1] = true; }

    var pillars = [[7, 4], [22, 4], [7, 10], [22, 10]];
    if (level >= 3) pillars.push([14, 2], [15, 12]);
    if (level >= 5) pillars.push([4, 7], [25, 7]);
    pillars.forEach(function (p) {
      if (!solid[p[1]][p[0]]) solid[p[1]][p[0]] = true;
    });

    // 合并水平连续墙段，避免逐格接缝；左右边界另作南北向长墙
    walls = [];
    for (var r3 = 0; r3 < ROWS; r3++) {
      var c3 = 1;
      while (c3 < COLS - 1) {
        if (!solid[r3][c3]) { c3++; continue; }
        var hh = (r3 === 0 || r3 === ROWS - 1) ? 10 : 16;
        var start = c3;
        while (c3 < COLS - 1 && solid[r3][c3]) c3++;
        walls.push({ x: start * T, y: r3 * T, w: (c3 - start) * T, h: hh });
      }
    }
    walls.push({ vert: true, x: 0, y: 0, w: T, h: ROWS * T });
    walls.push({ vert: true, x: (COLS - 1) * T, y: 0, w: T, h: ROWS * T });
  }

  function isSolid(c, r) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
    return solid[r][c];
  }

  function freeSpot(minDistFromPlayer, minDistFromChest) {
    for (var i = 0; i < 80; i++) {
      var c = 1 + randInt(COLS - 2), r = 1 + randInt(ROWS - 2);
      if (isSolid(c, r)) continue;
      var x = c * T + T / 2, y = r * T + T / 2;
      if (player && dist(x, y, player.x, player.y) < minDistFromPlayer) continue;
      var ok = true;
      if (minDistFromChest) {
        for (var k = 0; k < chests.length; k++) {
          if (dist(x, y, chests[k].x, chests[k].y) < minDistFromChest) { ok = false; break; }
        }
      }
      if (ok) return { x: x, y: y };
    }
    return null;
  }

  /* ---------------- 实体 ---------------- */
  function makePlayer() {
    return {
      x: W / 2, y: H / 2 + 26, w: 9, h: 9,
      hp: 100, maxhp: 100, speed: 78, level: 1, xp: 0, xpNext: 8,
      dmgMul: 1, spdMul: 1, armor: 0, xpMul: 1, cdMul: 1,
      invuln: 0, atkTimer: 0, weapon: 'reaper', wpnLvl: 0, moving: false, face: 1, t: 0,
      orbitAng: 0, sawTick: 0
    };
  }

  function makeEnemy(type, x, y) {
    var b = ENEMY[type], lv = G.level;
    var hp = Math.round(b.hp * (1 + 0.32 * (lv - 1)));
    return {
      type: type, x: x, y: y, w: b.box, h: b.box,
      hp: hp, maxhp: hp,
      dmg: b.dmg * (1 + 0.14 * (lv - 1)),
      speed: b.speed * (1 + 0.03 * (lv - 1)),
      xp: b.xp, flash: 0, t: rand(10), cd: 0.6,
      state: 'walk', stateT: 0, dashX: 0, dashY: 0, moving: true
    };
  }

  /* ---------------- 移动与碰撞 ---------------- */
  function resolveAxis(e, axis, d) {
    var hw = e.w / 2, hh = e.h / 2;
    var c0 = Math.floor((e.x - hw) / T), c1 = Math.floor((e.x + hw - 0.01) / T);
    var r0 = Math.floor((e.y - hh) / T), r1 = Math.floor((e.y + hh - 0.01) / T);
    for (var r = r0; r <= r1; r++) {
      for (var c = c0; c <= c1; c++) {
        if (!isSolid(c, r)) continue;
        if (axis === 'x') e.x = d > 0 ? c * T - hw - 0.01 : (c + 1) * T + hw + 0.01;
        else e.y = d > 0 ? r * T - hh - 0.01 : (r + 1) * T + hh + 0.01;
      }
    }
  }

  function moveEntity(e, dx, dy) {
    if (dx) { e.x += dx; resolveAxis(e, 'x', dx); }
    if (dy) { e.y += dy; resolveAxis(e, 'y', dy); }
    e.x = clamp(e.x, e.w / 2 + 1, W - e.w / 2 - 1);
    e.y = clamp(e.y, e.h / 2 + 1, H - e.h / 2 - 1);
  }

  /* ---------------- 战斗 ---------------- */
  function nearestEnemy(x, y, maxR) {
    var best = null, bd = maxR || 9999;
    for (var i = 0; i < enemies.length; i++) {
      var d = dist(x, y, enemies[i].x, enemies[i].y);
      if (d < bd) { bd = d; best = enemies[i]; }
    }
    return best;
  }

  function addText(x, y, txt, col) {
    texts.push({ x: x, y: y, txt: txt, col: col || '#f2eee0', t: 0, dur: 0.7 });
  }

  function spark(x, y, col, n, sp) {
    for (var i = 0; i < n; i++) {
      var a = rand(Math.PI * 2), v = 20 + rand(sp || 50);
      parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - 12, t: 0, dur: 0.35 + rand(0.25), col: col, s: rand(1) > 0.5 ? 2 : 1 });
    }
  }

  function hitEnemy(e, dmg) {
    e.hp -= dmg;
    e.flash = 0.09;
    addText(e.x, e.y - e.h - 4, '-' + Math.round(dmg), '#f08a4b');
    spark(e.x, e.y - 5, '#f08a4b', 4, 40);
    if (e.hp <= 0) {
      var idx = enemies.indexOf(e);
      if (idx >= 0) enemies.splice(idx, 1);
      G.kills++;
      spark(e.x, e.y - 5, '#6d8560', 9, 80);
      spark(e.x, e.y - 5, '#7a2f33', 4, 60);
      gainXp(e.xp);
      G.shake = Math.max(G.shake, 1.6);
    }
  }

  function hurtPlayer(dmg) {
    if (player.invuln > 0 || G.state !== 'play') return;
    var real = Math.max(1, Math.round(dmg * (1 - player.armor)));
    player.hp -= real;
    player.invuln = 0.75;
    G.shake = 4;
    addText(player.x, player.y - 16, '-' + real, '#f08a4b');
    spark(player.x, player.y - 6, '#c4513f', 6, 60);
    flashEl.classList.remove('on');
    void flashEl.offsetWidth;
    flashEl.classList.add('on');
    if (player.hp <= 0) {
      player.hp = 0;
      gameOver();
    }
  }

  function gainXp(n) {
    player.xp += n * player.xpMul;
    while (player.xp >= player.xpNext) {
      player.xp -= player.xpNext;
      player.level++;
      player.xpNext = 6 + player.level * 4;
      cardQueue++;
    }
    if (cardQueue > 0 && G.state === 'play') offerCards();
  }

  function fireWeapon() {
    var base = WEAPONS[player.weapon];
    var w = eff(base, player.wpnLvl);
    if (w.type === 'orbit') return;
    var target = nearestEnemy(player.x, player.y, 240);
    if (!target) return;
    var ang = Math.atan2(target.y - player.y, target.x - player.x);
    var dmg = w.dmg * player.dmgMul;

    if (w.type === 'melee') {
      fx.push({ kind: 'slash', x: player.x, y: player.y - 5, ang: ang, t: 0, dur: 0.22 });
      for (var i = enemies.length - 1; i >= 0; i--) {
        var e = enemies[i];
        var d = dist(player.x, player.y, e.x, e.y);
        if (d > w.range + e.w / 2) continue;
        var da = Math.abs(Math.atan2(e.y - player.y, e.x - player.x) - ang);
        if (da > Math.PI) da = Math.PI * 2 - da;
        if (da <= w.fanAng) hitEnemy(e, dmg);
      }
      G.shake = Math.max(G.shake, 1.2);
    } else if (w.type === 'bolt') {
      bullets.push({
        team: 'p', x: player.x, y: player.y - 5,
        vx: Math.cos(ang) * w.speed, vy: Math.sin(ang) * w.speed,
        dmg: dmg, r: 5, life: 1.6, kind: 'bolt', pierce: w.pierce || 0
      });
      spark(player.x + Math.cos(ang) * 8, player.y - 5 + Math.sin(ang) * 8, '#79c0c6', 3, 30);
    } else if (w.type === 'fan') {
      for (var k = 0; k < w.count; k++) {
        var a = ang + (k - (w.count - 1) / 2) * w.spread;
        bullets.push({
          team: 'p', x: player.x, y: player.y - 5,
          vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
          dmg: dmg, r: 4, life: 1.5, kind: 'ember'
        });
      }
    } else if (w.type === 'slam') {
      fx.push({ kind: 'shock', x: player.x, y: player.y + 2, r0: 10, r1: w.radius, t: 0, dur: 0.34 });
      for (var si = enemies.length - 1; si >= 0; si--) {
        var se = enemies[si];
        if (dist(player.x, player.y, se.x, se.y) <= w.radius + se.w / 2) hitEnemy(se, dmg);
      }
      spark(player.x, player.y + 2, '#d9a54b', 8, 70);
      G.shake = Math.max(G.shake, 3.4);
    } else if (w.type === 'beam') {
      var ex = player.x + Math.cos(ang) * w.range;
      var ey = player.y + Math.sin(ang) * w.range;
      for (var t = 0; t < w.range; t += 4) {
        var px = player.x + Math.cos(ang) * t, py = player.y + Math.sin(ang) * t;
        if (isSolid(Math.floor(px / T), Math.floor(py / T))) { ex = px; ey = py; break; }
      }
      fx.push({ kind: 'beam', x1: player.x, y1: player.y - 5, x2: ex, y2: ey - 5, t: 0, dur: 0.26 });
      for (var bi = enemies.length - 1; bi >= 0; bi--) {
        var be = enemies[bi];
        if (pointSegDist(be.x, be.y - 4, player.x, player.y - 5, ex, ey - 5) < w.width + be.w / 2) {
          hitEnemy(be, dmg);
        }
      }
      spark(ex, ey - 5, '#79c0c6', 6, 50);
      G.shake = Math.max(G.shake, 2);
    }
    player.atkTimer = w.cd * player.cdMul;
  }

  /* 环绕锯：固定节奏，对两条锯片附近的敌人结算伤害 */
  function updateSaw(dt) {
    if (player.weapon !== 'saw') return;
    var w = eff(WEAPONS.saw, player.wpnLvl);
    player.orbitAng += dt * 4.0;
    player.sawTick -= dt;
    if (player.sawTick > 0) return;
    player.sawTick = w.tick;
    var dmg = w.dmg * player.dmgMul;
    for (var b = 0; b < 2; b++) {
      var a = player.orbitAng + b * Math.PI;
      var bx = player.x + Math.cos(a) * w.orbitR;
      var by = player.y + Math.sin(a) * w.orbitR * 0.8;
      for (var i = enemies.length - 1; i >= 0; i--) {
        var e = enemies[i];
        if (dist(bx, by, e.x, e.y) < 8 + e.w / 2) hitEnemy(e, dmg);
      }
    }
  }

  /* ---------------- 敌人 AI ---------------- */
  function updateEnemy(e, dt) {
    e.t += dt;
    e.flash = Math.max(0, e.flash - dt);
    e.cd -= dt;
    var d = dist(e.x, e.y, player.x, player.y);
    var dx = player.x - e.x, dy = player.y - e.y;
    var len = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
    var nx = dx / len, ny = dy / len;

    if (e.type === 'crawler') {
      moveEntity(e, nx * e.speed * dt, ny * e.speed * dt);
      e.moving = true;
      if (d < e.w / 2 + 6 && e.cd <= 0) { hurtPlayer(e.dmg); e.cd = 0.9; }
    } else if (e.type === 'spitter') {
      // 保持距离：太近后退，太远靠近
      var want = 92;
      var sp = d < want - 18 ? -1 : d > want + 18 ? 1 : 0;
      if (sp !== 0) moveEntity(e, nx * e.speed * sp * dt, ny * e.speed * sp * dt);
      e.moving = sp !== 0;
      if (e.cd <= 0 && d < 220) {
        bullets.push({
          team: 'e', x: e.x, y: e.y - 6,
          vx: nx * 78, vy: ny * 78, dmg: e.dmg, r: 4, life: 3.2, kind: 'ember'
        });
        spark(e.x, e.y - 6, '#f08a4b', 4, 30);
        e.cd = 1.9;
      }
    } else if (e.type === 'charger') {
      e.stateT += dt;
      if (e.state === 'walk') {
        if (d < 130) { e.state = 'tell'; e.stateT = 0; }
        else { moveEntity(e, nx * e.speed * dt, ny * e.speed * dt); }
        e.moving = e.state === 'walk';
      } else if (e.state === 'tell') {
        e.moving = false;
        if (e.stateT > 0.65) {
          e.state = 'dash'; e.stateT = 0;
          e.dashX = nx; e.dashY = ny;
        }
      } else if (e.state === 'dash') {
        moveEntity(e, e.dashX * 255 * dt, e.dashY * 255 * dt);
        e.moving = false;
        spark(e.x - e.dashX * 6, e.y - 4, '#a3722f', 1, 20);
        if (d < e.w / 2 + 8 && e.cd <= 0) { hurtPlayer(e.dmg); e.cd = 1.2; }
        if (e.stateT > 0.30) { e.state = 'rest'; e.stateT = 0; }
      } else {
        e.moving = false;
        if (e.stateT > 0.9) { e.state = 'walk'; e.stateT = 0; }
      }
    }
  }

  /* ---------------- 更新 ---------------- */
  function update(dt) {
    G.t += dt;
    G.shake = Math.max(0, G.shake - dt * 22);

    // 玩家移动
    var mx = 0, my = 0;
    if (keys['a'] || keys['arrowleft']) mx -= 1;
    if (keys['d'] || keys['arrowright']) mx += 1;
    if (keys['w'] || keys['arrowup']) my -= 1;
    if (keys['s'] || keys['arrowdown']) my += 1;
    var ml = Math.sqrt(mx * mx + my * my);
    player.moving = ml > 0;
    if (ml > 0) {
      mx /= ml; my /= ml;
      moveEntity(player, mx * player.speed * player.spdMul * dt, my * player.speed * player.spdMul * dt);
      if (mx !== 0) player.face = mx > 0 ? 1 : -1;
    }
    player.t += dt;
    player.invuln = Math.max(0, player.invuln - dt);
    updateSaw(dt);
    player.atkTimer -= dt;
    if (player.atkTimer <= 0) fireWeapon();

    // 敌人
    for (var i = enemies.length - 1; i >= 0; i--) updateEnemy(enemies[i], dt);

    // 轻度分离，避免完全重叠导致看不清
    for (var a = 0; a < enemies.length; a++) {
      for (var b = a + 1; b < enemies.length; b++) {
        var ea = enemies[a], eb = enemies[b];
        var dd = dist(ea.x, ea.y, eb.x, eb.y);
        var min = (ea.w + eb.w) * 0.5;
        if (dd > 0.01 && dd < min) {
          var push = (min - dd) * 0.5;
          var ux = (ea.x - eb.x) / dd, uy = (ea.y - eb.y) / dd;
          moveEntity(ea, ux * push, uy * push);
          moveEntity(eb, -ux * push, -uy * push);
        }
      }
    }

    // 弹道
    for (var k = bullets.length - 1; k >= 0; k--) {
      var bl = bullets[k];
      bl.x += bl.vx * dt;
      bl.y += bl.vy * dt;
      bl.life -= dt;
      if (bl.life <= 0) { bullets.splice(k, 1); continue; }
      if (bl.team === 'p') {
        for (var m = enemies.length - 1; m >= 0; m--) {
          var en = enemies[m];
          if (dist(bl.x, bl.y, en.x, en.y - 4) < bl.r + en.w / 2) {
            hitEnemy(en, bl.dmg);
            if (bl.pierce && bl.pierce > 0) {
              bl.pierce--;
              break; // pierce 时本弹只结算一次（避免同一帧同时打一个敌人两次），下帧继续飞
            }
            bullets.splice(k, 1);
            break;
          }
        }
      } else if (dist(bl.x, bl.y, player.x, player.y - 5) < bl.r + 5) {
        hurtPlayer(bl.dmg);
        bullets.splice(k, 1);
        continue;
      }
      if (bl.x < 2 || bl.x > W - 2 || bl.y < 2 || bl.y > H - 2) bullets.splice(k, 1);
    }

    // 宝箱
    for (var ci = 0; ci < chests.length; ci++) {
      var ch = chests[ci];
      if (ch.open) continue;
      if (dist(player.x, player.y, ch.x, ch.y) < 16) openChest(ch);
    }
    updateDrops(dt);

    // 生成敌人
    if (G.spawned < G.total) {
      G.spawnTimer -= dt;
      if (G.spawnTimer <= 0) {
        if (enemies.length < G.cap) {
          var pos = freeSpot(115, 0);
          if (pos) {
            enemies.push(makeEnemy(pickEnemyType(), pos.x, pos.y));
            G.spawned++;
            G.spawnTimer = 0.75;
          } else G.spawnTimer = 0.3;
        } else G.spawnTimer = 0.4;
      }
    } else if (enemies.length === 0) {
      levelClear();
    }

    // 特效与粒子
    for (var fi = fx.length - 1; fi >= 0; fi--) {
      fx[fi].t += dt;
      if (fx[fi].t > fx[fi].dur) fx.splice(fi, 1);
    }
    for (var pi = parts.length - 1; pi >= 0; pi--) {
      var p = parts[pi];
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
      if (p.t > p.dur) parts.splice(pi, 1);
    }
    for (var ti = texts.length - 1; ti >= 0; ti--) {
      texts[ti].t += dt;
      texts[ti].y -= 14 * dt;
      if (texts[ti].t > texts[ti].dur) texts.splice(ti, 1);
    }
  }

  function pickEnemyType() {
    var r = Math.random();
    if (G.level >= 3 && r > 0.82) return 'charger';
    if (G.level >= 2 && r > 0.6) return 'spitter';
    return 'crawler';
  }

  /* 宝箱开启：武器落地，需玩家走上去拾取；落点必须完全在地面瓦片内 */
  function dropClear(x, y) {
    for (var oy = -7; oy <= 7; oy += 7) {
      for (var ox = -7; ox <= 7; ox += 7) {
        if (isSolid(Math.floor((x + ox) / T), Math.floor((y + oy) / T))) return false;
      }
    }
    return true;
  }

  function dropSpot(ch) {
    var offs = [[15, 0], [-15, 0], [0, 17], [0, -17], [12, 12], [-12, 12], [12, -12], [-12, -12]];
    for (var i = 0; i < offs.length; i++) {
      var x = ch.x + offs[i][0], y = ch.y + offs[i][1];
      if (dropClear(x, y)) return { x: x, y: y };
    }
    return { x: ch.x, y: ch.y + 6 };
  }

  function openChest(ch) {
    ch.open = true;
    // 过滤玩家武器 + 已在地上的掉落，避免同屏多件同款
    var pool = WEAPON_IDS.filter(function (id) {
      if (id === player.weapon) return false;
      for (var i = 0; i < drops.length; i++) if (drops[i].weapon === id) return false;
      return true;
    });
    if (!pool.length) pool = WEAPON_IDS.filter(function (id) { return id !== player.weapon; });
    var id = pool[randInt(pool.length)];
    var sp = dropSpot(ch);
    drops.push({ x: sp.x, y: sp.y, sx: ch.x, sy: ch.y, tx: sp.x, ty: sp.y, weapon: id, lvl: 0, k: 0, t: rand(6) });
    toast('宝箱开启 · ' + WEAPONS[id].name + ' 落在附近，走上去选择');
    for (var i = 0; i < 14; i++) {
      parts.push({
        x: ch.x, y: ch.y - 6, vx: (Math.random() - 0.5) * 60, vy: -40 - rand(60),
        t: 0, dur: 0.5 + rand(0.4), col: i % 3 === 0 ? '#d9a54b' : '#f08a4b', s: 1 + (i % 2)
      });
    }
  }

  /* 走到掉落物上：弹出替换 / 熔炼 / 跳过面板 */
  function openPickupPanel(dp) {
    G.pickupDrop = dp;
    G.pickupIdx = drops.indexOf(dp);
    G.state = 'pickup';
    var cur = WEAPONS[player.weapon], dro = WEAPONS[dp.weapon];
    var curEff = eff(cur, player.wpnLvl), droEff = eff(dro, dp.lvl);
    var curName = cur.name + (player.wpnLvl ? ' Lv.' + player.wpnLvl : '');
    var droName = dro.name + (dp.lvl ? ' Lv.' + dp.lvl : '');
    var curTxt = weaponUpgradeText(cur, player.wpnLvl);
    var droTxt = weaponUpgradeText(dro, dp.lvl);
    var meltTxt = weaponUpgradeText(dro, dp.lvl + 1); // 熔炼后 +1 级
    showOverlay(
      '<div class="panel wide">' +
      '<p class="eyebrow">发现武器</p>' +
      '<h2>' + droName + '</h2>' +
      '<p class="sub">' + dro.desc + '</p>' +
      '<div class="compare">' +
      '<div class="side">' +
      '<div class="side-head">当前装备</div>' +
      '<div class="side-name">' + curName + '</div>' +
      '<div class="side-desc">' + cur.desc + '</div>' +
      '<div class="side-mod">' + curTxt + '</div>' +
      '</div>' +
      '<div class="arrow">vs</div>' +
      '<div class="side">' +
      '<div class="side-head">地上</div>' +
      '<div class="side-name">' + droName + '</div>' +
      '<div class="side-desc">' + dro.desc + '</div>' +
      '<div class="side-mod">' + droTxt + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="pickup-actions">' +
      '<button class="btn" id="btnSwap">替换 · 旧的「' + curName + '」留在地上</button>' +
      '<button class="btn primary" id="btnMelt">熔炼 · 让「' + curName + '」升到 Lv.' + (player.wpnLvl + 1) + '</button>' +
      '<button class="btn ghost" id="btnSkip">跳过</button>' +
      '</div>' +
      '</div>'
    );
    document.getElementById('btnSwap').addEventListener('click', swapPickup);
    document.getElementById('btnMelt').addEventListener('click', meltPickup);
    document.getElementById('btnSkip').addEventListener('click', skipPickup);
    document.getElementById('btnSwap').focus();
  }

  function swapPickup() {
    var idx = G.pickupIdx;
    if (idx < 0 || idx >= drops.length) return closePickup();
    var dp = drops[idx];
    // 把当前武器扔到地上，保留原等级
    drops[idx] = {
      x: dp.x, y: dp.y, sx: dp.x, sy: dp.y, tx: dp.x, ty: dp.y, // 原位置占位，实际不会显示太久
      weapon: player.weapon, lvl: player.wpnLvl, k: 1, t: 0
    };
    // 再把选中的替换上去（原位置已经被上一条覆盖，需要重新 push 一个来自 chest 附近的？不对，我们直接覆盖掉了）
    // 更简单的做法：先把当前武器 push 到 drops 末尾，再把 drops[idx] 改成 dp 的武器
    // (上面的做法会覆盖掉落武器，这里纠正)
    var curDrop = {
      x: player.x, y: player.y + 6, sx: player.x, sy: player.y + 6, tx: player.x, ty: player.y + 6,
      weapon: player.weapon, lvl: player.wpnLvl, k: 1, t: 0
    };
    drops.push(curDrop);
    player.weapon = dp.weapon;
    player.wpnLvl = dp.lvl;
    drops.splice(idx, 1);
    spark(dp.x, dp.y - 4, '#d9a54b', 10, 70);
    G.shake = Math.max(G.shake, 1.2);
    toast('换上 ' + WEAPONS[player.weapon].name + ' · Lv.' + player.wpnLvl + '｜旧武器留在地上');
    updateWeaponHud();
    closePickup();
  }

  function meltPickup() {
    var idx = G.pickupIdx;
    if (idx < 0 || idx >= drops.length) return closePickup();
    drops.splice(idx, 1);
    player.wpnLvl++;
    spark(player.x, player.y - 8, '#f08a4b', 14, 90);
    G.shake = Math.max(G.shake, 2.5);
    toast('熔炼成功！当前武器升到 Lv.' + player.wpnLvl);
    updateWeaponHud();
    closePickup();
  }

  function skipPickup() {
    closePickup();
  }

  function closePickup() {
    G.state = 'play';
    G.pickupDrop = null;
    G.pickupIdx = -1;
    hideOverlay();
  }

  function updateDrops(dt) {
    for (var i = drops.length - 1; i >= 0; i--) {
      var dp = drops[i];
      dp.t += dt;
      if (dp.k < 1) {
        dp.k = Math.min(1, dp.k + dt / 0.28);
        dp.x = dp.sx + (dp.tx - dp.sx) * dp.k;
        dp.y = dp.sy + (dp.ty - dp.sy) * dp.k;
        continue;
      }
      // 走到掉落物上 → 弹出面板；面板显示期间不再触发
      if (G.state === 'play' && dist(player.x, player.y, dp.x, dp.y) < 11) {
        openPickupPanel(dp);
      }
    }
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }

  /* ---------------- 渲染 ---------------- */
  function shadowUnder(x, feetY, w) {
    ctx.fillStyle = 'rgba(13,11,20,0.5)';
    ctx.fillRect(Math.round(x - w / 2), Math.round(feetY) - 1, w, 2);
    ctx.fillRect(Math.round(x - w / 2) + 1, Math.round(feetY) - 2, w - 2, 1);
  }

  function drawPlayer() {
    var feet = player.y + 4.5;
    shadowUnder(player.x, feet + AY, 10);
    var frame = player.moving ? Math.floor(player.t * 8) % 2 : 0;
    var bob = player.moving ? (Math.floor(player.t * 8) % 2 === 0 ? 0 : 1) : 0;
    var tint = player.invuln > 0 && Math.floor(player.invuln * 16) % 2 === 0 ? '#f2eee0' : null;
    window.PX.drawFeet(ctx, window.PX.SPR.player, player.x, feet + AY - bob, {
      frame: frame, flip: player.face < 0, tint: tint
    });
    // 腰间灯笼：玩家光源，随呼吸轻微起伏
    var lx = Math.round(player.x + (player.face > 0 ? 7 : -7));
    var ly = Math.round(feet + AY - 7 + Math.sin(player.t * 3) * 0.9);
    window.ART.rect(ctx, lx - 1, ly - 2, 3, 4, '#6b4a24');
    window.ART.rect(ctx, lx, ly - 1, 1, 2, '#79c0c6');
    window.ART.rect(ctx, lx - 2, ly - 3, 5, 1, '#a3722f');
  }

  function drawEnemy(e) {
    var feet = e.y + e.h / 2;
    shadowUnder(e.x, feet + AY, e.w + 2);
    if (e.state === 'tell') {
      window.ART.ring(ctx, e.x, feet + AY - 5, 12, '#f08a4b', e.stateT);
    }
    var frame = 0;
    if (ENEMY[e.type].frames > 1 && e.moving) frame = Math.floor(e.t * 6) % 2;
    var tint = e.flash > 0 ? '#f2eee0' : null;
    window.PX.drawFeet(ctx, window.PX.SPR[e.type], e.x, feet + AY, { frame: frame, tint: tint });
    // 低血提示
    if (e.hp < e.maxhp * 0.5) {
      var pct = clamp(e.hp / e.maxhp, 0, 1);
      window.ART.rect(ctx, e.x - 6, feet + AY - e.h - 5, 12, 2, '#1b1726');
      window.ART.rect(ctx, e.x - 5, feet + AY - e.h - 4, Math.max(1, Math.round(10 * pct)), 1, '#c4513f');
    }
  }

  function drawDrop(dp) {
    var hop = dp.k < 1 ? Math.round(Math.sin(dp.k * Math.PI) * 6) : 0;
    var bob = dp.k < 1 ? 0 : Math.round(Math.sin(dp.t * 3) * 1.2);
    shadowUnder(dp.x, dp.y + 6 + AY, 10);
    if (dp.k >= 1) window.ART.ring(ctx, dp.x, dp.y + 6 + AY, 8, '#d9a54b', dp.t);
    window.ART.icon(ctx, WEAPONS[dp.weapon].icon, dp.x - 8, dp.y - 8 + AY - hop - bob);
    if (dp.lvl) {
      // 等级小牌：图标右下，黄铜底 + 骨白字
      var lx = dp.x - 8 + AY - 10, ly = dp.y + 6 - hop - bob;
      window.ART.rect(ctx, lx + 10, ly - 2, 6, 6, '#6b4a24');
      window.ART.rect(ctx, lx + 11, ly - 1, 4, 4, '#d9a54b');
      ctx.fillStyle = '#0d0b14';
      ctx.font = 'bold 5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('' + dp.lvl, Math.round(dp.x - 8 + 13), Math.round(dp.y - 8 + AY - hop - bob + 14));
      ctx.textAlign = 'left';
    }
  }

  function drawBlades() {
    var w = WEAPONS.saw;
    for (var b = 0; b < 2; b++) {
      var a = player.orbitAng + b * Math.PI;
      var bx = player.x + Math.cos(a) * w.orbitR;
      var by = player.y + Math.sin(a) * w.orbitR * 0.8;
      window.ART.sawBlade(ctx, bx, by + AY - 2, a * 3);
    }
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    if (G.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
    }

    // 1. 地面
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) window.ART.floor(ctx, c, r, 0, AY);
    }
    // 2. 接触阴影
    for (var wi = 0; wi < walls.length; wi++) {
      if (walls[wi].vert) continue;
      window.ART.wallShadow(ctx, walls[wi].x, AY + walls[wi].y, walls[wi].w);
    }
    // 左右长墙：先画，永远在实体之后
    walls.forEach(function (w) {
      if (!w.vert) return;
      if (w.x < W / 2) {
        ctx.fillStyle = 'rgba(13,11,20,0.45)';
        ctx.fillRect(w.x + T, AY + w.y, 5, w.h);
      }
      window.ART.wallV(ctx, w.x, AY + w.y, w.h);
    });

    // 3. 按脚底 y 排序，统一遮挡规则
    var list = [];
    walls.forEach(function (w) {
      if (w.vert) return;
      list.push({ y: w.y + T, f: function () { window.ART.wall(ctx, w.x, AY + w.y, w.w, w.h, w.h === 16); } });
    });
    chests.forEach(function (ch) {
      list.push({
        y: ch.y + 6, f: function () {
          shadowUnder(ch.x, ch.y + 6 + AY, 12);
          window.PX.drawFeet(ctx, window.PX.SPR.chest, ch.x, ch.y + 6 + AY, { frame: ch.open ? 1 : 0 });
        }
      });
    });
    drops.forEach(function (dp) {
      list.push({ y: dp.y + 6, f: function () { drawDrop(dp); } });
    });
    enemies.forEach(function (e) { list.push({ y: e.y + e.h / 2, f: function () { drawEnemy(e); } }); });
    list.push({ y: player.y + 4.5, f: drawPlayer });
    if (player.weapon === 'saw') list.push({ y: player.y + 5, f: drawBlades });
    list.sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (o) { o.f(); });

    // 4. 弹道
    bullets.forEach(function (b) {
      if (b.kind === 'bolt') window.ART.bolt(ctx, b.x, b.y + AY);
      else window.ART.emberShot(ctx, b.x, b.y + AY, G.t + b.x * 0.01);
    });

    // 5. 特效
    fx.forEach(function (f) {
      var k = f.t / f.dur;
      if (f.kind === 'slash') {
        window.ART.slash(ctx, f.x, f.y + AY, f.ang, k);
      } else if (f.kind === 'shock') {
        window.ART.shock(ctx, f.x, f.y + AY, f.r0 + (f.r1 - f.r0) * k, k);
      } else if (f.kind === 'beam') {
        window.ART.beam(ctx, f.x1, f.y1 + AY, f.x2, f.y2 + AY, k);
      }
    });
    parts.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.dur);
      window.ART.rect(ctx, p.x, p.y + AY, p.s, p.s, p.col);
      ctx.globalAlpha = 1;
    });

    // 6. 伤害数字
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    texts.forEach(function (t) {
      ctx.globalAlpha = Math.max(0, 1 - t.t / t.dur);
      ctx.fillStyle = '#0d0b14';
      ctx.fillText(t.txt, Math.round(t.x) + 1, Math.round(t.y + AY) + 1);
      ctx.fillStyle = t.col;
      ctx.fillText(t.txt, Math.round(t.x), Math.round(t.y + AY));
      ctx.globalAlpha = 1;
    });
    ctx.textAlign = 'left';

    // 7. 光照层级
    window.ART.lanternGlow(ctx, player.x, player.y + AY - 8);
    window.ART.vignette(ctx, VIEW_W, VIEW_H);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* ---------------- HUD ---------------- */
  function updateWeaponHud() {
    var w = WEAPONS[player.weapon];
    var name = w.name + (player.wpnLvl ? ' Lv.' + player.wpnLvl : '');
    wpnName.textContent = name;
    var c2 = wpnIcon.getContext('2d');
    c2.clearRect(0, 0, 16, 16);
    window.ART.icon(c2, w.icon, 0, 0);
    // 左上角等级徽标
    if (player.wpnLvl) {
      c2.fillStyle = '#6b4a24';
      c2.fillRect(0, 0, 7, 7);
      c2.fillStyle = '#d9a54b';
      c2.font = 'bold 7px monospace';
      c2.textAlign = 'center';
      c2.fillText('' + player.wpnLvl, 3.5, 6);
      c2.textAlign = 'left';
    }
  }

  function updateHud() {
    var pct = clamp(player.hp / player.maxhp, 0, 1);
    hpFill.style.width = (pct * 100).toFixed(1) + '%';
    hpText.textContent = Math.ceil(player.hp) + ' / ' + player.maxhp;
    hpBar.setAttribute('aria-valuenow', Math.round(player.hp));
    hpBar.setAttribute('aria-valuemax', player.maxhp);
    xpFill.style.width = clamp(player.xp / player.xpNext, 0, 1) * 100 + '%';
    lvlChip.textContent = 'Lv.' + player.level;
    var remain = (G.total - G.spawned) + enemies.length;
    foeChip.textContent = '剩余 ' + remain;
    floorChip.textContent = '第 ' + G.level + ' 层';
  }

  function hudTick(dt) {
    hudAcc += dt;
    if (hudAcc < 0.08) return;
    hudAcc = 0;
    updateHud();
  }

  /* ---------------- 流程 ---------------- */
  function startLevel(level) {
    G.level = level;
    G.spawned = 0;
    G.total = Math.min(34, 8 + level * 4);
    G.spawnTimer = 1.2;
    G.cap = Math.min(9, 5 + level);
    enemies.length = 0;
    bullets.length = 0;
    fx.length = 0;
    texts.length = 0;
    parts.length = 0;
    chests.length = 0;
    drops.length = 0;
    buildArena(level);

    var n = level >= 3 ? 2 : 1;
    for (var i = 0; i < n; i++) {
      var pos = freeSpot(90, 70);
      if (pos) chests.push({ x: pos.x, y: pos.y, open: false });
    }

    G.state = 'play';
    hideOverlay();
    updateWeaponHud();
    updateHud();
  }

  function resetGame() {
    player = makePlayer();
    G.kills = 0;
    cardQueue = 0;
    startLevel(1);
  }

  function levelClear() {
    if (G.state !== 'play') return;
    G.state = 'clear';
    player.hp = Math.min(player.maxhp, player.hp + Math.round(player.maxhp * 0.3));
    showOverlay(
      '<div class="panel">' +
      '<p class="eyebrow">第 ' + G.level + ' 层 · 清场</p>' +
      '<h2>回廊暂归寂静</h2>' +
      '<p class="sub">击杀 ' + G.kills + ' 只 · 生命回复 30%</p>' +
      '<div class="statrow"><span>剩余生命</span><b>' + Math.ceil(player.hp) + ' / ' + player.maxhp + '</b></div>' +
      '<div class="statrow"><span>等级</span><b>Lv.' + player.level + '</b></div>' +
      '<div class="statrow"><span>武器</span><b>' + WEAPONS[player.weapon].name + '</b></div>' +
      '<button class="btn primary" id="btnNext">深入第 ' + (G.level + 1) + ' 层</button>' +
      '</div>'
    );
    document.getElementById('btnNext').addEventListener('click', function () {
      startLevel(G.level + 1);
    });
    document.getElementById('btnNext').focus();
  }

  function gameOver() {
    G.state = 'over';
    showOverlay(
      '<div class="panel">' +
      '<p class="eyebrow">灯熄</p>' +
      '<h2>巡礼止于第 ' + G.level + ' 层</h2>' +
      '<p class="sub">共击杀 ' + G.kills + ' 只怪物 · 达到 Lv.' + player.level + '</p>' +
      '<button class="btn primary" id="btnRetry">重新点灯</button>' +
      '</div>'
    );
    document.getElementById('btnRetry').addEventListener('click', function () {
      resetGame();
    });
    document.getElementById('btnRetry').focus();
  }

  function showOverlay(html) {
    overlay.innerHTML = html;
    overlay.classList.remove('hidden');
  }
  function hideOverlay() {
    overlay.classList.add('hidden');
    overlay.innerHTML = '';
  }

  function pickCards() {
    var pool = UPGRADES.slice(), out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(randInt(pool.length), 1)[0]);
    return out;
  }

  function offerCards() {
    G.state = 'levelup';
    var picks = pickCards();
    var html = '<div class="panel wide">' +
      '<p class="eyebrow">升级 · Lv.' + player.level + '</p>' +
      '<h2>选择一项精进</h2>' +
      '<div class="cards">';
    picks.forEach(function (u, i) {
      html += '<button class="card" data-i="' + i + '">' +
        '<canvas class="card-icon" width="16" height="16" aria-hidden="true"></canvas>' +
        '<span class="card-name">' + u.name + '</span>' +
        '<span class="card-desc">' + u.desc + '</span>' +
        '<span class="card-key">' + (i + 1) + '</span>' +
        '</button>';
    });
    html += '</div></div>';
    showOverlay(html);

    var cs = overlay.querySelectorAll('.card-icon');
    picks.forEach(function (u, i) {
      var c2 = cs[i].getContext('2d');
      c2.clearRect(0, 0, 16, 16);
      window.ART.icon(c2, u.icon, 0, 0);
    });
    var btns = overlay.querySelectorAll('.card');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        chooseCard(picks[parseInt(btn.dataset.i, 10)]);
      });
    });
    if (btns[0]) btns[0].focus();
    offerCards._picks = picks;
  }

  function chooseCard(u) {
    if (!u || G.state !== 'levelup') return;
    u.apply(player);
    cardQueue = Math.max(0, cardQueue - 1);
    hideOverlay();
    G.state = 'play';
    updateHud();
    if (cardQueue > 0) offerCards();
  }

  /* ---------------- 输入 ---------------- */
  window.addEventListener('keydown', function (ev) {
    var k = ev.key.toLowerCase();
    if (k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright' || k === ' ') {
      ev.preventDefault();
    }
    keys[k] = true;
    if (G.state === 'levelup') {
      var idx = parseInt(k, 10);
      if (idx >= 1 && idx <= 3 && offerCards._picks) chooseCard(offerCards._picks[idx - 1]);
      return;
    }
    if (G.state === 'pickup') {
      if (k === '1') swapPickup();
      else if (k === '2') meltPickup();
      else if (k === '3' || k === 'escape') skipPickup();
      else if (k === 'enter') meltPickup();
      return;
    }
    if (G.state === 'title' && (k === 'enter' || k === ' ')) {
      var b = document.getElementById('btnStart');
      if (b) b.click();
    }
    if (G.state === 'clear' && k === 'enter') {
      var nb = document.getElementById('btnNext');
      if (nb) nb.click();
    }
    if (G.state === 'over' && k === 'enter') {
      var rb = document.getElementById('btnRetry');
      if (rb) rb.click();
    }
  });
  window.addEventListener('keyup', function (ev) {
    keys[ev.key.toLowerCase()] = false;
  });
  window.addEventListener('blur', function () { keys = {}; });

  /* ---------------- 主循环 ---------------- */
  var last = 0;
  function frame(ts) {
    var dt = last ? Math.min(0.045, (ts - last) / 1000) : 0;
    last = ts;
    if (G.state === 'play') {
      update(dt);
      hudTick(dt);
    } else if (G.state === 'pickup') {
      // 冻结战斗，但让粒子/掉落动画等继续一点，避免完全僵死
      G.t += dt;
      for (var fi = fx.length - 1; fi >= 0; fi--) { fx[fi].t += dt; if (fx[fi].t > fx[fi].dur) fx.splice(fi, 1); }
      for (var pi = parts.length - 1; pi >= 0; pi--) { var p = parts[pi]; p.t += dt; p.y += p.vy * dt; if (p.t > p.dur) parts.splice(pi, 1); }
      hudTick(dt);
    }
    render();
    requestAnimationFrame(frame);
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    resize();
    player = makePlayer();
    buildArena(1);
    showOverlay(
      '<div class="panel">' +
      '<p class="eyebrow">2DRougeNew · 原型</p>' +
      '<h1>守灯人回廊</h1>' +
      '<p class="sub">斜俯视瓦片像素 · 自动攻击 · 单层清场</p>' +
      '<ul class="keys">' +
      '<li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / 方向键：走位</li>' +
      '<li>攻击全自动，你只负责不被击中</li>' +
      '<li><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>：升级三选一</li>' +
      '<li>走到宝箱上开启：武器落在地上，走上去更换，旧武器丢弃</li>' +
      '</ul>' +
      '<button class="btn primary" id="btnStart">开始巡礼</button>' +
      '<a class="link" href="art-bible.html">先看美术圣经 →</a>' +
      '</div>'
    );
    document.getElementById('btnStart').addEventListener('click', function () {
      resetGame();
    });
    document.getElementById('btnStart').focus();
    requestAnimationFrame(frame);
  }

  boot();
})();

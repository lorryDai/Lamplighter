# 守灯人回廊 · Lamplighter

> 斜俯视瓦片像素 · 自动攻击 Roguelike · 原生 HTML5 Canvas

**一句话**：冷石回廊里，一个提着灯的人，用黄铜与余烬清场。

---

## 快速开始

不需要任何构建步骤，双击就能跑。

```bash
# 方式一：静态服务器（推荐，避免浏览器对 file:// 的限制）
node -e "require('http').createServer((req,res)=>{const fs=require('fs'),path=require('path');let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/' )p='/index.html';const f=path.join(process.cwd(),p);const t={'html':'text/html','js':'application/javascript','css':'text/css','ico':'image/x-icon'}[p.split('.').pop()]||'text/plain';fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);res.end('not found');return;}res.writeHead(200,{'Content-Type':t+';charset=utf-8'});res.end(d);});}).listen(5173,()=>console.log('▶ http://localhost:5173/'));"

# 方式二：直接在浏览器打开 index.html
```

打开 http://localhost:5173/ ，点击「开始巡礼」即可。

---

## 玩法

| 系统 | 说明 |
|---|---|
| **移动** | `W A S D` / 方向键 |
| **攻击** | 全自动，只管走位 |
| **敌人 AI** | 蠕行者贴脸近战 · 灯蛾保持距离射击 · 铜角冲锋者带 0.65s 预警环冲刺 |
| **升级** | 经验满弹三张属性卡（锋锐/体魄/疾行/守御/悟性/迅捷），三选一 |
| **宝箱** | 靠近自动开启，武器弹落到附近空地（不会卡进墙体） |
| **武器拾取** | 走到掉落物上弹出三选一面板：**替换**（旧武器留在地上）· **熔炼**（当前武器 +1 级）· **跳过** |
| **过关** | 清完全部敌人，回复 30% 生命，进入下一层（敌人按层递增血量与数量） |

## 武器 & 熔炼词条（6 种，每种独立两条词条）

| 武器 | 攻击方式 | 词条 1 | 词条 2 |
|---|---|---|---|
| 钟摆刃 | 扇形近战弧斩 | 刃弧扩 · 扇形角 +0.15 rad | 刃锋锐 · 伤害 +1 |
| 灯芯弹 | 自动瞄准直线弹丸 | 穿透+ · 多穿透 1 个敌人 | 弹芯锐 · 伤害 +1 |
| 余烬扇 | 三向扇形散射 | 散弹+ · 弹数 +1（上限 6）| 扇面宽 · 散射角 +0.06 |
| 钟锤 | 砸地冲击波 | 冲击波扩 · 半径 +6 px | 锤重沉 · 伤害 +3 |
| 齿环锯 | 双锯环绕切割 | 锯环扩 · 轨道半径 +6 px | 齿锋锐 · 单段伤害 +1 |
| 灯塔棱光 | 贯穿直线光束 | 棱光加粗 · 宽度 +2 px | 棱光锐 · 伤害 +2 |

每熔炼一次，两条词条各 +1 级，最多 10 级封顶（在 WEAPONS 定义里配 step / max）。

---

## 技术栈

- **原生 HTML5 Canvas + 原生 JS**（非 ES Module，`file://` 直接打开也能跑）
- 逻辑分辨率 480×284，整数倍整数倍缩放（CSS `image-rendering: pixelated` + `--s` 变量）
- **双层 UI**：世界用低分辨率 canvas 放大渲染像素，HUD / 卡片 / 提示用 DOM 在原生分辨率渲染（中文清晰、可访问）
- **锁定 22 色调色板**，全局 7 色族：ink/slate0-4/bone0-1/moss/brass/ember/cyan
- **统一遮挡**：所有实体（墙 / 宝箱 / 敌人 / 锯片）按脚底 y 排序，y 大的压住 y 小的

## 文件结构

```
Lamplighter/
├── index.html          可玩原型入口
├── art-bible.html      美术圣经（9 章节 + OKR）
├── bible.css           美术圣经样式
├── styles.css          游戏样式（HUD / 面板 / 按钮）
└── js/
    ├── palette.js      22 色调色板 + 字母缩写映射
    ├── pixels.js        角色/敌人/宝箱精灵矩阵 + 离屏 canvas 烘焙缓存
    ├── art.js          绘制层：地板、墙、弹丸、特效、图标
    ├── bible.js        美术圣经的可视化渲染（色板、场景图、精灵卡）
    └── game.js         核心逻辑（约 1200 行，单 IIFE 闭包）
```

**美术圣经与实机不漂移**：`art-bible.html` 直接调用同一套 `palette.js / pixels.js / art.js` 渲染色板、精灵、材质、图标，文档看到的就是游戏里实际渲染的。

## 美术圣经目录

00 项目假设 · 01 锁定调色板 · 02 空间语法 · 03 剪影与比例 · 04 材质与光照 · 05 UI 与图标 · 06 动效 · 07 资产规格（含武器熔炼词条）· 08 应避免的视觉错误 · 09 个人 OKR

## 键盘速查

| 场景 | 按键 |
|---|---|
| 游戏中 | `W` `A` `S` `D` / 方向键 走位 |
| 升级三选一 | `1` `2` `3` 选卡 / 回车随机 |
| 拾取面板 | `1` 替换 · `2` 熔炼 · `3` / `Esc` 跳过 · 回车默认熔炼 |
| 层间切换 / 重开 | 回车 |

## 已知限制（下个迭代要做的）

- 没有持久化（localStorage 存档）
- 没有音效 / BGM
- 没有 Boss 层（每 5 层一个）
- 武器熔炼词条上限固定 10，未在 UI 提示
- 没有把像素精灵导出为 PNG 图集给美术管线

## License

暂不指定，内部项目。

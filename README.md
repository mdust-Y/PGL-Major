# PGL Major Singapore 2026 · 对阵预测作业（模拟器）

针对 **PGL Major Singapore 2026**（2026.11.24 – 12.13，新加坡加冷，$1,250,000，32队）的
三阶段瑞士轮 + 季后赛预测与对阵模拟工具。界面参考 B 站 Major 作业（Pick'Em）风格。

## 快速开始

直接用浏览器打开 **`index.html`**（无需联网、无需服务器）。打开后自动运行一次全赛程蒙特卡洛预测。

## 微信 / 手机版

已做移动端适配，部署方法见 `deploy/DEPLOY.md`（GitHub Pages / Vercel / 云开发）。

改动点：

- **点选排阵**：手机上没有可靠的 HTML5 拖拽，改成「点战队 → 点槽位」；槽位右侧 `×` 把队伍移回池子（`js/mobile.js`）。
- **本地队标**：29 支队的 logo 已下载到 `img/`，`js/logos-local.js` 覆盖 CDN 地址，国内网络不再掉图。
- **手机布局**：`≤640px` 时顶部分页条横向滑动、梯子宽度 620px、侧栏堆叠、季后赛竖排。
- **分享卡片**：补了 `og:title/description/image` 和 `cover.png`；头部站外链接改成纯文本，避免微信「非官方网页」拦截。
- **触屏兼容**：鼠标仍可拖拽；`pointerType !== 'mouse'` 时不启动拖拽，交给点选。

测试：`node tools/test_ui.js`（原有冒烟测试）、`node tools/test_mobile.js`（点选排阵逻辑）。


## 功能

- **分页式流程**：总览 / 第一阶段 / 第二阶段 / 第三阶段 / 季后赛，顶部步骤导航切换
- **真实战队队标**（cybersport.ru CDN，加载失败自动回退为彩色缩写）
- **对阵按战绩分组列展示**：0-0 / 1-0 / 0-1 / 2-0 / 1-1 / 0-2 / 2-1 / 1-2 / 2-2
- **手动设定权限**（每个阶段开始时）：
  - 从战队池**拖动战队图标**到 0-0 组对阵槽，自由安排初始对阵
  - **点击每场对阵的战队手动选定胜者**（✓ 已选高亮）
- **右键战队图标 = 标记关注**（⭐ 金色高亮）
- **模拟按钮**：默认「▶ 模拟下一轮」只推进一轮；「⏩ 模拟到完赛」并列一键到底
- **结果可改判**：点击任意场次改判胜者，自动重算该轮起的后续（保持当前轮次深度）
- **阶段联动**：每阶段 8 支晋级队自动流入下一阶段；完赛弹窗询问是否进入下一阶段
- **实时晋级概率**：每支战队晋级概率以数字实时显示（蒙特卡洛按当前设定重算）
- **季后赛**：点击战队手动定胜负，或按实力一键模拟（QF/SF BO3、三四名BO3、决赛BO5）
- **一键全赛程蒙特卡洛**：给出战绩分布与夺冠概率榜

## 文件说明

| 文件 | 说明 |
| --- | --- |
| `index.html` | 交互页面（分页导航 + 瑞士轮作业风格样式 + 完赛弹窗） |
| `data.js` | 32队数据：VRS积分/名次/赛区/阶段/官方首轮对阵/赛制 |
| `sim.js` | 模拟引擎：Elo胜率、瑞士轮配对、季后赛、蒙特卡洛 |
| `ui.js` | 页面逻辑：分页渲染、拖拽、点选赛果、部分模拟、实时概率 |
| `predictions.json` | 基线预测（Node 端 3 万次蒙特卡洛，2026-11-20 生成） |
| `predict_cli.js` | Node 端预测脚本：`node predict_cli.js 30000` |
| `summarize.js` | 打印可读预测摘要：`node summarize.js` |
| `test_ui.js` | 无头冒烟测试：`node test_ui.js` |

## 模型

- 单图胜率 `P = 1 / (1 + 10^(-Δ/620))`，Δ = 两队 **Valve 区域排名(VRS)积分差**（2026-11-02 版）
- `S = 620` 由第一阶段首轮 BetBoom 盘口隐含概率拟合
- BO3/BO5 逐图模拟，比分与胜负严格一致
- 瑞士轮：同战绩池按种子高低搭配、避免重赛；季后赛种子 = 战绩(3-0>3-1>3-2) → 布赫霍尔茨 → VRS

> 模型仅基于 VRS 历史积分，不含临场状态、阵容变动与地图池因素，仅供娱乐参考。

## 数据来源

- Valve Regional Standings 2026-11-02 — [GitHub](https://github.com/ValveSoftware/counter-strike_regional_standings)
- PGL / HLTV / 5EPlay / [dust2.dk](https://www.dust2.dk/nyheder/79553/ikke-flere-pladser-at-spille-om-her-er-alle-major-holdene) / [Fragster](https://www.fragster.com/pgl-major-singapore-2026-teams/) / cybersport.ru / 新浪电竞

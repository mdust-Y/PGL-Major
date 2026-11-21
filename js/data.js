/* ============================================================
 * PGL Major Singapore 2026 — 赛事数据
 * 数据收集日期: 2026-11-20
 * 来源:
 *  - Valve Regional Standings (VRS) 全球排名 2026-11-02
 *    github.com/ValveSoftware/counter-strike_regional_standings
 *  - PGL 官方 / HLTV / 5EPlay / dust2.dk / fragster / cybersport.ru
 * 赛制:
 *  - 第一阶段 11.24-11.27: 16队瑞士轮, 全 BO1, 8队晋级第二阶段
 *  - 第二阶段 11.28-12.01: 16队瑞士轮(8直邀+8晋级), 全 BO1, 8队晋级第三阶段
 *  - 第三阶段 12.02 起:   16队瑞士轮(8直邀+8晋级), 全 BO3(效仿科隆Major), 8队晋级季后赛
 *  - 季后赛 12.10-12.13 (新加坡室内体育馆): 单败淘汰, 1/4决赛与半决赛 BO3,
 *    三四名决赛 BO3, 总决赛 BO5
 * 种子依据: 2026-11-02 VRS 全球排名 (首轮抽签亦以此确定)
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MAJOR_DATA = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // id, 名称, 缩写, 赛区, 起始阶段, VRS积分(11-02), VRS全球名次, 队徽主色, 深色文字?
  // roster 以 VRS 11-02 登记阵容为准(大名单/替补可能有变动)
  var TEAMS = [
    { id:'mouz',      name:'MOUZ',              abbr:'MOUZ',  region:'EU', stage:3, vrs:1960, rank:1,  color:'#E31837', dark:false, roster:'PR · Spinx · torzsi · xelex · xertioN' },
    { id:'vitality',  name:'Team Vitality',     abbr:'VIT',   region:'EU', stage:3, vrs:1922, rank:2,  color:'#FDB913', dark:true,  roster:'flameZ · jL · mezii · ropz · ZywOo' },
    { id:'furia',     name:'FURIA Esports',     abbr:'FUR',   region:'AM', stage:3, vrs:1912, rank:3,  color:'#2b2b2b', dark:false, roster:'FalleN · KSCERATO · molodoy · YEKINDAR · yuurih' },
    { id:'aurora',    name:'Aurora Gaming',     abbr:'AUR',   region:'EU', stage:3, vrs:1860, rank:4,  color:'#B026FF', dark:false, roster:'Jimpphat · kyxsan · Wicadia · woxic · XANTARES' },
    { id:'spirit',    name:'Team Spirit',       abbr:'TS',    region:'EU', stage:3, vrs:1842, rank:5,  color:'#12E0B0', dark:true,  roster:'donk · magixx · sh1ro · tN1R · zont1x' },
    { id:'betboom',   name:'BetBoom Team',      abbr:'BB',    region:'EU', stage:3, vrs:1786, rank:6,  color:'#2B7FFF', dark:false, roster:'Boombl4 · d1Ledez · Magnojez · S1ren · zorte' },
    { id:'falcons',   name:'Team Falcons',      abbr:'FAL',   region:'EU', stage:3, vrs:1764, rank:7,  color:'#0E9F6E', dark:false, roster:'karrigan · kyousuke · m0NESY · NiKo · TeSeS' },
    { id:'fut',       name:'FUT Esports',       abbr:'FUT',   region:'EU', stage:2, vrs:1721, rank:8,  color:'#E10600', dark:false, roster:'cmtry · dem0n · dziugss · Krabeni · xfl0ud' },
    { id:'legacy',    name:'Legacy',            abbr:'LGC',   region:'AM', stage:3, vrs:1662, rank:9,  color:'#F59E0B', dark:true,  roster:'arT · dumau · latto · n1ssim · try' },
    { id:'nemiga',    name:'Nemiga Gaming',     abbr:'NMG',   region:'EU', stage:2, vrs:1650, rank:10, color:'#94A3B8', dark:true,  roster:'KaiR0N- · khaN · robo · syph0 · Xant3r' },
    { id:'g2',        name:'G2 Esports',        abbr:'G2',    region:'EU', stage:2, vrs:1616, rank:11, color:'#E63946', dark:false, roster:'HeavyGod · huNter- · MATYS · NertZ · r1nkle' },
    { id:'1win',      name:'1win',              abbr:'1WIN',  region:'EU', stage:2, vrs:1598, rank:12, color:'#3B82F6', dark:false, roster:'ArtFr0st · Ax1Le · BELCHONOKK · fame · nafany' },
    { id:'navi',      name:'Natus Vincere',     abbr:'NAVI',  region:'EU', stage:2, vrs:1589, rank:13, color:'#FFD400', dark:true,  roster:'Aleksib · b1t · iM · makazze · w0nderful' },
    { id:'astralis',  name:'Astralis',          abbr:'AST',   region:'EU', stage:2, vrs:1572, rank:14, color:'#EF2B2D', dark:false, roster:'jabbi · phzy · ryu · siuhy · Staehr' },
    { id:'nip',       name:'Ninjas in Pyjamas', abbr:'NIP',   region:'EU', stage:1, vrs:1564, rank:15, color:'#C9A227', dark:true,  roster:'adamb · Krimbo · sjuush · stavn · xKacpersky' },
    { id:'parivision',name:'PARIVISION',        abbr:'PARI',  region:'EU', stage:1, vrs:1560, rank:16, color:'#8B5CF6', dark:false, roster:'FL1T · HObbit · Jame · xiELO · zweih' },
    { id:'mongolz',   name:'The MongolZ',       abbr:'MNGZ',  region:'AP', stage:2, vrs:1554, rank:17, color:'#3A5FE0', dark:false, roster:'910 · bLitz · cobrazera · nin9 · Techno' },
    { id:'heroic',    name:'HEROIC',            abbr:'HEROIC',region:'EU', stage:1, vrs:1548, rank:18, color:'#F43F5E', dark:false, roster:'Brollan · Chr1zN · MartinezSa · nilo · susp' },
    { id:'mibr',      name:'MIBR',              abbr:'MIBR',  region:'AM', stage:2, vrs:1546, rank:19, color:'#F9A01B', dark:true,  roster:'insani · LNZ · nqz · tomaszin · venomzera' },
    { id:'faze',      name:'FaZe Clan',         abbr:'FaZe',  region:'EU', stage:1, vrs:1539, rank:20, color:'#D93A3A', dark:false, roster:'frozen · JBOEN · jcobbb · Neityu · Twistzz' },
    { id:'liquid',    name:'Team Liquid',       abbr:'TL',    region:'AM', stage:1, vrs:1528, rank:21, color:'#005BAB', dark:false, roster:'EliGE · Jorko · JT · malbsMd · NAF' },
    { id:'ef',        name:'Eternal Fire',      abbr:'EF',    region:'EU', stage:1, vrs:1513, rank:22, color:'#FF6A00', dark:true,  roster:'jottAAA · Kvem · MisteM · regali · soulfly' },
    { id:'100t',      name:'100 Thieves',       abbr:'100T',  region:'EU', stage:1, vrs:1511, rank:23, color:'#B91C1C', dark:false, roster:'device · Gizmy · poiii · rain · sirah' },
    { id:'9z',        name:'9z Team',           abbr:'9z',    region:'AM', stage:1, vrs:1490, rank:24, color:'#6D28D9', dark:false, roster:'dgt · HUASOPEEK · luchov · max · meyern' },
    { id:'m80',       name:'M80',               abbr:'M80',   region:'AM', stage:1, vrs:1489, rank:25, color:'#2563EB', dark:false, roster:'JBa · Lake · s1n · slaxz- · Swisher' },
    { id:'dendele',   name:'DENDELE CS',        abbr:'DND',   region:'AM', stage:1, vrs:1466, rank:29, color:'#16A34A', dark:false, roster:'doc · gafolo · koala · maxxkor · rdnzao' },
    { id:'imperial',  name:'Imperial Esports',  abbr:'IMP',   region:'AM', stage:1, vrs:1406, rank:35, color:'#059669', dark:false, roster:'chelo · decenty · noway · saadzin · VINI' },
    { id:'wildcard',  name:'Wildcard Gaming',   abbr:'WC',    region:'AM', stage:1, vrs:1391, rank:38, color:'#7E22CE', dark:false, roster:'Cxzi · fr3nd · HexT · nEMANHA · reck' },
    { id:'bcgame',    name:'BC.Game',           abbr:'BCG',   region:'AP', stage:1, vrs:1337, rank:45, color:'#06B6D4', dark:true,  roster:'asap · Magisk · mzinho · s1mple · Senzu' },
    { id:'flyquest',  name:'FlyQuest',          abbr:'FLY',   region:'AP', stage:1, vrs:1318, rank:48, color:'#84CC16', dark:true,  roster:'aliStair · INS · jks · nettik · Vexite' },
    { id:'cw',        name:'Chinggis Warriors', abbr:'CW',    region:'AP', stage:1, vrs:1272, rank:55, color:'#EF4444', dark:false, roster:'cool4st · fury5k · ROUX · sk0R · tikuak' },
    { id:'lvg',       name:'Lynn Vision',       abbr:'LVG',   region:'AP', stage:1, vrs:1267, rank:56, color:'#1D4ED8', dark:false, roster:'C4LLM3SU3 · EmiliaQAQ · Starry · Westmelon · z4KR' }
  ];

  // 真实战队队标 (来源: cybersport.ru 战队图库 CDN, 加载失败自动回退为彩色缩写)
  var LOGOS = {
    mouz: 'https://images.cybersport.ru/images/team-list-logo/plain/97/97498286-95fa-4697-936c-608f036f5f79.png',
    vitality: 'https://images.cybersport.ru/images/team-list-logo/plain/81/81ae4eec-842d-4049-be1e-04b1209be33a.png',
    furia: 'https://images.cybersport.ru/images/team-list-logo/plain/8d/8dbe0195-0d9b-4005-ba9e-4e3e9af380f6.png',
    aurora: 'https://images.cybersport.ru/images/team-list-logo/plain/3a/3aa91584-e03d-4504-b966-13020f364d21.png',
    spirit: 'https://images.cybersport.ru/images/team-list-logo/plain/30/30e9c980-9e53-461a-8123-ae7d088fc361.png',
    betboom: 'https://images.cybersport.ru/images/team-list-logo/plain/b8/b82af2b1-6233-4267-9863-ff3f822598a6.png',
    falcons: 'https://images.cybersport.ru/images/team-list-logo/plain/b3/b3a0073b-dedd-4237-9126-283350ff5c7a.png',
    fut: 'https://images.cybersport.ru/images/team-list-logo/plain/d0/d0d0f9e7-a355-4d25-961e-c94dbafc5055.webp@jpg',
    legacy: 'https://images.cybersport.ru/images/team-list-logo/plain/47/471f7824-7d48-4f86-9d33-559969d55235.png',
    nemiga: 'https://images.cybersport.ru/images/team-list-logo/plain/69/696b5507-3313-405e-a988-ce0e3fe760fb.png',
    g2: 'https://images.cybersport.ru/images/team-list-logo/plain/24/2469f7e1-0da8-42f8-b89a-5f459a187f99.png',
    '1win': 'https://images.cybersport.ru/images/team-list-logo/plain/1f/1f55037e-3ef0-4df2-a7e6-509aa53948cb.png',
    navi: 'https://images.cybersport.ru/images/team-list-logo/plain/6b/6bf06b6e-3bac-4df3-bdc7-9f2fe5b34237.png',
    astralis: 'https://images.cybersport.ru/images/team-list-logo/plain/5c/5c6ad9d5-22df-4f3c-8901-a4af75d63465.png',
    nip: 'https://images.cybersport.ru/images/team-list-logo/plain/a0/a00d1a6b-9e9b-4317-94c1-ca4263e751e7.png',
    parivision: 'https://images.cybersport.ru/images/team-list-logo/plain/21/21323333-bc1b-430f-95b0-951cf19ddf09.png',
    mongolz: 'https://images.cybersport.ru/images/team-list-logo/plain/30/30e20fd9-f968-4d97-924d-1601dbcaa9d0.png',
    heroic: 'https://images.cybersport.ru/images/team-list-logo/plain/ff/ff6c72da-0281-4390-93d0-5bca6ad8df25.png',
    mibr: 'https://images.cybersport.ru/images/team-list-logo/plain/4d/4dbbc1f2-32f4-4df5-b8ee-825a55418241.png',
    faze: 'https://images.cybersport.ru/images/team-list-logo/plain/58/5874f10f-5b8c-4b67-932b-4ca853fb7029.png',
    liquid: 'https://images.cybersport.ru/images/team-list-logo/plain/e9/e9cb9e5a-a56f-445f-b387-6a2c000de322.png',
    ef: 'https://images.cybersport.ru/images/team-list-logo/plain/00/00d7d94a-d883-4c26-a7e0-b6ff385dc584.png',
    '100t': 'https://images.cybersport.ru/images/team-list-logo/plain/81/81f1b1ee-160d-43c7-a945-ec91bc443a12.png',
    '9z': 'https://images.cybersport.ru/images/team-list-logo/plain/12/12b701db-57a1-4342-a7ea-9a798b834d43.png',
    m80: 'https://images.cybersport.ru/images/team-list-logo/plain/a1/a1f2cdb8-28dd-43ad-a17d-63032b032325.webp@jpg',
    dendele: 'https://images.cybersport.ru/images/team-list-logo/plain/3b/3bee2661-5806-418f-ae73-344203863859.png',
    imperial: 'https://images.cybersport.ru/images/team-list-logo/plain/03/032a1a43-fc34-44c9-a08f-991185e70e2a.png',
    wildcard: 'https://images.cybersport.ru/images/team-list-logo/plain/68/68f9721f-0ccb-4e62-9937-9a155ed74d7e.png',
    bcgame: 'https://images.cybersport.ru/images/team-list-logo/plain/f0/f0d4fa21-bc41-4604-b3a7-5aeebe4e06d4.png',
    flyquest: 'https://images.cybersport.ru/images/team-list-logo/plain/7d/7d55f159-448a-42f5-bd4f-8f66c16cdf31.png',
    cw: 'https://images.cybersport.ru/images/team-list-logo/plain/24/24ed177b-f9b7-4047-b559-e52f4d47fcb4.webp@jpg',
    lvg: 'https://images.cybersport.ru/images/team-list-logo/plain/b0/b0ee4a80-6dc6-493b-8485-b51f42e8a43a.png'
  };

  var TEAM_BY_ID = {};
  TEAMS.forEach(function (t) { TEAM_BY_ID[t.id] = t; });

  // 第一阶段首轮官方对阵 (PGL 2026-11-11 公布, 依据 11-02 VRS 抽签)
  var STAGE1_R1 = [
    ['9z', 'lvg'],
    ['heroic', 'imperial'],
    ['nip', 'm80'],
    ['100t', 'cw'],
    ['parivision', 'dendele'],
    ['liquid', 'bcgame'],
    ['faze', 'wildcard'],
    ['ef', 'flyquest']
  ];

  // 各阶段直接进入(受邀)的战队
  var INVITED = {
    2: ['fut', 'nemiga', 'g2', '1win', 'navi', 'astralis', 'mongolz', 'mibr'],
    3: ['mouz', 'vitality', 'furia', 'aurora', 'spirit', 'betboom', 'falcons', 'legacy']
  };

  var STAGES = {
    1: { name: '第一阶段 · 揭幕', dates: '11.24 – 11.27', bo: 1, boLabel: '全BO1', note: '16队瑞士轮，8队晋级第二阶段' },
    2: { name: '第二阶段 · 淘汰', dates: '11.28 – 12.01', bo: 1, boLabel: '全BO1', note: '8支直邀队 + 8支第一阶段晋级队，8队晋级第三阶段' },
    3: { name: '第三阶段 · 传奇', dates: '12.02 起', bo: 3, boLabel: '全BO3（效仿科隆Major）', note: '8支直邀队 + 8支第二阶段晋级队，8队晋级季后赛' }
  };

  var PLAYOFFS = { name: '季后赛', dates: '12.10 – 12.13', venue: '新加坡室内体育馆', qf: 3, sf: 3, tp: 3, gf: 5, note: '单败淘汰 · 1/4决赛与半决赛BO3 · 三四名BO3 · 总决赛BO5' };

  // 模型配置: Elo S 值由第一阶段首轮盘口(BetBoom)隐含概率拟合
  var CONFIG = {
    S: 620,
    stageMC: 3000,   // 单阶段蒙特卡洛默认次数
    fullMC: 3000,    // 全赛程蒙特卡洛默认次数
    seed: 20261124
  };

  return {
    TEAMS: TEAMS,
    TEAM_BY_ID: TEAM_BY_ID,
    LOGOS: LOGOS,
    STAGE1_R1: STAGE1_R1,
    INVITED: INVITED,
    STAGES: STAGES,
    PLAYOFFS: PLAYOFFS,
    CONFIG: CONFIG,
    REGION_LABEL: { EU: '欧洲', AM: '美洲', AP: '亚太' }
  };
}));

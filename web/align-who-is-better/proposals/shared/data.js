/**
 * PLAN_BATTLE_DATA — coding/token/agent plan 统一事实模型（一期：事实层）
 *
 * 生成日期: 2026-07-17
 * 数据性质: 每条事实标注来源（营销页/文档页/第三方），第三方与推算数据单独标记。
 * 设计原则: 营销话术与文档条款分开存放，永不混写；所有"折算"都显式给出假设。
 */
window.PLAN_BATTLE_DATA = {
  meta: {
    generatedAt: '2026-07-17',
    purpose: '把各家 coding plan 拉到同一基准，剥掉营销外衣，辅助一站式决策',
    disclaimer: '价格与条款随官方调整而变化；本快照仅反映调研当日公开页面。第三方数据与推算均已显式标注。',
  },

  /**
   * 统一度量基准（自定义假设，用于横向可比，非任何官方口径）
   * 1 标准任务轮 = 一次提问 ≈ 15–20 次模型调用（GLM 官方文档口径）
   * token 构成假设: 输入 200K（75% 缓存命中）+ 输出 15K
   */
  standardTask: {
    name: '标准任务轮',
    definition: '一次提问（≈15–20 次模型调用，GLM 官方口径）',
    inputTokens: 200000,
    cacheHitRate: 0.75,
    outputTokens: 15000,
    note: '该 token 构成为本项目自定义假设，仅用于横向折算；不同任务形态会有数倍偏差。',
  },

  vendors: [
    /* ───────────────────────── 小米 MiMo ───────────────────────── */
    {
      id: 'xiaomi-mimo',
      name: 'MiMo Token Plan',
      company: '小米',
      marketingUrl: 'https://platform.xiaomimimo.com/token-plan',
      docsUrl: 'https://mimo.mi.com/docs/zh-CN/tokenplan/Token%20Plan/subscription',
      tiers: [
        { name: 'Lite', monthlyCny: 39, yearlyCny: 411.84, quota: '41亿 Credits/月（年付 492亿/年）' },
        { name: 'Standard', monthlyCny: 99, yearlyCny: 1045.44, quota: '110亿 Credits/月（年付 1320亿/年）' },
        { name: 'Pro', monthlyCny: 329, yearlyCny: 3474.24, quota: '380亿 Credits/月（年付 4560亿/年）' },
        { name: 'Max', monthlyCny: 659, yearlyCny: 6959.04, quota: '820亿 Credits/月（年付 9840亿/年）' },
      ],
      metering: {
        unit: 'Credits（自定义计费中介单位，非 token）',
        poolPeriod: '月付按月给、年付给年总量；到期作废不结转',
        conversionNote: '官方未定义 1 Credit = 多少 token；按模型逐 token 扣 Credits',
        modelRates: [
          { model: 'mimo-v2.5-pro', inputCacheHit: 2.5, inputCacheMiss: 300, output: 600, unit: 'Credits/token' },
          { model: 'mimo-v2.5', inputCacheHit: 2, inputCacheMiss: 100, output: 200, unit: 'Credits/token' },
          { model: 'mimo-v2.5-asr', note: '30M Credits / 音频小时' },
          { model: 'mimo-v2.5-tts 系列', note: '限时免费（截止未公布）' },
        ],
        implicitRate: '对照按量价：1B Credits ≈ ¥10 API 标价（推算）；Standard 年付 ≈ API 标价 7.9 折',
      },
      models: '全档位 6 款一致：v2.5-pro（旗舰）、v2.5（全模态）、asr、tts×3；v2.5-pro-ultraspeed 不在套餐内',
      rateLimits: 'RPM 100 / TPM 10M（API 章节口径，对套餐 Key 适用性未核实）；无日/周用量闸，属总量流量包',
      overage: '额度耗尽即停服，不扣余额；可补差价升级（不可降级）或切按量付费',
      marketing: [
        { claim: '1320亿 Credits 套餐年总量（Standard）', source: '营销页' },
        { claim: '透明、超值、耐用的订阅计划', source: '营销页' },
        { claim: '9.3倍/20倍 Lite 套餐用量', source: '营销页' },
        { claim: '非高峰期 0.8x 系数消耗', source: '营销页+文档页' },
      ],
      fineprint: [
        { clause: '旗舰 v2.5-pro 每输出 token 扣 600 Credits、未命中输入扣 300', source: '文档页' },
        { clause: '套餐内模型并行消耗同一 Credit 池，非独立额度', source: '文档页' },
        { clause: '不支持退款、未用完不退费、到期作废不结转', source: '文档页' },
        { clause: '仅限编程工具使用，禁止自动化脚本/自建后端，违规可封 Key', source: '文档页' },
        { clause: '扣除系数可由官方单方面调整（2026-05 曾"额度升级 5–8 倍并重置已消耗"）', source: '文档页+营销页 FAQ' },
        { clause: 'v2 系列 2026-06-30 整体下线，套餐模型会迭代替换', source: '文档页' },
      ],
      gotchas: [
        { label: '单位混淆', detail: '用 Credits 大数字做营销，1 输出 token 扣 600 Credits，1320亿 实际仅 ≈2.2亿 输出 token/年', severity: 'high' },
        { label: '年付锁定', detail: '不退款、不结转、年总量池', severity: 'high' },
        { label: '条款可变', detail: '额度系数与套餐模型可官方单方调整/下线', severity: 'mid' },
      ],
      computed: {
        assumption: '按标准任务轮（输入200K/75%缓存命中/输出15K）',
        rows: [
          { model: 'mimo-v2.5-pro', costPerRound: '24.38M Credits', monthlyRounds: 'Standard ≈ 451 轮/月' },
          { model: 'mimo-v2.5', costPerRound: '8.30M Credits', monthlyRounds: 'Standard ≈ 1325 轮/月（官方自报≈1600轮，任务口径更小）' },
        ],
        verdict: '1320亿 Credits/年 折算旗舰输出仅 ≈2.2亿 token（月均 ≈1830万），宣传数字与真实含金量差约两个数量级',
      },
      sources: ['platform.xiaomimimo.com/token-plan', 'mimo.mi.com/docs/zh-CN/tokenplan/Token Plan/subscription', 'mimo.mi.com/docs/zh-CN/price/token-plan', 'mimo.mi.com/docs/zh-CN/quick-start/faq/token-plan'],
    },

    /* ───────────────────────── MiniMax ───────────────────────── */
    {
      id: 'minimax',
      name: 'MiniMax Token Plan',
      company: 'MiniMax（稀宇科技）',
      marketingUrl: 'https://platform.minimaxi.com/subscribe/token-plan',
      docsUrl: 'https://platform.minimaxi.com/docs/token-plan/intro',
      tiers: [
        { name: 'Plus', monthlyCny: 49, yearlyCny: 490, quota: '≈6亿+ token/月（M3）' },
        { name: 'Max', monthlyCny: 119, yearlyCny: 1190, quota: '≈18亿+ token/月（M3）' },
        { name: 'Ultra', monthlyCny: 469, yearlyCny: 4690, quota: '≈71亿 token/月（官方迁移文档；早期报道为55亿，两个版本并存）' },
      ],
      metering: {
        unit: 'token 用量额度（2026-06 起从"5h 请求次数制"切换为 Token-Based）',
        poolPeriod: '月度额度 + 5小时窗口 + 周窗口三重闸；不结转',
        conversionNote: '按 API 按量刊例价等值扣减套餐额度（额度≈等值人民币预算）',
        modelRates: [
          { model: 'MiniMax-M3（旗舰）', note: '与 M2.7/M2.7-highspeed 共享同一额度池' },
          { model: '多模态（图像/语音/音乐）', note: '同池扣减；视频生成按档位含日额度（Ultra 5 条/日）' },
        ],
        implicitRate: '积分体系：1000 积分 = ¥7，与刊例价 1:1 等值',
      },
      models: '开放平台全部模型可用：M3（旗舰，1M 上下文）、M2.7 系列、图像/语音/音乐；视频按档位日额度',
      rateLimits: 'RPM/TPM 数值未公开；超限约 1 分钟恢复；工作日 15:00–17:30 高峰动态收紧（Plus 3–4 / Max 4–5 / Ultra 6–7 个 Agent）',
      overage: '积分自动补扣 → 升级套餐 → 切按量付费 → 等 5h/周窗口重置',
      marketing: [
        { claim: '全模态一个订阅，文本+图像+语音+音乐共享额度', source: '营销页' },
        { claim: '单价最低，适合长期高频文本/代码场景', source: '营销页' },
        { claim: '10+ 编程工具已适配（OpenClaw/Claude Code/Cline 等）', source: '营销页' },
      ],
      fineprint: [
        { clause: '5 小时窗口 + 周窗口 + 月度额度三重限制，未用完不结转', source: '文档页' },
        { clause: '工作日 15:00–17:30 高峰期按集群负载动态限流', source: '文档页' },
        { clause: '订阅性质产品不支持退款（但控制台有人工审核退款入口，口径矛盾）', source: '文档页+营销页' },
        { clause: '老用户回馈权益仅在连续订阅周期内有效，改档/退订即放弃', source: '文档页' },
        { clause: '定位个人交互式场景，生产环境建议按量付费；禁止高并发自动化批量任务', source: '文档页' },
      ],
      gotchas: [
        { label: '三重窗口', detail: '月额度之外还有 5h 与周窗口，短期爆发力受限', severity: 'mid' },
        { label: '高峰降速', detail: '工作日午后动态限流，隐性体验折损', severity: 'mid' },
        { label: '数值不公开', detail: 'RPM/TPM 与各窗口 token 上限均未公开', severity: 'mid' },
      ],
      computed: {
        assumption: '第三方估算单次编程调用 ≈50K token（非官方口径）',
        rows: [
          { model: 'MiniMax-M3', costPerRound: '≈50K token', monthlyRounds: 'Plus ≈1.2万轮 / Max ≈3.6万轮 / Ultra ≈14万轮（第三方估算）' },
        ],
        verdict: '唯一直接以 token 计量的厂商，单位最诚实；但窗口与限速数值不透明',
      },
      sources: ['platform.minimaxi.com/subscribe/token-plan', 'platform.minimaxi.com/docs/token-plan/intro', 'platform.minimaxi.com/docs/guides/pricing-token-plan', 'platform.minimaxi.com/docs/token-plan/migration', 'geekpark.net/news/365422（第三方）'],
    },

    /* ───────────────────────── 智谱 GLM ───────────────────────── */
    {
      id: 'zhipu-glm',
      name: 'GLM Coding Plan',
      company: '智谱 AI',
      marketingUrl: 'https://bigmodel.cn/glm-coding?plantype=personal',
      docsUrl: 'https://docs.bigmodel.cn/cn/coding-plan/overview',
      tiers: [
        { name: 'Lite', monthlyCny: 49, yearlyCny: '≈470（年付8折口径，折扣曾变动）', quota: '80 prompts/5h + 400/周' },
        { name: 'Pro', monthlyCny: 149, yearlyCny: '≈1428', quota: '400 prompts/5h + 2000/周' },
        { name: 'Max', monthlyCny: 469, yearlyCny: '≈4502', quota: '1600 prompts/5h + 8000/周' },
      ],
      metering: {
        unit: 'prompts（提问次数；1 prompt ≈ 15–20 次模型调用，官方口径）',
        poolPeriod: '5 小时动态窗口 + 7 天周窗口双闸；无月度总额（月度仅"订阅费 15–30 倍 API 折算"表述）',
        conversionNote: '旗舰模型高峰期 3 倍、非高峰期 2 倍扣额度（GLM-5.2/5-Turbo；高峰=每日14:00–18:00）',
        modelRates: [
          { model: 'GLM-5.2（对标 Claude Opus 级）', note: '高峰 3x / 非高峰 2x 扣额度；2026-09 底前非高峰 1x 限时福利' },
          { model: 'GLM-5-Turbo', note: '同 5.2 倍率规则' },
          { model: 'GLM-4.7（对标 Sonnet 级）', note: '全天 1x' },
        ],
        implicitRate: 'Lite 80 prompts/5h 若全在高峰用 GLM-5.2，实际仅 ≈26 次提问',
      },
      models: '三档清单一致：GLM-5.2 / 5-Turbo / 4.7；差异在额度与并发；GLM-5.1/5 已强制迁移至 5.2',
      rateLimits: '并发数不公开（Max>Pro>Lite）；建议并行项目 Lite 1 / Pro 1–2 / Max 2+；高峰按账户限流（错误码1302/1305）',
      overage: '额度耗尽硬停止，等 5h 窗口恢复；不扣余额、不降级模型；团队版可开超额按量（9折）',
      marketing: [
        { claim: '每月额度相当于订阅费 15–30 倍的 API 用量', source: '营销页（第三方转述）' },
        { claim: 'GLM-5.2 对标 Claude Opus 级模型', source: '文档页' },
        { claim: '20+ 编程工具兼容（Claude Code/Cline/Cursor 等）', source: '文档页' },
      ],
      fineprint: [
        { clause: 'GLM-5.2 高峰期（每日14:00–18:00）按 3 倍扣额度、非高峰 2 倍', source: '文档页' },
        { clause: '非高峰 1 倍抵扣为限时福利，2026-09 底结束，之后恢复 2 倍', source: '文档页' },
        { clause: '每日 10:00 限量放售，可能售罄；续费按当日页面价不锁价', source: '文档页' },
        { clause: '升级/再次购买不叠加时长，旧套餐作废按剩余折算抵价', source: '文档页' },
        { clause: '不退款（usage-notes）；订阅协议另有 7 天冷静期未用可退，两处口径不一', source: '文档页×2' },
        { clause: '仅限官方指定工具；配错 baseurl 会报余额不足并误扣账户余额（高频坑）', source: '文档页' },
      ],
      gotchas: [
        { label: '高峰倍率', detail: '14:00–18:00 三倍扣额度且限流最严，白天重度用户额度腰斩再腰斩', severity: 'high' },
        { label: '福利到期缩水', detail: '9 月底非高峰 1x 福利结束，同等订阅可用量直接减半', severity: 'high' },
        { label: '限售+不锁价', detail: '每日放量可售罄；续费价随页面价浮动', severity: 'mid' },
      ],
      computed: {
        assumption: '按官方 prompt 口径（1 prompt ≈ 15–20 次调用）',
        rows: [
          { model: 'GLM-5.2 非高峰（限时1x）', costPerRound: '1 prompt', monthlyRounds: 'Pro ≈2000 轮/周' },
          { model: 'GLM-5.2 高峰（3x）', costPerRound: '3 prompts', monthlyRounds: 'Pro ≈667 轮/周（同等额度直接三折）' },
        ],
        verdict: 'prompt 计量本身直观，但旗舰模型 2–3 倍系数使"80/400/1600 prompts"的面值严重虚高',
      },
      sources: ['bigmodel.cn/glm-coding（SPA，第三方转述）', 'docs.bigmodel.cn/cn/coding-plan/overview', 'docs.bigmodel.cn/cn/coding-plan/usage-notes', 'docs.bigmodel.cn/cn/terms/subscription-agreement'],
    },

    /* ───────────────────────── Kimi ───────────────────────── */
    {
      id: 'kimi',
      name: 'Kimi Code（会员权益）',
      company: '月之暗面 Moonshot AI',
      marketingUrl: 'https://www.kimi.com/membership/pricing',
      docsUrl: 'https://www.kimi.com/code/docs/',
      tiers: [
        { name: 'Andante', monthlyCny: 49, yearlyCny: '≈468（第三方）', quota: '1× Kimi Code 基准额度' },
        { name: 'Moderato', monthlyCny: 99, yearlyCny: '≈948（第三方）', quota: '4×' },
        { name: 'Allegretto', monthlyCny: 199, yearlyCny: '≈1908（第三方）', quota: '20×' },
        { name: 'Allegro', monthlyCny: 699, yearlyCny: '≈6708（第三方）', quota: '60×' },
      ],
      metering: {
        unit: '百分比计量的统一额度池（只公布档位倍数 1×/4×/20×/60×，不公布绝对数值）',
        poolPeriod: 'Kimi Code 周窗口（7 天刷新）+ 5 小时滚动窗口 + 会员月度共享池三重约束；均不结转',
        conversionNote: '内部按实际 token 消耗扣减；官方仅给相对倍数，绝对量未披露',
        modelRates: [
          { model: 'kimi-for-coding（K2.7 Code，Thinking 常开）', note: '所有付费会员可用；256K 上下文' },
          { model: 'kimi-for-coding-highspeed', note: '速度 5–6 倍、额度消耗约 3 倍；Allegretto 及以上' },
          { model: 'k3（2.8T 旗舰，2026-07-16 发布）', note: 'Moderato 256K / Allegretto+ 最高 1M 上下文' },
        ],
        implicitRate: '加油包锚点：简单请求 ≈¥0.03、复杂多步任务 ≈¥1.6（官方示例，接近 API 刊例价）',
      },
      models: 'k3 / K2.7 Code / 高速版三个固定 ID；填错 ID 静默兜底到普通版（不报错也不加速）',
      rateLimits: '5h 请求 300–1200 次（按档位，仅给区间）；最高并发 30；RPM 未公布；工作日 14:00–17:00 可能 429 过载',
      overage: '进行中任务可完成；加油包（预充值按量）无视一切额度限制无缝兜底；或等刷新/升级',
      marketing: [
        { claim: '一份订阅 = 编程 + 完整 Kimi 会员权益（Agent/PPT/深度研究等）', source: '营销页' },
        { claim: 'Kimi Code 额度 4×/20×/60× 多档提升', source: '营销页+帮助页' },
        { claim: '即将拆分独立 Coding 套餐，取消月度总额度限制', source: '文档页公告' },
      ],
      fineprint: [
        { clause: 'Kimi Code 与聊天端 Agent/PPT 共享月度额度池，网页端玩 Agent 会吃掉编程额度', source: '文档页' },
        { clause: '月度池打满则 Kimi Code 连坐冻结，即使其周额度未用完', source: '文档页' },
        { clause: '高速版输出快 5–6 倍但额度消耗约 3 倍', source: '文档页' },
        { clause: '获赠额度有有效期（7/30 天）过期失效；订阅失效后加油包余额可用但不可再充、一般不可退款', source: '文档页+说明页' },
        { clause: '禁止伪造/篡改客户端 UA，违规可致权益终止（403 Access terminated）', source: '文档页' },
      ],
      gotchas: [
        { label: '额度黑箱', detail: '只给 1×/4×/20×/60× 相对倍数，绝对 token 量官方从未公布', severity: 'high' },
        { label: '共享池连坐', detail: '编程额度与娱乐型 Agent/PPT 共用月池，互相挤占', severity: 'high' },
        { label: '高速版倍耗', detail: '5–6 倍速度背后约 3 倍消耗，"快"是有价的', severity: 'mid' },
      ],
      computed: {
        assumption: '第三方实测（k2.5 时代）：Andante(1×) ≈639 次/周',
        rows: [
          { model: 'K2.7 Code', costPerRound: '未公开', monthlyRounds: 'Moderato(4×) ≈2500 次/周（第三方实测推算，非官方）' },
        ],
        verdict: '权益捆绑最丰富，但额度绝对值最不透明；"倍数"无法跨厂对齐，只能按第三方实测锚定',
      },
      sources: ['kimi.com/membership/pricing（SPA）', 'kimi.com/zh-cn/help/membership/membership-pricing', 'kimi.com/code/docs/kimi-code/membership.html', 'kimi.com/membership-credits', 'github.com/mahonzhan/awesome-coding-plan（第三方实测）'],
    },
  ],

  /* ─────────── 跨厂陷阱模式图鉴（以反模式为纲的归纳） ─────────── */
  gotchaPatterns: [
    {
      id: 'unit-confusion', name: '单位混淆', icon: '🎭',
      desc: '用自定义大数字单位替代 token，面值与实际含金量差数量级',
      instances: [
        { vendor: '小米', detail: '1320亿 Credits 营销，旗舰输出 600 Credits/token，实际 ≈2.2亿 token/年' },
        { vendor: 'Kimi', detail: '百分比池只给倍数，绝对值不可考' },
      ],
    },
    {
      id: 'peak-penalty', name: '高峰惩罚', icon: '⏰',
      desc: '白天高峰时段加倍扣额度或动态限流，同等订阅白天价值缩水',
      instances: [
        { vendor: '智谱', detail: '14:00–18:00 旗舰 3 倍扣额度 + 限流最严' },
        { vendor: 'MiniMax', detail: '工作日 15:00–17:30 动态限流' },
        { vendor: '小米', detail: '反向操作：夜间 0.8x 奖励（少数派良心）' },
      ],
    },
    {
      id: 'shared-pool', name: '共享池连坐', icon: '🕳️',
      desc: '编程额度与其他功能共用一个池，互相挤占',
      instances: [
        { vendor: 'Kimi', detail: '与 Agent/PPT/深度研究共享月池，月满连坐冻结' },
        { vendor: '小米', detail: '6 款模型并行消耗同一 Credit 池' },
      ],
    },
    {
      id: 'no-refund', name: '不退款不结转', icon: '🔒',
      desc: '订阅即确认、额度到期清零，沉没成本锁定',
      instances: [
        { vendor: '全员', detail: '小米/智谱/MiniMax 明示不退款；GLM 另有 7 天冷静期但口径矛盾' },
      ],
    },
    {
      id: 'forced-migration', name: '强制迁移', icon: '🔄',
      desc: '套餐内模型/系数可由官方单方面下线或调整',
      instances: [
        { vendor: '智谱', detail: 'GLM-5.1/5 自动切到 5.2；9 月底 1x 福利到期恢复 2x' },
        { vendor: '小米', detail: 'v2 全系 2026-06-30 下线；系数曾单方调整（5–8倍重置）' },
        { vendor: 'Kimi', detail: '即将拆分独立套餐，现行规则将整体变化' },
      ],
    },
    {
      id: 'scarcity', name: '限售与价格浮动', icon: '🎣',
      desc: '每日放量售罄、续费不锁价、首购价仅首周期',
      instances: [
        { vendor: '智谱', detail: '每日 10:00 放量；续费按当日页面价' },
        { vendor: 'MiniMax', detail: '邀请 9 折仅首周期，下周期原价' },
      ],
    },
    {
      id: 'speed-tax', name: '速度税', icon: '💸',
      desc: '更快的版本消耗加倍，"快"从额度里扣回来',
      instances: [
        { vendor: 'Kimi', detail: '高速版 5–6 倍速度 ≈3 倍消耗' },
        { vendor: '小米', detail: 'ultraspeed 版干脆不含在套餐内需另付费' },
      ],
    },
  ],
};

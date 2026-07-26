import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
  outDir: 'output',
  vite: () => ({
    build: {
      // Use Terser instead of the default Rolldown/esbuild minifier. The
      // default minifier reused a mangled identifier (`A`) for both a
      // top-level constant (SALE_TIME_DEFAULT) and a helper function in the
      // same scope, silently corrupting runtime semantics.
      minify: 'terser',
      terserOptions: {
        mangle: {
          // Keep function/class names to avoid collisions with mangled
          // top-level constants imported from other modules.
          keep_fnames: true,
        },
      },
    },
  }),
  manifest: {
    name: '智能Coding Plan助手',
    description: '智能 Coding Plan 助手：多平台套餐秒杀（智谱 / 火山引擎 / 阿里百炼 / 百度千帆）+ 买家秀 UGC + AI 新闻 + Token 用量监控',
    permissions: ['storage', 'tabs', 'scripting', 'alarms', 'notifications', 'cookies', 'declarativeNetRequest'],
    host_permissions: [
      '*://*.bigmodel.cn/*',
      '*://*.volcengine.com/*',
      '*://*.aliyun.com/*',
      '*://*.bce.baidu.com/*',
      '*://*.minimaxi.com/*',
      '*://*.kimi.com/*',
      '*://*.xiaomimimo.com/*',
      '*://rocke1001feller.github.io/*',
      // ai-news 国内反代镜像（github.io 不可达时回退）
      'https://xiaocha.online/*',
      // ai-news 现行反代(根路径子域名,回退链第二级)
      'https://ai-news.poorhub.store/*',
      // 买家秀 iframe(public/buyer-show/)只读拉取 any-comments 聚合数据
      'https://any-comments-worker.poorhub.workers.dev/*',
      // any-comments 国内反代（vendored popup 的 CN 构建 + 现场层 field.js 读写都走这里）
      'https://ac-api.xiaocha.online/*',
      // 迁址后的现行反代域(见 any-comments example-showcase/domain-migration.md)
      'https://ac-api.poorhub.store/*',
    ],
    content_scripts: [
      {
        // 买家秀现场层:vendor 自 any-comments example-showcase/dist-ext/field.js(CN 构建),
        // 营销页 + 文档站全站内嵌评分/标签/评论覆盖层,数据同入 ac-coding-plan 项目
        matches: [
          '*://platform.xiaomimimo.com/token-plan*',
          '*://mimo.mi.com/docs/*',
          '*://platform.minimaxi.com/subscribe/token-plan*',
          '*://platform.minimaxi.com/docs/*',
          '*://bigmodel.cn/glm-coding*',
          '*://docs.bigmodel.cn/cn/*',
          '*://www.kimi.com/membership/pricing*',
          '*://www.kimi.com/code/docs/*',
        ],
        js: ['buyer-show/field.js'],
        run_at: 'document_idle',
      },
    ],
    web_accessible_resources: [
      {
        resources: ['bm-early.js', 'bm-main.js'],
        matches: ['*://*.bigmodel.cn/*'],
      },
      {
        resources: ['volc-main.js'],
        matches: ['*://*.volcengine.com/*'],
      },
      {
        resources: ['ali-main.js'],
        matches: ['*://*.aliyun.com/*'],
      },
      {
        resources: ['bce-main.js'],
        matches: ['*://*.bce.baidu.com/*'],
      },
    ],
  },
});

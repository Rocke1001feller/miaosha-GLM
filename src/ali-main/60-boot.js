// Startup orchestration — concatenated last, runs after all modules load.
(async function ali_boot() {
  try {
    ali_buildOverlay();
    ali_log('百炼秒杀 overlay v' + ALI_VERSION + ' 已注入');
    aliState.tokens = await ali_waitTokens(ALI_CONFIG.tokenReadyRetries, ALI_CONFIG.tokenReadyDelayMs);
    if (!aliState.tokens.umidToken) {
      ali_log('[BOOT] 风控令牌未就绪（getUmidToken 缺失），开火可能失败；请刷新页面');
    }
    await ali_syncClock();
    ali_checkLogin();
    ali_pollTick();
  } catch (e) {
    try {
      ali_log('[BOOT_FAIL] ' + ((e && e.message) || e));
    } catch (ignored) {}
  }
})();

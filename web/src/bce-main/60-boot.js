// Startup orchestration — concatenated last, runs after all modules load.
(async function bce_boot() {
  try {
    bce_buildOverlay();
    bce_log('千帆 Token Plan 秒杀 overlay v' + BCE_VERSION + ' 已注入');
    bce_uiLogin(bce_readLoginName());
    bce_pollTick();
  } catch (e) {
    try {
      bce_log('[BOOT_FAIL] ' + ((e && e.message) || e));
    } catch (ignored) {}
  }
})();

// Stock polling loop + phase state machine.
// Phases: INIT -> SOLD_OUT -> ARMED -> (FIRING | IN_STOCK) -> SUCCESS | FAIL
var aliState = {
  phase: 'INIT',
  autoFire: true,
  autoRenew: false,
  restockTs: null,
  attempts: 0,
  tokens: { umidToken: '', collina: '' },
  pollTimer: 0,
  fireTimer: 0,
};

var aliLogs = [];

function ali_log(line) {
  aliLogs.push(line);
  if (aliLogs.length > 50) aliLogs.shift();
  if (typeof ali_uiLog === 'function') ali_uiLog(line);
}

function ali_setPhase(phase) {
  if (aliState.phase === phase) return;
  aliState.phase = phase;
  if (typeof ali_uiSetPhase === 'function') ali_uiSetPhase(phase);
}

// PURE: next phase given current phase, inventory, server now and lead window.
function ali_nextPhase(phase, inv, serverNow, leadMs) {
  if (phase === 'FIRING' || phase === 'SUCCESS' || phase === 'FAIL') return phase;
  if (inv.inStock) return 'IN_STOCK';
  if (inv.restockTs && inv.restockTs - serverNow <= leadMs) return 'ARMED';
  return 'SOLD_OUT';
}

function ali_schedulePoll(ms) {
  clearTimeout(aliState.pollTimer);
  aliState.pollTimer = setTimeout(ali_pollTick, ms);
}

async function ali_pollTick() {
  if (aliState.phase === 'FIRING' || aliState.phase === 'SUCCESS' || aliState.phase === 'FAIL') return;
  var inv;
  try {
    inv = await ali_checkInventory(aliState.autoRenew, aliState.tokens);
  } catch (e) {
    ali_log('[STOCK_FAIL] ' + ((e && e.message) || e));
    ali_schedulePoll(ALI_CONFIG.idlePollMs);
    return;
  }
  if (inv.restockTs) aliState.restockTs = inv.restockTs;
  var next = ali_nextPhase(aliState.phase, inv, ali_serverNow(), ALI_CONFIG.armedLeadMs);
  ali_setPhase(next);
  if (next === 'SOLD_OUT') {
    ali_schedulePoll(ALI_CONFIG.idlePollMs);
  } else if (next === 'ARMED') {
    ali_schedulePoll(ALI_CONFIG.armedPollMs);
    ali_armFireTimer();
  } else if (next === 'IN_STOCK') {
    if (aliState.autoFire) ali_startFire('stock');
    else ali_log('检测到库存！（自动开火已关闭，请手动点击「立即开火」）');
  }
}

// Schedule the T-0 fire from the server-anchored restock timestamp.
function ali_armFireTimer() {
  if (aliState.fireTimer || !aliState.restockTs) return;
  var delay = Math.max(0, aliState.restockTs - ali_serverNow());
  aliState.fireTimer = setTimeout(function () {
    aliState.fireTimer = 0;
    if (aliState.autoFire && (aliState.phase === 'ARMED' || aliState.phase === 'SOLD_OUT')) {
      ali_startFire('timer');
    }
  }, delay);
}

function ali_stopFire() {
  if (aliState.phase !== 'FIRING') return;
  aliState.autoFire = false;
  var chk = document.getElementById('__ali_autofire');
  if (chk) chk.checked = false;
  ali_log('已手动停止（第 ' + aliState.attempts + ' 发后），自动开火已关闭');
  ali_setPhase('SOLD_OUT');
  ali_schedulePoll(ALI_CONFIG.idlePollMs);
}

// Stock polling loop + phase state machine.
// Phases: INIT -> SOLD_OUT -> ARMED -> (IN_STOCK | FIRING) -> SUCCESS | FAIL
var bceState = {
  phase: 'INIT',
  autoFire: true,
  autoRenew: false,
  selected: BCE_CONFIG.defaultSelected.slice(),
  pollTimer: 0,
  attempts: 0,
  armedStartMs: 0,
  saleTimes: ['10:00'],
  lastStock: null,
};

var bceLogs = [];

function bce_log(line) {
  bceLogs.push(line);
  if (bceLogs.length > 50) bceLogs.shift();
  if (typeof bce_uiLog === 'function') bce_uiLog(line);
}

function bce_setPhase(phase) {
  if (bceState.phase === phase) return;
  bceState.phase = phase;
  if (typeof bce_uiSetPhase === 'function') bce_uiSetPhase(phase);
}

// PURE: next phase given current phase, selected-stock flag, armed-window flag.
function bce_nextPhase(phase, anyInStock, armedNow) {
  if (phase === 'FIRING' || phase === 'SUCCESS' || phase === 'FAIL') return phase;
  if (anyInStock) return 'IN_STOCK';
  if (armedNow) return 'ARMED';
  return 'SOLD_OUT';
}

function bce_schedulePoll(ms) {
  clearTimeout(bceState.pollTimer);
  bceState.pollTimer = setTimeout(bce_pollTick, ms);
}

async function bce_pollTick() {
  if (bceState.phase === 'FIRING' || bceState.phase === 'SUCCESS' || bceState.phase === 'FAIL') return;
  var stock;
  try {
    stock = await bce_checkStock();
  } catch (e) {
    bce_log('[STOCK_FAIL] ' + ((e && e.message) || e));
    bce_schedulePoll(BCE_CONFIG.idlePollMs);
    return;
  }
  bceState.lastStock = stock;
  if (stock.ok && stock.times.length) {
    bceState.saleTimes = stock.times;
    bceState.armedStartMs = bce_nextArmedMs(stock.times, Date.now(), BCE_CONFIG.armedLeadMs);
  }
  if (typeof bce_uiStock === 'function') bce_uiStock(stock.available);
  var anyInStock = bceState.selected.some(function (p) {
    return stock.available[p] === true;
  });
  var armedNow = bceState.armedStartMs > 0 && Date.now() >= bceState.armedStartMs;
  var next = bce_nextPhase(bceState.phase, anyInStock, armedNow);
  bce_setPhase(next);
  if (next === 'SOLD_OUT') {
    bce_schedulePoll(BCE_CONFIG.idlePollMs);
  } else if (next === 'ARMED') {
    bce_schedulePoll(BCE_CONFIG.armedPollMs);
  } else if (next === 'IN_STOCK') {
    if (bceState.autoFire) bce_startFire('stock');
    else bce_log('检测到库存！（自动开火已关闭，请手动点击「开始刷新库存」）');
  }
}

function bce_stopFire() {
  if (bceState.phase !== 'FIRING') return;
  bceState.autoFire = false;
  var chk = document.getElementById('__bce_autofire');
  if (chk) chk.checked = false;
  bce_log('已手动停止（第 ' + bceState.attempts + ' 发后），自动开火已关闭');
  bce_setPhase('SOLD_OUT');
  bce_schedulePoll(BCE_CONFIG.idlePollMs);
}

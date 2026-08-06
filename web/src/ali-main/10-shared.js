// Mechanical helpers shared by the Bailian MAIN-world overlay.

function ali_postCmd(type, data) {
  var envelope = { __ali_cmd: true, type: type };
  if (data && typeof data === 'object') {
    for (var key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) envelope[key] = data[key];
    }
  }
  window.postMessage(envelope, '*');
}

function ali_getCookies() {
  return document.cookie.split(';').reduce(function (acc, c) {
    var parts = c.trim().split('=');
    acc[parts[0]] = parts.slice(1).join('=');
    return acc;
  }, {});
}

function ali_getCna() {
  return ali_getCookies()['cna'] || '';
}

// Server-clock sync. buy-api responses do not expose a Date header through
// CORS, so the anchor comes from the same-origin page document instead.
var aliClock = { offsetMs: 0, synced: false };

async function ali_syncClock() {
  try {
    var t0 = Date.now();
    var res = await fetch(location.origin + '/coding-plan', {
      method: 'HEAD',
      credentials: 'omit',
      cache: 'no-store',
    });
    var t1 = Date.now();
    var dateHdr = res.headers.get('date');
    if (!dateHdr) return false;
    var serverMs = new Date(dateHdr).getTime();
    if (!isFinite(serverMs)) return false;
    aliClock.offsetMs = serverMs - Math.round((t0 + t1) / 2);
    aliClock.synced = true;
    return true;
  } catch (e) {
    return false;
  }
}

function ali_serverNow() {
  return Date.now() + aliClock.offsetMs;
}

// Page-bundle compatible linkage: charCode-hex of
// JSON.stringify({itemId:[commodityCode]}) (the site's own ue/de/le chain).
function ali_linkage(commodityCode) {
  var s = JSON.stringify({ itemId: [commodityCode] });
  var out = '';
  for (var i = 0; i < s.length; i++) out += s.charCodeAt(i).toString(16);
  return out;
}

function ali_playBeeps(count) {
  for (var i = 0; i < count; i++) setTimeout(ali_playBeep, i * 350);
}

function ali_playBeep() {
  try {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    var audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') {
      audioCtx.close();
      return;
    }
    var buf = audioCtx.createBuffer(1, 44100, 44100);
    var data = buf.getChannelData(0);
    for (var i = 0; i < data.length; i++) {
      data[i] = Math.sin((2 * Math.PI * 880 * i) / 44100) * 0.25;
    }
    var src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start();
    setTimeout(function () {
      src.stop();
      audioCtx.close();
    }, 200);
  } catch (e) {}
}

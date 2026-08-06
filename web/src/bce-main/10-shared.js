// Mechanical helpers shared by the Qianfan Token Plan MAIN-world overlay.

function bce_postCmd(type, data) {
  var envelope = { __bce_cmd: true, type: type };
  if (data && typeof data === 'object') {
    for (var key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) envelope[key] = data[key];
    }
  }
  window.postMessage(envelope, '*');
}

function bce_getCookies() {
  return document.cookie.split(';').reduce(function (acc, c) {
    var parts = c.trim().split('=');
    acc[parts[0]] = parts.slice(1).join('=');
    return acc;
  }, {});
}

// csrftoken header value = bce-user-info cookie (URL-decoded, quotes stripped).
// The cookie rotates, so read it fresh before every write request.
function bce_readCsrf() {
  var m = document.cookie.match(/bce-user-info=([^;]+)/);
  if (!m) return '';
  var raw = m[1];
  try {
    raw = decodeURIComponent(raw);
  } catch (e) {}
  return raw.replace(/"/g, '');
}

// PURE: next armed-window start (leadMs before the next daily sale time).
// Returns a timestamp that may be in the past (window already open).
// After a 30-minute grace past the sale time, rolls to the next day.
function bce_nextArmedMs(times, now, leadMs) {
  var t = (times && times[0]) || '10:00';
  var parts = String(t).split(':');
  var h = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  if (!isFinite(h)) h = 10;
  if (!isFinite(m)) m = 0;
  var d = new Date(now);
  d.setHours(h, m, 0, 0);
  var GRACE_MS = 30 * 60000;
  var start = d.getTime() - leadMs;
  if (now >= d.getTime() + GRACE_MS) {
    d.setDate(d.getDate() + 1);
    start = d.getTime() - leadMs;
  }
  return start;
}

function bce_playBeeps(count) {
  for (var i = 0; i < count; i++) setTimeout(bce_playBeep, i * 350);
}

function bce_playBeep() {
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

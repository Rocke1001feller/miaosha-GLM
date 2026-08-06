var O = '__bm_overlay';
var CSS =
  '#'+O+'{position:fixed;top:72px;left:20px;width:300px;background:rgba(255,255,255,0.97);backdrop-filter:blur(12px);border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.15);z-index:99999;font-family:Inter,system-ui,sans-serif;color:#1e293b;max-height:calc(100vh - 92px);overflow-y:auto}' +
  '#'+O+'::-webkit-scrollbar{width:3px}#'+O+'::-webkit-scrollbar-thumb{background:rgba(99,102,241,0.2);border-radius:99px}' +
  '#'+O+' .h{padding:10px 14px;background:rgba(99,102,241,0.05);border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:6px;cursor:move;position:sticky;top:0;z-index:1}' +
  '#'+O+' .h h3{font-size:12px;font-weight:800;flex:1;margin:0}' +
  '#'+O+' .h .ver{font-size:8px;font-weight:800;color:#6366f1;background:rgba(99,102,241,.1);padding:1px 6px;border-radius:999px;border:1px solid rgba(99,102,241,.2);margin-right:4px}' +
  '#'+O+' .mn{width:18px;height:18px;border-radius:50%;border:0;background:#e2e8f0;cursor:pointer;font-size:9px;display:grid;place-items:center;color:#475569}' +
  '#'+O+' .opts{width:18px;height:18px;border-radius:50%;border:0;background:transparent;cursor:pointer;font-size:11px;display:grid;place-items:center;color:#94a3b8;margin-left:auto;margin-right:4px;transition:all .15s}' +
  '#'+O+' .opts:hover{color:#6366f1;background:rgba(99,102,241,0.08)}' +
  '#'+O+' .b{padding:10px 12px}' +
  // Cards
  '#'+O+' .c{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-bottom:8px}' +
  '#'+O+' .ch{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}' +
  '#'+O+' .ct{font-size:11px;font-weight:700;display:flex;align-items:center;gap:5px}' +
  '#'+O+' .tg{font-size:7px;font-weight:800;padding:2px 5px;border-radius:3px;text-transform:uppercase;letter-spacing:.05em}' +
  '#'+O+' .tg-a{background:#fffbeb;color:#d97706;border:1px solid #fde68a}' +
  '#'+O+' .tg-r{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}' +
  '#'+O+' .tg-g{background:#f0fdf4;color:#059669;border:1px solid #a7f3d0}' +
  // Prep
  '#'+O+' .pg{display:grid;grid-template-columns:1fr 1fr;gap:4px}' +
  '#'+O+' .pc{padding:6px 8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;display:flex;align-items:center;gap:5px}' +
  '#'+O+' .pd{width:6px;height:6px;border-radius:50%;flex-shrink:0}' +
  '#'+O+' .pd.ok{background:#10b981}#'+O+' .pd.w{background:#f59e0b}' +
  '#'+O+' .pn{font-size:9px;font-weight:600;color:#475569}' +
  '#'+O+' .pb{font-size:8px;font-weight:700;color:#6366f1;font-family:monospace}' +
  // Pool
  // Pool meter
  '#'+O+' .pl-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}' +
  '#'+O+' .pl-l{font-size:9px;font-weight:700;color:#475569}' +
  '#'+O+' .pl-c{font-size:9px;font-weight:800;color:#6366f1;font-family:monospace}' +
  '#'+O+' .pm{display:grid;grid-template-columns:repeat(20,1fr);gap:2px;height:10px;margin:6px 0}' +
  '#'+O+' .pm div{height:100%;border-radius:2px;background:#e2e8f0;transition:all .2s}' +
  '#'+O+' .pm div.on{background:linear-gradient(180deg,#34d399,#10b981);box-shadow:0 0 5px rgba(16,185,129,0.35)}' +
  '#'+O+' .ps{font-size:8px;font-weight:600;text-align:center;padding:2px 0;min-height:14px;color:#64748b}' +
  '#'+O+' .ps-low{color:#d97706}' +
  '#'+O+' .ps-mid{color:#6366f1}' +
  '#'+O+' .ps-high{color:#059669}' +
  '@keyframes pmp{0%{opacity:.7}50%{opacity:1}100%{opacity:.7}}' +
  '@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}' +
  '#'+O+' .pm div.on:last-child{animation:pmp 1.6s ease-in-out infinite}' +
  '#'+O+' .ab{width:100%;padding:6px;border:1.5px dashed #6366f1;border-radius:6px;background:rgba(99,102,241,0.03);color:#6366f1;font-family:inherit;font-weight:700;font-size:9px;cursor:pointer;transition:all .15s}' +
  '#'+O+' .ab:hover{background:rgba(99,102,241,0.08);border-style:solid}' +
  '#'+O+' .ab:disabled{opacity:.4;cursor:not-allowed}' +
  // Fire
  '#'+O+' .fm{display:flex;gap:3px;margin:6px 0}' +
  '#'+O+' .fp{flex:1;height:5px;border-radius:3px;background:#e2e8f0}' +
  '#'+O+' .fp.on{background:#f43f5e}' +
  '#'+O+' #_fireCfg{margin:6px 0;display:flex;flex-direction:column;gap:5px}' +
  '#'+O+' .fb{width:100%;padding:8px;border:0;border-radius:10px;background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;font-family:inherit;font-weight:800;font-size:11px;cursor:pointer;transition:all .15s}' +
  '#'+O+' .fb:hover{transform:translateY(-1px)}#'+O+' .fb:disabled{opacity:.35;cursor:not-allowed;transform:none}' +
  '#'+O+' .fbb{width:100%;padding:6px;border:0;border-radius:10px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-family:inherit;font-weight:800;font-size:10px;cursor:pointer;transition:all .15s;margin-top:5px}' +
  '#'+O+' .fbb:hover{transform:translateY(-1px)}#'+O+' .fbb:disabled{opacity:.35;cursor:not-allowed;transform:none}' +
  // Product selector
  '#'+O+' .pr-bill{display:flex;gap:3px;margin-bottom:6px}' +
  '#'+O+' .pr-bl{flex:1;text-align:center;padding:4px;border:1px solid #e2e8f0;border-radius:5px;font-size:7px;color:#94a3b8;cursor:pointer;transition:all .15s;font-family:inherit;background:0}' +
  '#'+O+' .pr-bl.on{border-color:#6366f1;color:#6366f1;font-weight:700;background:rgba(99,102,241,0.04)}' +
  '#'+O+' .pr-t{border:1.5px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:4px;transition:all .15s}' +
  '#'+O+' .pr-t.on{border-color:#6366f1}' +
  '#'+O+' .pr-th{display:flex;align-items:center;gap:6px;padding:6px 8px;cursor:pointer;transition:background .15s}' +
  '#'+O+' .pr-th:hover{background:#f8fafc}' +
  '#'+O+' .pr-t.on .pr-th{background:rgba(99,102,241,0.04)}' +
  '#'+O+' .pr-td{width:10px;height:10px;border-radius:50%;border:1.5px solid #cbd5e1;flex-shrink:0;transition:all .15s;display:flex;align-items:center;justify-content:center;font-size:6px;color:transparent}' +
  '#'+O+' .pr-t.on .pr-td{border-color:#6366f1;background:#6366f1;color:#fff}' +
  '#'+O+' .pr-tn{font-size:10px;font-weight:700;flex:1}' +
  '#'+O+' .pr-tp{font-size:9px;font-family:monospace;color:#94a3b8}' +
  '#'+O+' .pr-tp b{color:#dc2626;font-weight:800}' +
  '#'+O+' .pr-ts{font-size:6px;font-weight:700;padding:1px 4px;border-radius:3px}' +
  '#'+O+' .pr-ts.ok{background:#f0fdf4;color:#059669}' +
  '#'+O+' .pr-ts.warn{background:#fef3c7;color:#d97706}' +
  '#'+O+' .pr-ti{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:0 8px 6px}' +
  '#'+O+' .pr-ti div{font-size:7px;color:#64748b;line-height:1.35}' +
  '#'+O+' .pr-ti b{display:block;font-size:8px;color:#334155;font-weight:700;font-family:monospace}' +
  '#'+O+' .pr-tb{display:none;padding:0 8px 6px;font-size:8px;color:#64748b;line-height:1.4}' +
  '#'+O+' .pr-sel{font-size:8px;color:#94a3b8;margin-top:4px}' +
  '#'+O+' .pr-sel b{color:#6366f1;font-weight:800}' +
  '#'+O+' .pr-rk{font-size:6px;font-weight:800;padding:1px 4px;border-radius:3px;background:#6366f1;color:#fff;margin-left:4px;vertical-align:middle}' +
  // Priority Config
  '#'+O+' .cfg-b{display:flex;flex-direction:column;gap:5px}' +
  '#'+O+' .cfg-sl{display:flex;align-items:center;gap:6px;padding:5px 6px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;transition:all .15s}' +
  '#'+O+' .cfg-sl.on{border-color:#6366f1;background:rgba(99,102,241,0.04)}' +
  '#'+O+' .cfg-rk{width:16px;height:16px;border-radius:50%;border:1.5px solid #cbd5e1;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;color:#94a3b8;flex-shrink:0}' +
  '#'+O+' .cfg-n{font-size:9px;font-weight:700;flex:1;display:flex;flex-direction:column;gap:1px}' +
  '#'+O+' .cfg-p{font-size:7px;font-weight:600;color:#94a3b8}' +
  '#'+O+' .cfg-val{font-size:7px;font-weight:700;padding:3px 6px;border-radius:4px;text-align:center}' +
  '#'+O+' .cfg-val.ok{background:#f0fdf4;color:#059669}' +
  '#'+O+' .cfg-val.err{background:#fef2f2;color:#dc2626}' +
  '#'+O+' .cfg-rk1{background:#dc2626;color:#fff;border-color:#dc2626}' +
  '#'+O+' .cfg-rk2{background:#f59e0b;color:#fff;border-color:#f59e0b}' +
  '#'+O+' .cfg-rk3{background:#64748b;color:#fff;border-color:#64748b}' +
  '#'+O+' .fc-row{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:4px 0}' +
  '#'+O+' .fc-lbl{font-size:8px;font-weight:700;color:#475569}' +
  '#'+O+' .fc-sel{font-size:8px;padding:3px 5px;border:1px solid #e2e8f0;border-radius:5px;background:#fff;color:#334155;font-family:inherit}' +
  '#'+O+' .fc-num{width:40px;text-align:center;font-size:8px;padding:3px 5px;border:1px solid #e2e8f0;border-radius:5px;background:#fff;color:#334155;font-family:monospace}' +
  '#'+O+' .fc-tip{display:inline-grid;place-items:center;width:12px;height:12px;border-radius:50%;background:#e2e8f0;color:#475569;font-size:8px;font-weight:800;cursor:help;margin-left:3px;vertical-align:middle;transition:all .15s}' +
  '#'+O+' .fc-tip:hover{background:#6366f1;color:#fff}' +
  // Rich tooltips for overlay (same fast fade as header; open upward to avoid clipping by overflow-y)
  '#'+O+' [data-tip]{position:relative}' +
  '#'+O+' [data-tip]::after{'+
  'content:attr(data-tip);'+
  'position:absolute;bottom:calc(100% + 5px);left:0;'+
  'z-index:100001;'+
  'min-width:180px;max-width:280px;'+
  'padding:8px 10px;'+
  'background:rgba(15,23,42,.95);'+
  'color:#f8fafc;border-radius:8px;'+
  'font-size:10px;font-weight:500;line-height:1.45;'+
  'font-family:Inter,system-ui,sans-serif;'+
  'white-space:pre-line;word-break:break-word;'+
  'box-shadow:0 4px 12px rgba(0,0,0,.2);'+
  'pointer-events:none;opacity:0;visibility:hidden;'+
  'transition:opacity .12s ease,visibility .12s ease'+
  '}' +
  '#'+O+' [data-tip]:hover::after{opacity:1;visibility:visible}' +
  '#'+O+' [data-tip]::before{'+
  'content:"";position:absolute;bottom:calc(100% + 1px);left:10px;'+
  'border:4px solid transparent;border-top-color:rgba(15,23,42,.95);'+
  'pointer-events:none;opacity:0;visibility:hidden;'+
  'transition:opacity .12s ease,visibility .12s ease'+
  '}' +
  '#'+O+' [data-tip]:hover::before{opacity:1;visibility:visible}';

/* companion-friend.js — Direction 4 "Modular Friend": detailed buildable companion.
   Reuses window.CompanionSVG for front/side/back/mini/face; adds dimensions,
   internal zoning, and exploded-assembly builders, then renders the page. */
(function () {
  const S = window.CompanionSVG;
  S.injectDefs();

  const geo = {
    name: 'Modular Friend', bodyW: 170, bodyH: 160, bodyTop: 90, bodyRX: 52,
    earW: 32, earH: 80, earGapInner: 34, earTilt: 7, earStyle: 'capsule',
    screenScale: 1.02, faceType: 'calm', base: 'feet', vh: 300,
  };

  const rr = (x, y, w, h, r, a = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" ${a}/>`;
  const lic = (p, sz = 16, sw = 2) => `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  // ---- hero front with a small breathing front-status glow ----
  function heroFront() {
    const gy = geo.bodyTop + geo.bodyH - 30;
    const glow = `<ellipse cx="130" cy="${gy}" rx="22" ry="6.5" fill="var(--sage)" filter="url(#softGlow)" opacity=".5"><animate attributeName="opacity" values="0.22;0.7;0.22" dur="4.2s" repeatCount="indefinite"/></ellipse>`;
    return S.front(geo).replace('</svg>', glow + '</svg>');
  }

  // ---- dimensioned technical front ----
  function dimDrawing() {
    const cx = 150, bw = geo.bodyW, bh = geo.bodyH, by = geo.bodyTop, bx = cx - bw / 2;
    const baseY = by + 8, earTop = baseY - geo.earH;
    const footBottom = by + bh + 9;
    const ew = geo.earW, lx = cx - geo.earGapInner / 2 - ew, rx = cx + geo.earGapInner / 2;
    const sw = bw * 0.64 * geo.screenScale, sh = bh * 0.6 * geo.screenScale, sx = cx - sw / 2, sy = by + bh * 0.17;
    const out = 'fill="none" stroke="var(--edge)" stroke-width="2"';
    const ear = (x, rot) => `<g transform="rotate(${rot} ${x + ew / 2} ${baseY})">${rr(x, earTop, ew, geo.earH, ew / 2, out)}</g>`;
    const txt = (x, y, t, anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="11.5" font-weight="700" fill="var(--sage-deep)" font-family="var(--font-body)">${t}</text>`;
    const tick = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--sage)" stroke-width="1.3"/>`;
    const dimV = (x, y1, y2, label, lx2) => `${tick(x - 4, y1, x + 4, y1)}${tick(x - 4, y2, x + 4, y2)}<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="var(--sage)" stroke-width="1.3"/>${txt(lx2 ?? (x + 8), (y1 + y2) / 2 + 4, label, 'start')}`;
    const dimH = (y, x1, x2, label) => `${tick(x1, y - 4, x1, y + 4)}${tick(x2, y - 4, x2, y + 4)}<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="var(--sage)" stroke-width="1.3"/><rect x="${(x1 + x2) / 2 - 30}" y="${y - 9}" width="60" height="18" fill="var(--surface)"/>${txt((x1 + x2) / 2, y + 4, label)}`;
    return `<svg viewBox="0 0 320 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Dimensioned front view">
      ${ear(lx, -geo.earTilt)}${ear(rx, geo.earTilt)}
      ${rr(bx, by, bw, bh, geo.bodyRX, out)}
      ${rr(sx, sy, sw, sh, Math.min(sw, sh) * 0.26, 'fill="none" stroke="var(--sage)" stroke-width="1.6"')}
      ${rr(bx + bw * 0.12, by + bh - 6, bw * 0.2, 15, 7, out)}${rr(bx + bw - bw * 0.12 - bw * 0.2, by + bh - 6, bw * 0.2, 15, 7, out)}
      <!-- dims -->
      ${dimV(bx + bw + 30, earTop, footBottom, '≈135', bx + bw + 36)}
      ${dimV(bx + bw + 8, by, by + bh, '≈90', bx + bw + 14)}
      ${dimV(lx - 14, earTop, baseY, '45', lx - 44)}
      ${dimH(footBottom + 16, bx, bx + bw, '≈95 mm')}
      ${dimH(sy + sh + 12, sx, sx + sw, '1.69–2.0″')}
    </svg>`;
  }

  // ---- internal hardware zoning (front cutaway) ----
  function zoning() {
    const cx = 130, bw = geo.bodyW, bh = geo.bodyH, by = geo.bodyTop, bx = cx - bw / 2;
    const baseY = by + 8;
    const zone = (x, y, w, h, col, label) =>
      `${rr(x, y, w, h, 8, `fill="${col}" fill-opacity=".55" stroke="${col}" stroke-width="1.4"`)}
       <text x="${x + w / 2}" y="${y + h / 2 + 3.5}" text-anchor="middle" font-size="9.5" font-weight="700" fill="var(--ink)" font-family="var(--font-body)">${label}</text>`;
    const ew = geo.earW, lx = cx - geo.earGapInner / 2 - ew, rx = cx + geo.earGapInner / 2;
    const earGuide = (x, rot) => `<g transform="rotate(${rot} ${x + ew / 2} ${baseY})">${rr(x, baseY - geo.earH, ew, geo.earH, ew / 2, 'fill="none" stroke="var(--line-strong)" stroke-width="1.6" stroke-dasharray="4 4"')}${rr(x + ew * 0.3, baseY - geo.earH * 0.7, ew * 0.4, geo.earH * 0.4, ew * 0.2, 'fill="var(--sage)" fill-opacity=".5"')}</g>`;
    return `<svg viewBox="0 0 260 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Internal hardware zoning">
      ${earGuide(lx, -geo.earTilt)}${earGuide(rx, geo.earTilt)}
      ${rr(bx, by, bw, bh, geo.bodyRX, 'fill="var(--surface-2)" stroke="var(--ink-faint)" stroke-width="1.6" stroke-dasharray="5 5"')}
      ${zone(cx - 52, by + 14, 104, 40, 'var(--teal)', 'Display module')}
      ${zone(cx - 30, by + 60, 60, 52, 'var(--sage)', 'ESP32-S3')}
      ${zone(cx - 50, by + 118, 44, 30, 'var(--gold)', 'Speaker')}
      ${zone(cx + 8, by + 118, 44, 30, 'var(--clay)', 'LiPo cell')}
      <circle cx="${bx + 16}" cy="${by + 18}" r="4" fill="var(--ink-soft)"/><text x="${bx + 24}" y="${by + 21}" font-size="9" font-weight="700" fill="var(--ink-soft)" font-family="var(--font-body)">Mic</text>
      ${rr(cx - 12, by + bh - 12, 24, 9, 4, 'fill="var(--ink-soft)"')}<text x="${cx}" y="${by + bh + 6}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--ink-soft)" font-family="var(--font-body)">USB-C</text>
      <text x="${lx + ew / 2}" y="${by - 60}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--sage-deep)" font-family="var(--font-body)" transform="rotate(${-geo.earTilt} ${lx + ew / 2} ${baseY})">LED</text>
    </svg>`;
  }

  // ---- exploded assembly (parts laid front → back) ----
  function assembly() {
    const plate = (x, label, inner) => {
      const w = 64, h = 104, y = 92;
      return `<g>
        ${rr(x + 4, y + 5, w, h, 14, 'fill="var(--ivory-deep)"')}
        ${rr(x, y, w, h, 14, 'fill="url(#ivoryV)" stroke="var(--edge)" stroke-width="1.8"')}
        ${inner(x, y, w, h)}
        <text x="${x + w / 2}" y="${y + h + 20}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--ink-soft)" font-family="var(--font-body)">${label}</text>
      </g>`;
    };
    const axis = `<line x1="36" y1="144" x2="324" y2="144" stroke="var(--sage)" stroke-width="1.4" stroke-dasharray="5 5"/>
      <path d="M324 144 l-9 -4 v8 z" fill="var(--sage)"/>
      <text x="180" y="248" text-anchor="middle" font-size="10" font-weight="700" letter-spacing=".08em" fill="var(--sage-deep)" font-family="var(--font-body)">FRONT  ◄———  ASSEMBLY AXIS  ———►  BACK</text>`;
    // 1 front shell+face, 2 display, 3 chassis(esp32), 4 back panel
    const p1 = plate(40, 'Front shell', (x, y, w, h) => `${rr(x + 12, y + 22, w - 24, h - 50, 12, 'fill="url(#screenG)"')}<circle cx="${x + w / 2 - 9}" cy="${y + 44}" r="3.2" fill="var(--screen-glow)"/><circle cx="${x + w / 2 + 9}" cy="${y + 44}" r="3.2" fill="var(--screen-glow)"/><path d="M${x + w / 2 - 6} ${y + 58} q6 5 12 0" stroke="var(--screen-glow)" stroke-width="2" fill="none" stroke-linecap="round"/>`);
    const p2 = plate(125, 'Display', (x, y, w, h) => `${rr(x + 14, y + 26, w - 28, h - 54, 8, 'fill="var(--teal)" fill-opacity=".5" stroke="var(--teal)" stroke-width="1.4"')}${rr(x + 10, y + 8, 7, 16, 3, 'fill="var(--sage)" fill-opacity=".6"')}${rr(x + w - 17, y + 8, 7, 16, 3, 'fill="var(--sage)" fill-opacity=".6"')}`);
    const p3 = plate(210, 'Chassis', (x, y, w, h) => `${rr(x + 16, y + 18, w - 32, 30, 5, 'fill="var(--sage)" fill-opacity=".55" stroke="var(--sage)" stroke-width="1.3"')}<circle cx="${x + w / 2 - 10}" cy="${y + 72}" r="11" fill="var(--gold)" fill-opacity=".5" stroke="var(--gold)" stroke-width="1.3"/>${rr(x + w / 2 + 2, y + 62, 18, 22, 4, 'fill="var(--clay)" fill-opacity=".5" stroke="var(--clay)" stroke-width="1.3"')}`);
    const p4 = plate(295, 'Back panel', (x, y, w, h) => {
      const sc = (sx, sy) => `<circle cx="${sx}" cy="${sy}" r="3" fill="var(--surface-3)" stroke="var(--edge)" stroke-width="1.2"/>`;
      return `${sc(x + 12, y + 12)}${sc(x + w - 12, y + 12)}${sc(x + 12, y + h - 12)}${sc(x + w - 12, y + h - 12)}${rr(x + w / 2 - 9, y + h - 24, 18, 8, 4, 'fill="var(--surface-3)" stroke="var(--edge)" stroke-width="1.3"')}`;
    });
    // floating ears + feet
    const ears = `<g><rect x="60" y="34" width="13" height="40" rx="6.5" fill="url(#ivoryV)" stroke="var(--edge)" stroke-width="1.6"/><rect x="78" y="34" width="13" height="40" rx="6.5" fill="url(#ivoryV)" stroke="var(--edge)" stroke-width="1.6"/><text x="76" y="28" text-anchor="middle" font-size="9" font-weight="700" fill="var(--ink-soft)" font-family="var(--font-body)">Ears (×2)</text><line x1="76" y1="76" x2="76" y2="92" stroke="var(--edge)" stroke-width="1" stroke-dasharray="3 3"/></g>`;
    const feet = `<g><rect x="52" y="214" width="22" height="9" rx="4.5" fill="url(#ivoryV)" stroke="var(--edge)" stroke-width="1.6"/><rect x="80" y="214" width="22" height="9" rx="4.5" fill="url(#ivoryV)" stroke="var(--edge)" stroke-width="1.6"/><text x="77" y="234" text-anchor="middle" font-size="9" font-weight="700" fill="var(--ink-soft)" font-family="var(--font-body)">Feet (TPU ×2)</text></g>`;
    return `<svg viewBox="0 0 360 256" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Exploded assembly">
      ${axis}${ears}${feet}${p1}${p2}${p3}${p4}
    </svg>`;
  }

  // ---------- content data ----------
  const expressions = [
    { motion: 'breath', face: 'calm', glow: '#2E9E6E', label: 'Idle', say: 'Resting and ready — a slow green breath.' },
    { motion: 'pulse', face: 'attentive', glow: '#2E9E6E', label: 'Listening', say: 'Ears pulse gently while you speak.' },
    { motion: 'steady', face: 'think', glow: '#CCA24F', label: 'Thinking', say: 'A still, warm glow as it gathers words.' },
    { motion: 'rhythm', face: 'talk', glow: '#C77B5E', label: 'Speaking', say: 'Glow flickers with its voice; mouth moves.' },
    { motion: 'off', face: 'mute', glow: '#9AA79A', label: 'Mic off', say: 'Ears go dark; a calm mic-off face.' },
    { motion: 'error', face: 'alert', glow: '#D98A3D', label: 'Connection', say: 'A slow amber breath — gentle, never red.' },
  ];

  const specs = [
    ['Overall height (incl. ears)', '≈ 135 mm'],
    ['Body (W × H × D)', '≈ 95 × 90 × 85 mm'],
    ['Ear height (Ø)', '≈ 45 mm (Ø 18 mm)'],
    ['Face display', '1.69″–2.0″ IPS / round LCD'],
    ['Foot stance width', '≈ 105 mm'],
    ['Wall thickness', '2.4–3.0 mm'],
    ['Weight (with battery)', '≈ 190–240 g'],
    ['Battery', '1000–1500 mAh LiPo'],
    ['Fits print bed', 'Yes — well under 120 mm'],
  ];

  const zones = [
    ['var(--teal)', 'Display module', 'Behind the face window, slightly tilted up toward the user.'],
    ['var(--sage)', 'ESP32-S3 board', 'Mounted vertically on standoffs in the centre — the warm core.'],
    ['var(--gold)', 'Speaker', 'Bottom-front I2S driver, angled to the desk for a softer voice.'],
    ['var(--clay)', 'LiPo cell', 'Low and central to keep the centre of gravity down.'],
    ['var(--ink-soft)', 'Mic + USB-C', 'Mic pinhole up top away from the speaker; USB-C at the rear base.'],
    ['var(--sage)', 'Ear LEDs', 'Two short LED strips with light pipes inside each ear channel.'],
  ];

  const steps = [
    ['Print the parts', 'front shell, back panel, internal chassis, 2 ears + 2 light pipes, 2 TPU feet.'],
    ['Heat-set inserts', 'press 4× M3 brass inserts into the back-panel posts.'],
    ['Fit the display', 'seat the LCD in the chassis window; mount the ESP32-S3 on standoffs behind it.'],
    ['Sound + voice', 'clip the I2S speaker into the bottom grille; route the mic to the top pinhole.'],
    ['Light the ears', 'drop the light pipes into the ear channels and wire the two LED strips.'],
    ['Power', 'set the LiPo in the lower tray; connect the USB-C charge board at the rear cutout.'],
    ['Close it up', 'clip the chassis into the front shell on its alignment ribs; fix the back panel with 4 screws.'],
    ['Feet on', 'press on the TPU feet. No glue needed — fully reopenable for debugging.'],
  ];

  const palette = [['#FBFBF3', 'Ivory shell'], ['#2E9E6E', 'Sage accent'], ['#1C7A52', 'Deep sage'], ['#1F2A24', 'Face screen'], ['#BFEFD6', 'Mint glow'], ['#F3F7EE', 'Cream']];
  const paletteStatus = [['#2E9E6E', 'Listening'], ['#CCA24F', 'Thinking'], ['#C77B5E', 'Speaking'], ['#3F8FA8', 'Transcribe'], ['#D98A3D', 'Issue (amber)']];

  const materials = [
    ['layers', 'Main shell', 'Matte PLA+ or PETG in warm ivory. PETG adds durability and heat tolerance near the electronics; matte hides layer lines and reads calmer than gloss.'],
    ['sparkle', 'Ear light pipes', 'Translucent natural PLA or a frosted acrylic rod for an even, soft glow instead of visible LED dots.'],
    ['cpu', 'Screen window', 'Thin clear acrylic insert (or a clean open cutout) flush with the bezel.'],
    ['check', 'Feet', 'TPU or stick-on silicone bumpers — grippy, quiet, and a little squishy to the touch.'],
    ['wrench', 'Fasteners', '4× M3 heat-set brass inserts + M3 screws in the back panel; no glue.'],
    ['sparkle', 'Finish', 'Light bead-blast / matte all over, with an optional sage accent ring printed in a second colour or hand-painted.'],
  ];
  const ic = {
    layers: '<path d="M12 2 2 7l10 5 10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L4 16.8 7.2 20l5.3-5.3a4 4 0 0 0 5.2-5.4l-2.7 2.7-2.3-2.3z"/>',
  };

  // ---------- render ----------
  document.getElementById('hero-art').innerHTML = heroFront();

  document.getElementById('exprstrip').innerHTML = expressions.map(e =>
    `<div class="card expr" style="--glow:${e.glow}">
      ${S.mini({ motion: e.motion, faceType: e.face })}
      <h4 class="serif"><span class="gdot"></span>${e.label}</h4>
      <p>${e.say}</p>
    </div>`).join('');

  document.getElementById('views').innerHTML =
    `<div class="view"><span class="vlabel">Front</span>${S.front(geo)}</div>
     <div class="view"><span class="vlabel">Side</span>${S.side(geo)}</div>
     <div class="view"><span class="vlabel">Back</span>${S.back(geo)}</div>`;

  document.getElementById('dim-art').innerHTML = dimDrawing();
  document.getElementById('specs').innerHTML = specs.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');

  document.getElementById('zone-art').innerHTML = zoning();
  document.getElementById('zlegend').innerHTML = zones.map(([c, t, d]) =>
    `<div class="zrow"><span class="sw" style="background:${c}"></span><span><b>${t}.</b> ${d}</span></div>`).join('');

  document.getElementById('asm-art').innerHTML = assembly();
  document.getElementById('asm-steps').innerHTML = steps.map(([t, d]) => `<li><span><b>${t}.</b> ${d}</span></li>`).join('');

  document.getElementById('palette').innerHTML = palette.map(([h, n]) => `<div class="sw2"><span class="c" style="background:${h}"></span>${n}</div>`).join('');
  document.getElementById('palette-status').innerHTML = paletteStatus.map(([h, n]) => `<div class="sw2"><span class="c" style="background:${h};height:28px;width:48px"></span>${n}</div>`).join('');
  document.getElementById('matlist').innerHTML = materials.map(([i, t, d]) => `<li>${lic(ic[i], 17, 1.9)}<span><b>${t}.</b> ${d}</span></li>`).join('');
})();

/* companion-3d.js — shaded, dimensional product renderer for the SoulMate
   companion body. Four silhouette directions, each with front / 3-4 / side / back. */
(function () {
  // ---------------- shared defs ----------------
  function defs() {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', '0'); s.setAttribute('height', '0');
    s.style.cssText = 'position:absolute;width:0;height:0;';
    s.innerHTML = `<defs>
      <linearGradient id="gBody" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stop-color="#FFFFFF"/><stop offset=".4" stop-color="var(--ivory)"/><stop offset="1" stop-color="var(--ivory-deep)"/>
      </linearGradient>
      <linearGradient id="gSide" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--ivory-deep)"/><stop offset="1" stop-color="var(--ivory-side)"/>
      </linearGradient>
      <linearGradient id="gSage" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#BCD2B2"/><stop offset="1" stop-color="var(--sage-mat-deep)"/>
      </linearGradient>
      <radialGradient id="gHi" cx="0.32" cy="0.2" r="0.85"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".75"/><stop offset="0.6" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
      <radialGradient id="gScreen" cx="0.5" cy="0.4" r="0.75"><stop offset="0" stop-color="#2B392F"/><stop offset="1" stop-color="#141C17"/></radialGradient>
      <radialGradient id="gFab" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="#E2E1D4"/><stop offset="1" stop-color="var(--fabric-2)"/></radialGradient>
      <filter id="ring" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.4"/></filter>
      <filter id="cshad" x="-50%" y="-60%" width="200%" height="220%"><feGaussianBlur stdDeviation="4.5"/></filter>
      <filter id="eyeGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="1.6"/></filter>
    </defs>`;
    document.body.appendChild(s);
  }

  const R = (x, y, w, h, r, a = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" ${a}/>`;
  const shadow = (cx, cy, rx) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${rx * 0.2}" fill="rgba(42,47,38,.16)" filter="url(#cshad)"/>`;

  // egg / pod silhouette path
  function egg(cx, top, w, h) {
    const hw = w / 2;
    return `M${cx},${top} C${cx + hw * 0.62},${top} ${cx + hw},${top + h * 0.28} ${cx + hw},${top + h * 0.52}`
      + ` C${cx + hw},${top + h * 0.82} ${cx + hw * 0.64},${top + h} ${cx},${top + h}`
      + ` C${cx - hw * 0.64},${top + h} ${cx - hw},${top + h * 0.82} ${cx - hw},${top + h * 0.52}`
      + ` C${cx - hw},${top + h * 0.28} ${cx - hw * 0.62},${top} ${cx},${top} Z`;
  }
  // body element for a given shape
  function bodyEl(shape, x, y, w, h, fill, stroke) {
    const st = stroke ? `stroke="var(--edge)" stroke-width="2"` : '';
    if (shape === 'pod') return `<path d="${egg(x + w / 2, y, w, h)}" fill="${fill}" ${st}/>`;
    const r = shape === 'buddy' ? Math.min(w, h) * 0.17 : Math.min(w, h) * 0.32;
    return R(x, y, w, h, r, `fill="${fill}" ${st}`);
  }

  // two-tone ribbed ear (capsule) or fin
  function ear(x, topY, w, h, rot, baseY, style) {
    if (style === 'fin') {
      const fw = w * 1.7, fh = h * 0.62, ty = baseY - fh;
      return `<g transform="rotate(${rot} ${x + w / 2} ${baseY})">
        ${R(x - (fw - w) / 2, ty, fw, fh, fh / 2, 'fill="url(#gBody)" stroke="var(--edge)" stroke-width="2"')}
        ${R(x - (fw - w) / 2 + fw * 0.16, ty + fh * 0.3, fw * 0.68, fh * 0.3, fh * 0.15, 'fill="url(#gSage)"')}
        ${R(x - (fw - w) / 2 + fw * 0.22, ty + fh * 0.36, fw * 0.56, fh * 0.16, fh * 0.08, 'fill="var(--screen-glow)" opacity=".7"')}
      </g>`;
    }
    const ribs = [0.34, 0.5, 0.66].map(p =>
      `<line x1="${x + w * p}" y1="${topY + h * 0.1}" x2="${x + w * p}" y2="${topY + h * 0.5}" stroke="var(--sage-mat-deep)" stroke-width="1.3" stroke-linecap="round" opacity=".75"/>`).join('');
    return `<g transform="rotate(${rot} ${x + w / 2} ${baseY})">
      ${R(x, topY, w, h, w / 2, 'fill="url(#gBody)" stroke="var(--edge)" stroke-width="2"')}
      <path d="M${x},${topY + h * 0.5} v${-(h * 0.5 - w / 2)} a${w / 2},${w / 2} 0 0 1 ${w},0 v${h * 0.5 - w / 2} z" fill="url(#gSage)"/>
      ${R(x + w * 0.3, topY + h * 0.12, w * 0.4, h * 0.4, w * 0.2, 'fill="var(--screen-glow)" opacity=".5"')}
      ${ribs}
    </g>`;
  }

  // glowing light-ring face
  function faceScreen(cx, sy, sw, sh, opts = {}) {
    const sr = Math.min(sw, sh) * 0.28, sx = cx - sw / 2;
    const eyeDX = sw * 0.19, eyeY = sy + sh * 0.54, ew = Math.max(7, sw * 0.085), eh = ew * 2.3;
    const eyes = `${R(cx - eyeDX - ew / 2, eyeY - eh / 2, ew, eh, ew / 2, 'fill="var(--screen-glow)"')}${R(cx + eyeDX - ew / 2, eyeY - eh / 2, ew, eh, ew / 2, 'fill="var(--screen-glow)"')}`;
    const heart = `<path d="M${cx} ${sy + sh * 0.26} c-1.6 -3 -6 -2 -6 1.4 c0 2.4 3.2 4 6 6 c2.8 -2 6 -3.6 6 -6 c0 -3.4 -4.4 -4.4 -6 -1.4 z" fill="var(--screen-glow)" opacity=".92"/>`;
    return `${R(sx - 8, sy - 8, sw + 16, sh + 16, sr + 8, 'fill="var(--ivory-2)" stroke="var(--edge)" stroke-width="1.5"')}
      ${R(sx - 4, sy - 4, sw + 8, sh + 8, sr + 4, 'fill="none" stroke="var(--sage)" stroke-width="4" opacity=".4"')}
      ${R(sx - 3, sy - 3, sw + 6, sh + 6, sr + 3, 'fill="none" stroke="var(--screen-glow)" stroke-width="1.6" opacity=".9"')}
      ${R(sx, sy, sw, sh, sr, 'fill="url(#gScreen)"')}
      ${heart}${eyes}`;
  }

  const grille = (cx, cy, rw, rh) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rw + 2}" ry="${rh + 2}" fill="var(--ivory-deep)"/>
     <ellipse cx="${cx}" cy="${cy}" rx="${rw}" ry="${rh}" fill="url(#gFab)" stroke="var(--edge)" stroke-width="1"/>
     <ellipse cx="${cx}" cy="${cy}" rx="${rw * 0.62}" ry="${rh * 0.72}" fill="none" stroke="#B7B7A6" stroke-width="1" opacity=".5"/>
     <ellipse cx="${cx - rw * 0.3}" cy="${cy - rh * 0.3}" rx="${rw * 0.5}" ry="${rh * 0.4}" fill="#FFFFFF" opacity=".12"/>`;

  const foot = (x, y, w, h) => R(x, y, w, h, h * 0.5, 'fill="url(#gSage)" stroke="var(--edge)" stroke-width="1.6"');
  const num = (x, y, n) => `<circle cx="${x}" cy="${y}" r="9" fill="var(--sage)"/><text x="${x}" y="${y + 3.4}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="var(--font-body)">${n}</text>`;

  // ---------------- view builders ----------------
  function front(d) {
    const cx = 130, W = d.W, H = d.H, by = d.topY, bx = cx - W / 2, vh = d.vh;
    const sw = W * (d.shape === 'pod' ? 0.6 : 0.66), sh = sw * 0.92, sy = by + (d.shape === 'pod' ? H * 0.2 : H * 0.2);
    const baseY = by + (d.shape === 'pod' ? H * 0.12 : 10);
    const ew = d.earW, eh = d.earH, lx = cx - d.earGap / 2 - ew, rx = cx + d.earGap / 2, topY = baseY - eh;
    let s = `<svg viewBox="0 0 260 ${vh}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${d.name} front">`;
    s += shadow(cx, by + H + (d.feet === 'base' ? 20 : 16), W * 0.5);
    s += d.ears === 'fin'
      ? ear(lx, 0, ew, eh, -d.earTilt, baseY, 'fin') + ear(rx, 0, ew, eh, d.earTilt, baseY, 'fin')
      : ear(lx, topY, ew, eh, -d.earTilt, baseY, 'cap') + ear(rx, topY, ew, eh, d.earTilt, baseY, 'cap');
    if (d.feet === 'base') s += `<ellipse cx="${cx}" cy="${by + H + 10}" rx="${W * 0.42}" ry="13" fill="url(#gSide)" stroke="var(--edge)" stroke-width="1.6"/>` + R(cx - W * 0.12, by + H - 6, W * 0.24, 18, 8, 'fill="url(#gBody)" stroke="var(--edge)" stroke-width="1.6"');
    s += bodyEl(d.shape, bx, by, W, H, 'url(#gBody)', true);
    s += bodyEl(d.shape, bx, by, W, H, 'url(#gHi)', false);
    // panel seam + side grille hint + details
    if (d.shape !== 'pod') s += `<path d="M${bx + 6} ${by + H * 0.62} h${W - 12}" stroke="var(--edge)" stroke-width="1" opacity=".5"/>`;
    s += grille(bx + W * 0.04, by + H * 0.5, W * 0.07, H * 0.16); // left side speaker peeking
    s += faceScreen(cx, sy, sw, sh);
    s += `<circle cx="${cx}" cy="${by + 9}" r="2.1" fill="var(--ink-faint)"/>`; // mic
    s += `<circle cx="${bx + W - 16}" cy="${by + H - 14}" r="3.4" fill="none" stroke="var(--edge)" stroke-width="1.6"/>`; // button
    if (d.feet === 'nubs') s += foot(cx - W * 0.3, by + H - 4, W * 0.2, 16) + foot(cx + W * 0.1, by + H - 4, W * 0.2, 16);
    if (d.shape === 'dock') s += dockBase(cx, by + H, W);
    return s + '</svg>';
  }

  function threeQ(d) {
    const cx = 122, W = d.W, H = d.H, by = d.topY, bx = cx - W / 2, vh = d.vh, ex = 20, ey = 9;
    const sw = W * (d.shape === 'pod' ? 0.56 : 0.6), sh = sw * 0.92, sy = by + H * 0.2, scx = cx - 6;
    const baseY = by + (d.shape === 'pod' ? H * 0.12 : 10);
    const ew = d.earW, eh = d.earH, lx = cx - d.earGap / 2 - ew, rx = cx + d.earGap / 2, topY = baseY - eh;
    let s = `<svg viewBox="0 0 260 ${vh}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${d.name} three-quarter">`;
    s += shadow(cx + 8, by + H + (d.feet === 'base' ? 20 : 16), W * 0.56);
    // ears (slightly offset for depth)
    const E = (X, rot) => d.ears === 'fin' ? ear(X, 0, ew, eh, rot, baseY, 'fin') : ear(X, topY, ew, eh, rot, baseY, 'cap');
    s += `<g opacity=".0">${E(lx, 0)}</g>`; // keep ribs def warm (noop)
    s += E(lx + ex * 0.4, -d.earTilt) + E(rx + ex * 0.4, d.earTilt);
    if (d.feet === 'base') s += `<ellipse cx="${cx + 6}" cy="${by + H + 10}" rx="${W * 0.44}" ry="13" fill="url(#gSide)" stroke="var(--edge)" stroke-width="1.6"/>`;
    // extruded side wall
    s += bodyEl(d.shape, bx + ex, by + ey, W, H, 'url(#gSide)', false);
    s += bodyEl(d.shape, bx, by, W, H, 'url(#gBody)', true);
    s += bodyEl(d.shape, bx, by, W, H, 'url(#gHi)', false);
    // right cheek seam (depth) + side grille on cheek
    s += `<path d="M${bx + W - 2} ${by + H * 0.2} q${ex} ${H * 0.28} 0 ${H * 0.56}" stroke="var(--edge)" stroke-width="1" fill="none" opacity=".4"/>`;
    s += grille(bx + W + ex * 0.5, by + H * 0.5, W * 0.085, H * 0.17);
    s += faceScreen(scx, sy, sw, sh);
    s += `<circle cx="${scx}" cy="${by + 9}" r="2" fill="var(--ink-faint)"/>`;
    if (d.feet === 'nubs') s += foot(cx - W * 0.32, by + H - 4, W * 0.2, 16) + foot(cx + W * 0.08 + ex * 0.4, by + H - 2, W * 0.2, 16);
    if (d.shape === 'dock') s += dockBase(cx, by + H, W);
    return s + '</svg>';
  }

  function side(d) {
    const cx = 132, DW = d.W * 0.86, H = d.H, by = d.topY, bx = cx - DW / 2, vh = d.vh;
    const baseY = by + (d.shape === 'pod' ? H * 0.12 : 10);
    const ew = d.earW, eh = d.earH;
    let s = `<svg viewBox="0 0 260 ${vh}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${d.name} side">`;
    s += shadow(cx, by + H + (d.feet === 'base' ? 20 : 16), DW * 0.52);
    // single ear from side (thinner)
    const sew = d.ears === 'fin' ? ew : ew * 0.62;
    s += d.ears === 'fin' ? ear(cx - sew / 2, 0, sew, eh, 4, baseY, 'fin') : ear(cx - sew / 2, baseY - eh, sew, eh, 4, baseY, 'cap');
    if (d.feet === 'base') s += `<ellipse cx="${cx}" cy="${by + H + 10}" rx="${DW * 0.48}" ry="13" fill="url(#gSide)" stroke="var(--edge)" stroke-width="1.6"/>`;
    s += bodyEl(d.shape, bx, by, DW, H, 'url(#gBody)', true);
    s += bodyEl(d.shape, bx, by, DW, H, 'url(#gHi)', false);
    // front face edge (left) — recessed screen sliver with light-ring edge
    s += `<path d="M${bx + 7} ${by + H * 0.22} v${H * 0.5} a7 7 0 0 0 7 7" stroke="var(--sage)" stroke-width="2.6" fill="none" opacity=".55"/>`;
    s += `<path d="M${bx + 4} ${by + H * 0.2} v${H * 0.56}" stroke="var(--screen)" stroke-width="3.4" opacity=".5"/>`;
    // side speaker grille
    s += grille(cx + DW * 0.06, by + H * 0.5, DW * 0.2, H * 0.2);
    // mic + usb-c (back/right)
    s += `<circle cx="${bx + 12}" cy="${by + H * 0.16}" r="2" fill="var(--ink-faint)"/>`;
    s += R(bx + DW - 22, by + H - 30, 16, 8, 4, 'fill="var(--sage-mat)" stroke="var(--edge)" stroke-width="1.4"');
    if (d.feet === 'nubs') s += foot(cx - DW * 0.28, by + H - 4, DW * 0.22, 16) + foot(cx + DW * 0.06, by + H - 4, DW * 0.22, 16);
    if (d.shape === 'dock') s += dockBase(cx, by + H, DW * 1.05);
    // callouts
    s += num(cx + DW * 0.06, by + H * 0.5, 2) + num(bx + DW - 14, by + H - 26, 4) + num(bx + 4, by + H * 0.2, 1) + num(bx + 12, by + H * 0.16, 3);
    return s + '</svg>';
  }

  function back(d) {
    const cx = 130, W = d.W, H = d.H, by = d.topY, bx = cx - W / 2, vh = d.vh;
    const baseY = by + (d.shape === 'pod' ? H * 0.12 : 10);
    const ew = d.earW, eh = d.earH, lx = cx - d.earGap / 2 - ew, rx = cx + d.earGap / 2, topY = baseY - eh;
    const earBack = (x, rot) => `<g transform="rotate(${rot} ${x + ew / 2} ${baseY})">${R(x, d.ears === 'fin' ? baseY - eh * 0.62 : topY, d.ears === 'fin' ? ew * 1.7 : ew, d.ears === 'fin' ? eh * 0.62 : eh, d.ears === 'fin' ? eh * 0.3 : ew / 2, 'fill="url(#gSide)" stroke="var(--edge)" stroke-width="2"')}</g>`;
    let s = `<svg viewBox="0 0 260 ${vh}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${d.name} back">`;
    s += shadow(cx, by + H + (d.feet === 'base' ? 20 : 16), W * 0.5);
    s += earBack(lx - (d.ears === 'fin' ? ew * 0.35 : 0), -d.earTilt) + earBack(rx, d.earTilt);
    if (d.feet === 'base') s += `<ellipse cx="${cx}" cy="${by + H + 10}" rx="${W * 0.42}" ry="13" fill="url(#gSide)" stroke="var(--edge)" stroke-width="1.6"/>`;
    s += bodyEl(d.shape, bx, by, W, H, 'url(#gBody)', true);
    // perimeter shell seam
    s += bodyEl(d.shape, bx + 4, by + 4, W - 8, H - 8, 'none', false).replace('/>', ' stroke="var(--edge)" stroke-width="1" opacity=".4" stroke-dasharray="4 4"/>');
    // removable panel (sage)
    const pw = W * 0.5, ph = H * 0.42, px = cx - pw / 2, py = by + H * 0.14;
    s += R(px, py, pw, ph, 14, 'fill="url(#gSage)" stroke="var(--edge)" stroke-width="1.8"');
    s += R(px + 5, py + 5, pw - 10, ph - 10, 10, 'fill="none" stroke="var(--sage-mat-deep)" stroke-width="1" opacity=".5" stroke-dasharray="4 3"');
    s += `<rect x="${cx - 7}" y="${py - 4}" width="14" height="8" rx="3" fill="url(#gSage)" stroke="var(--edge)" stroke-width="1.2"/>`; // panel tab
    // speaker hole grid (lower)
    const gy = by + H * 0.7; let holes = '';
    for (let a = 0; a < 5; a++) for (let b = 0; b < 4; b++) { const hx = cx - 14 + a * 7, hy = gy + b * 6; if ((hx - cx) ** 2 / 256 + (hy - (gy + 9)) ** 2 / 100 <= 1) holes += `<circle cx="${hx}" cy="${hy}" r="1.7" fill="var(--ink-faint)"/>`; }
    s += holes;
    // usb-c bottom
    s += R(cx - 9, by + H - 14, 18, 8, 4, 'fill="var(--sage-mat)" stroke="var(--edge)" stroke-width="1.4"');
    if (d.feet === 'nubs') s += foot(cx - W * 0.3, by + H - 4, W * 0.2, 16) + foot(cx + W * 0.1, by + H - 4, W * 0.2, 16);
    if (d.shape === 'dock') s += dockBase(cx, by + H, W);
    s += num(px - 4, py + ph * 0.5, 5) + num(cx + 22, gy + 9, 2) + num(cx, by + H - 2, 3);
    return s + '</svg>';
  }

  function dockBase(cx, topY, W) {
    const w1 = W * 0.7, w2 = W * 1.02, h = 34;
    return `<path d="M${cx - w1 / 2} ${topY} L${cx + w1 / 2} ${topY} L${cx + w2 / 2} ${topY + h} Q${cx + w2 / 2} ${topY + h + 8} ${cx + w2 / 2 - 10} ${topY + h + 8} L${cx - w2 / 2 + 10} ${topY + h + 8} Q${cx - w2 / 2} ${topY + h + 8} ${cx - w2 / 2} ${topY + h} Z" fill="url(#gBody)" stroke="var(--edge)" stroke-width="2"/>
      <path d="M${cx - w1 / 2} ${topY} L${cx + w1 / 2} ${topY} L${cx + w2 / 2} ${topY + h} L${cx - w2 / 2} ${topY + h} Z" fill="url(#gHi)" opacity=".5"/>
      <ellipse cx="${cx}" cy="${topY + h * 0.5}" rx="${W * 0.12}" ry="4" fill="var(--sage-mat)" opacity=".5"/>`;
  }

  // ---------------- directions ----------------
  const dirs = [
    {
      id: 'd1', tag: '1', name: 'Soft TV Companion', shape: 'tv', ears: 'cap', feet: 'nubs',
      W: 152, H: 138, topY: 96, earW: 26, earH: 78, earTilt: 6, earGap: 30, vh: 290,
      dims: '≈ 110 × 105 × 95 mm',
      tagline: 'A little retro‑TV body with real depth and a recessed light‑ring face. The most desk‑friend of the four — and closest to the SoulMate identity.',
      hw: [['Display', '2.0″ square LCD, recessed ~6 mm behind a glowing sage light‑ring bezel.'], ['Speaker', 'Full‑range driver behind a warm‑grey fabric grille on the left side cheek.'], ['Microphone', 'Far‑field MEMS mic in a pinhole on the top edge, away from the speaker.'], ['USB‑C', 'Centred on the lower back, just above the parting seam.'], ['Buttons', 'Single recessed touch/power dot, lower‑right of the front face.']],
      asm: [['Two‑part shell', 'front + back shells split on a visible mid‑seam; clip + 4× M3 screws from the back.'], ['Ears', 'printed separately, posted into sockets on the top shell so the light pipes seat cleanly.'], ['Print', 'flat back face prints first‑layer‑down with no supports; 2.6 mm walls; feet in TPU.']],
    },
    {
      id: 'd2', tag: '2', name: 'Rounded Pod Companion', shape: 'pod', ears: 'cap', feet: 'base',
      W: 134, H: 168, topY: 70, earW: 23, earH: 58, earTilt: 4, earGap: 22, vh: 300,
      dims: '≈ 95 W × 145 H × 95 mm',
      tagline: 'A soft capsule/egg body that feels organic and huggable. The ears grow straight out of the top shell; it rests on a weighted base ring.',
      hw: [['Display', 'Round/soft‑square LCD embedded into the front of the pod, flush light‑ring.'], ['Speaker', 'Down‑firing driver in the base ring; grille slots around the pedestal.'], ['Microphone', 'Top‑centre pinhole between the ears.'], ['USB‑C', 'Hidden at the rear of the base where the cable can route away tidily.'], ['Buttons', 'Capacitive touch on the crown; no visible button to keep the form pure.']],
      asm: [['Shell halves', 'front/back egg halves meet on a soft vertical seam; the base ring screws up into both.'], ['Weighted base', 'a printed base ring holds a steel washer + speaker to lower the centre of gravity.'], ['Print', 'egg prints in two halves face‑down (no supports); ears need light support or print flat.']],
    },
    {
      id: 'd3', tag: '3', name: 'Modular Buddy Shell', shape: 'buddy', ears: 'cap', feet: 'nubs',
      W: 150, H: 144, topY: 92, earW: 30, earH: 70, earTilt: 5, earGap: 32, vh: 290,
      dims: '≈ 105 × 110 × 100 mm',
      tagline: 'The build‑honest one: a chunkier shell with visible seam lines, a screw‑on back panel and thicker, sturdier ears — construction logic on show, but still a friend.',
      hw: [['Display', 'Square LCD in a bolt‑down front frame; light‑ring on a separate clip‑in lens.'], ['Speaker', 'Oval fabric grille on the right side panel, screwed over the driver.'], ['Microphone', 'Pinhole on the top chamfer with an internal foam gasket.'], ['USB‑C', 'On the back panel beside the parting line for easy reflashing.'], ['Buttons', 'Tactile power + a recessed reset pinhole on the back panel.']],
      asm: [['Removable back panel', 'full back panel on 4× M3 heat‑set inserts — open any time to service the ESP32.'], ['Internal chassis', 'a printed sled holds board + speaker + battery and slides in from the back.'], ['Print', 'boxy chamfered form is the easiest to print; 3 mm walls; thick ears resist snapping.']],
    },
    {
      id: 'd4', tag: '4', name: 'Bunny Dock Companion', shape: 'dock', ears: 'fin', feet: 'dock',
      W: 138, H: 104, topY: 64, earW: 24, earH: 58, earTilt: 0, earGap: 26, vh: 270,
      dims: '≈ 120 base × 115 H × 105 mm',
      tagline: 'A dock with a wide, stable base and a head tilted gently up toward you — built for voice conversation. The ears are short status‑light fins.',
      hw: [['Display', 'Face angled ~10° upward for eye‑contact; light‑ring framing the LCD.'], ['Speaker', 'Forward‑firing driver in the base, grille slot along the front of the dock.'], ['Microphone', 'Two mic pinholes on the base front edge for clearer far‑field pickup.'], ['USB‑C', 'At the rear of the heavy base, doubling as the charging dock connection.'], ['Buttons', 'Touch bar across the top of the base; mute toggle on the side.']],
      asm: [['Head + base', 'the head shell screws onto the wedge base; cable routes down through the neck.'], ['Weighted dock', 'the wide base carries most of the mass and the speaker for desk stability.'], ['Print', 'base prints flat & solid‑ish for weight; head prints face‑down; fins are sturdy & support‑free.']],
    },
  ];

  // ---------------- render ----------------
  defs();
  const matIcon = '';
  document.getElementById('matbar').innerHTML = [
    ['#FBFAF1', 'Soft Ivory', 'Main shell'], ['#A9C3A0', 'Sage Green', 'Accent / ears'], ['#D7D6C7', 'Warm Grey', 'Fabric grille'], ['#1F2A24', 'Matte Black', 'Display'],
  ].map(([c, n, s]) => `<div class="mat"><span class="c" style="background:${c}"></span><span>${n}<small>${s}</small></span></div>`).join('');

  document.getElementById('hero-art').innerHTML = threeQ(dirs[0]);

  const kIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const pIcon = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>';

  document.getElementById('directions').innerHTML = dirs.map(d => `
    <section class="dir" id="${d.id}">
      <div class="dir-head">
        <div class="dir-tag">${d.tag}</div>
        <div class="meta"><h3 class="serif">${d.name}</h3><p>${d.tagline}</p></div>
        <div class="dim-badge">${d.dims}</div>
      </div>
      <div class="views4">
        <div class="vtile"><span class="vlabel">Front</span>${front(d)}</div>
        <div class="vtile"><span class="vlabel">3 / 4</span>${threeQ(d)}</div>
        <div class="vtile"><span class="vlabel">Side</span>${side(d)}</div>
        <div class="vtile"><span class="vlabel">Back</span>${back(d)}</div>
      </div>
      <div class="dir-body">
        <div class="col"><div class="label" style="margin-bottom:12px;">Hardware placement</div>
          <ul class="speclist">${d.hw.map(([k, v]) => `<li><span class="k">${kIcon}</span><span><b>${k}.</b> ${v}</span></li>`).join('')}</ul>
        </div>
        <div class="col"><div class="label" style="margin-bottom:12px;">Assembly &amp; 3D‑printing</div>
          <div class="printnote">${d.asm.map(([k, v]) => `<div class="row">${pIcon}<span><b>${k}.</b> ${v}</span></div>`).join('')}</div>
        </div>
      </div>
    </section>`).join('');
})();

/* companion-svg.js — vector builders for the SoulMate companion body concepts.
   Exposes window.CompanionSVG with front/side/back/mini/face builders. */
(function () {
  // ---- shared <defs> + ear animation keyframes ----
  function injectDefs() {
    if (document.getElementById('cmp-defs')) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'cmp-defs';
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
    svg.innerHTML = `<defs>
      <linearGradient id="ivoryV" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--ivory)"/><stop offset="1" stop-color="var(--ivory-deep)"/>
      </linearGradient>
      <linearGradient id="ivoryH" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="var(--ivory)"/><stop offset="1" stop-color="var(--ivory-shade)"/>
      </linearGradient>
      <radialGradient id="screenG" cx="0.5" cy="0.4" r="0.8">
        <stop offset="0" stop-color="#26342C"/><stop offset="1" stop-color="var(--screen)"/>
      </radialGradient>
      <filter id="blurS" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
      <filter id="softGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.6"/></filter>
    </defs>`;
    document.body.appendChild(svg);

    const css = document.createElement('style');
    css.textContent = `
      @keyframes earBreath{0%,100%{opacity:.26}50%{opacity:.85}}
      @keyframes earPulse{0%{opacity:.3}20%{opacity:.95}40%{opacity:.45}60%{opacity:.92}100%{opacity:.34}}
      @keyframes earRhythm{0%{opacity:.4}12%{opacity:.96}22%{opacity:.5}38%{opacity:.86}50%{opacity:.56}66%{opacity:1}80%{opacity:.5}100%{opacity:.7}}
      @keyframes earError{0%,100%{opacity:.24}50%{opacity:.82}}
      @keyframes earSeg{0%,100%{opacity:.16}30%{opacity:.95}55%{opacity:.3}}
      .earlight{transition:opacity .2s;}
      .m-breath .earlight{animation:earBreath 4.2s ease-in-out infinite;}
      .m-pulse .earlight{animation:earPulse 1.5s ease-in-out infinite;}
      .m-steady .earlight{opacity:.85;}
      .m-rhythm .earlight{animation:earRhythm 1.7s ease-in-out infinite;}
      .m-off .earlight{opacity:.1;}
      .m-error .earlight{animation:earError 1.7s ease-in-out infinite;}
      .m-travel .earseg{opacity:.16;animation:earSeg 1.5s ease-in-out infinite;}
      .m-travel .s2{animation-delay:.5s;} .m-travel .s3{animation-delay:1s;}
    `;
    document.head.appendChild(css);
  }

  const rr = (x, y, w, h, r, attrs = '') =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" ${attrs}/>`;

  // ---- face on the screen (coords within screen box) ----
  function face(type, sx, sy, sw, sh) {
    const cx = sx + sw / 2, eyeY = sy + sh * 0.43, dx = sw * 0.21, r = Math.max(3.2, sw * 0.066);
    const g = 'var(--screen-glow)';
    const eye = (ex, rad = r) => `<circle cx="${ex}" cy="${eyeY}" r="${rad}" fill="${g}"/>`;
    const eyeLine = (ex) => `<rect x="${ex - r}" y="${eyeY - 1.6}" width="${r * 2}" height="3.2" rx="1.6" fill="${g}"/>`;
    const mouthY = sy + sh * 0.66;
    let f = '';
    switch (type) {
      case 'attentive':
        f = eye(cx - dx, r * 1.15) + eye(cx + dx, r * 1.15) +
          `<path d="M${cx - r * 0.9} ${mouthY} Q${cx} ${mouthY + r * 0.7} ${cx + r * 0.9} ${mouthY}" stroke="${g}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
        break;
      case 'dots':
        f = `<circle cx="${cx - sw * 0.16}" cy="${eyeY + sh * 0.06}" r="${r * 0.7}" fill="${g}"/><circle cx="${cx}" cy="${eyeY + sh * 0.06}" r="${r * 0.7}" fill="${g}"/><circle cx="${cx + sw * 0.16}" cy="${eyeY + sh * 0.06}" r="${r * 0.7}" fill="${g}"/>`;
        break;
      case 'think':
        f = eye(cx - dx) + eye(cx + dx) +
          `<path d="M${cx + dx * 1.05} ${sy + sh * 0.2} l2.4 5 5 .6 -3.6 3.4 1 5 -4.8-2.6 -4.8 2.6 1-5 -3.6-3.4 5-.6z" fill="${g}" opacity=".9"/>`;
        break;
      case 'talk':
        f = eye(cx - dx) + eye(cx + dx) +
          `<ellipse cx="${cx}" cy="${mouthY + 1}" rx="${r * 0.9}" ry="${r * 0.75}" fill="${g}"/>`;
        break;
      case 'mute':
        f = eyeLine(cx - dx) + eyeLine(cx + dx) +
          `<g transform="translate(${cx},${mouthY + 2})" stroke="${g}" stroke-width="2" fill="none" stroke-linecap="round"><rect x="-3.5" y="-8" width="7" height="11" rx="3.5"/><path d="M-7 -1 a7 7 0 0 0 14 0"/><line x1="0" y1="6" x2="0" y2="9"/><line x1="-9" y1="-11" x2="9" y2="7"/></g>`;
        break;
      case 'alert':
        f = eye(cx - dx) + eye(cx + dx) +
          `<path d="M${cx - r} ${mouthY + 2} q${r} -${r * 0.9} ${r * 2} 0" stroke="${g}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
        break;
      default: // calm
        f = eye(cx - dx) + eye(cx + dx) +
          `<path d="M${cx - r} ${mouthY} Q${cx} ${mouthY + r * 0.9} ${cx + r} ${mouthY}" stroke="${g}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    }
    return f;
  }

  // ---- ears (front / back) ----
  function earsFront(c) {
    const cx = 130, ew = c.earW, eh = c.earH, baseY = c.bodyTop + 8;
    const topY = baseY - eh;
    if (c.earStyle === 'fin') {
      const fw = ew * 1.5, fh = eh * 0.5, ty = c.bodyTop - fh + 10;
      const fin = (x, rot, bx) => `<g transform="rotate(${rot} ${bx} ${c.bodyTop + 6})">
        ${rr(x, ty, fw, fh, fh / 2, 'fill="url(#ivoryV)" stroke="var(--edge)" stroke-width="2"')}
        ${rr(x + fw * 0.16, ty + fh * 0.3, fw * 0.68, fh * 0.34, fh * 0.17, 'class="earlight" fill="var(--earGlow,var(--sage))" filter="url(#softGlow)"')}
        ${rr(x + fw * 0.2, ty + fh * 0.33, fw * 0.6, fh * 0.28, fh * 0.14, 'class="earlight" fill="var(--earGlow,var(--sage))"')}
      </g>`;
      return fin(cx - fw - 6, -3, cx - 6) + fin(cx + 6, 3, cx + 6);
    }
    const lx = cx - c.earGapInner / 2 - ew, rx = cx + c.earGapInner / 2;
    const ear = (x, rot, bx) => `<g transform="rotate(${rot} ${bx} ${baseY})">
      ${rr(x, topY, ew, eh, ew / 2, 'fill="url(#ivoryV)" stroke="var(--edge)" stroke-width="2"')}
      ${rr(x + ew * 0.24, topY + eh * 0.12, ew * 0.52, eh * 0.66, ew * 0.26, 'class="earlight" fill="var(--earGlow,var(--sage))" filter="url(#softGlow)"')}
      ${rr(x + ew * 0.29, topY + eh * 0.14, ew * 0.42, eh * 0.6, ew * 0.21, 'class="earlight" fill="var(--earGlow,var(--sage))"')}
    </g>`;
    return ear(lx, -c.earTilt, lx + ew / 2) + ear(rx, c.earTilt, rx + ew / 2);
  }

  function earsBack(c) {
    const cx = 130, ew = c.earW, eh = c.earH, baseY = c.bodyTop + 8, topY = baseY - eh;
    if (c.earStyle === 'fin') {
      const fw = ew * 1.5, fh = eh * 0.5, ty = c.bodyTop - fh + 10;
      const fin = (x) => rr(x, ty, fw, fh, fh / 2, 'fill="url(#ivoryV)" stroke="var(--edge)" stroke-width="2"') +
        `<line x1="${x + fw / 2}" y1="${ty + 4}" x2="${x + fw / 2}" y2="${ty + fh - 4}" stroke="var(--edge)" stroke-width="1.4"/>`;
      return fin(cx - fw - 6) + fin(cx + 6);
    }
    const lx = cx - c.earGapInner / 2 - ew, rx = cx + c.earGapInner / 2;
    const ear = (x, rot, bx) => `<g transform="rotate(${rot} ${bx} ${baseY})">
      ${rr(x, topY, ew, eh, ew / 2, 'fill="url(#ivoryH)" stroke="var(--edge)" stroke-width="2"')}
      <line x1="${x + ew / 2}" y1="${topY + ew * 0.5}" x2="${x + ew / 2}" y2="${topY + eh - ew * 0.5}" stroke="var(--edge)" stroke-width="1.4"/>
    </g>`;
    return ear(lx, -c.earTilt, lx + ew / 2) + ear(rx, c.earTilt, rx + ew / 2);
  }

  function feet(c, bx, by, bw, bh) {
    if (c.base === 'disc') {
      const dy = by + bh - 4;
      return `<ellipse cx="130" cy="${dy + 16}" rx="${bw * 0.46}" ry="9" fill="url(#ivoryH)" stroke="var(--edge)" stroke-width="2"/>` +
        rr(130 - bw * 0.1, dy - 2, bw * 0.2, 12, 5, 'fill="var(--ivory-shade)" stroke="var(--edge)" stroke-width="1.6"');
    }
    const fw = bw * 0.2, fy = by + bh - 6;
    return rr(bx + bw * 0.12, fy, fw, 15, 7, 'fill="url(#ivoryV)" stroke="var(--edge)" stroke-width="2"') +
      rr(bx + bw - bw * 0.12 - fw, fy, fw, 15, 7, 'fill="url(#ivoryV)" stroke="var(--edge)" stroke-width="2"');
  }

  // ---- FRONT (beauty shot) ----
  function front(c) {
    const cx = 130, bw = c.bodyW, bh = c.bodyH, by = c.bodyTop, bx = cx - bw / 2;
    const sw = bw * 0.64 * (c.screenScale || 1), sh = bh * 0.6 * (c.screenScale || 1);
    const sx = cx - sw / 2, sy = by + bh * 0.17 + (c.faceDrop || 0);
    const sr = Math.min(sw, sh) * 0.26;
    let extra = '';
    if (c.arms) {
      extra += `<path d="M${bx - 4} ${by + bh * 0.55} q-20 6 -16 30 q1 6 6 4 q-2 -20 14 -24z" fill="var(--clay-soft)" stroke="var(--edge)" stroke-width="2"/>`;
      extra += `<path d="M${bx + bw + 4} ${by + bh * 0.55} q20 6 16 30 q-1 6 -6 4 q2 -20 -14 -24z" fill="var(--clay-soft)" stroke="var(--edge)" stroke-width="2"/>`;
    }
    let blush = '';
    if (c.blush) blush = `<ellipse cx="${sx + sw * 0.16}" cy="${sy + sh * 0.62}" rx="5" ry="3" fill="var(--clay)" opacity=".5"/><ellipse cx="${sx + sw * 0.84}" cy="${sy + sh * 0.62}" rx="5" ry="3" fill="var(--clay)" opacity=".5"/>`;
    return `<svg viewBox="0 0 260 ${c.vh || 300}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${c.name} front view">
      <ellipse cx="130" cy="${by + bh + 16}" rx="${bw * 0.48}" ry="10" fill="rgba(42,47,38,.12)" filter="url(#blurS)"/>
      ${earsFront(c)}
      ${extra}
      ${rr(bx, by, bw, bh, c.bodyRX, 'fill="url(#ivoryV)" stroke="var(--edge)" stroke-width="2"')}
      <path d="M${bx + 12} ${by + c.bodyRX} q0 -${c.bodyRX - 4} ${c.bodyRX - 4} -${c.bodyRX - 4} h${bw - 2 * (c.bodyRX + 6)}" stroke="#fff" stroke-width="3" fill="none" opacity=".5" stroke-linecap="round"/>
      ${rr(sx - 7, sy - 7, sw + 14, sh + 14, sr + 7, 'fill="var(--sage-soft)" stroke="var(--sage)" stroke-width="2"')}
      ${rr(sx, sy, sw, sh, sr, 'fill="url(#screenG)"')}
      ${face(c.faceType || 'calm', sx, sy, sw, sh)}
      ${blush}
      ${feet(c, bx, by, bw, bh)}
      <circle cx="${cx}" cy="${by + bh - 16}" r="4" fill="var(--ivory-shade)" stroke="var(--edge)" stroke-width="1.4"/>
    </svg>`;
  }

  // ---- SIDE ----
  function side(c) {
    const bw = c.bodyW * 0.94, bh = c.bodyH, by = c.bodyTop, cx = 130, bx = cx - bw / 2;
    const ew = c.earStyle === 'fin' ? c.earW * 0.5 : c.earW * 0.62, eh = c.earStyle === 'fin' ? c.earH * 0.5 : c.earH;
    const baseY = by + 8, topY = baseY - eh;
    const ear = c.earStyle === 'fin'
      ? rr(cx - ew, by - c.earH * 0.5 + 10, ew * 2, c.earH * 0.5, c.earH * 0.25, 'fill="url(#ivoryH)" stroke="var(--edge)" stroke-width="2"')
      : `<g transform="rotate(4 ${cx} ${baseY})">${rr(cx - ew / 2, topY, ew, eh, ew / 2, 'fill="url(#ivoryH)" stroke="var(--edge)" stroke-width="2"')}</g>`;
    const num = (x, y, n) => `<circle cx="${x}" cy="${y}" r="9" fill="var(--sage)"/><text x="${x}" y="${y + 3.4}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="var(--font-body)">${n}</text>`;
    return `<svg viewBox="0 0 260 ${c.vh || 300}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${c.name} side view">
      <ellipse cx="130" cy="${by + bh + 16}" rx="${bw * 0.48}" ry="10" fill="rgba(42,47,38,.12)" filter="url(#blurS)"/>
      ${ear}
      <g transform="rotate(-3 130 ${by + bh / 2})">
        ${rr(bx, by, bw, bh, c.bodyRX, 'fill="url(#ivoryH)" stroke="var(--edge)" stroke-width="2"')}
        <path d="M${bx + 8} ${by + bh * 0.17} v${bh * 0.6} a8 8 0 0 0 8 8" stroke="var(--sage)" stroke-width="2.4" fill="none" opacity=".8"/>
        <line x1="${bx + 5}" y1="${by + bh * 0.15}" x2="${bx + 5}" y2="${by + bh * 0.82}" stroke="var(--edge)" stroke-width="1.6" stroke-dasharray="3 4"/>
        <g fill="var(--ink-faint)">${[0, 1, 2].map(i => `<circle cx="${bx + 16 + i * 7}" cy="${by + bh - 22}" r="1.7"/>`).join('')}</g>
        <circle cx="${bx + 14}" cy="${by + bh * 0.13}" r="1.8" fill="var(--ink-faint)"/>
        <circle cx="${bx + 18}" cy="${by + bh - 40}" r="4.5" fill="none" stroke="var(--edge)" stroke-width="1.8"/>
        ${rr(bx + bw - 26, by + bh - 30, 18, 8, 4, 'fill="var(--surface-3)" stroke="var(--edge)" stroke-width="1.6"')}
      </g>
      ${feet(c, bx, by, bw, bh)}
      ${num(bx - 6, by + bh * 0.32, 1)}
      ${num(bx + 22, by + bh - 22, 3)}
      ${num(bx + 8, by + bh * 0.06, 4)}
      ${num(bx + 24, by + bh - 40, 5)}
      ${num(bx + bw + 2, by + bh - 26, 6)}
      ${num(130, by + bh + 14, 8)}
    </svg>`;
  }

  // ---- BACK ----
  function back(c) {
    const bw = c.bodyW, bh = c.bodyH, by = c.bodyTop, cx = 130, bx = cx - bw / 2;
    const px = bx + bw * 0.16, py = by + bh * 0.16, pw = bw * 0.68, ph = bh * 0.6;
    const screw = (x, y) => `<circle cx="${x}" cy="${y}" r="3.2" fill="var(--surface-3)" stroke="var(--edge)" stroke-width="1.4"/><line x1="${x - 1.8}" y1="${y}" x2="${x + 1.8}" y2="${y}" stroke="var(--ink-faint)" stroke-width="1"/>`;
    const num = (x, y, n) => `<circle cx="${x}" cy="${y}" r="9" fill="var(--sage)"/><text x="${x}" y="${y + 3.4}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="var(--font-body)">${n}</text>`;
    const grille = [];
    for (let r2 = 0; r2 < 2; r2++) for (let cc = 0; cc < 4; cc++) grille.push(`<circle cx="${cx - 11 + cc * 7}" cy="${by + bh - 26 + r2 * 7}" r="1.7" fill="var(--ink-faint)"/>`);
    return `<svg viewBox="0 0 260 ${c.vh || 300}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${c.name} back view">
      <ellipse cx="130" cy="${by + bh + 16}" rx="${bw * 0.48}" ry="10" fill="rgba(42,47,38,.12)" filter="url(#blurS)"/>
      ${earsBack(c)}
      ${rr(bx, by, bw, bh, c.bodyRX, 'fill="url(#ivoryH)" stroke="var(--edge)" stroke-width="2"')}
      ${rr(px, py, pw, ph, 16, 'fill="var(--ivory-shade)" stroke="var(--edge)" stroke-width="1.8"')}
      ${rr(px + 6, py + 6, pw - 12, ph - 12, 11, 'fill="none" stroke="var(--edge)" stroke-width="1.2" stroke-dasharray="4 4"')}
      ${screw(px + 9, py + 9)}${screw(px + pw - 9, py + 9)}${screw(px + 9, py + ph - 9)}${screw(px + pw - 9, py + ph - 9)}
      <g opacity=".6"><path d="M${cx} ${py + ph * 0.5} a4 4 0 1 0 .1 0z" fill="none" stroke="var(--sage)" stroke-width="1.6"/></g>
      <text x="${cx}" y="${py + ph * 0.42}" text-anchor="middle" font-size="9" letter-spacing="1.5" fill="var(--ink-faint)" font-family="var(--font-body)" font-weight="700">SOULMATE</text>
      ${grille.join('')}
      ${rr(cx - 9, by + bh - 12, 18, 8, 4, 'fill="var(--surface-3)" stroke="var(--edge)" stroke-width="1.6"')}
      ${feet(c, bx, by, bw, bh)}
      ${num(px - 4, py + ph * 0.5, 7)}
      ${num(cx + 26, by + bh - 22, 3)}
      ${num(cx, by + bh - 2, 6)}
      ${num(cx + 14, by - (c.earStyle === 'fin' ? 4 : c.earH * 0.4), 2)}
      ${num(px + pw * 0.5, py + ph * 0.66, 9)}
    </svg>`;
  }

  // ---- MINI (ear-state matrix) ----
  function mini(opts) {
    // opts: { motion, faceType }  — small front with animated ears
    const cx = 75, bw = 92, bh = 86, by = 52, bx = cx - bw / 2, ew = 20, eh = 46, gap = 16;
    const baseY = by + 6, topY = baseY - eh;
    const lx = cx - gap / 2 - ew, rx = cx + gap / 2;
    const sw = bw * 0.62, sh = bh * 0.6, sx = cx - sw / 2, sy = by + bh * 0.18, sr = 14;
    const lightInner = (x) => {
      if (opts.motion === 'travel') {
        const segH = (eh * 0.62) / 3;
        return [0, 1, 2].map(i =>
          rr(x + ew * 0.28, topY + eh * 0.13 + (2 - i) * segH, ew * 0.44, segH - 2, ew * 0.18,
            `class="earseg s${i + 1}" fill="var(--glow)"`)).join('');
      }
      return rr(x + ew * 0.26, topY + eh * 0.13, ew * 0.48, eh * 0.62, ew * 0.24, 'class="earlight" fill="var(--glow)" filter="url(#softGlow)"') +
        rr(x + ew * 0.3, topY + eh * 0.15, ew * 0.4, eh * 0.56, ew * 0.2, 'class="earlight" fill="var(--glow)"');
    };
    const ear = (x, rot) => `<g transform="rotate(${rot} ${x + ew / 2} ${baseY})">
      ${rr(x, topY, ew, eh, ew / 2, 'fill="url(#ivoryV)" stroke="var(--edge)" stroke-width="1.8"')}
      ${lightInner(x)}</g>`;
    return `<svg class="m-${opts.motion}" viewBox="0 0 150 150" width="132" height="132" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="75" cy="${by + bh + 9}" rx="${bw * 0.46}" ry="7" fill="rgba(42,47,38,.10)" filter="url(#blurS)"/>
      ${ear(lx, -7)}${ear(rx, 7)}
      ${rr(bx, by, bw, bh, 26, 'fill="url(#ivoryV)" stroke="var(--edge)" stroke-width="1.8"')}
      ${rr(sx - 5, sy - 5, sw + 10, sh + 10, sr + 5, 'fill="var(--sage-soft)" stroke="var(--sage)" stroke-width="1.6"')}
      ${rr(sx, sy, sw, sh, sr, 'fill="url(#screenG)"')}
      ${face(opts.faceType, sx, sy, sw, sh)}
    </svg>`;
  }

  window.CompanionSVG = { injectDefs, front, side, back, mini, face };
})();

/* companion-concept.js — content + rendering for the SoulMate companion body concept doc. */
(function () {
  const S = window.CompanionSVG;
  S.injectDefs();

  // ---------- concept geometry + content ----------
  const concepts = [
    {
      id: 'concept-a', tag: 'A', key: 'Mochi', name: 'Rounded cube companion',
      recommended: true,
      tagline: 'The recommended direction — a soft square body with rabbit‑ear status antennas and a friendly face screen.',
      geo: { name: 'Concept A', bodyW: 168, bodyH: 164, bodyTop: 84, bodyRX: 48, earW: 30, earH: 84, earGapInner: 36, earTilt: 8, earStyle: 'capsule', screenScale: 1, faceType: 'calm', base: 'feet', vh: 300 },
      palette: [['#FBFBF3', 'Ivory shell'], ['#2E9E6E', 'Sage accent'], ['#1C7A52', 'Deep sage'], ['#1F2A24', 'Face screen'], ['#F3F7EE', 'Cream']],
      material: 'Matte PLA or PETG main shell in warm ivory with a light bead‑blasted finish; ear diffusers printed in natural/white translucent PLA (or a frosted acrylic insert) for an even, soft glow; silicone non‑slip feet. No glossy surfaces — matte reads calmer and hides print layer lines.',
      hardware: [
        ['1', 'Face display', '1.69–2.0" IPS or round LCD behind a flush window, slight inward tilt.'],
        ['2', 'Ear light diffuser', 'Two side‑emitting LED strips / WS2812B inside translucent ear channels.'],
        ['3', 'Speaker grille', 'Bottom‑front I2S speaker; small hole array, angled to the desk for warmth.'],
        ['4', 'Microphone', 'Single MEMS mic pinhole, top‑front, away from the speaker to reduce echo.'],
        ['5', 'Power / touch', 'One capacitive touch dot or recessed button — mute & wake.'],
        ['6', 'USB‑C', 'Rear‑bottom port for power + flashing; no fragile connectors exposed.'],
        ['7', 'Removable back', 'Friction‑fit panel with 4× M3 heat‑set inserts for tidy assembly.'],
        ['8', 'Feet', 'Two soft feet give a stable, slightly forward‑leaning stance.'],
        ['9', 'ESP32 + battery', 'ESP32‑S3 mounted upright at the back; optional LiPo under the board.'],
      ],
      ear: 'The two upright ears are the clearest, most "creature‑like" place for a glance‑able status light. Their height gives the LED room to diffuse softly, and their symmetry makes pulsing and breathing read instantly from across a desk.',
      hci: 'Highest emotional warmth without tipping into toy territory. The cube gives generous, honest internal volume for student hardware, and the tall ears are the strongest canvas for the status‑light language that mirrors the app.',
    },
    {
      id: 'concept-b', tag: 'B', key: 'Sprout', name: 'Soft mascot version',
      tagline: 'A little more characterful — a rounder pebble body, a larger face, longer ears and gentle stub arms. Still calm, still buildable.',
      geo: { name: 'Concept B', bodyW: 156, bodyH: 178, bodyTop: 78, bodyRX: 64, earW: 30, earH: 96, earGapInner: 30, earTilt: 10, earStyle: 'capsule', screenScale: 1.06, faceType: 'calm', base: 'disc', arms: true, blush: true, faceDrop: -4, vh: 312 },
      palette: [['#FBFBF3', 'Ivory shell'], ['#2E9E6E', 'Sage accent'], ['#C77B5E', 'Clay blush'], ['#1F2A24', 'Face screen'], ['#ECF8F1', 'Sage tint']],
      material: 'Same ivory matte shell; soft TPU stub arms and a TPU foot‑ring add a tactile, huggable quality. Optional faint clay blush printed or painted on the screen bezel for warmth. Slightly thicker walls to keep the rounder form sturdy.',
      hardware: [
        ['1', 'Face display', 'Larger round/oval LCD — the face is the emotional centre here.'],
        ['2', 'Ear light diffuser', 'Longer ear channels; more LED length for expressive motion.'],
        ['3', 'Speaker grille', 'Bottom‑firing into the disc base, which gently amplifies.'],
        ['4', 'Microphone', 'Top‑front pinhole, hidden in the seam line.'],
        ['5', 'Power / touch', 'Touch dot on the chest; arms are fixed (no mechanism).'],
        ['6', 'USB‑C', 'Rear‑bottom, routed through the disc base for cable tidiness.'],
        ['7', 'Removable back', 'Curved back panel, 4× M3 inserts — slightly trickier on a round body.'],
        ['8', 'Base', 'Weighted disc base lowers the centre of gravity for stability.'],
        ['9', 'ESP32 + battery', 'ESP32‑S3 + LiPo stacked vertically; rounder body reduces free volume.'],
      ],
      ear: 'Longer ears exaggerate the same status motions for a more expressive, pet‑like read — lovely for emotional comfort, though the extra length needs a thicker base to stay print‑sturdy.',
      hci: 'Most emotionally inviting and the most "companion‑like". The trade‑off: the rounder body and arms are fiddlier to print and assemble, and risk reading slightly young for an academic audience.',
    },
    {
      id: 'concept-c', tag: 'C', key: 'Tile', name: 'Minimal desk device',
      tagline: 'More product than mascot — a refined, low body with rabbit‑ear‑inspired light fins and a minimal face. Mature and quiet.',
      geo: { name: 'Concept C', bodyW: 186, bodyH: 150, bodyTop: 96, bodyRX: 38, earW: 30, earH: 70, earTilt: 0, earStyle: 'fin', screenScale: 0.92, faceType: 'calm', base: 'disc', vh: 300 },
      palette: [['#FBFBF3', 'Ivory shell'], ['#E2EAD9', 'Stone grey'], ['#2E9E6E', 'Sage line'], ['#1F2A24', 'Face screen'], ['#5A6353', 'Olive detail']],
      material: 'Matte stone‑and‑ivory two‑tone, finely textured like a quality desk object. The "ears" become two short rounded light fins integrated into the top edge — a subtle nod to the identity rather than a literal rabbit. The most refined, fingerprint‑resistant finish.',
      hardware: [
        ['1', 'Face display', 'Small minimal LCD showing a two‑dot face — calm, not cartoonish.'],
        ['2', 'Ear light fin', 'Two short LED light bars in the top edge; same status language, quieter.'],
        ['3', 'Speaker grille', 'Recessed slot along the lower front edge.'],
        ['4', 'Microphone', 'Pinhole on the top surface near the fins.'],
        ['5', 'Power / touch', 'Flush touch zone on the top — minimal and hidden.'],
        ['6', 'USB‑C', 'Rear‑bottom, fully concealed when viewed from the front.'],
        ['7', 'Removable back', 'Flat back panel with 4× M3 inserts — easiest of the three to print.'],
        ['8', 'Base', 'Low slim foot; the wide stance is inherently stable.'],
        ['9', 'ESP32 + battery', 'Wide flat body = the most generous, easiest electronics bay.'],
      ],
      ear: 'Two short light fins carry the identical seven‑state light language in a more understated way. They are the sturdiest and most print‑friendly ear form, but lose some of the creature warmth that makes the companion feel alive.',
      hci: 'The most mature and product‑like, and the easiest to build. The cost is emotional presence — it reads as a calm appliance more than a companion, which is slightly off‑brief for SoulMate\'s warmth.',
    },
  ];

  // ---------- ear-state matrix ----------
  const states = [
    { n: 1, label: 'Idle / ready', motion: 'breath', glow: '#2E9E6E', face: 'calm', web: 'Ready when you are', ear: 'Both ears breathe slowly in soft green.', cue: 'Read by the <b>slow breathing rhythm</b> + relaxed face — calm, not asleep.' },
    { n: 2, label: 'Listening', motion: 'pulse', glow: '#2E9E6E', face: 'attentive', web: 'Listening…', ear: 'A gentle synchronised pulse, a touch quicker.', cue: 'Read by the <b>quicker pulse</b> + wide attentive eyes.' },
    { n: 3, label: 'Transcribing', motion: 'travel', glow: '#3F8FA8', face: 'dots', web: 'Transcribing…', ear: 'A light travels upward through the ears.', cue: 'Read by <b>upward travelling motion</b> + “…” on the face.' },
    { n: 4, label: 'Preparing a response', motion: 'steady', glow: '#CCA24F', face: 'think', web: 'Preparing a response…', ear: 'A calm, completely steady glow — no motion.', cue: 'Read by the <b>still, motionless glow</b> + thinking face.' },
    { n: 5, label: 'Speaking (ESP32)', motion: 'rhythm', glow: '#C77B5E', face: 'talk', web: 'Speaking through ESP32', ear: 'A warm glow flickers in rhythm with speech.', cue: 'Read by <b>speech‑rhythm flicker</b> + a moving mouth.' },
    { n: 6, label: 'Microphone off', motion: 'off', glow: '#9AA79A', face: 'mute', web: 'Microphone off · Private', ear: 'Ears are dimmed to near‑dark.', cue: 'Read by <b>ears going dark</b> + a mic‑off icon on the face.' },
    { n: 7, label: 'Connection issue', motion: 'error', glow: '#D98A3D', face: 'alert', web: 'Reconnecting…', ear: 'A soft, slow amber breathe — never an alarming red.', cue: 'Read by <b>slow amber breathing</b> + a gentle alert face + text.' },
  ];

  // ---------- helpers ----------
  const ic = {
    warm: '<path d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.6 6.7 19.1l1-5.8-4.2-4.1 5.9-.9z"/>',
    heart: '<path d="M20.8 7.6a5 5 0 0 0-8.8-2.3A5 5 0 0 0 3.2 7.6c0 4 5.5 8 8.8 10.4 3.3-2.4 8.8-6.4 8.8-10.4z"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L4 16.8 7.2 20l5.3-5.3a4 4 0 0 0 5.2-5.4l-2.7 2.7-2.3-2.3z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    layers: '<path d="M12 2 2 7l10 5 10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  };
  const lic = (p, sz = 18, sw = 1.9) => `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  // ---------- render: hero ----------
  document.getElementById('hero-art').innerHTML =
    `<div style="width:100%;max-width:300px;filter:drop-shadow(0 24px 40px rgba(42,47,38,.14));">${S.front(concepts[0].geo)}</div>`;

  // ---------- render: principles ----------
  const principles = [
    ['warm', 'Warm, not clinical', 'Ivory shell, rounded everything, soft sage light. It belongs on a bedside table, not a lab bench.'],
    ['heart', 'Soft &amp; emotionally safe', 'No red alarms, no harsh beeps. Even errors stay gentle amber. The face is friendly but mature.'],
    ['eye', 'Status you can glance', 'The ears tell you what it\'s doing from across the room — motion first, colour second, text always.'],
    ['wrench', 'Buildable &amp; honest', 'Thick walls, no moving parts, real ports and an access panel. Designed to actually print and assemble.'],
  ];
  document.getElementById('principles-grid').innerHTML = principles.map(([i, t, d]) =>
    `<div class="card principle"><div class="ic">${lic(ic[i], 20)}</div><h4 class="serif">${t}</h4><p>${d}</p></div>`).join('');

  // ---------- render: ear matrix ----------
  document.getElementById('earmatrix').innerHTML = states.map(s =>
    `<div class="card state" style="--glow:${s.glow}">
      <div class="mini">${S.mini({ motion: s.motion, faceType: s.face })}</div>
      <h4 class="serif"><span class="stnum">${s.n}</span>${s.label}</h4>
      <div class="ear-behaviour">${s.ear}</div>
      <span class="webchip"><span class="wd"></span>${s.web}</span>
      <div class="cue"><span>↳</span><span>${s.cue}</span></div>
    </div>`).join('');

  // ---------- render: concepts ----------
  const root = document.getElementById('concepts-root');
  root.innerHTML = `<div class="sec-head"><div class="num">03</div><h2 class="serif">Three concept variations</h2>
    <p>Each shares the same DNA — ivory body, sage‑lit rabbit ears, a face screen, and the seven‑state light language above — but trades emotional character against product restraint and build effort.</p></div>` +
    concepts.map(c => `
    <section class="concept" id="${c.id}">
      <div class="concept-head">
        <div class="concept-tag">${c.tag}</div>
        <div class="meta"><h3 class="serif">${c.name}</h3><p>“${c.key}” · ${c.tagline}</p></div>
        ${c.recommended ? '<span class="rec-badge">★ Recommended</span>' : ''}
      </div>
      <div class="views">
        <div class="view"><span class="vlabel">Front</span>${S.front(c.geo)}</div>
        <div class="view"><span class="vlabel">Side</span>${S.side(c.geo)}</div>
        <div class="view"><span class="vlabel">Back</span>${S.back(c.geo)}</div>
      </div>
      <div class="concept-body">
        <div class="cb-col">
          <div class="cb-block"><div class="label">Colour palette</div>
            <div class="swatches">${c.palette.map(([h, n]) => `<span class="sw"><span class="chipcol" style="background:${h}"></span>${n}</span>`).join('')}</div>
          </div>
          <div class="cb-block"><div class="label">Material &amp; finish</div><p>${c.material}</p></div>
          <div class="cb-block"><div class="label">Ear feedback</div><p>${c.ear}</p></div>
          <div class="cb-block"><div class="label">HCI rationale</div><p>${c.hci}</p></div>
        </div>
        <div class="cb-col">
          <div class="cb-block"><div class="label">Hardware placement</div>
            <ul class="hwlist">${c.hardware.map(([n, t, d]) => `<li><span class="n">${n}</span><span><b>${t}.</b> ${d}</span></li>`).join('')}</ul>
          </div>
        </div>
      </div>
    </section>`).join('');

  // ---------- render: comparison ----------
  const criteria = [
    ['Emotional comfort', 'high', 'high', 'med'],
    ['HCI clarity (ear status)', 'high', 'high', 'med'],
    ['ESP32 prototyping realism', 'high', 'med', 'high'],
    ['3D‑print feasibility', 'high', 'med', 'high'],
    ['Consistency with the app', 'high', 'med', 'high'],
    ['Academic maturity', 'high', 'med', 'high'],
  ];
  const word = { high: 'Strong', med: 'Fair', low: 'Weak' };
  document.getElementById('cmp').innerHTML =
    `<thead><tr><th>Criterion</th><th>A · Rounded cube</th><th>B · Soft mascot</th><th>C · Minimal desk</th></tr></thead>
     <tbody>${criteria.map(([crit, a, b, cc]) =>
      `<tr><td>${crit}</td>${[a, b, cc].map(r => `<td><span class="rate ${r}"><span class="bead"></span>${word[r]}</span></td>`).join('')}</tr>`).join('')}
     <tr class="winner"><td>Overall</td><td><span class="rate high"><span class="bead"></span>Recommended</span></td><td><span class="rate med"><span class="bead"></span>Strong character</span></td><td><span class="rate high"><span class="bead"></span>Most refined</span></td></tr>
     </tbody>`;

  // ---------- render: recommendation ----------
  const recWhy = [
    ['heart', 'Emotional comfort', 'The upright‑eared cube is warm and alive without becoming childish.'],
    ['eye', 'HCI clarity', 'Tall ears are the best canvas for glance‑able, multi‑modal status feedback.'],
    ['cpu', 'ESP32 realism', 'A true cube gives the most honest internal volume for board, speaker & battery.'],
    ['layers', '3D‑print feasibility', 'Flat faces, thick walls, no overhangs or moving parts — forgiving to print.'],
    ['sparkle', 'App consistency', 'Ivory + sage + the same status pipeline make it unmistakably SoulMate.'],
    ['check', 'Academically defensible', 'Buildable, justified by HCI principles, and easy to evaluate with users.'],
  ];
  document.getElementById('rec').innerHTML =
    `<div class="rec-art"><div style="filter:drop-shadow(0 18px 30px rgba(42,47,38,.16));">${S.front(concepts[0].geo)}</div></div>
     <div class="rec-text">
       <div class="label" style="color:var(--sage-deep)">The strongest concept</div>
       <h3 class="serif">Concept A — the rounded cube companion</h3>
       <p style="font-size:15px;color:var(--ink-soft)">For SoulMate it best balances a genuinely comforting presence with clear, accessible status feedback and a build that a final‑year student can actually print, wire to an ESP32, and defend. Concept C is the strong fallback if a more product‑like, minimal direction is preferred; Concept B is the choice if maximum emotional warmth outweighs build simplicity.</p>
       <div class="why">${recWhy.map(([i, t, d]) => `<div class="rec-why"><div class="ic">${lic(ic[i], 16, 2)}</div><div><b>${t}</b><span>${d}</span></div></div>`).join('')}</div>
     </div>`;
})();

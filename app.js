import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {
  SUPABASE_URL, SUPABASE_KEY, SITE_NAME, TAGLINE, CONTACT_EMAIL,
  MAP_CENTER, MAP_ZOOM, CATEGORIES, BADGES, PHOTOS, WAYS, DONATE_URL, ANYTIME, PLACES,
} from './config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const app = document.getElementById('app');
const TZ = 'America/Chicago';

let session = null;
let profile = null;
let activeMaps = [];

/* ================= helpers ================= */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtHours = (h) => { const n = Number(h || 0); return Number.isInteger(n) ? String(n) : n.toFixed(1); };
const fmtDate = (d, opts) => new Date(d).toLocaleString('en-US', { timeZone: TZ, ...opts });
const fmtWhen = (s, e) =>
  `${fmtDate(s, { weekday: 'short', month: 'short', day: 'numeric' })} · ${fmtDate(s, { hour: 'numeric', minute: '2-digit' })}–${fmtDate(e, { hour: 'numeric', minute: '2-digit' })}`;
const fmtDay = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3200);
}
function cleanError(err) {
  const m = err?.message || String(err);
  if (m.includes('Invalid login')) return 'Wrong email or password.';
  if (m.includes('already registered')) return 'That email already has an account. Try logging in.';
  return m;
}
function go(path) { location.hash = path; }
function needLogin() {
  if (!session) { sessionStorage.setItem('afterLogin', location.hash); go('#/login'); return true; }
  return false;
}
function clearMaps() { activeMaps.forEach((m) => m.remove()); activeMaps = []; }
function waitForLeaflet() {
  return new Promise((res) => { const t = () => (window.L ? res() : setTimeout(t, 50)); t(); });
}
async function makeMap(el, center = MAP_CENTER, zoom = MAP_ZOOM) {
  await waitForLeaflet();
  const map = L.map(el, { scrollWheelZoom: false }).setView(center, zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
  activeMaps.push(map);
  return map;
}
function badgeFor(hours) { return [...BADGES].reverse().find((b) => hours >= b.hours) || null; }
function nextBadge(hours) { return BADGES.find((b) => hours < b.hours) || null; }
function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint32Array(6)), (n) => chars[n % chars.length]).join('');
}
function localInputToISO(v) { return v ? new Date(v).toISOString() : null; }

const CAT_ICON = { Cleanup: '🧹', Food: '🥫', Animals: '🐶', Seniors: '👵', 'Kids & Tutoring': '📚', 'Snow & Yard': '❄️', Environment: '🌱', 'Drives & Donations': '📦', Other: '🛠️' };
const CAT_PHOTO = { Cleanup: 'cleanup', Food: 'food', Animals: 'animals', Environment: 'garden', Other: 'paint', Seniors: 'smile1', 'Kids & Tutoring': 'smile2', 'Drives & Donations': 'food' };
const catIcon = (c) => CAT_ICON[c] || '🤝';
const catPhoto = (c) => (CAT_PHOTO[c] ? PHOTOS[CAT_PHOTO[c]] : null);
const img = (src, alt = '') => (src ? `<img src="${src}" alt="${esc(alt)}" loading="lazy" onerror="this.remove()">` : '');
function pinIcon(cat) {
  return L.divIcon({ className: '', html: `<div class="pin"><span>${catIcon(cat)}</span></div>`, iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -32] });
}

/* scroll reveal + count-up numbers */
let revealObs;
function setupReveal() {
  revealObs?.disconnect();
  revealObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      if (en.target.dataset.count != null) countUp(en.target);
      revealObs.unobserve(en.target);
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal, [data-count]').forEach((el) => revealObs.observe(el));
}
function countUp(el) {
  const target = Number(el.dataset.count) || 0;
  const t0 = performance.now(), dur = 1400;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur), eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmtHours(Math.round(target * eased * 10) / 10);
    if (p < 1) requestAnimationFrame(step); else el.textContent = fmtHours(target);
  };
  requestAnimationFrame(step);
}

/* confetti 🎉 */
function confetti() {
  const c = document.getElementById('confetti'), ctx = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight;
  const colors = ['#ff6b4a', '#ffc145', '#2f8fd0', '#17594a', '#ffffff'];
  const parts = Array.from({ length: 160 }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .35,
    vx: (Math.random() - .5) * 16, vy: -Math.random() * 14 - 4,
    r: Math.random() * 6 + 4, c: colors[(Math.random() * colors.length) | 0], a: Math.random() * 6, s: (Math.random() - .5) * .3,
  }));
  let frames = 0;
  (function tick() {
    ctx.clearRect(0, 0, c.width, c.height);
    parts.forEach((p) => {
      p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.s;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore();
    });
    if (++frames < 170) requestAnimationFrame(tick); else ctx.clearRect(0, 0, c.width, c.height);
  })();
}

/* top bar turns solid when you scroll */
addEventListener('scroll', () => document.getElementById('topbar').classList.toggle('scrolled', scrollY > 30), { passive: true });

/* ================= auth ================= */
async function loadProfile() {
  profile = null;
  if (!session) return;
  const { data } = await sb.from('profiles').select('id, full_name, is_admin').eq('id', session.user.id).maybeSingle();
  profile = data || { id: session.user.id, full_name: '', is_admin: false };
}
function renderNavAuth() {
  const el = document.getElementById('nav-auth');
  if (session) {
    el.innerHTML = `${profile?.is_admin ? '<a href="#/admin">Admin</a>' : ''}<a href="#" id="logout">Log out</a>`;
    document.getElementById('logout').onclick = async (e) => { e.preventDefault(); await sb.auth.signOut(); toast('Logged out'); go('#/'); };
  } else {
    el.innerHTML = `<a href="#/login" class="btn small">Log in / Sign up</a>`;
  }
  const path = location.hash.split('/')[1] || '';
  document.querySelectorAll('nav a').forEach((a) => {
    const p = (a.getAttribute('href') || '').split('/')[1] || '';
    a.classList.toggle('active', a.getAttribute('href')?.startsWith('#/') && p === path);
  });
}

/* ================= pages ================= */
async function pageHome() {
  const [{ data: events, error }, { data: counts }, { data: stats }] = await Promise.all([
    sb.from('events').select('id,title,description,category,location_name,lat,lng,starts_at,ends_at,hours,capacity')
      .gte('ends_at', new Date().toISOString()).order('starts_at'),
    sb.rpc('signup_counts'),
    sb.rpc('site_stats'),
  ]);
  if (error) throw error;
  const countMap = Object.fromEntries((counts || []).map((c) => [c.event_id, c.n]));
  const s = (stats && stats[0]) || { total_hours: 0, volunteers: 0, events: 0 };
  const words = ['pick up trash', 'pack meals', 'walk shelter dogs', 'plant trees', 'shovel snow', 'help neighbors'];

  app.innerHTML = `
    <section class="hero">
      <div class="hero-bg" style="background-image:url('${PHOTOS.hero}')"></div>
      <div class="hero-inner">
        <span class="eyebrow" style="color:var(--gold)">Free · Minnesota · Community-powered</span>
        <h1>Come <span class="rotator" id="rot"><span>${words[0]}</span></span><br>with your neighbors.</h1>
        <p class="lead">Find volunteer events near you, check in on site, and get credit for every hour you give. Badges, a leaderboard, and a printable certificate included.</p>
        <div class="actions">
          <a class="btn" href="#events">Find an event →</a>
          ${session ? '<a class="btn glass" href="#/me">See my hours</a>' : '<a class="btn glass" href="#/login">Join free</a>'}
        </div>
        <div class="hero-chips"><span>🧹 Cleanups</span><span>🥫 Food shelves</span><span>🐶 Animal shelters</span><span>❄️ Snow shoveling</span><span>🌱 Gardens</span></div>
      </div>
    </section>

    <div class="wrap stats-band">
      <div class="stats">
        <div class="stat reveal"><div class="ico">⏱️</div><div><b data-count="${Number(s.total_hours)}">0</b><span>verified hours volunteered</span></div></div>
        <div class="stat reveal d1"><div class="ico">🙌</div><div><b data-count="${Number(s.volunteers)}">0</b><span>volunteers with logged hours</span></div></div>
        <div class="stat reveal d2"><div class="ico">📍</div><div><b data-count="${Number(s.events)}">0</b><span>events posted</span></div></div>
      </div>
    </div>

    <section class="section wrap" id="ways">
      <div class="section-head reveal">
        <div><span class="eyebrow">Ways to help</span><h2>Pick what you love.<br>We'll find the event.</h2></div>
        <p>Tap a card to see upcoming events for it. No experience needed, just show up ready to help.</p>
      </div>
      <div class="ways">
        ${WAYS.map((w, i) => `
          <button class="way reveal d${i % 3 + 1} ${w.photo ? '' : 'snow'}" data-cat="${esc(w.cat)}">
            ${w.photo ? img(PHOTOS[w.photo], w.title) : `<span class="big-ico">${w.icon}</span>`}
            <div class="way-body"><h3>${esc(w.title)}</h3><p>${esc(w.blurb)}</p><span class="go">See events <i>→</i></span></div>
          </button>`).join('')}
      </div>
    </section>

    <section class="wrap">
      <div class="how reveal">
        <span class="eyebrow" style="color:var(--gold)">How it works</span>
        <h2>From couch to community<br>in four steps.</h2>
        <div class="steps">
          <div class="step reveal d1"><div class="num">🔍</div><small>STEP 1</small><h3>Find an event</h3><p>Browse the map for something near you that you'd actually enjoy.</p></div>
          <div class="step reveal d2"><div class="num">✋</div><small>STEP 2</small><h3>Save your spot</h3><p>One tap to sign up so the organizer knows you're coming.</p></div>
          <div class="step reveal d3"><div class="num">🔑</div><small>STEP 3</small><h3>Check in on site</h3><p>Enter the code the event leader gives out. Your hours are verified on the spot.</p></div>
          <div class="step reveal d4"><div class="num">🏅</div><small>STEP 4</small><h3>Get the credit</h3><p>Earn badges, climb the leaderboard, and print a certificate anytime.</p></div>
        </div>
      </div>
    </section>

    <section class="section wrap" id="events">
      <div class="section-head reveal">
        <div><span class="eyebrow">Upcoming</span><h2>Events near you</h2></div>
        <div class="filters" id="filters">
          <button class="chip on" data-cat="">All</button>
          ${CATEGORIES.map((c) => `<button class="chip" data-cat="${esc(c)}">${catIcon(c)} ${esc(c)}</button>`).join('')}
        </div>
      </div>
      <div class="events-layout">
        <div class="grid" id="list"></div>
        <div class="map-sticky"><div id="map"></div></div>
      </div>
    </section>

    <section class="section wrap" style="padding-top:0">
      <div class="anytime-band reveal">
        <div>
          <span class="eyebrow">No event this week?</span>
          <h2>Do good anytime.</h2>
          <p class="muted" style="font-size:1.05rem;max-width:440px">Litter walks, shoveling for neighbors, care kits and more. Do it on your own time, then log your hours in seconds.</p>
          <a class="btn" href="#/anytime">See anytime ideas →</a>
        </div>
        <div class="anytime-mini">
          ${ANYTIME.slice(0, 6).map((a) => `<a href="#/anytime" class="mini"><span>${a.icon}</span>${esc(a.title)}</a>`).join('')}
        </div>
      </div>
    </section>

    <section class="section wrap" style="padding-top:0">
      <div class="impact">
        <div class="mosaic reveal">
          <div>${img(PHOTOS.smile1, 'Smiling volunteer at a park cleanup')}</div>
          <div>${img(PHOTOS.garden, 'Volunteers planting flowers')}</div>
          <div>${img(PHOTOS.smile2, 'Volunteer smiling during a cleanup')}</div>
        </div>
        <div class="reveal d2">
          <span class="eyebrow">Why LendAHand MN</span>
          <h2>Hours that actually count.</h2>
          <p class="muted" style="font-size:1.05rem">Need service hours for school, a club, Greek life, or a scholarship? Every hour you check in with a code is verified, so the people you turn it in to can trust it.</p>
          <ul class="checklist">
            <li><b>✓</b><span><strong>Verified check-ins.</strong> Organizers share a code on site, so no fake hours.</span></li>
            <li><b>✓</b><span><strong>One-click certificate.</strong> Print or save as PDF whenever you need it.</span></li>
            <li><b>✓</b><span><strong>100% free.</strong> No ads, no fees, no catch.</span></li>
          </ul>
          <a class="btn green" href="${session ? '#/me' : '#/login'}">${session ? 'View my hours' : 'Start tracking free'}</a>
        </div>
      </div>
    </section>

    <section class="wrap">
      <div class="section-head reveal" style="margin-bottom:1rem">
        <div><span class="eyebrow">Level up</span><h2>Collect badges as you go</h2></div>
        <p>Earned with verified hours. How far can you get?</p>
      </div>
      <div class="badge-strip">
        ${BADGES.map((b, i) => `<div class="badge reveal d${i % 5 + 1}"><div class="i">${b.icon}</div><div class="n">${b.name}</div><div class="h">${b.hours} hour${b.hours > 1 ? 's' : ''}</div></div>`).join('')}
      </div>
    </section>

    <section class="section wrap">
      <div class="donate-band reveal">
        <div class="bg" style="background-image:url('${PHOTOS.together}')"></div>
        <div>
          <span class="eyebrow" style="color:var(--gold)">Support the mission</span>
          <h2>Can't make it out?<br>Chip in instead.</h2>
          <p style="opacity:.88;max-width:480px">Donations help cover gloves, trash bags, water and supplies for volunteer events around Minnesota.</p>
        </div>
        <div style="display:flex;gap:.7rem;flex-wrap:wrap;justify-content:flex-start">
          <a class="btn gold" href="#/donate">💛 Donate</a>
          <a class="btn glass" href="#/about">Host an event</a>
        </div>
      </div>
    </section>`;

  // rotating words in the headline
  let wi = 0;
  const rot = document.getElementById('rot');
  clearInterval(window._rot);
  window._rot = setInterval(() => {
    if (!document.body.contains(rot)) return clearInterval(window._rot);
    wi = (wi + 1) % words.length;
    rot.innerHTML = `<span>${words[wi]}</span>`;
  }, 2200);

  const map = await makeMap(document.getElementById('map'));
  const layer = L.layerGroup().addTo(map);
  const markers = {};

  const draw = (cat) => {
    const list = (events || []).filter((e) => !cat || e.category === cat);
    layer.clearLayers();
    document.getElementById('list').innerHTML = list.length ? list.map((e) => {
      const n = countMap[e.id] || 0;
      const full = e.capacity && n >= e.capacity;
      return `
      <a class="card event-card" href="#/event/${e.id}" data-id="${e.id}">
        <div class="date-box"><div class="m">${fmtDate(e.starts_at, { month: 'short' })}</div><div class="d">${fmtDate(e.starts_at, { day: 'numeric' })}</div></div>
        <div style="flex:1;min-width:0">
          <h3>${catIcon(e.category)} ${esc(e.title)}</h3>
          <div class="meta"><span>🕒 ${fmtWhen(e.starts_at, e.ends_at)}</span><span>📍 ${esc(e.location_name)}</span></div>
          <div class="tags">
            <span class="tag">${esc(e.category)}</span>
            <span class="tag sun">⏱️ ${fmtHours(e.hours)} hrs</span>
            <span class="tag ${full ? 'coral' : 'gray'}">🙋 ${n}${e.capacity ? ' / ' + e.capacity : ''} going${full ? ' · FULL' : ''}</span>
          </div>
          ${e.capacity ? `<div class="spots"><div style="width:${Math.min(100, (n / e.capacity) * 100)}%"></div></div>` : ''}
        </div>
      </a>`;
    }).join('') : `<div class="card empty"><span class="big">🌤️</span>No upcoming events${cat ? ' in this category' : ''} yet.<br>Check back soon, or <a href="#/about">suggest one</a>!</div>`;
    const pts = [];
    list.forEach((e) => {
      if (e.lat == null || e.lng == null) return;
      pts.push([e.lat, e.lng]);
      markers[e.id] = L.marker([e.lat, e.lng], { icon: pinIcon(e.category) }).addTo(layer)
        .bindPopup(`<strong>${esc(e.title)}</strong><br>${fmtWhen(e.starts_at, e.ends_at)}<br><a href="#/event/${e.id}">View event →</a>`);
    });
    if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40], maxZoom: 12, animate: false });
    else if (pts.length === 1) map.setView(pts[0], 12, { animate: false });
    // hovering a card highlights its pin
    document.querySelectorAll('#list .event-card').forEach((card) => {
      card.onmouseenter = () => { const m = markers[card.dataset.id]; if (m) { m.openPopup(); } };
    });
  };
  draw('');
  const pick = (cat) => {
    document.querySelectorAll('#filters .chip').forEach((c) => c.classList.toggle('on', c.dataset.cat === cat));
    draw(cat);
  };
  document.getElementById('filters').onclick = (ev) => { const b = ev.target.closest('.chip'); if (b) pick(b.dataset.cat); };
  document.querySelectorAll('.way').forEach((w) => (w.onclick = () => {
    pick(w.dataset.cat);
    document.getElementById('events').scrollIntoView({ behavior: 'smooth' });
  }));
  if (location.hash === '#events') setTimeout(() => document.getElementById('events').scrollIntoView(), 50);
}

async function pageEvent(id) {
  const { data: e, error } = await sb.from('events')
    .select('id,title,description,category,location_name,lat,lng,starts_at,ends_at,hours,capacity').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!e) { app.innerHTML = `<div class="card empty">Event not found. <a href="#/">Back to events</a></div>`; return; }

  const { data: counts } = await sb.rpc('signup_counts');
  const going = (counts || []).find((c) => c.event_id === id)?.n || 0;
  let mine = false, checkedIn = false;
  if (session) {
    const [{ data: s }, { data: h }] = await Promise.all([
      sb.from('signups').select('event_id').eq('event_id', id).eq('user_id', session.user.id).maybeSingle(),
      sb.from('hours_log').select('id').eq('event_id', id).eq('user_id', session.user.id).maybeSingle(),
    ]);
    mine = !!s; checkedIn = !!h;
  }
  const now = Date.now();
  const start = new Date(e.starts_at).getTime(), end = new Date(e.ends_at).getTime();
  const checkinOpen = now >= start - 3600e3 && now <= end + 3 * 86400e3;
  const ended = now > end;
  const full = e.capacity && going >= e.capacity && !mine;

  app.innerHTML = `
    <p style="margin-top:0"><a href="#/" style="font-weight:600;text-decoration:none">← All events</a></p>
    <div class="event-hero">
      ${img(catPhoto(e.category), e.category)}
      <div><span class="tag sun">${catIcon(e.category)} ${esc(e.category)}</span></div>
      <h1 style="margin:.7rem 0 .6rem;color:#fff">${esc(e.title)}</h1>
      <div class="meta">
        <span>🕒 ${fmtWhen(e.starts_at, e.ends_at)}</span>
        <span>📍 ${esc(e.location_name)}</span>
        <span>⏱️ ${fmtHours(e.hours)} hours</span>
        <span>🙋 ${going}${e.capacity ? ' / ' + e.capacity : ''} going</span>
      </div>
    </div>
    <div class="split">
      <div class="card">
        <h3>About this event</h3>
        <p style="white-space:pre-wrap;margin-top:.3rem">${esc(e.description) || '<span class="muted">More details coming soon.</span>'}</p>
        <div id="actions" style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1.2rem"></div>
        <div id="checkin"></div>
        ${e.lat != null ? `<p class="help" style="margin-top:1rem"><a target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}">Get directions in Google Maps ↗</a></p>` : ''}
      </div>
      <div>
        ${e.lat != null ? '<div class="map medium" id="emap"></div>' : ''}
        <div id="admin-box"></div>
      </div>
    </div>`;

  // sign up / cancel
  const actions = document.getElementById('actions');
  if (checkedIn) {
    actions.innerHTML = `<span class="tag" style="font-size:.95rem;padding:.5rem .9rem">✅ Checked in · ${fmtHours(e.hours)} hours logged</span>`;
  } else if (!ended) {
    if (mine) {
      actions.innerHTML = `<span class="tag" style="font-size:.95rem;padding:.5rem .9rem">✅ You're signed up</span><button class="btn danger small" id="cancel">Cancel my spot</button>`;
      document.getElementById('cancel').onclick = async () => {
        const { error } = await sb.from('signups').delete().eq('event_id', id).eq('user_id', session.user.id);
        if (error) return toast(cleanError(error));
        toast('Spot cancelled'); render();
      };
    } else {
      actions.innerHTML = full ? `<button class="btn" disabled>Event is full</button>` : `<button class="btn" id="join">✋ Save my spot</button>`;
      const j = document.getElementById('join');
      if (j) j.onclick = async () => {
        if (needLogin()) return;
        const { error } = await sb.from('signups').insert({ event_id: id, user_id: session.user.id });
        if (error) return toast(cleanError(error));
        confetti(); toast("You're signed up! 🎉"); render();
      };
    }
  }

  // check-in
  if (!checkedIn && checkinOpen) {
    document.getElementById('checkin').innerHTML = `
      <div class="checkin-box">
        <strong>📍 At the event?</strong> Enter the check-in code your event leader gives you to log verified hours.
        <form id="cform">
          <input id="code" placeholder="CODE" maxlength="12" autocomplete="off">
          <button class="btn">Check in ✓</button>
        </form>
      </div>`;
    document.getElementById('cform').onsubmit = async (ev) => {
      ev.preventDefault();
      if (needLogin()) return;
      const code = document.getElementById('code').value.trim();
      if (!code) return;
      const { data, error } = await sb.rpc('check_in', { p_event: id, p_code: code });
      if (error) return toast(cleanError(error));
      confetti(); toast(`Checked in! +${fmtHours(data)} verified hours 🎉`); render();
    };
  }

  if (e.lat != null) {
    const m = await makeMap(document.getElementById('emap'), [e.lat, e.lng], 13);
    L.marker([e.lat, e.lng], { icon: pinIcon(e.category) }).addTo(m);
  }

  // admin panel
  if (profile?.is_admin) {
    const [{ data: codeRow }, { data: people }] = await Promise.all([
      sb.from('event_codes').select('code').eq('event_id', id).maybeSingle(),
      sb.from('signups').select('created_at, profiles(full_name)').eq('event_id', id).order('created_at'),
    ]);
    const { data: logged } = await sb.from('hours_log').select('user_id').eq('event_id', id);
    document.getElementById('admin-box').innerHTML = `
      <div class="card" style="margin-top:1rem">
        <h3>🔐 Admin</h3>
        <p class="muted" style="margin:.2rem 0 .6rem">Read this code out loud at the event. Volunteers enter it to log verified hours.</p>
        <div class="code-box">${esc(codeRow?.code || '—')}</div>
        <h3 style="margin-top:1.2rem">Signed up (${people?.length || 0}) · Checked in (${logged?.length || 0})</h3>
        ${people?.length ? `<ul>${people.map((p) => `<li>${esc(p.profiles?.full_name || 'Volunteer')}</li>`).join('')}</ul>` : '<p class="muted">No sign-ups yet.</p>'}
        <button class="btn danger small" id="del">Delete event</button>
      </div>`;
    document.getElementById('del').onclick = async () => {
      if (!confirm('Delete this event? Sign-ups go away; logged hours stay on people\'s records.')) return;
      const { error } = await sb.from('events').delete().eq('id', id);
      if (error) return toast(cleanError(error));
      toast('Event deleted'); go('#/admin');
    };
  }
}

async function pageLogin() {
  if (session) { go('#/me'); return; }
  let mode = 'signup';
  const draw = () => {
    app.innerHTML = `
      <div class="auth-wrap">
       <div class="auth-photo">${img(PHOTOS.smile2, 'Smiling volunteer')}
         <div><span class="eyebrow" style="color:var(--gold)">LendAHand MN</span><h2>Every hour you give, counted.</h2><p style="opacity:.85;margin:0">Join free to sign up for events, check in, earn badges and print your certificate.</p></div>
       </div>
       <div class="auth-form">
        <div class="tabs">
          <button class="chip ${mode === 'signup' ? 'on' : ''}" data-m="signup">Sign up</button>
          <button class="chip ${mode === 'login' ? 'on' : ''}" data-m="login">Log in</button>
        </div>
        <h2>${mode === 'signup' ? 'Join LendAHand MN' : 'Welcome back'}</h2>
        <p class="muted">${mode === 'signup' ? "Free forever. Track every hour you give." : 'Log in to see your hours.'}</p>
        <form id="f">
          ${mode === 'signup' ? `<label>Full name</label><input id="name" required placeholder="First Last" autocomplete="name">
          <div class="help">This name goes on your hour certificate.</div>` : ''}
          <label>Email</label><input id="email" type="email" required autocomplete="email">
          <label>Password</label><input id="pw" type="password" required minlength="6" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}">
          <div id="err" class="error"></div>
          <button class="btn" style="width:100%;margin-top:1.2rem">${mode === 'signup' ? 'Create my free account →' : 'Log in →'}</button>
        </form>
        ${mode === 'login' ? '<p class="help" style="text-align:center"><a href="#" id="forgot">Forgot password?</a></p>' : ''}
       </div>
      </div>`;
    app.querySelectorAll('.tabs .chip').forEach((b) => (b.onclick = () => { mode = b.dataset.m; draw(); }));
    const forgot = document.getElementById('forgot');
    if (forgot) forgot.onclick = async (ev) => {
      ev.preventDefault();
      const email = document.getElementById('email').value.trim();
      if (!email) return toast('Type your email first');
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + '#/reset' });
      toast(error ? cleanError(error) : 'Check your email for a reset link');
    };
    document.getElementById('f').onsubmit = async (ev) => {
      ev.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('pw').value;
      const err = document.getElementById('err'); err.textContent = '';
      const btn = ev.target.querySelector('button'); btn.disabled = true;
      try {
        if (mode === 'signup') {
          const full_name = document.getElementById('name').value.trim();
          const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name } } });
          if (error) throw error;
          if (!data.session) {
            app.innerHTML = `<div class="card narrow empty"><h2>Check your email 📬</h2><p>We sent a link to <strong>${esc(email)}</strong>. Click it to finish signing up.</p></div>`;
            return;
          }
          confetti(); toast(`Welcome, ${full_name.split(' ')[0] || 'friend'}! 🎉`);
        } else {
          const { error } = await sb.auth.signInWithPassword({ email, password });
          if (error) throw error;
          toast('Logged in');
        }
      } catch (e) { err.textContent = cleanError(e); btn.disabled = false; }
    };
  };
  draw();
}

async function pageReset() {
  app.innerHTML = `
    <div class="card narrow"><h2>Set a new password</h2>
      <form id="f"><label>New password</label><input id="pw" type="password" minlength="6" required>
      <div id="err" class="error"></div><button class="btn green" style="width:100%;margin-top:1rem">Save password</button></form></div>`;
  document.getElementById('f').onsubmit = async (ev) => {
    ev.preventDefault();
    const { error } = await sb.auth.updateUser({ password: document.getElementById('pw').value });
    if (error) return (document.getElementById('err').textContent = cleanError(error));
    toast('Password updated'); go('#/me');
  };
}

async function getMyHours() {
  const { data, error } = await sb.from('hours_log')
    .select('id, activity, activity_date, hours, verified, event_id').eq('user_id', session.user.id)
    .order('activity_date', { ascending: false });
  if (error) throw error;
  const verified = data.filter((h) => h.verified).reduce((a, h) => a + Number(h.hours), 0);
  const self = data.filter((h) => !h.verified).reduce((a, h) => a + Number(h.hours), 0);
  return { rows: data, verified, self };
}

async function pageMe() {
  if (needLogin()) return;
  const [{ rows, verified, self }, { data: ups }] = await Promise.all([
    getMyHours(),
    sb.from('signups').select('events(id,title,starts_at,ends_at)').eq('user_id', session.user.id),
  ]);
  const upcoming = (ups || []).map((u) => u.events).filter((e) => e && new Date(e.ends_at) > new Date())
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const cur = badgeFor(verified), nxt = nextBadge(verified);
  const prevH = cur ? cur.hours : 0;
  const pct = nxt ? Math.min(100, ((verified - prevH) / (nxt.hours - prevH)) * 100) : 100;
  const first = (profile?.full_name || '').split(' ')[0] || 'friend';

  const C = 2 * Math.PI * 74;
  app.innerHTML = `
    <div class="me-hero">
      <div class="ring">
        <svg width="170" height="170"><circle cx="85" cy="85" r="74" stroke="rgba(255,255,255,.15)" stroke-width="12" fill="none"/>
          <circle id="ringbar" cx="85" cy="85" r="74" stroke="url(#g)" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" style="transition:stroke-dashoffset 1.4s cubic-bezier(.2,.7,.2,1)"/>
          <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#ffc145"/><stop offset="1" stop-color="#ff6b4a"/></linearGradient></defs></svg>
        <div class="val"><div><b data-count="${verified}">0</b><span>verified hours</span></div></div>
      </div>
      <div style="position:relative;z-index:2">
        <h1>Hey ${esc(first)} 👋</h1>
        <div style="font-size:1.1rem">${cur ? `${cur.icon} You're a <strong>${cur.name}</strong>` : 'Check in to your first event to earn a badge!'}</div>
        ${self ? `<div class="help">+ ${fmtHours(self)} self-reported hours</div>` : ''}
        <div class="help" style="margin-top:.4rem">${nxt ? `${fmtHours(nxt.hours - verified)} more verified hours to ${nxt.icon} <strong>${nxt.name}</strong>` : "You've earned every badge. Legend. 🏆"}</div>
        <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1.2rem">
          <a class="btn gold" href="#/certificate">📄 My hour certificate</a>
          <a class="btn glass" href="#/">Find more events</a>
        </div>
      </div>
    </div>
    <div class="split" style="margin-top:1.5rem">
      <div class="card">
        <h3>📅 Your upcoming events</h3>
        ${upcoming.length ? upcoming.map((e) => `<p style="margin:.5rem 0"><a href="#/event/${e.id}"><strong>${esc(e.title)}</strong></a><br><span class="muted">${fmtWhen(e.starts_at, e.ends_at)}</span></p>`).join('')
          : '<p class="muted">Nothing yet. <a href="#/">Find an event →</a></p>'}
      </div>
      <div class="card"><h3>🏅 Next badge</h3>${nxt ? `<p class="muted" style="margin:.3rem 0 0">${nxt.icon} <strong>${nxt.name}</strong> at ${nxt.hours} hours</p><div class="spots" style="max-width:none;height:10px"><div style="width:${pct}%"></div></div>` : '<p class="muted">All badges earned!</p>'}</div>
    </div>
    <div class="section-head" style="margin:2.5rem 0 1rem"><h2>Badges</h2></div>
    <div class="badges">
      ${BADGES.map((b) => `<div class="badge ${verified >= b.hours ? '' : 'locked'}"><div class="i">${b.icon}</div><div class="n">${b.name}</div><div class="h">${b.hours} hr${b.hours > 1 ? 's' : ''}</div></div>`).join('')}
    </div>

    <div class="section-head" style="margin:2.5rem 0 1rem"><h2>Hour history</h2></div>
    <div class="card table-scroll">
      ${rows.length ? `<table><thead><tr><th>Date</th><th>Activity</th><th>Hours</th><th>Status</th><th></th></tr></thead><tbody>
        ${rows.map((h) => `<tr><td>${fmtDay(h.activity_date)}</td><td>${esc(h.activity)}</td><td>${fmtHours(h.hours)}</td>
          <td>${h.verified ? '<span class="tag">✅ Verified</span>' : '<span class="tag gray">Self-reported</span>'}</td>
          <td>${h.verified ? '' : `<button class="btn danger small" data-del="${h.id}">Remove</button>`}</td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">No hours yet. Check in at an event with the event code to get verified hours.</div>'}
    </div>

    <div class="section-head" style="margin:2.5rem 0 1rem"><h2>Volunteered on your own?</h2></div>
    <div class="card">
      <p class="muted" style="margin-top:0">Picked up trash on a walk or shoveled a neighbor's driveway? Log it here. These show as <em>self-reported</em> (not verified) and don't count toward badges or the leaderboard.</p>
      <form id="selfform">
        <div class="row">
          <div><label>What did you do?</label><input id="act" required maxlength="120" placeholder="Picked up trash at Minnehaha Park"></div>
          <div class="row"><div><label>Date</label><input id="dt" type="date" required></div><div><label>Hours</label><input id="hrs" type="number" min="0.25" max="24" step="0.25" required></div></div>
        </div>
        <button class="btn green" style="margin-top:1rem">Log hours</button>
      </form>
    </div>

    <div class="section-head" style="margin:2.5rem 0 1rem"><h2>Settings</h2></div>
    <div class="card">
      <form id="nameform" style="display:flex;gap:.5rem;align-items:end;flex-wrap:wrap">
        <div style="flex:1;min-width:220px"><label style="margin-top:0">Name on certificate</label><input id="fn" value="${esc(profile?.full_name || '')}" required></div>
        <button class="btn ghost">Save</button>
      </form>
    </div>`;

  setTimeout(() => { const r = document.getElementById('ringbar'); if (r) r.style.strokeDashoffset = C * (1 - (nxt ? pct / 100 : 1)); }, 120);
  document.getElementById('dt').value = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  document.getElementById('selfform').onsubmit = async (ev) => {
    ev.preventDefault();
    const { error } = await sb.from('hours_log').insert({
      user_id: session.user.id, activity: document.getElementById('act').value.trim(),
      activity_date: document.getElementById('dt').value, hours: Number(document.getElementById('hrs').value), verified: false,
    });
    if (error) return toast(cleanError(error));
    toast('Hours logged'); render();
  };
  app.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
    if (!confirm('Remove this entry?')) return;
    const { error } = await sb.from('hours_log').delete().eq('id', b.dataset.del);
    if (error) return toast(cleanError(error));
    toast('Removed'); render();
  }));
  document.getElementById('nameform').onsubmit = async (ev) => {
    ev.preventDefault();
    const full_name = document.getElementById('fn').value.trim();
    const { error } = await sb.from('profiles').update({ full_name }).eq('id', session.user.id);
    if (error) return toast(cleanError(error));
    profile.full_name = full_name; toast('Name saved');
  };
}

async function pageCertificate() {
  if (needLogin()) return;
  const { rows, verified, self } = await getMyHours();
  const v = rows.filter((r) => r.verified), s = rows.filter((r) => !r.verified);
  const today = new Date().toLocaleDateString('en-US', { timeZone: TZ, month: 'long', day: 'numeric', year: 'numeric' });
  const table = (list) => `<table><thead><tr><th>Date</th><th>Activity</th><th>Hours</th></tr></thead><tbody>
    ${list.map((h) => `<tr><td>${fmtDay(h.activity_date)}</td><td>${esc(h.activity)}</td><td>${fmtHours(h.hours)}</td></tr>`).join('')}</tbody></table>`;
  app.innerHTML = `
    <div class="no-print" style="display:flex;gap:.6rem;justify-content:center;margin-bottom:1rem;flex-wrap:wrap">
      <a class="btn ghost" href="#/me">← Back</a>
      <button class="btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>
    <div class="cert">
      <div class="seal">🤝</div>
      <div class="muted" style="letter-spacing:.2em;text-transform:uppercase;font-size:.8rem">${esc(SITE_NAME)}</div>
      <h1>Certificate of Community Service</h1>
      <p>This certifies that</p>
      <div class="name">${esc(profile?.full_name || 'Volunteer')}</div>
      <p class="total">has completed <strong>${fmtHours(verified)} verified hours</strong> of community service${self ? `, plus ${fmtHours(self)} self-reported hours` : ''}.</p>
      ${v.length ? `<h3 style="margin-top:1.5rem;text-align:left">Verified hours</h3>${table(v)}` : ''}
      ${s.length ? `<h3 style="margin-top:1.5rem;text-align:left">Self-reported hours (not verified)</h3>${table(s)}` : ''}
      <div class="sig"><div>Date issued: ${today}</div><div>${esc(SITE_NAME)} · ${esc(CONTACT_EMAIL)}</div></div>
      <p class="fine">Verified hours were confirmed by an on-site check-in code given by the event leader. Self-reported hours were entered by the volunteer and were not verified by ${esc(SITE_NAME)}.</p>
    </div>
    <p class="help no-print" style="text-align:center">Tip: in the print window, choose "Save as PDF" to download it.</p>`;
}

async function pageLeaderboard() {
  const { data, error } = await sb.rpc('leaderboard', { limit_n: 50 });
  if (error) throw error;
  const rows = data || [];
  const max = Math.max(1, ...rows.map((r) => Number(r.total_hours)));
  const pod = (r, medal, cls) => r ? `<div class="p ${cls} reveal"><div class="medal">${medal}</div><b>${esc(r.name)}</b><div class="hrs">${fmtHours(r.total_hours)}</div><div class="muted" style="font-size:.8rem">verified hours</div></div>` : `<div class="p ${cls}" style="opacity:.4"><div class="medal">${medal}</div><b>Could be you</b></div>`;
  app.innerHTML = `
    <div class="page-title"><span class="eyebrow">Hall of fame</span><h1>Leaderboard</h1>
      <p>Top Minnesota volunteers by <strong>verified</strong> hours. Names show first name and last initial.</p></div>
    <div class="podium">${pod(rows[1], '🥈', '')}${pod(rows[0], '🥇', 'first')}${pod(rows[2], '🥉', '')}</div>
    <div class="card" style="padding:0">
      ${rows.length ? rows.map((r, i) => {
        const b = badgeFor(Number(r.total_hours));
        return `<div class="lb-row"><div class="lb-rank">${i + 1}</div>
          <div class="lb-name">${esc(r.name)} ${b ? `<span title="${b.name}">${b.icon}</span>` : ''}</div>
          <div class="lb-bar"><div style="width:${(Number(r.total_hours) / max) * 100}%"></div></div>
          <div class="muted" style="font-size:.85rem;width:70px;text-align:right">${r.events_count} event${r.events_count == 1 ? '' : 's'}</div>
          <div class="lb-hours" style="width:70px;text-align:right">${fmtHours(r.total_hours)} hrs</div></div>`;
      }).join('') : '<div class="empty"><span class="big">🏁</span>No verified hours yet. Check in at an event to grab the #1 spot!</div>'}
    </div>`;
}

async function pageDonate() {
  const levels = [
    { amt: 5,  e: '🧤', text: 'helps cover work gloves for a cleanup volunteer' },
    { amt: 10, e: '🗑️', text: 'helps cover trash bags and gloves for a cleanup crew' },
    { amt: 25, e: '💧', text: 'helps cover water and snacks for volunteers at an event' },
    { amt: 50, e: '📦', text: 'helps cover supplies for a whole community event' },
  ];
  let amt = 25, monthly = false;
  app.innerHTML = `
    <div class="donate-wrap">
      <div class="donate-photo reveal">${img(PHOTOS.food, 'Volunteers packing food')}
        <div class="quote">💛 Every dollar goes toward supplies that put volunteers to work across Minnesota.</div>
      </div>
      <div class="card reveal d1" style="padding:clamp(1.6rem,4vw,2.4rem)">
        <span class="eyebrow">Donate</span>
        <h1 style="font-size:clamp(2rem,4vw,2.8rem)">Fuel the next cleanup.</h1>
        <p class="muted">Pick an amount to see what it helps make possible.</p>
        <div class="freq" id="freq"><button class="on" data-m="0">One time</button><button data-m="1">Monthly</button></div>
        <div class="amounts" id="amts">${levels.map((l) => `<button class="amt ${l.amt === amt ? 'on' : ''}" data-a="${l.amt}">$${l.amt}</button>`).join('')}</div>
        <div class="impact-line" id="impact"></div>
        <label>Or enter your own amount</label>
        <input id="custom" type="number" min="1" step="1" placeholder="$ Other amount">
        <button class="btn" id="give" style="width:100%;margin-top:1.2rem;font-size:1.05rem"></button>
        <p class="help" id="givehelp" style="text-align:center"></p>
        <div class="notice" style="margin-top:1rem">LendAHand MN is a community project and is <strong>not yet a registered 501(c)(3) nonprofit</strong>, so donations are not tax-deductible. Questions? <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></div>
      </div>
    </div>`;
  const upd = () => {
    const lvl = [...levels].reverse().find((l) => amt >= l.amt) || levels[0];
    document.getElementById('impact').innerHTML = `<span class="e">${lvl.e}</span><span>$${amt}${monthly ? '/month' : ''} ${lvl.text}.</span>`;
    const give = document.getElementById('give');
    if (DONATE_URL) {
      give.textContent = `Donate $${amt}${monthly ? ' monthly' : ''} →`; give.disabled = false;
      document.getElementById('givehelp').textContent = `You'll finish on our secure payment page. Enter $${amt} there.`;
    } else {
      give.textContent = 'Online giving coming soon'; give.disabled = true;
      document.getElementById('givehelp').innerHTML = `Want to help now? Email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.`;
    }
  };
  document.getElementById('amts').onclick = (ev) => {
    const b = ev.target.closest('.amt'); if (!b) return;
    amt = Number(b.dataset.a); document.getElementById('custom').value = '';
    document.querySelectorAll('.amt').forEach((x) => x.classList.toggle('on', x === b)); upd();
  };
  document.getElementById('custom').oninput = (ev) => {
    const v = Math.floor(Number(ev.target.value));
    if (v >= 1) { amt = v; document.querySelectorAll('.amt').forEach((x) => x.classList.toggle('on', Number(x.dataset.a) === v)); upd(); }
  };
  document.getElementById('freq').onclick = (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    monthly = b.dataset.m === '1';
    document.querySelectorAll('#freq button').forEach((x) => x.classList.toggle('on', x === b)); upd();
  };
  document.getElementById('give').onclick = () => { if (DONATE_URL) window.open(DONATE_URL, '_blank', 'noopener'); };
  upd();
}

async function pageAbout() {
  app.innerHTML = `
    <div class="event-hero" style="min-height:320px">
      ${img(PHOTOS.together, 'People holding hands')}
      <span class="eyebrow" style="color:var(--gold)">About us</span>
      <h1 style="color:#fff;max-width:700px">Minnesota runs on neighbors helping neighbors.</h1>
    </div>
    <div class="split">
      <div class="card reveal">
        <h2>Our mission</h2>
        <p>LendAHand MN is a free, community-run site that makes it easy to find volunteer opportunities around Minnesota and keep track of the hours you give.</p>
        <p>Whether you need service hours for school, a club or a scholarship, or you just want to do some good on a Saturday morning, we make it simple to show up and get credit for it.</p>
        <h3 style="margin-top:1.4rem">How check-in works</h3>
        <p class="muted">Every event has a secret code that the event leader shares in person. Volunteers enter it on the event page, and their hours are logged as <strong>verified</strong>. That's how schools and organizations know the hours are real.</p>
      </div>
      <div class="card reveal d1" style="background:linear-gradient(135deg,#fff6e0,#ffeee6)">
        <h2>Host an event 📣</h2>
        <p>Running a cleanup, food drive, or shelter shift? We'll post it for free and give you a check-in code for your volunteers.</p>
        <p>Email us what, where, and when:</p>
        <a class="btn" href="mailto:${CONTACT_EMAIL}?subject=Event%20for%20LendAHand%20MN">✉️ ${CONTACT_EMAIL}</a>
      </div>
    </div>`;
}

/* ---------- "log hours" popup used by the Anytime page ---------- */
function openLogModal(activity) {
  if (needLogin()) return;
  const wrap = document.createElement('div');
  wrap.className = 'modal-bg';
  wrap.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <button class="modal-x" aria-label="Close">✕</button>
      <span class="eyebrow">Log your hours</span>
      <h2 style="font-size:1.7rem">${esc(activity)}</h2>
      <form id="lm">
        <label>Where did you do it? <span class="muted" style="font-weight:400">(optional)</span></label>
        <input id="lm-where" maxlength="80" placeholder="e.g. Lake Nokomis, my block, Animal Humane Society">
        <div class="row">
          <div><label>Date</label><input id="lm-date" type="date" required></div>
          <div><label>Hours</label><input id="lm-hrs" type="number" min="0.25" max="24" step="0.25" value="1" required></div>
        </div>
        <p class="help">These are logged as <strong>self-reported</strong> hours and show on your certificate in their own section.</p>
        <div id="lm-err" class="error"></div>
        <button class="btn" style="width:100%;margin-top:.8rem">Log it ✓</button>
      </form>
    </div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
  const close = () => { wrap.classList.remove('show'); setTimeout(() => wrap.remove(), 250); };
  wrap.onclick = (ev) => { if (ev.target === wrap) close(); };
  wrap.querySelector('.modal-x').onclick = close;
  const dt = wrap.querySelector('#lm-date');
  dt.value = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  dt.max = dt.value;
  wrap.querySelector('#lm').onsubmit = async (ev) => {
    ev.preventDefault();
    const where = wrap.querySelector('#lm-where').value.trim();
    const { error } = await sb.from('hours_log').insert({
      user_id: session.user.id,
      activity: (where ? `${activity} (${where})` : activity).slice(0, 120),
      activity_date: dt.value,
      hours: Number(wrap.querySelector('#lm-hrs').value),
      verified: false,
    });
    if (error) { wrap.querySelector('#lm-err').textContent = cleanError(error); return; }
    close(); confetti(); toast('Hours logged! Nice work 🙌');
  };
}

async function pageAnytime() {
  app.innerHTML = `
    <div class="event-hero" style="min-height:300px">
      ${img(PHOTOS.smile1, 'Volunteer smiling at a cleanup')}
      <span class="eyebrow" style="color:var(--gold)">No event needed</span>
      <h1 style="color:#fff;max-width:720px">Do good anytime, then log it.</h1>
      <p style="max-width:560px;opacity:.9;margin:0">Ready-made community service you can do on your own schedule, plus great Minnesota organizations that take volunteers.</p>
    </div>

    <div class="section-head" style="margin:2.5rem 0 1.2rem">
      <div><span class="eyebrow">On your own</span><h2>Grab one and go</h2></div>
      <p>Do it today, then tap <strong>I did this</strong> to log your hours.</p>
    </div>
    <div class="anytime-grid">
      ${ANYTIME.map((a, i) => `
        <div class="any-card reveal d${i % 4 + 1}">
          <div class="any-top"><div class="any-ico">${a.icon}</div><span class="tag sun">⏱️ ${esc(a.time)}</span></div>
          <h3>${esc(a.title)}</h3>
          <div class="muted" style="font-size:.86rem;margin-bottom:.5rem">📍 ${esc(a.where)}</div>
          <p>${esc(a.blurb)}</p>
          <div class="any-tip">💡 ${esc(a.tip)}${a.link ? ` <a href="${a.link}" target="_blank" rel="noopener">Visit ↗</a>` : ''}</div>
          <button class="btn small" data-log="${esc(a.title)}">✓ I did this</button>
        </div>`).join('')}
    </div>

    <div class="section-head" style="margin:3.5rem 0 1.2rem">
      <div><span class="eyebrow">Places to volunteer</span><h2>Minnesota orgs that need you</h2></div>
      <p>Sign up on their website, go volunteer, then come back and log your hours here.</p>
    </div>
    <div class="places-grid">
      ${PLACES.map((p, i) => `
        <div class="place reveal d${i % 3 + 1}">
          <div class="any-ico">${p.icon}</div>
          <div style="flex:1">
            <h3 style="margin-bottom:.2rem">${esc(p.name)}</h3>
            <p class="muted" style="margin:0 0 .8rem;font-size:.93rem">${esc(p.what)}</p>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap">
              <a class="btn small green" href="${p.url}" target="_blank" rel="noopener">Volunteer with them ↗</a>
              <button class="btn small ghost" data-log="${esc(p.name)}">Log hours</button>
            </div>
          </div>
        </div>`).join('')}
    </div>
    <p class="help" style="margin-top:1.2rem">LendAHand MN isn't affiliated with these organizations. Hours logged here are self-reported. For verified hours, check in at a <a href="#/">LendAHand MN event</a>.</p>`;
  app.querySelectorAll('[data-log]').forEach((b) => (b.onclick = () => openLogModal(b.dataset.log)));
}

async function pageAdmin() {
  if (needLogin()) return;
  if (!profile?.is_admin) { app.innerHTML = `<div class="card empty">This page is for LendAHand MN admins.</div>`; return; }
  const { data: events } = await sb.from('events').select('id,title,starts_at,ends_at,location_name').order('starts_at', { ascending: false });
  const { data: codes } = await sb.from('event_codes').select('event_id, code');
  const codeMap = Object.fromEntries((codes || []).map((c) => [c.event_id, c.code]));

  app.innerHTML = `
    <h1>Admin</h1>
    <div class="split" style="margin-top:1rem">
      <div class="card">
        <h2>Post a new event</h2>
        <form id="ef">
          <label>Title</label><input id="t" required maxlength="100" placeholder="Lake Phalen Trash Pickup">
          <label>Description</label><textarea id="d" placeholder="What to bring, where to meet, who to look for…"></textarea>
          <div class="row">
            <div><label>Category</label><select id="c">${CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join('')}</select></div>
            <div><label>Hours credited</label><input id="h" type="number" min="0.25" max="24" step="0.25" value="2" required></div>
          </div>
          <div class="row">
            <div><label>Starts</label><input id="s" type="datetime-local" required></div>
            <div><label>Ends</label><input id="e" type="datetime-local" required></div>
          </div>
          <div class="row">
            <div><label>Location name</label><input id="loc" required placeholder="Lake Phalen, St. Paul"></div>
            <div><label>Spots (optional)</label><input id="cap" type="number" min="1" placeholder="No limit"></div>
          </div>
          <label>Pin on map <span class="muted" style="font-weight:400">(click the map)</span></label>
          <div class="map small" id="pick"></div>
          <div class="help" id="pinlabel">No pin yet</div>
          <div id="err" class="error"></div>
          <button class="btn green" style="margin-top:1rem;width:100%">Post event</button>
        </form>
      </div>
      <div class="card">
        <h2>All events</h2>
        ${events?.length ? `<table><thead><tr><th>Event</th><th>Code</th></tr></thead><tbody>
          ${events.map((e) => `<tr><td><a href="#/event/${e.id}">${esc(e.title)}</a><br><span class="muted" style="font-size:.8rem">${fmtWhen(e.starts_at, e.ends_at)}</span></td>
          <td><code>${esc(codeMap[e.id] || '—')}</code></td></tr>`).join('')}</tbody></table>` : '<p class="muted">No events yet.</p>'}
      </div>
    </div>`;

  let pin = null, marker = null;
  const m = await makeMap(document.getElementById('pick'));
  m.on('click', (ev) => {
    pin = [Number(ev.latlng.lat.toFixed(5)), Number(ev.latlng.lng.toFixed(5))];
    if (marker) marker.setLatLng(pin); else marker = L.marker(pin).addTo(m);
    document.getElementById('pinlabel').textContent = `📍 Pinned at ${pin[0]}, ${pin[1]}`;
  });

  document.getElementById('ef').onsubmit = async (ev) => {
    ev.preventDefault();
    const err = document.getElementById('err'); err.textContent = '';
    const starts_at = localInputToISO(document.getElementById('s').value);
    const ends_at = localInputToISO(document.getElementById('e').value);
    if (new Date(ends_at) <= new Date(starts_at)) { err.textContent = 'End time must be after start time.'; return; }
    if (!pin) { err.textContent = 'Click the map to drop a pin where the event is.'; return; }
    const cap = document.getElementById('cap').value;
    const btn = ev.target.querySelector('button[class*="green"]'); btn.disabled = true;
    const { data: e, error } = await sb.from('events').insert({
      title: document.getElementById('t').value.trim(),
      description: document.getElementById('d').value.trim(),
      category: document.getElementById('c').value,
      hours: Number(document.getElementById('h').value),
      starts_at, ends_at,
      location_name: document.getElementById('loc').value.trim(),
      capacity: cap ? Number(cap) : null,
      lat: pin[0], lng: pin[1],
    }).select('id').single();
    if (error) { err.textContent = cleanError(error); btn.disabled = false; return; }
    const code = randomCode();
    const { error: cErr } = await sb.from('event_codes').insert({ event_id: e.id, code });
    if (cErr) { err.textContent = cleanError(cErr); btn.disabled = false; return; }
    toast(`Event posted! Check-in code: ${code}`);
    go(`#/event/${e.id}`);
  };
}

/* ================= router ================= */
const routes = [
  [/^#?\/?$/, pageHome],
  [/^#events$/, pageHome],
  [/^#\/event\/([\w-]+)$/, pageEvent],
  [/^#\/login$/, pageLogin],
  [/^#\/reset$/, pageReset],
  [/^#\/me$/, pageMe],
  [/^#\/certificate$/, pageCertificate],
  [/^#\/leaderboard$/, pageLeaderboard],
  [/^#\/about$/, pageAbout],
  [/^#\/admin$/, pageAdmin],
  [/^#\/donate$/, pageDonate],
  [/^#\/anytime$/, pageAnytime],
];

async function render() {
  document.body.classList.remove('nav-open');
  clearMaps();
  renderNavAuth();
  const hash = location.hash || '#/';
  if (hash.includes('access_token=') || hash.includes('type=recovery')) return; // Supabase handles these
  const match = routes.map(([re, fn]) => [hash.match(re), fn]).find(([m]) => m);
  document.body.classList.toggle('home', match && match[1] === pageHome);
  document.getElementById('topbar').classList.toggle('scrolled', scrollY > 30);
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    if (!match) { app.innerHTML = `<div class="card empty">Page not found. <a href="#/">Go home</a></div>`; return; }
    await match[1](...match[0].slice(1));
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="card empty"><span class="big">😕</span><h3>Something went wrong</h3><p>${esc(cleanError(e))}</p><p><a href="#/">Go home</a></p></div>`;
  }
  if (hash !== '#events') window.scrollTo(0, 0);
  setupReveal();
}

window.addEventListener('hashchange', render);
// in-page links like #events / #ways scroll instead of changing pages
document.addEventListener('click', (ev) => {
  const a = ev.target.closest('a[href^="#"]');
  if (!a) return;
  const h = a.getAttribute('href');
  if (h.startsWith('#/') || h === '#') return;
  const target = document.getElementById(h.slice(1));
  if (target) { ev.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
});

if (SUPABASE_KEY.startsWith('PASTE_')) {
  app.innerHTML = `<div class="card empty"><h2>Almost there!</h2><p>Open <code>config.js</code> and paste your Supabase publishable key.</p></div>`;
} else {
  const { data } = await sb.auth.getSession();
  session = data.session;
  await loadProfile();
  sb.auth.onAuthStateChange((event, s) => {
    // Defer so Supabase calls don't run inside the auth callback
    setTimeout(async () => {
      const was = !!session;
      session = s;
      if (event === 'PASSWORD_RECOVERY') { await loadProfile(); go('#/reset'); return; }
      const changed = was !== !!s;
      if (!changed && event !== 'USER_UPDATED') return; // ignore token refreshes / tab refocus
      await loadProfile();
      if (s && !was) {
        const back = sessionStorage.getItem('afterLogin');
        sessionStorage.removeItem('afterLogin');
        if (location.hash === '#/login' || location.hash.includes('access_token')) { go(back || '#/me'); return; }
      }
      render();
    }, 0);
  });
  render();
}

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {
  SUPABASE_URL, SUPABASE_KEY, SITE_NAME, TAGLINE, CONTACT_EMAIL,
  MAP_CENTER, MAP_ZOOM, CATEGORIES, BADGES,
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

  app.innerHTML = `
    <section class="hero">
      <h1>${esc(TAGLINE)}</h1>
      <p>Find volunteer events across Minnesota: cleanups, food shelves, animal shelters and more. Check in on site and your hours are tracked for you.</p>
      <div class="actions">
        <a class="btn" href="#events">Find an event</a>
        ${session ? '<a class="btn ghost" href="#/me">See my hours</a>' : '<a class="btn ghost" href="#/login">Create free account</a>'}
      </div>
    </section>
    <div class="stats">
      <div class="stat"><b>${fmtHours(s.total_hours)}</b><span>verified hours volunteered</span></div>
      <div class="stat"><b>${s.volunteers}</b><span>volunteers with logged hours</span></div>
      <div class="stat"><b>${s.events}</b><span>events posted</span></div>
    </div>

    <div class="section-title" id="events">
      <h2>Upcoming events</h2>
      <div class="filters" id="filters">
        <button class="chip on" data-cat="">All</button>
        ${CATEGORIES.map((c) => `<button class="chip" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
    </div>
    <div class="split">
      <div class="grid" id="list"></div>
      <div id="map"></div>
    </div>`;

  const map = await makeMap(document.getElementById('map'));
  const layer = L.layerGroup().addTo(map);

  const draw = (cat) => {
    const list = (events || []).filter((e) => !cat || e.category === cat);
    layer.clearLayers();
    document.getElementById('list').innerHTML = list.length ? list.map((e) => {
      const n = countMap[e.id] || 0;
      const full = e.capacity && n >= e.capacity;
      return `
      <a class="card event-card" href="#/event/${e.id}">
        <div class="date-box"><div class="m">${fmtDate(e.starts_at, { month: 'short' })}</div><div class="d">${fmtDate(e.starts_at, { day: 'numeric' })}</div></div>
        <div>
          <h3>${esc(e.title)}</h3>
          <div class="meta"><span>🕒 ${fmtWhen(e.starts_at, e.ends_at)}</span><span>📍 ${esc(e.location_name)}</span></div>
          <div style="margin-top:.4rem;display:flex;gap:.35rem;flex-wrap:wrap">
            <span class="tag">${esc(e.category)}</span>
            <span class="tag sun">${fmtHours(e.hours)} hrs</span>
            <span class="tag gray">${n}${e.capacity ? ' / ' + e.capacity : ''} going${full ? ' · FULL' : ''}</span>
          </div>
        </div>
      </a>`;
    }).join('') : `<div class="card empty">No upcoming events${cat ? ' in this category' : ''} yet. Check back soon!</div>`;
    const pts = [];
    list.forEach((e) => {
      if (e.lat == null || e.lng == null) return;
      pts.push([e.lat, e.lng]);
      L.marker([e.lat, e.lng]).addTo(layer)
        .bindPopup(`<strong>${esc(e.title)}</strong><br>${fmtWhen(e.starts_at, e.ends_at)}<br><a href="#/event/${e.id}">View event →</a>`);
    });
    if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40], maxZoom: 12 });
    else if (pts.length === 1) map.setView(pts[0], 12);
  };
  draw('');
  document.getElementById('filters').onclick = (ev) => {
    const b = ev.target.closest('.chip'); if (!b) return;
    document.querySelectorAll('#filters .chip').forEach((c) => c.classList.toggle('on', c === b));
    draw(b.dataset.cat);
  };
  if (location.hash === '#events') document.getElementById('events').scrollIntoView();
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
    <p><a href="#/">← All events</a></p>
    <div class="split">
      <div class="card">
        <span class="tag">${esc(e.category)}</span>
        <h1 style="font-size:2.1rem;margin-top:.5rem">${esc(e.title)}</h1>
        <div class="meta" style="font-size:.95rem;margin-bottom:1rem">
          <span>🕒 ${fmtWhen(e.starts_at, e.ends_at)}</span>
          <span>📍 ${esc(e.location_name)}</span>
          <span>⏱️ ${fmtHours(e.hours)} hours</span>
          <span>🙋 ${going}${e.capacity ? ' / ' + e.capacity : ''} going</span>
        </div>
        <p style="white-space:pre-wrap">${esc(e.description)}</p>
        <div id="actions" style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1.2rem"></div>
        <div id="checkin"></div>
        ${e.lat != null ? `<p class="help" style="margin-top:1rem"><a target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}">Get directions in Google Maps ↗</a></p>` : ''}
      </div>
      <div>
        ${e.lat != null ? '<div class="map" id="emap"></div>' : ''}
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
      actions.innerHTML = full ? `<button class="btn" disabled>Event is full</button>` : `<button class="btn green" id="join">Sign me up</button>`;
      const j = document.getElementById('join');
      if (j) j.onclick = async () => {
        if (needLogin()) return;
        const { error } = await sb.from('signups').insert({ event_id: id, user_id: session.user.id });
        if (error) return toast(cleanError(error));
        toast("You're signed up! 🎉"); render();
      };
    }
  }

  // check-in
  if (!checkedIn && checkinOpen) {
    document.getElementById('checkin').innerHTML = `
      <div class="notice" style="margin-top:1.2rem">
        <strong>At the event?</strong> Enter the check-in code your event leader gives you to log your hours.
        <form id="cform" style="display:flex;gap:.5rem;margin-top:.6rem">
          <input id="code" placeholder="CODE" maxlength="12" autocomplete="off" style="text-transform:uppercase;letter-spacing:.15em;font-weight:700;max-width:180px">
          <button class="btn green">Check in</button>
        </form>
      </div>`;
    document.getElementById('cform').onsubmit = async (ev) => {
      ev.preventDefault();
      if (needLogin()) return;
      const code = document.getElementById('code').value.trim();
      if (!code) return;
      const { data, error } = await sb.rpc('check_in', { p_event: id, p_code: code });
      if (error) return toast(cleanError(error));
      toast(`Checked in! +${fmtHours(data)} verified hours 🎉`); render();
    };
  }

  if (e.lat != null) {
    const m = await makeMap(document.getElementById('emap'), [e.lat, e.lng], 13);
    L.marker([e.lat, e.lng]).addTo(m);
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
      <div class="card narrow">
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
          <button class="btn green" style="width:100%;margin-top:1rem">${mode === 'signup' ? 'Create account' : 'Log in'}</button>
        </form>
        ${mode === 'login' ? '<p class="help" style="text-align:center"><a href="#" id="forgot">Forgot password?</a></p>' : ''}
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
          toast(`Welcome, ${full_name.split(' ')[0] || 'friend'}! 🎉`);
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

  app.innerHTML = `
    <h1>Hey ${esc(first)} 👋</h1>
    <div class="split" style="margin-top:1rem">
      <div class="card">
        <div class="muted">Verified hours</div>
        <div class="big-hours">${fmtHours(verified)}</div>
        ${self ? `<div class="muted" style="margin-top:.3rem">+ ${fmtHours(self)} self-reported hours</div>` : ''}
        <div style="margin-top:1rem">${cur ? `${cur.icon} <strong>${cur.name}</strong>` : 'No badge yet. Check in to your first event!'}</div>
        ${nxt ? `<div class="progress"><div style="width:${pct}%"></div></div>
        <div class="help">${fmtHours(nxt.hours - verified)} more hours to ${nxt.icon} ${nxt.name}</div>` : '<div class="help">You\'ve earned every badge. Legend. 🏆</div>'}
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:1.2rem">
          <a class="btn" href="#/certificate">📄 Get my hour certificate</a>
        </div>
      </div>
      <div class="card">
        <h3>Your upcoming events</h3>
        ${upcoming.length ? upcoming.map((e) => `<p style="margin:.5rem 0"><a href="#/event/${e.id}"><strong>${esc(e.title)}</strong></a><br><span class="muted">${fmtWhen(e.starts_at, e.ends_at)}</span></p>`).join('')
          : '<p class="muted">Nothing yet. <a href="#/">Find an event →</a></p>'}
      </div>
    </div>

    <div class="section-title"><h2>Badges</h2></div>
    <div class="badges">
      ${BADGES.map((b) => `<div class="badge ${verified >= b.hours ? '' : 'locked'}"><div class="i">${b.icon}</div><div class="n">${b.name}</div><div class="h">${b.hours} hr${b.hours > 1 ? 's' : ''}</div></div>`).join('')}
    </div>

    <div class="section-title"><h2>Hour history</h2></div>
    <div class="card">
      ${rows.length ? `<table><thead><tr><th>Date</th><th>Activity</th><th>Hours</th><th>Status</th><th></th></tr></thead><tbody>
        ${rows.map((h) => `<tr><td>${fmtDay(h.activity_date)}</td><td>${esc(h.activity)}</td><td>${fmtHours(h.hours)}</td>
          <td>${h.verified ? '<span class="tag">✅ Verified</span>' : '<span class="tag gray">Self-reported</span>'}</td>
          <td>${h.verified ? '' : `<button class="btn danger small" data-del="${h.id}">Remove</button>`}</td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">No hours yet. Check in at an event with the event code to get verified hours.</div>'}
    </div>

    <div class="section-title"><h2>Volunteered on your own?</h2></div>
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

    <div class="section-title"><h2>Settings</h2></div>
    <div class="card">
      <form id="nameform" style="display:flex;gap:.5rem;align-items:end;flex-wrap:wrap">
        <div style="flex:1;min-width:220px"><label style="margin-top:0">Name on certificate</label><input id="fn" value="${esc(profile?.full_name || '')}" required></div>
        <button class="btn ghost">Save</button>
      </form>
    </div>`;

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
  const medals = ['🥇', '🥈', '🥉'];
  app.innerHTML = `
    <h1>Leaderboard</h1>
    <p class="muted">Top volunteers by <strong>verified</strong> hours. Names show first name + last initial.</p>
    <div class="card" style="padding:0;margin-top:1rem">
      ${data?.length ? data.map((r, i) => {
        const b = badgeFor(Number(r.total_hours));
        return `<div class="lb-row ${i < 3 ? 'top' : ''}"><div class="lb-rank">${medals[i] || i + 1}</div>
          <div class="lb-name">${esc(r.name)} ${b ? `<span title="${b.name}">${b.icon}</span>` : ''}</div>
          <div class="muted" style="font-size:.85rem">${r.events_count} event${r.events_count == 1 ? '' : 's'}</div>
          <div class="lb-hours">${fmtHours(r.total_hours)} hrs</div></div>`;
      }).join('') : '<div class="empty">No verified hours yet. Be the first! 🏁</div>'}
    </div>`;
}

async function pageAbout() {
  app.innerHTML = `
    <div class="card" style="max-width:760px;margin:0 auto">
      <h1>About LendAHand MN</h1>
      <p>LendAHand MN is a free, community-run site that makes it easy to find volunteer opportunities around Minnesota and keep track of the hours you give.</p>
      <h3 style="margin-top:1.4rem">How it works</h3>
      <ol>
        <li><strong>Find an event</strong>: cleanups, food shelves, animal shelters, snow shoveling for neighbors and more.</li>
        <li><strong>Sign up</strong> so the organizer knows you're coming.</li>
        <li><strong>Check in</strong>: at the event, the leader gives out a code. Enter it and your hours are logged as <em>verified</em>.</li>
        <li><strong>Earn badges</strong>, climb the leaderboard, and print a certificate for school, a club, or a job application.</li>
      </ol>
      <h3 style="margin-top:1.4rem">Want to host an event?</h3>
      <p>Email us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> with what, where and when, and we'll post it.</p>
    </div>`;
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
];

async function render() {
  document.body.classList.remove('nav-open');
  clearMaps();
  renderNavAuth();
  const hash = location.hash || '#/';
  if (hash.includes('access_token=') || hash.includes('type=recovery')) return; // Supabase handles these
  const match = routes.map(([re, fn]) => [hash.match(re), fn]).find(([m]) => m);
  app.innerHTML = '<div class="loading">Loading…</div>';
  try {
    if (!match) { app.innerHTML = `<div class="card empty">Page not found. <a href="#/">Go home</a></div>`; return; }
    await match[1](...match[0].slice(1));
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="card empty"><h3>Something went wrong</h3><p>${esc(cleanError(e))}</p><p><a href="#/">Go home</a></p></div>`;
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);

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

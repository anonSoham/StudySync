// ── Toast Notifications ───────────────────────────────────────
export function showToast(message, type = 'info') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Dark Mode ─────────────────────────────────────────────────
export function initDarkMode() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);
}

export function toggleDarkMode() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('theme', next);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.innerHTML = theme === 'dark'
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
}

// ── Stats Bar ─────────────────────────────────────────────────
export function updateStats(groups) {
  const now = new Date();
  const activeGroups = groups.filter(g => {
    const start = new Date(g.date + 'T' + g.time);
    const end = new Date(g.date + 'T' + (g.end_time ?? g.time));
    return end >= now && !Number.isNaN(end.getTime()) && !Number.isNaN(start.getTime());
  });
  const totalStudents = groups.reduce((sum, g) => sum + (g.member_count || 0), 0);

  const elGroups = document.getElementById('stat-groups');
  const elStudents = document.getElementById('stat-students');
  if (elGroups) elGroups.textContent = activeGroups.length;
  if (elStudents) elStudents.textContent = totalStudents;
}

// ── Countdown ─────────────────────────────────────────────────
export function getCountdown(dateStr, timeStr, endTimeStr) {
  const startTime = new Date(dateStr + 'T' + timeStr);
  const endTime = new Date(dateStr + 'T' + (endTimeStr ?? timeStr));
  const now = new Date();
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    return { label: '—', cls: 'countdown-future' };
  }
  if (now > endTime) return { label: 'Completed', cls: 'countdown-past' };
  if (now >= startTime && now <= endTime) return { label: 'Ongoing', cls: 'countdown-soon' };

  const diff = startTime - now;

  if (diff < 0) return { label: 'Past', cls: 'countdown-past' };

  const totalMins = Math.floor(diff / 60000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;

  if (days === 0 && hours === 0) return { label: 'Starting soon!', cls: 'countdown-soon' };
  if (days === 0) return { label: `Today in ${hours}h ${mins}m`, cls: 'countdown-today' };
  return { label: `in ${days}d ${hours}h`, cls: 'countdown-future' };
}

// ── Icons (Lucide-style inline SVG) ───────────────────────────
function icon(name) {
  const a = `width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ic"`;
  const p = {
    calendar: `<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>`,
    clock:    `<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>`,
    mapPin:   `<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>`,
    user:     `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
    users:    `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>`,
  };
  return `<svg ${a}>${p[name]}</svg>`;
}

// ── Build Group Card HTML ─────────────────────────────────────
export function buildGroupCard(group, currentUserId) {
  const { label } = getCountdown(group.date, group.time, group.end_time);
  const memberCount = group.member_count ?? 0;
  const maxMembers = group.max_members;
  const hasLimit = maxMembers !== null && maxMembers !== undefined && !Number.isNaN(Number(maxMembers));
  const isFull = hasLimit && memberCount >= maxMembers;
  const isHost = group.host_id === currentUserId;
  const isMember = group.is_member === true;
  const pct = hasLimit ? Math.min(100, Math.round((memberCount / maxMembers) * 100)) : 0;
  const status = group.status || (label === 'Ongoing' ? 'Ongoing' : label === 'Completed' ? 'Completed' : 'Upcoming');
  const sl = status.toLowerCase();

  let actionBtn = '';
  if (isHost) {
    actionBtn = `<button class="btn btn-danger btn-sm" onclick="deleteGroup('${group.id}')">Delete</button>`;
  } else if (isMember) {
    actionBtn = `<button class="btn btn-outline btn-sm" onclick="leaveGroup('${group.id}')">Leave</button>`;
  } else if (status === 'Completed') {
    actionBtn = `<button class="btn btn-disabled btn-sm" disabled>Ended</button>`;
  } else if (isFull) {
    actionBtn = `<button class="btn btn-disabled btn-sm" disabled>Full</button>`;
  } else {
    actionBtn = `<button class="btn btn-primary btn-sm" onclick="joinGroup('${group.id}')">Join</button>`;
  }

  const desc = stripEndMarker(group.description || '');

  return `
    <div class="group-card card-${sl}" data-id="${group.id}">
      <div class="card-header">
        <span class="subject-badge">${escapeHtml(group.subject)}</span>
        <span class="status-pill pill-${sl}">${escapeHtml(status)}</span>
      </div>
      <div class="card-body">
        <h3 class="group-name">${escapeHtml(group.subject)} room</h3>
        ${desc ? `<p class="group-desc">${escapeHtml(desc)}</p>` : ''}
        <div class="card-info">
          <div class="info-row">
            ${icon('calendar')}<span>${formatDate(group.date)}</span>
            <span class="info-dot">·</span>
            ${icon('clock')}<span>${formatTime(group.time)} — ${formatTime(group.end_time ?? group.time)}</span>
          </div>
          <div class="info-row">
            ${icon('mapPin')}<span>${escapeHtml(group.location)}</span>
          </div>
          <div class="info-row">
            ${icon('user')}<span>${escapeHtml(group.host_email || 'Unknown')}</span>
          </div>
        </div>
      </div>
      <div class="card-footer">
        <div class="member-info">
          <div class="progress-bar">
            <div class="progress-fill" style="width:${hasLimit ? pct : 20}%"></div>
          </div>
          <div class="capacity-row">
            ${icon('users')}<span class="member-count">${memberCount} / ${hasLimit ? maxMembers : '∞'} participants</span>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn btn-ghost btn-sm" onclick="navigate('room','${group.id}')">View</button>
          ${actionBtn}
        </div>
      </div>
    </div>
  `;
}

// ── Render Room Detail Page ───────────────────────────────────
export function renderRoomPage(room, files, currentUserId, isMember, isHost) {
  // Header
  document.getElementById('room-title').textContent = `${room.subject} room`;
  document.getElementById('room-subtitle').textContent = room.description || '';

  // Status pill
  const endTime = room.end_time ?? room.time;
  const now = new Date();
  const start = new Date(`${room.date}T${room.time}`);
  const end   = new Date(`${room.date}T${endTime}`);
  let statusLabel = 'Upcoming', statusCls = 'pill-upcoming';
  if (now >= start && now <= end) { statusLabel = 'Ongoing';   statusCls = 'pill-ongoing';   }
  if (now > end)                  { statusLabel = 'Completed'; statusCls = 'pill-completed'; }
  document.getElementById('room-status-pill').innerHTML =
    `<span class="status-pill ${statusCls}">${statusLabel}</span>`;

  // Meta bar
  document.getElementById('room-meta').innerHTML = `
    <div class="info-row">
      ${icon('calendar')}<span>${formatDate(room.date)}</span>
      <span class="info-dot">·</span>
      ${icon('clock')}<span>${formatTime(room.time)} — ${formatTime(endTime)}</span>
      <span class="info-dot">·</span>
      ${icon('mapPin')}<span>${escapeHtml(room.location)}</span>
      <span class="info-dot">·</span>
      ${icon('user')}<span>${escapeHtml(room.host_email || 'Unknown')}</span>
    </div>
  `;

  // Files list
  const container = document.getElementById('room-files-list');
  if (!isMember) {
    const hasLimit = room.max_members !== null && room.max_members !== undefined && !Number.isNaN(Number(room.max_members));
    const isFull = hasLimit && (room.member_count ?? 0) >= room.max_members;
    let joinBtn = '';
    if (statusLabel === 'Completed') {
      joinBtn = `<button class="btn btn-disabled btn-sm" disabled>Ended</button>`;
    } else if (isFull) {
      joinBtn = `<button class="btn btn-disabled btn-sm" disabled>Full</button>`;
    } else {
      joinBtn = `<button class="btn btn-primary btn-sm" onclick="joinGroup('${room.id}')">Join Room</button>`;
    }
    container.innerHTML = `
      <div class="room-locked">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <p>Join this room to view session files.</p>
        ${joinBtn}
      </div>`;
    return;
  }
  if (files.length === 0) {
    container.innerHTML = `<div class="empty-state">No files uploaded yet.</div>`;
    return;
  }
  container.innerHTML = files.map(f => {
    const sizeLabel = f.file_size < 1024 * 1024
      ? `${(f.file_size / 1024).toFixed(1)} KB`
      : `${(f.file_size / (1024 * 1024)).toFixed(1)} MB`;
    const ext = f.file_name.split('.').pop().toUpperCase();
    return `
      <div class="file-item">
        <div class="file-icon">${escapeHtml(ext)}</div>
        <div class="file-info">
          <span class="file-name">${escapeHtml(f.file_name)}</span>
          <span class="file-meta">${sizeLabel} · ${new Date(f.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
        </div>
        <div class="file-actions">
          <button class="btn btn-ghost btn-sm" onclick="handleDownloadFile('${f.storage_path}','${escapeHtml(f.file_name)}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </button>
          ${isHost ? `<button class="btn btn-danger btn-sm" onclick="handleDeleteFile('${f.id}','${f.storage_path}')">Delete</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ── Render groups into a container ────────────────────────────
export function renderGroups(containerId, groups, currentUserId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (groups.length === 0) {
    container.innerHTML = `<div class="empty-state">No study groups found.</div>`;
    return;
  }

  container.innerHTML = groups.map(g => buildGroupCard(g, currentUserId)).join('');
}

// ── Helpers ───────────────────────────────────────────────────
function stripEndMarker(str) {
  return (str ?? '').replace(/\n*\s*(?:end(?:\s*time)?|ends?)\s*:\s*([01]\d|2[0-3]):([0-5]\d)\s*$/gi, '').trim();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str ?? ''));
  return div.innerHTML;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':');
  const d = new Date();
  d.setHours(+h, +m);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}


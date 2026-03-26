import { supabase } from './supabase.js';
import { showToast, renderGroups, updateStats } from './ui.js';
import { getUser } from './auth.js';
import { router } from './router.js';

function refreshCurrentPage() {
  if (router.currentPage === 'mygroups') loadMyGroups();
  else if (router.currentPage === 'room' && router.currentRoomId) router.navigate('room', router.currentRoomId);
  else loadGroups();
}

function normalizeLocation(loc) {
  return (loc ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeSubject(sub) {
  return (sub ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function extractEndTimeFromDescription(description) {
  const text = (description ?? '').toString();
  // Supports: "End: 14:30", "Ends: 14:30", "End time: 14:30"
  const m = text.match(/(?:^|\n)\s*(?:end(?:\s*time)?|ends?)\s*:\s*([01]\d|2[0-3]):([0-5]\d)\s*(?:\n|$)/i);
  if (!m) return null;
  return `${m[1]}:${m[2]}`;
}


function getEndTimeForGroupRow(group) {
  return group?.end_time ?? extractEndTimeFromDescription(group?.description) ?? group?.time;
}

function getRoomStatus(dateStr, startTimeStr, endTimeStr) {
  const now = new Date();
  const start = new Date(`${dateStr}T${startTimeStr}`);
  const end = new Date(`${dateStr}T${endTimeStr}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { status: 'Upcoming', start, end };
  if (now < start) return { status: 'Upcoming', start, end };
  if (now >= start && now <= end) return { status: 'Ongoing', start, end };
  return { status: 'Completed', start, end };
}

// ── Load all groups ───────────────────────────────────────────
export async function loadGroups(searchTerm = '', subjectFilter = '', locationFilter = '', timeFilter = 'active') {
  const user = await getUser();
  if (!user) return;

  // Get all groups
  let query = supabase.from('groups').select('*').order('date', { ascending: true }).order('time', { ascending: true });

  if (subjectFilter) {
    query = query.eq('subject', subjectFilter);
  }

  const { data: groups, error } = await query;
  if (error) { showToast('Failed to load groups.', 'error'); return; }

  // Get membership counts
  const { data: memberships } = await supabase.from('memberships').select('group_id, user_id');

  // Attach member_count and is_member to each group
  const enriched = (groups ?? []).map(g => {
    const members = memberships?.filter(m => m.group_id === g.id) ?? [];
    const endTime = getEndTimeForGroupRow(g);
    const { status, start, end } = getRoomStatus(g.date, g.time, endTime);
    return {
      ...g,
      member_count: members.length,
      is_member: members.some(m => m.user_id === user.id),
      member_ids: members.map(m => m.user_id),
      end_time: endTime,
      status,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
    };
  });

  // Apply search filter
  const s = (searchTerm ?? '').trim().toLowerCase();
  const locNorm = normalizeLocation(locationFilter);
  let filtered = s
    ? enriched.filter(g =>
        (g.subject ?? '').toLowerCase().includes(s) ||
        (g.description ?? '').toLowerCase().includes(s) ||
        (g.location ?? '').toLowerCase().includes(s)
      )
    : enriched;

  if (locNorm) {
    filtered = filtered.filter(g => normalizeLocation(g.location) === locNorm);
  }

  // Time filter: active/upcoming/ongoing/past/all
  if (timeFilter && timeFilter !== 'all') {
    if (timeFilter === 'active') filtered = filtered.filter(g => g.status === 'Upcoming' || g.status === 'Ongoing');
    if (timeFilter === 'upcoming') filtered = filtered.filter(g => g.status === 'Upcoming');
    if (timeFilter === 'ongoing') filtered = filtered.filter(g => g.status === 'Ongoing');
    if (timeFilter === 'past') filtered = filtered.filter(g => g.status === 'Completed');
  }

  const activeRooms = filtered.filter(g => g.status !== 'Completed');
  const pastRooms = filtered.filter(g => g.status === 'Completed').sort((a, b) => (b.ends_at ?? '').localeCompare(a.ends_at ?? ''));

  renderGroups('groups-container', activeRooms, user.id);
  renderGroups('past-container', pastRooms, user.id);
  updateStats(activeRooms);
}

// ── Load only groups the user joined or created ───────────────
export async function loadMyGroups() {
  const user = await getUser();
  if (!user) return;

  // Groups user is a member of
  const { data: memberships } = await supabase
    .from('memberships')
    .select('group_id')
    .eq('user_id', user.id);

  const memberGroupIds = memberships?.map(m => m.group_id) ?? [];

  // Groups user hosts
  const { data: hostedGroups } = await supabase
    .from('groups')
    .select('*')
    .eq('host_id', user.id);

  // Groups user joined (but didn't host)
  let joinedGroups = [];
  if (memberGroupIds.length > 0) {
    const { data } = await supabase
      .from('groups')
      .select('*')
      .in('id', memberGroupIds)
      .neq('host_id', user.id);
    joinedGroups = data ?? [];
  }

  // Get all memberships to compute counts
  const allGroupIds = [...new Set([
    ...(hostedGroups ?? []).map(g => g.id),
    ...joinedGroups.map(g => g.id)
  ])];

  const { data: allMemberships } = await supabase
    .from('memberships')
    .select('group_id, user_id')
    .in('group_id', allGroupIds);

  const combined = [...(hostedGroups ?? []), ...joinedGroups];
  const enriched = combined.map(g => {
    const members = allMemberships?.filter(m => m.group_id === g.id) ?? [];
    const endTime = getEndTimeForGroupRow(g);
    const { status, start, end } = getRoomStatus(g.date, g.time, endTime);
    return {
      ...g,
      member_count: members.length,
      is_member: members.some(m => m.user_id === user.id),
      member_ids: members.map(m => m.user_id),
      end_time: endTime,
      status,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
    };
  });

  const active = enriched.filter(g => g.status !== 'Completed');
  const past = enriched.filter(g => g.status === 'Completed').sort((a, b) => (b.ends_at ?? '').localeCompare(a.ends_at ?? ''));
  renderGroups('mygroups-container', active, user.id);
  renderGroups('mygroups-past-container', past, user.id);
}

// ── Create a group ────────────────────────────────────────────
export async function createGroup(formData) {
  const user = await getUser();
  if (!user) return;

  const { subject, description, date, time, end_time, location, max_members } = formData;
  const subjectClean = (subject ?? '').toString().trim().replace(/\s+/g, ' ');
  const subjectNorm = normalizeSubject(subjectClean);
  const start = new Date(`${date}T${time}`);
  const end = new Date(`${date}T${end_time}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    showToast('End time must be after start time.', 'error');
    return;
  }
  if (end <= new Date()) {
    showToast('Cannot create a room in the past. Please choose a future time.', 'error');
    return;
  }

  // Duplicate control — fetch all active rooms on the same day
  const { data: sameDay, error: dupError } = await supabase
    .from('groups')
    .select('id, subject, date, time, end_time, location, description')
    .eq('date', date);
  if (dupError) {
    showToast('Duplicate check unavailable — creating anyway.', 'info');
  }

  const newLocNorm = normalizeLocation(location);
  const hhmm = t => (t ?? '').slice(0, 5);
  const newStart = hhmm(time);
  const newEnd = hhmm(end_time);
  // Two time ranges overlap when each starts before the other ends
  const overlaps = (s1, e1, s2, e2) => s1 < e2 && s2 < e1;

  if (!dupError) {
    const active = (sameDay ?? []).filter(g => {
      const { status } = getRoomStatus(g.date, g.time, getEndTimeForGroupRow(g));
      return status !== 'Completed';
    });

    // Rule 1: same subject at an overlapping time (any location)
    const subjectConflict = active.find(g =>
      normalizeSubject(g.subject) === subjectNorm &&
      overlaps(newStart, newEnd, hhmm(g.time), hhmm(getEndTimeForGroupRow(g)))
    );
    if (subjectConflict) {
      showToast(`A "${subjectClean}" room already exists during this time slot.`, 'error');
      return;
    }

    // Rule 2: same location at an overlapping time (any subject)
    const locationConflict = active.find(g =>
      normalizeLocation(g.location) === newLocNorm &&
      overlaps(newStart, newEnd, hhmm(g.time), hhmm(getEndTimeForGroupRow(g)))
    );
    if (locationConflict) {
      showToast(`"${location}" is already booked during this time slot.`, 'error');
      return;
    }
  }

  const maxParsed = (max_members ?? '').toString().trim() === '' ? null : parseInt(max_members, 10);
  if (maxParsed !== null && (Number.isNaN(maxParsed) || maxParsed < 2 || maxParsed > 50)) {
    showToast('Max participants must be between 2 and 50 (or left empty).', 'error');
    return;
  }

  const { error } = await supabase.from('groups').insert({
    name: `${subject} Study Room`,
    subject: subjectClean,
    description: (description ?? '').trim(),
    date,
    time,
    end_time,
    location,
    max_members: maxParsed,
    host_id: user.id,
    host_email: user.email,
  });

  if (error) {
    showToast('Failed to create group: ' + error.message, 'error');
  } else {
    // Also insert host as a member
    const { data: newGroup } = await supabase
      .from('groups')
      .select('id')
      .eq('host_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (newGroup) {
      await supabase.from('memberships').insert({ group_id: newGroup.id, user_id: user.id });
    }

    showToast('Study room created!', 'success');
    window.location.hash = 'home';
  }
}

// ── Join a group ──────────────────────────────────────────────
export async function joinGroup(groupId) {
  const user = await getUser();
  if (!user) return;

  // Validate capacity + lifecycle before joining
  const { data: group, error: gErr } = await supabase
    .from('groups')
    .select('id, date, time, end_time, max_members, description')
    .eq('id', groupId)
    .single();
  if (gErr || !group) {
    showToast('Could not load room.', 'error');
    return;
  }

  const endTime = getEndTimeForGroupRow(group);
  const { status } = getRoomStatus(group.date, group.time, endTime);
  if (status === 'Completed') {
    showToast('This room has already ended.', 'info');
    refreshCurrentPage();
    return;
  }

  if (group.max_members !== null && group.max_members !== undefined) {
    const { data: memberRows } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('group_id', groupId);
    const count = memberRows?.length ?? 0;
    if (count >= group.max_members) {
      showToast('Room is full.', 'info');
      refreshCurrentPage();
      return;
    }
  }

  const { error } = await supabase.from('memberships').insert({
    group_id: groupId,
    user_id: user.id
  });

  if (error) {
    showToast('Could not join room.', 'error');
  } else {
    showToast('Joined room!', 'success');
    refreshCurrentPage();
  }
}

// ── Leave a group ─────────────────────────────────────────────
export async function leaveGroup(groupId) {
  const user = await getUser();
  if (!user) return;

  const { error } = await supabase
    .from('memberships')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', user.id);

  if (error) {
    showToast('Could not leave group.', 'error');
  } else {
    showToast('Left group.', 'info');
    refreshCurrentPage();
  }
}

// ── Delete a group (host only) ────────────────────────────────
export async function deleteGroup(groupId) {
  const { error } = await supabase.from('groups').delete().eq('id', groupId);

  if (error) {
    showToast('Could not delete group.', 'error');
  } else {
    showToast('Group deleted.', 'info');
    refreshCurrentPage();
  }
}

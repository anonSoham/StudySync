import { supabase } from './supabase.js';
import { showToast } from './ui.js';
import { getUser } from './auth.js';

const BUCKET       = 'group-files';
const MAX_SIZE     = 10 * 1024 * 1024; // 10 MB
const BLOCKED_EXTS = ['exe','bat','cmd','sh','ps1','msi','dll','vbs','js','jar'];

// ── Load room details ─────────────────────────────────────────
export async function loadRoom(groupId) {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single();
  if (error) { showToast('Could not load room.', 'error'); return null; }
  return data;
}

// ── Load files for a room ─────────────────────────────────────
export async function loadRoomFiles(groupId) {
  const { data, error } = await supabase
    .from('group_files')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data ?? [];
}

// ── Check if current user is a member of the room ────────────
export async function getRoomMembership(groupId) {
  const user = await getUser();
  if (!user) return { user: null, isMember: false, isHost: false };

  const { data: group } = await supabase
    .from('groups')
    .select('host_id')
    .eq('id', groupId)
    .single();

  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle();

  const isHost   = group?.host_id === user.id;
  const isMember = !!membership || isHost;
  return { user, isMember, isHost };
}

// ── Upload one file ───────────────────────────────────────────
export async function uploadRoomFile(groupId, file, onDone) {
  const user = await getUser();
  if (!user) return;

  const ext = file.name.split('.').pop().toLowerCase();
  if (BLOCKED_EXTS.includes(ext)) {
    showToast(`File type .${ext} is not allowed.`, 'error');
    return;
  }
  if (file.size > MAX_SIZE) {
    showToast(`"${file.name}" exceeds the 10 MB limit.`, 'error');
    return;
  }

  const storagePath = `${groupId}/${Date.now()}_${file.name}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: false });

  if (uploadErr) {
    showToast('Upload failed: ' + uploadErr.message, 'error');
    return;
  }

  const { error: dbErr } = await supabase.from('group_files').insert({
    group_id:     groupId,
    uploader_id:  user.id,
    file_name:    file.name,
    file_type:    file.type || 'application/octet-stream',
    file_size:    file.size,
    storage_path: storagePath,
  });

  if (dbErr) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    showToast('Failed to save file record.', 'error');
    return;
  }

  showToast(`"${file.name}" uploaded!`, 'success');
  if (onDone) onDone();
}

// ── Get a short-lived signed download URL ────────────────────
export async function getFileUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600); // 1-hour expiry
  if (error) { showToast('Could not generate download link.', 'error'); return null; }
  return data.signedUrl;
}

// ── Delete a file (host only) ─────────────────────────────────
export async function deleteRoomFile(fileId, storagePath, onDone) {
  await supabase.storage.from(BUCKET).remove([storagePath]);
  const { error } = await supabase.from('group_files').delete().eq('id', fileId);
  if (error) {
    showToast('Could not delete file.', 'error');
  } else {
    showToast('File deleted.', 'info');
    if (onDone) onDone();
  }
}

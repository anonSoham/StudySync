import { supabase } from './supabase.js';
import { showToast } from './ui.js';
import { router } from './router.js';

function isDKTEEmail(email) {
  return email.trim().toLowerCase().endsWith('@dkte.ac.in');
}

export async function signUp(email, password) {
  if (!isDKTEEmail(email)) {
    showToast('Only @dkte.ac.in email addresses are allowed.', 'error');
    return;
  }
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) { showToast(error.message, 'error'); }
  else { showToast('Account created! You are now signed in.', 'success'); router.navigate('home'); }
}

export async function signIn(email, password) {
  if (!isDKTEEmail(email)) {
    showToast('Only @dkte.ac.in email addresses are allowed.', 'error');
    return;
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { showToast(error.message, 'error'); }
  else { showToast('Welcome back!', 'success'); router.navigate('home'); }
}

export async function signOut() {
  await supabase.auth.signOut();
  showToast('Signed out.', 'info');
  router.navigate('auth');
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function onAuthStateChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}

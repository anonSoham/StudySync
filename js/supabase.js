import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://yxymgljwllimkamdyvzk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4eW1nbGp3bGxpbWthbWR5dnprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0Mzg2MjEsImV4cCI6MjA5MDAxNDYyMX0.yTzUiIC5P8AmZ0xL2M4drb0IZ4WNPVA5r_j0xE28Xxc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

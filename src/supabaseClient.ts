import { createClient } from '@supabase/supabase-js';

// Project Supabase "bayusetiadji07's Project" (dipakai bersama beberapa app lain milik user).
// Kunci di bawah ini publishable/anon — aman dipakai di browser (bukan service_role).
const SUPABASE_URL = 'https://wddfpmsurcftapbczise.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kbPqKDodER85J6w3qls1UQ_iitjQFlm';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export interface SigatotProfile {
  id: string;
  email: string;
  nama: string;
  is_approved: boolean;
  created_at: string;
  approved_at: string | null;
}

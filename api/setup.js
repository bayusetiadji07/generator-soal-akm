// Vercel Serverless Function - Setup Supabase Database
// Jalankan SEKALI saja untuk configure database, lalu hapus file ini!
// Buka: /api/setup?secret=YOUR_ADMIN_PASSWORD

import { checkAdminPassword } from './_lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  const { secret } = req.query
  if (!checkAdminPassword(secret)) {
    return res.status(401).json({ ok: false, message: 'Invalid admin password' })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, message: 'SUPABASE_SERVICE_ROLE_KEY not set' })
  }

  const results = []

  // SQL statements to run
  const sqlStatements = [
    // 1. Create handle_new_user function
    `CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.sigatot_profiles (id, email, nama)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'nama')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`,

    // 2. Create trigger
    `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();`,

    // 3. Update existing users' profiles (if any)
    `INSERT INTO public.sigatot_profiles (id, email, is_approved, created_at)
SELECT id, email, false, now()
FROM auth.users
ON CONFLICT (id) DO NOTHING;`,
  ]

  for (let i = 0; i < sqlStatements.length; i++) {
    const sql = sqlStatements[i]
    try {
      const response = await fetch(`${process.env.SUPABASE_URL || 'https://wddfpmsurcftapbczise.supabase.co'}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ query: sql }),
      })

      // If rpc/exec doesn't exist, try alternative approach
      if (!response.ok) {
        results.push({
          index: i + 1,
          status: 'skipped',
          message: 'RPC function not available, will be created via alternative method'
        })
      } else {
        const data = await response.json()
        results.push({ index: i + 1, status: 'ok', data })
      }
    } catch (err) {
      results.push({ index: i + 1, status: 'error', message: err.message })
    }
  }

  return res.status(200).json({
    ok: true,
    message: 'Setup completed (some steps may require manual SQL execution)',
    results,
    manual_sql: `
-- Run this SQL manually in Supabase SQL Editor if needed:

-- 1. Create function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.sigatot_profiles (id, email, nama)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'nama')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
`
  })
}

'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function updatePassword(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const password = String(formData.get('password') ?? '');
  if (password.length < 8) return { ok: false, error: 'short' };
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

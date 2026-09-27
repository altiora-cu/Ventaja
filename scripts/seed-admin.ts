/**
 * Crea (o actualiza) el usuario administrador en Supabase Auth y su perfil.
 * Uso: ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm seed:admin
 * La contraseña solo vive en .env.local / Vercel; nunca en el repo.
 */
import { config as loadEnv } from 'dotenv';

// Carga .env.local (prioridad) y .env, desde la raíz del proyecto.
loadEnv({ path: ['.env.local', '.env'] });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  if (!email || !password) throw new Error('Faltan ADMIN_EMAIL / ADMIN_PASSWORD');
  if (password.length < 8) throw new Error('ADMIN_PASSWORD debe tener al menos 8 caracteres');

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // ¿Existe ya?
  let userId: string | null = null;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    userId = existing.id;
    const { error } = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    if (error) throw error;
    console.log(`Usuario existente actualizado: ${email}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { locale: 'es' } });
    if (error) throw error;
    userId = data.user.id;
    console.log(`Usuario creado: ${email}`);
  }

  // El trigger crea el perfil; aseguramos rol/estado admin.
  const { error: pErr } = await admin.from('profiles').upsert(
    {
      id: userId,
      email,
      role: 'admin',
      status: 'activa',
      paid_until: '2099-12-31T00:00:00Z',
      trial_ends_at: '2099-12-31T00:00:00Z',
      locale: 'es',
    },
    { onConflict: 'id' },
  );
  if (pErr) throw pErr;
  console.log('Perfil admin listo: role=admin, status=activa, paid_until=2099-12-31');
  console.log('Recuerda cambiar la contraseña desde /cuenta tras el primer login.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

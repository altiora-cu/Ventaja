import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';

export default function RegistroPage() {
  return (
    <Suspense>
      <AuthForm mode="register" />
    </Suspense>
  );
}

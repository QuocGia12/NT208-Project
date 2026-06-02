'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProfilePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/lobby');
  }, [router]);

  return (
    <div className="flex h-full w-full items-center justify-center text-center text-amber-100">
      <p className="moba-heading text-lg uppercase tracking-[0.12em]">Profile is disabled.</p>
    </div>
  );
}

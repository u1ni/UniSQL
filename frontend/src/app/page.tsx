"use client";

import dynamic from 'next/dynamic';

const Layout = dynamic(() => import('@/components/Layout').then(mod => mod.Layout), { ssr: false });

export default function Home() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-bg text-text">
      <Layout />
    </main>
  );
}

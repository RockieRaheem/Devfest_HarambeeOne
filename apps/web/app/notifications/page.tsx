'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';

export default function NotificationsPage() {
  return <div className="notifications-page">
    <header className="notifications-page-header">
      <Link href="/workspace" className="portal-brand"><Image src="/harambeeone-logo.png" width={38} height={38} alt=""/><span><strong>HarambeeOne</strong><small>Account updates</small></span></Link>
      <Link href="/workspace" className="notifications-back"><ArrowLeft size={16}/>Back to workspaces</Link>
    </header>
    <main><NotificationCenter/></main>
  </div>;
}

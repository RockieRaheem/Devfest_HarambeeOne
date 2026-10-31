'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRightLeft, BarChart3, BookOpen, CalendarDays, ChevronDown, ClipboardCheck, ExternalLink, FileUp, GraduationCap, HandHeart, LayoutDashboard, ListChecks, LogOut, Menu, PlugZap, ReceiptText, RefreshCw, Settings, ShieldCheck, Users, WalletCards, X } from 'lucide-react';
import { useState } from 'react';
import { useEffect } from 'react';
import { clearPrimarySchool, getPrimarySchool, SchoolLoadError } from '@/lib/school';
import { AcademicPeriod, clearPeriods, getAcademicPeriods, getSelectedPeriod, selectPeriod } from '@/lib/period';
import { getDashboardBootstrap } from '@/lib/dashboard';
import { clearServerSession } from '@/lib/firebase/client';
import PushNotificationControl from '@/components/PushNotificationControl';
import { NotificationIndicator } from '@/components/NotificationCenter';

const navGroups = [
  { label: 'Overview', items: [
    { label: 'Bursar command', href: '/dashboard', icon: LayoutDashboard },
  ]},
  { label: 'Learners', items: [
    { label: 'Student ledgers', href: '/students', icon: Users },
    { label: 'Import learners', href: '/students/import', icon: FileUp },
    { label: 'Classes & streams', href: '/classes', icon: BookOpen },
    { label: 'Learner rollover', href: '/rollover', icon: GraduationCap },
    { label: 'Section transfers', href: '/transfers', icon: ArrowRightLeft },
  ]},
  { label: 'Finance', items: [
    { label: 'Fees & installments', href: '/fees', icon: ReceiptText },
    { label: 'Requirements', href: '/requirements', icon: ClipboardCheck },
    { label: 'Payment register', href: '/payments', icon: WalletCards },
    { label: 'Reconciliation', href: '/reconciliation', icon: ListChecks },
    { label: 'Overdue accounts', href: '/arrears', icon: AlertTriangle },
    { label: 'Financial reports', href: '/reports', icon: BarChart3 },
  ]},
  { label: 'Support', items: [
    { label: 'Manage campaigns', href: '/support-admin', icon: HandHeart },
    { label: 'Outcome evidence', href: '/support-admin/outcomes', icon: ClipboardCheck },
    { label: 'Public donor portal', href: '/support', icon: ExternalLink },
  ]},
  { label: 'Control', items: [
    { label: 'Academic periods', href: '/periods', icon: CalendarDays },
    { label: 'Controlled reopening', href: '/reopening', icon: RefreshCw },
    { label: 'Staff access', href: '/institution/access', icon: Users },
    { label: 'Connected systems', href: '/integrations', icon: PlugZap },
    { label: 'Audit trail', href: '/audit', icon: ShieldCheck },
  ]},
] as const;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const authRoute = pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password' || pathname === '/reset-password' || pathname === '/onboarding' || pathname.startsWith('/auth/');
  const publicRoute = pathname === '/support' || pathname.startsWith('/support/');
  const portalRoute = pathname === '/workspace' || pathname === '/welcome' || pathname === '/notifications' || pathname === '/guardian' || pathname.startsWith('/guardian/') || pathname === '/donor' || pathname.startsWith('/donor/') || pathname.startsWith('/staff/accept');
  const periodsRoute = pathname === '/periods';
  const dashboardRoute = pathname === '/dashboard';
  const [open, setOpen] = useState(false);
  const [schoolName, setSchoolName] = useState('Set up institution');
  const [userName, setUserName] = useState('Bursar');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('Bursar');
  const [userOpen, setUserOpen] = useState(false);
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [schoolAccess, setSchoolAccess] = useState<'checking'|'allowed'|'denied'>('checking');
  useEffect(() => {
    if (authRoute || publicRoute || portalRoute) { setSchoolAccess('allowed'); return; }
    setSchoolAccess('checking');
    let cancelled = false;
    fetch('/api/backend/api/v1/me/portals', { cache: 'no-store' })
      .then(async response => {
        if (response.status === 401) { router.replace('/login?error=session_expired'); return null; }
        if (!response.ok) throw new Error('Workspace access could not be verified');
        return response.json();
      })
      .then((context:{preferred_workspace:string|null;portals:{type:string;href:string}[]} | null) => {
        if (!context || cancelled) return;
        if (context.portals.some(portal => portal.type === 'school')) { setSchoolAccess('allowed'); return; }
        setSchoolAccess('denied');
        const destination = context.portals.find(portal => portal.type === context.preferred_workspace)
          ?? context.portals.find(portal => portal.type === 'guardian')
          ?? context.portals.find(portal => portal.type === 'donor');
        router.replace(destination?.href ?? '/workspace');
      })
      .catch(() => { if (!cancelled) { setSchoolAccess('denied'); router.replace('/workspace'); } });
    return () => { cancelled = true; };
  }, [authRoute, portalRoute, publicRoute, router]);
  useEffect(() => {
    if (authRoute || publicRoute || portalRoute || schoolAccess !== 'allowed') return;
    const workspace = dashboardRoute
      ? getDashboardBootstrap().then(result => [result.school, result.periods] as const)
      : Promise.all([getPrimarySchool(), getAcademicPeriods()]);
    workspace.then(async ([school, rows]) => {
      setSchoolName(school.name); if (school.role) setUserRole(school.role);
      setPeriods(rows);
      if (rows.length) setPeriodId((await getSelectedPeriod()).id);
    }).catch(reason => {
      if (reason instanceof SchoolLoadError && reason.status === 401) {
        clearPrimarySchool();
        clearPeriods();
        router.replace('/login?error=session_expired');
      } else if (reason instanceof SchoolLoadError && (reason.status === 403 || reason.status === 404) && !periodsRoute) {
        router.replace('/workspace');
      }
    });
    void fetch('/auth/session', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(profile => {
        if (!profile) return;
        const email = typeof profile.email === 'string' ? profile.email : '';
        setUserName(profile.displayName || email.split('@')[0] || 'Bursar');
        setUserEmail(email);
      });
  }, [authRoute, dashboardRoute, periodsRoute, portalRoute, publicRoute, router, schoolAccess]);

  useEffect(() => {
    if (authRoute || publicRoute || portalRoute || schoolAccess !== 'allowed') return;
    const prefetch = () => navGroups.forEach(group => group.items.forEach(item => router.prefetch(item.href)));
    const idleWindow = window as Window & { requestIdleCallback?: (callback: () => void) => number; cancelIdleCallback?: (id: number) => void };
    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(prefetch);
      return () => idleWindow.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(prefetch, 250);
    return () => window.clearTimeout(id);
  }, [authRoute, portalRoute, publicRoute, router, schoolAccess]);

  async function signOut() {
    clearPrimarySchool();
    clearPeriods();
    await clearServerSession();
    router.replace('/login');
    router.refresh();
  }

  async function changePeriod(value: string) {
    await selectPeriod(value);
    setPeriodId(value);
    setWorkspaceRevision(revision => revision + 1);
  }

  if (authRoute || publicRoute || portalRoute) return <>{children}</>;
  if (schoolAccess !== 'allowed') return <div className="portal-state" role="status">Verifying school workspace access...</div>;
  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'BU';
  return <div className="app-shell" data-school-workspace>
    {open && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? 'is-open' : ''}`}>
      <div className="institution">
        <Image src="/harambeeone-logo.png" width={42} height={42} alt="HarambeeOne" priority />
        <div><strong>HarambeeOne</strong></div>
        <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={20} /></button>
      </div>
      <Link href="/workspace" className="school-switcher"><span className="school-mark">{schoolName.slice(0, 2).toUpperCase()}</span><span><strong>{schoolName}</strong></span><ChevronDown size={16} /></Link>
      <nav className="primary-nav" aria-label="Primary navigation">
        {navGroups.map(group => <section className="nav-group" key={group.label} aria-labelledby={`nav-${group.label.toLowerCase()}`}>
          <span className="nav-label" id={`nav-${group.label.toLowerCase()}`}>{group.label}</span>
          {group.items.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
            return <Link className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} href={href} key={href} onClick={() => setOpen(false)}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></Link>;
          })}
        </section>)}
      </nav>
      <div className="sidebar-foot"><div className="sidebar-tools"><Link href="/institution"><Settings size={17} /> Institution settings</Link></div></div>
    </aside>
    <div className="workspace">
      <header className="top-nav">
        <button className="menu-button" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={22} /></button>
        <div className="mobile-brand"><GraduationCap size={20} /><strong>HarambeeOne</strong></div>
        {periods.length ? <label className="term-selector" htmlFor="active-academic-period"><span>Academic period</span><select id="active-academic-period" name="active_academic_period" aria-label="Selected academic period" value={periodId} onChange={event => changePeriod(event.target.value)}>{periods.map(period => <option value={period.id} key={period.id}>{period.name} · {period.academic_year_name}{period.is_operational ? ' · Current' : ''}</option>)}</select><ChevronDown size={15} /></label> : <Link className="term-selector period-setup" href="/periods"><span>Academic period</span><strong>Set up calendar</strong><ChevronDown size={15}/></Link>}
        <Link className="quick-action" href="/payments"><ReceiptText size={17} /> Record payment</Link>
        <NotificationIndicator />
        <div className="header-push"><PushNotificationControl /></div>
        <div className="user-area"><button className="user-menu" onClick={() => setUserOpen(value => !value)} aria-expanded={userOpen}><span>{initials}</span><div><strong>{userName}</strong><small>{userEmail || `${userRole} · Active`}</small></div><ChevronDown size={14} /></button>{userOpen && <div className="user-dropdown"><div><strong>{userName}</strong><span>{userEmail || userRole}</span></div><button onClick={signOut}><LogOut size={16}/>Sign out</button></div>}</div>
      </header>
      <main className="page-canvas" key={workspaceRevision}>{children}</main>
    </div>
  </div>;
}

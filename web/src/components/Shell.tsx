'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconCourses, IconDashboard, IconKnowledge, IconPlanner, IconRevision, IconTasks, IconSettings, IconLogout } from './icons';
import { Assistant } from './Assistant';

const NAV = [
  { href: '/', label: 'Dashboard', Icon: IconDashboard },
  { href: '/courses', label: 'Courses', Icon: IconCourses },
  { href: '/knowledge', label: 'Knowledge', Icon: IconKnowledge },
  { href: '/planner', label: 'Planner', Icon: IconPlanner },
  { href: '/tasks', label: 'Tasks', Icon: IconTasks },
  { href: '/revision', label: 'Revision', Icon: IconRevision },
];

const active = (path: string, href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));

export function Shell({ user, aiEnabled, logout, children }: { user: { name: string }; aiEnabled: boolean; logout: () => Promise<void>; children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-6 lg:p-5">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col bg-charcoal text-paper rounded-[22px] px-4 py-6 sticky top-5 h-[calc(100dvh-40px)]">
        <Link href="/" className="font-serif text-[26px] px-3 mb-8 tracking-tight">LEA<span className="text-rose">·</span>Study</Link>
        <p className="eyebrow !text-white/40 px-3 mb-2">Study</p>
        <nav className="flex flex-col gap-0.5" aria-label="Main">
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href} aria-current={active(path, href) ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[14.5px] transition-colors ${active(path, href) ? 'bg-white/10 text-rose' : 'text-white/80 hover:bg-white/5'}`}>
              <Icon />{label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-0.5">
          <Link href="/settings" aria-current={active(path, '/settings') ? 'page' : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[14.5px] ${active(path, '/settings') ? 'bg-white/10 text-rose' : 'text-white/80 hover:bg-white/5'}`}><IconSettings />Settings</Link>
          <form action={logout}><button className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-[14.5px] text-white/80 hover:bg-white/5"><IconLogout />Log out</button></form>
          <p className="px-3 pt-3 text-xs text-white/40 truncate">{user.name}</p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-20 bg-ivory/95 backdrop-blur border-b border-line px-4 pt-[max(10px,env(safe-area-inset-top))] pb-2.5 flex items-center justify-between">
        <Link href="/" className="font-serif text-[22px]">LEA<span className="text-rose-ink">·</span>Study</Link>
        <Link href="/settings" className="btn btn-ghost !p-2" aria-label="Settings"><IconSettings /></Link>
      </header>

      <main className="min-w-0 px-4 sm:px-6 lg:px-2 pt-5 pb-28 lg:pb-10">{children}</main>

      {/* Mobile bottom navigation */}
      <nav aria-label="Main" className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-charcoal text-white/75 grid grid-cols-6 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5 px-1">
        {NAV.map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-current={active(path, href) ? 'page' : undefined}
            className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10.5px] ${active(path, href) ? 'text-rose' : ''}`}>
            <Icon width={21} height={21} />{label}
          </Link>
        ))}
      </nav>
      <Assistant enabled={aiEnabled} />
    </div>
  );
}

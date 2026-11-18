import { Shell } from '@/components/Shell';
import { requireUser } from '@/lib/auth';
import { logout } from '@/app/actions/auth';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  return <Shell user={{ name: user.name }} aiEnabled={aiEnabled} logout={logout}>{children}</Shell>;
}

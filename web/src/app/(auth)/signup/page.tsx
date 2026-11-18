import { AuthForm } from '@/components/AuthForm';
import { signup } from '@/app/actions/auth';
export const metadata = { title: 'Create account' };
export const dynamic = 'force-dynamic';
export default function Page() {
  return <main className="min-h-dvh grid place-items-center p-4"><AuthForm mode="signup" action={signup} needsCode={Boolean(process.env.SIGNUP_CODE)} /></main>;
}

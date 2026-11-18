import { AuthForm } from '@/components/AuthForm';
import { login } from '@/app/actions/auth';
export const metadata = { title: 'Sign in' };
export default function Page() {
  return <main className="min-h-dvh grid place-items-center p-4"><AuthForm mode="login" action={login} /></main>;
}

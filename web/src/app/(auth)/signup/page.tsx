import { AuthForm } from '@/components/AuthForm';
import { signup } from '@/app/actions/auth';
export const metadata = { title: 'Create account' };
export default function Page() {
  return <main className="min-h-dvh grid place-items-center p-4"><AuthForm mode="signup" action={signup} /></main>;
}

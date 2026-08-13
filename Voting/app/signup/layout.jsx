import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function PublicAuthLayout({ children }) {
  const session = await auth();
  if (session) redirect('/dashboard');
  return children;
}

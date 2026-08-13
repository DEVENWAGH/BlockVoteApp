import FluentProviderWrapper from '@/components/FluentProviderWrapper';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }) {
  const session = await auth();
  if (!session) redirect('/login');

  return <FluentProviderWrapper>{children}</FluentProviderWrapper>;
}

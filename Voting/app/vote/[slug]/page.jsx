import { redirect } from 'next/navigation';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';
import Admin from '@/lib/models/Admin';

export default async function LegacyVotePage({ params }) {
  const { slug } = await params;

  const electionId = String(slug || '').trim();
  if (!electionId) {
    redirect('/login');
  }

  await connectDB();
  const election = await Election.findOne({ electionId }).lean();
  if (!election || !election.title || !election.createdBy) {
    redirect('/login');
  }

  const admin = await Admin.findById(election.createdBy).lean();
  const orgName = admin?.name || 'admin';

  redirect(
    `/org/${encodeURIComponent(orgName)}/election/${encodeURIComponent(
      election.title,
    )}/${encodeURIComponent(electionId)}`,
  );
}

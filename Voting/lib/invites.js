/**
 * lib/invites.js
 * Send the "vote in the app" email to registered people in an election.
 */
import Enrollment from './models/Enrollment.js';
import Voter from './models/Voter.js';

export async function sendInvitesForElection({
  electionId,
  electionTitle,
  inviteUrl,
  deepLink,
  onlyUnsent = true,
  limit = 500,
  send,
}) {
  const filter = { electionId: String(electionId), status: 'registered' };
  if (onlyUnsent) filter.$or = [{ inviteSentAt: null }, { inviteSentAt: { $exists: false } }];

  const enrollments = await Enrollment.find(filter).limit(limit).lean();
  if (!enrollments.length) return 0;

  const people = await Voter.find({ voterId: { $in: enrollments.map((e) => e.voterId) } })
    .select('voterId name email')
    .lean();
  const byId = new Map(people.map((p) => [p.voterId, p]));

  let sent = 0;
  for (const enrollment of enrollments) {
    const person = byId.get(enrollment.voterId);
    if (!person?.email) continue;
    try {
      await send(person.email, {
        voterName: person.name,
        electionTitle,
        inviteUrl,
        deepLink,
      });
      await Enrollment.updateOne({ _id: enrollment._id }, { $set: { inviteSentAt: new Date() } });
      sent += 1;
    } catch (err) {
      console.warn('[invites] invite failed', enrollment.voterId, err.message);
    }
  }
  return sent;
}

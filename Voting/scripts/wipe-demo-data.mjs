import mongoose from 'mongoose';

async function wipe() {
  const conn = await mongoose.connect('mongodb://127.0.0.1:27017/votingdapp');
  const db = conn.connection.db;

  const delElections = await db.collection('elections').deleteMany({});
  const delCandidates = await db.collection('candidates').deleteMany({});
  const delEnrollments = await db.collection('enrollments').deleteMany({});
  const delVotes = await db.collection('voteactivities').deleteMany({});

  console.log(`Cleaned up:
- ${delElections.deletedCount} election(s) removed
- ${delCandidates.deletedCount} candidate(s) removed
- ${delEnrollments.deletedCount} enrollment(s) removed
- ${delVotes.deletedCount} vote(s) removed`);

  process.exit(0);
}

wipe().catch((err) => {
  console.error(err);
  process.exit(1);
});

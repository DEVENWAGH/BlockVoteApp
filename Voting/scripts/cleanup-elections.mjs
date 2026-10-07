import mongoose from 'mongoose';

async function main() {
  const conn = await mongoose.connect('mongodb://127.0.0.1:27017/votingdapp');
  const db = conn.connection.db;

  // 1. Remove student council election and its candidate/enrollment records
  const studentCouncilId = '0x65e76de92b8d3a29f79f3843e684033abdf563a3e3bb8b8d43df5e9eca9448f6';
  const delElection = await db.collection('elections').deleteOne({ electionId: studentCouncilId });
  const delCandidates = await db.collection('candidates').deleteMany({ electionId: studentCouncilId });
  const delEnroll = await db.collection('enrollments').deleteMany({ electionId: studentCouncilId });
  console.log('Removed student council:', delElection.deletedCount, 'election,', delCandidates.deletedCount, 'candidates,', delEnroll.deletedCount, 'enrollments');

  // 2. Set Demo Election 2026 level to 'assembly' (Assembly MLA tier)
  const demoId = '0x91402bda0e6c1420c274b32dc86c24bc93d1885e34cd1c33f2e9348c805480bc';
  const updElection = await db.collection('elections').updateOne(
    { electionId: demoId },
    { $set: { level: 'assembly', title: 'Demo Election 2026' } }
  );
  console.log('Updated Demo Election 2026 to level assembly:', updElection.modifiedCount);

  // 3. Update existing candidates so their constituencyCode is MH-AC-258 (Karad North)
  const updCandidates = await db.collection('candidates').updateMany(
    { electionId: demoId },
    { $set: { constituencyCode: 'MH-AC-258', constituencyName: 'Karad North' } }
  );
  console.log('Updated candidates constituencyCode to MH-AC-258:', updCandidates.modifiedCount);

  // Verify remaining elections
  const remaining = await db.collection('elections').find({}).toArray();
  console.log('\nRemaining Elections:');
  remaining.forEach(e => console.log('ID:', e.electionId, '| Title:', e.title, '| Level:', e.level));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

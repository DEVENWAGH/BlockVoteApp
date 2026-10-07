import mongoose from 'mongoose';

async function seed() {
  const conn = await mongoose.connect('mongodb://127.0.0.1:27017/votingdapp');
  const Party = conn.connection.db.collection('parties');
  const parties = [
    { code: 'BJP', name: 'Bharatiya Janata Party', symbol: '/logo.png', manifesto: 'Rashtra Pratham, Sabka Saath Sabka Vikas', allowMultiplePerSeat: false, createdAt: new Date(), updatedAt: new Date() },
    { code: 'INC', name: 'Indian National Congress', symbol: '/logo.png', manifesto: 'Nyay Patra, progress and equality for all', allowMultiplePerSeat: false, createdAt: new Date(), updatedAt: new Date() },
    { code: 'AAP', name: 'Aam Aadmi Party', symbol: '/logo.png', manifesto: 'Clean governance, schools, healthcare and free water', allowMultiplePerSeat: false, createdAt: new Date(), updatedAt: new Date() },
    { code: 'SS', name: 'Shiv Sena', symbol: '/logo.png', manifesto: 'Maharashtra Dharma and citizen welfare', allowMultiplePerSeat: false, createdAt: new Date(), updatedAt: new Date() },
    { code: 'NCP', name: 'Nationalist Congress Party', symbol: '/logo.png', manifesto: 'Agricultural prosperity and modern infrastructure', allowMultiplePerSeat: false, createdAt: new Date(), updatedAt: new Date() },
    { code: 'PP', name: 'Progress Party', symbol: '/logo.png', manifesto: 'Forward-looking democratic governance and technology', allowMultiplePerSeat: false, createdAt: new Date(), updatedAt: new Date() },
    { code: 'UF', name: 'Unity Front', symbol: '/logo.png', manifesto: 'Uniting communities with integrity and civic justice', allowMultiplePerSeat: false, createdAt: new Date(), updatedAt: new Date() },
    { code: 'GA', name: 'Green Alliance', symbol: '/logo.png', manifesto: 'Ecological sustainability, renewable solar energy and clean water', allowMultiplePerSeat: false, createdAt: new Date(), updatedAt: new Date() },
    { code: 'IND', name: 'Independent', symbol: '/logo.png', manifesto: 'Independent non-partisan civic representative', allowMultiplePerSeat: true, createdAt: new Date(), updatedAt: new Date() }
  ];
  for (const p of parties) {
    await Party.updateOne({ code: p.code }, { $set: p, $unset: { color: "" } }, { upsert: true });
  }
  // Remove color from any other parties in the collection
  await Party.updateMany({}, { $unset: { color: "" } });
  console.log('Successfully seeded', parties.length, 'parties into MongoDB without color property!');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});

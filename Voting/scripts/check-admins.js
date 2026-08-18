import mongoose from 'mongoose';
(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/blockvote_local');
  const cols = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections:', cols.map(c => c.name).join(', '));
  const admins = await mongoose.connection.db.collection('admins').find({}).toArray();
  console.log('Admin count:', admins.length);
  admins.forEach(a => {
    console.log(`${a.email} | verified: ${a.isEmailVerified} | hasPassword: ${!!a.passwordHash}`);
  });
  process.exit(0);
})();

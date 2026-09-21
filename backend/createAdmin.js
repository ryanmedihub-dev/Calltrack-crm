require('dotenv').config();
const mongoose = require('mongoose');
const User     = require('./models/User');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const EMAIL = 'ryanadmin@gmail.com';

  const existing = await User.findOne({ email: EMAIL });
  if (existing) {
    console.log('User already exists — updating password and role...');
    existing.password = 'Dashzer@1503';
    existing.role     = 'admin';
    existing.isActive = true;
    await existing.save();
    console.log('Updated:', existing.email, '| role:', existing.role, '| id:', existing._id);
  } else {
    const user = await User.create({
      name:     'Ryan Admin',
      email:    EMAIL,
      password: 'Dashzer@1503',
      role:     'admin',
      isActive: true,
    });
    console.log('Admin created:');
    console.log('  Email :', user.email);
    console.log('  Role  :', user.role);
    console.log('  ID    :', user._id);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

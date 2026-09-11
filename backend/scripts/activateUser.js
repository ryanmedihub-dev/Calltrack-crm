// One-off: reactivate a user account by email. Usage: node scripts/activateUser.js <email>
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  const email = process.argv[2];
  if (!email) { console.error('Usage: node scripts/activateUser.js <email>'); process.exit(1); }

  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) { console.error('No user found for', email); await mongoose.disconnect(); process.exit(1); }

  console.log('Before:', { id: user._id.toString(), email: user.email, role: user.role, isActive: user.isActive });
  user.isActive = true;
  await user.save();

  const check = await User.findById(user._id).select('email isActive');
  console.log('After :', { id: check._id.toString(), email: check.email, isActive: check.isActive });

  await mongoose.disconnect();
  console.log('Done.');
})().catch(async (e) => { console.error(e); try { await mongoose.disconnect(); } catch {} process.exit(1); });

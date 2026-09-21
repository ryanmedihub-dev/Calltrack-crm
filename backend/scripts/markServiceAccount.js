// One-off: flag an account as a service account (isServiceAccount: true) so its login
// tokens get the long 365-day expiry instead of the normal 7-day session — see
// signToken() in routes/auth.js. Usage: node scripts/markServiceAccount.js <email>
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  const email = process.argv[2];
  if (!email) { console.error('Usage: node scripts/markServiceAccount.js <email>'); process.exit(1); }

  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) { console.error('No user found for', email); await mongoose.disconnect(); process.exit(1); }

  console.log('Before:', { id: user._id.toString(), email: user.email, role: user.role, isServiceAccount: user.isServiceAccount });
  user.isServiceAccount = true;
  await user.save();

  const check = await User.findById(user._id).select('email isServiceAccount');
  console.log('After :', { id: check._id.toString(), email: check.email, isServiceAccount: check.isServiceAccount });
  console.log('\nThe NEXT login for this account will mint a 365-day token. Log in again to get one.');

  await mongoose.disconnect();
})().catch(async (e) => { console.error(e); try { await mongoose.disconnect(); } catch {} process.exit(1); });

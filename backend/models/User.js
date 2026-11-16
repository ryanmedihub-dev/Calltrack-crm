const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'manager', 'tl', 'employee'], default: 'employee' },
  phone: { type: String },
  deviceId:    { type: String, select: false },
  tlName:      { type: String, default: '' },
  fcmToken:    { type: String, default: null, select: false },
  dailyTarget: { type: Number, default: 100 },
  isActive:    { type: Boolean, default: true },
  isSuperAdmin: { type: Boolean, default: false },
  isDeleted:   { type: Boolean, default: false },
  deletedAt:   { type: Date, default: null },
  ryanEmployeeCode: { type: String, default: null, index: true, trim: true },
  // Marks an account as a server-to-server integration login (e.g. ryan-crm's
  // CALLBY_SERVICE_TOKEN), not a person's daily-use account. Login tokens for this account
  // get a long expiry instead of the normal 7-day user session — see signToken() in
  // routes/auth.js. Not a real API-key system (still a login JWT, still gated by
  // isActive), but avoids rotating this specific token every week by hand.
  isServiceAccount: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.fcmToken;
    delete ret.deviceId;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);

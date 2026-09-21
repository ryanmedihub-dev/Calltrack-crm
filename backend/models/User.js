const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'manager', 'tl', 'employee'], default: 'employee' },
  phone: { type: String },
  deviceId:    { type: String },
  tlName:      { type: String, default: '' },
  fcmToken:    { type: String, default: null },
  dailyTarget: { type: Number, default: 100 },
  isActive:    { type: Boolean, default: true },
  ryanEmployeeCode: { type: String, default: null, index: true, trim: true },
  isSuperAdmin:{ type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },

  // ── Phase 2: Organizational Hierarchy ──────────────────────────────────────
  // Set on users with role: 'tl' — references the Manager they report to.
  // Null for admin, manager, and employee users.
  managerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Set on users with role: 'employee' — references the TL they report to.
  // The manager relationship for an employee is derived transitively:
  //   employee → teamLeadId → TL → managerId → Manager
  // Null for admin, manager, and tl users.
  teamLeadId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
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
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);

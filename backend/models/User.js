const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['manager', 'employee'], default: 'employee' },
  phone: { type: String },
  deviceId:    { type: String },
  tlName:      { type: String, default: '' },
  fcmToken:    { type: String, default: null },
  dailyTarget: { type: Number, default: 100 },
  isActive:    { type: Boolean, default: true },
  // ryan-crm's Employee.employeeId code (e.g. "RC-014"), NOT this app's own User._id.
  // Deliberately NOT named `employeeId` — that name is already load-bearing elsewhere in this
  // codebase (CallLog.employeeId, workforceSummary/agentDetail response fields, the
  // agent-detail/:employeeId route param) as this User document's own _id. Reusing it here
  // would let the two meanings silently swap under a future refactor.
  ryanEmployeeCode: { type: String, default: null, index: true, trim: true },
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
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);

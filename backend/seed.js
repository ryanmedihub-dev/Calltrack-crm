require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('./models/User');
const CallLog = require('./models/CallLog');
const Lead = require('./models/Lead');

// ===============================
// MongoDB Connection Helper
// ===============================
function getMongoUri() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI or MONGO_URI environment variable is not set.');
    process.exit(1);
  }
  return uri;
}

// ===============================
// Seed Configuration & Helpers
// ===============================
const CALL_TYPES = ['incoming', 'outgoing', 'missed', 'rejected'];
const CONTACT_NAMES = ['Raj Kumar', 'Priya Singh', 'Amit Sharma', 'Neha Patel', 'Vikram Joshi', 'Anita Verma', 'Suresh Reddy', 'Kavita Nair', 'Ravi Gupta', 'Sunita Rao'];
const LEAD_SOURCES = ['website', 'referral', 'cold_call', 'social_media', 'email_campaign'];
const LEAD_STATUSES = ['new', 'contacted', 'interested', 'not_interested', 'converted', 'lost'];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPhone() {
  return `+91${randomInt(7000000000, 9999999999)}`;
}

function randomDate(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - randomInt(0, daysBack));
  d.setHours(randomInt(8, 20), randomInt(0, 59), 0, 0);
  return d;
}

// ===============================
// Primary Seed Function
// ===============================
async function seed() {
  const mongoUri = getMongoUri();
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  // Clear existing data
  await Promise.all([User.deleteMany({}), CallLog.deleteMany({}), Lead.deleteMany({})]);
  console.log('Cleared existing data');

  // Create admin
  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@calltrack.com',
    password: 'password123',
    role: 'admin',
    phone: randomPhone(),
    isActive: true
  });
  console.log('Admin created:', admin.email);

  // Create manager
  const manager = await User.create({
    name: 'Admin Manager',
    email: 'manager@calltrack.com',
    password: 'password123',
    role: 'manager',
    phone: randomPhone(),
    isActive: true
  });
  console.log('Manager created:', manager.email);

  // Create 5 employees with ryanEmployeeCode
  const employees = [];
  for (let i = 1; i <= 5; i++) {
    const emp = await User.create({
      name: `Employee ${i}`,
      email: `employee${i}@calltrack.com`,
      password: 'password123',
      role: 'employee',
      phone: randomPhone(),
      deviceId: `device_${i}_${Date.now()}`,
      ryanEmployeeCode: `EMP${String(i).padStart(3, '0')}`,
      isActive: true
    });
    employees.push(emp);
    console.log(`Employee ${i} created:`, emp.email);
  }

  // Create 100 call logs
  const callLogs = [];
  for (let i = 0; i < 100; i++) {
    const emp = randomItem(employees);
    const callType = randomItem(CALL_TYPES);
    callLogs.push({
      employeeId: emp._id,
      employeeName: emp.name,
      employeePhone: emp.phone,
      callType,
      contactNumber: randomPhone(),
      contactName: randomItem(CONTACT_NAMES),
      duration: callType === 'missed' || callType === 'rejected' ? 0 : randomInt(10, 1800),
      timestamp: randomDate(30),
      deviceId: emp.deviceId,
      synced: true
    });
  }
  await CallLog.insertMany(callLogs);
  console.log('100 call logs created');

  // Create 10 sample leads
  const leads = [];
  for (let i = 0; i < 10; i++) {
    const assignedEmp = randomItem(employees);
    leads.push({
      name: randomItem(CONTACT_NAMES),
      phone: randomPhone(),
      email: `lead${i + 1}@example.com`,
      source: randomItem(LEAD_SOURCES),
      status: randomItem(LEAD_STATUSES),
      assignedTo: assignedEmp._id,
      notes: [
        { text: 'Initial contact made', addedBy: admin._id, addedAt: new Date() }
      ],
      lastCallAt: randomDate(7),
      followUpDate: randomDate(-7)
    });
  }
  await Lead.insertMany(leads);
  console.log('10 leads created');

  console.log('\n=== Seed complete ===');
  console.log('Admin:     admin@calltrack.com / password123');
  console.log('Manager:   manager@calltrack.com / password123');
  console.log('Employees: employee1@calltrack.com to employee5@calltrack.com / password123');
  process.exit(0);
}

// ==========================================
// Origin/Main: Ryan Employee Code Auditor
// ==========================================
async function getUsersWithoutRyanEmployeeCode() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    const mongoUri = getMongoUri();
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected.');

    // Find users where ryanEmployeeCode is null, 0, "0", or missing
    const users = await User.find({
      $or: [
        { ryanEmployeeCode: null },
        { ryanEmployeeCode: 0 },
        { ryanEmployeeCode: '0' },
        { ryanEmployeeCode: { $exists: false } },
      ],
    })
      .select('-password')
      .lean();

    console.log(`\n📊 Found ${users.length} users without a valid Ryan Employee Code.\n`);

    if (users.length > 0) {
      console.table(
        users.map((user) => ({
          ID: user._id?.toString(),
          Name: user.name || '',
          Email: user.email || '',
          Phone: user.phone || '',
          Role: user.role || '',
          RyanEmployeeCode:
            user.ryanEmployeeCode === undefined ? 'MISSING' : user.ryanEmployeeCode,
          Active: user.isActive,
          CreatedAt: user.createdAt ? new Date(user.createdAt).toISOString() : '',
        }))
      );
    }

    // Save JSON File
    const outputPath = path.join(__dirname, 'users_without_ryan_employee_code.json');
    fs.writeFileSync(outputPath, JSON.stringify(users, null, 2), 'utf8');
    console.log(`\n✅ JSON file created:\n${outputPath}`);

    // Create CSV File
    const csvPath = path.join(__dirname, 'users_without_ryan_employee_code.csv');
    const csvHeaders = [
      '_id', 'name', 'email', 'phone', 'role',
      'ryanEmployeeCode', 'isActive', 'tlName', 'dailyTarget', 'createdAt',
    ];

    const escapeCsv = (value) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const csvRows = users.map((user) =>
      [
        user._id?.toString(),
        user.name,
        user.email,
        user.phone,
        user.role,
        user.ryanEmployeeCode,
        user.isActive,
        user.tlName,
        user.dailyTarget,
        user.createdAt ? new Date(user.createdAt).toISOString() : '',
      ]
        .map(escapeCsv)
        .join(',')
    );

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
    fs.writeFileSync(csvPath, csvContent, 'utf8');
    console.log(`\n✅ CSV file created:\n${csvPath}`);

    console.log('\n🎉 Done.');
  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB disconnected.');
  }
}

// ===============================
// Run
// ===============================
if (require.main === module) {
  if (process.argv.includes('--check-ryan-codes') || process.argv.includes('--audit')) {
    getUsersWithoutRyanEmployeeCode();
  } else {
    seed().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  }
}

module.exports = { seed, getUsersWithoutRyanEmployeeCode };

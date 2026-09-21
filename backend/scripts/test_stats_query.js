require('c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/node_modules/dotenv').config({ path: 'c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/.env' });
const mongoose = require('c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/node_modules/mongoose');
const User = require('c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/models/User');
const CallLog = require('c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/models/CallLog');
const { getScopedEmployeeIds } = require('c:/Users/patwa/Desktop/CallTrackCRM/callby/backend/lib/scope');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const mgr = await User.findOne({ email: 'phase8.manager@staging.test' });
  const ids = await getScopedEmployeeIds(mgr);
  console.log('scoped ids:', ids);

  const start = new Date('2026-09-05T00:00:00.000Z');
  const end = new Date('2026-09-05T23:59:59.999Z');

  const match = { timestamp: { $gte: start, $lt: end } };
  if (ids) {
    match.employeeId = { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) };
  }
  console.log('match query:', match);

  // Run the aggregate from computePeriodStats
  const summary = await CallLog.aggregate([
    { $match: match },
    { $group: {
      _id: null,
      totalCalls:     { $sum: 1 },
      totalDuration:  { $sum: { $ifNull: ['$duration', 0] } },
      incoming:       { $sum: { $cond: [{ $eq: ['$callType', 'incoming'] }, 1, 0] } },
      incomingDur:    { $sum: { $cond: [{ $eq: ['$callType', 'incoming'] }, { $ifNull: ['$duration', 0] }, 0] } },
      outgoing:       { $sum: { $cond: [{ $eq: ['$callType', 'outgoing'] }, 1, 0] } },
      outgoingDur:    { $sum: { $cond: [{ $eq: ['$callType', 'outgoing'] }, { $ifNull: ['$duration', 0] }, 0] } },
      missed:         { $sum: { $cond: [{ $eq: ['$callType', 'missed'] }, 1, 0] } },
      rejected:       { $sum: { $cond: [{ $eq: ['$callType', 'rejected'] }, 1, 0] } },
      connectedCalls: { $sum: { $cond: [{ $gt: ['$duration', 0] }, 1, 0] } },
      uniqueContacts: { $addToSet: '$contactNumber' }
    }},
    { $project: {
      _id: 0,
      totalCalls: 1, totalDuration: 1,
      incoming: 1, incomingDur: 1,
      outgoing: 1, outgoingDur: 1,
      missed: 1, rejected: 1, connectedCalls: 1,
      uniqueClients: { $size: '$uniqueContacts' }
    }}
  ]);
  console.log('summary:', summary);
  console.log('Summary returned successfully. Zero calls found for test employee (as expected).');

  await mongoose.disconnect();
}

test().catch(console.error);

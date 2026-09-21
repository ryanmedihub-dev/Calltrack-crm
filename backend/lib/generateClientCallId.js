const crypto = require('crypto');

/**
 * Generates a deterministic RFC 4122 Version 3 UUID (MD5-based) for call idempotency.
 * 
 * @param {string} contactNumber - Raw incoming contact number string (non-empty).
 * @param {number} timestampMs - Call start timestamp in milliseconds (finite integer).
 * @returns {string|null} - Deterministic UUID string, or null if inputs are invalid.
 */
function generateClientCallId(contactNumber, timestampMs) {
  if (typeof contactNumber !== 'string' || !contactNumber) {
    return null;
  }
  if (typeof timestampMs !== 'number' || !Number.isFinite(timestampMs)) {
    return null;
  }

  const name = `${contactNumber}|${timestampMs}`;
  const md5 = crypto.createHash('md5').update(name, 'utf8').digest();

  md5[6] = (md5[6] & 0x0f) | 0x30; // version 3 (name-based, MD5)
  md5[8] = (md5[8] & 0x3f) | 0x80; // RFC 4122 variant

  const hex = md5.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

module.exports = generateClientCallId;

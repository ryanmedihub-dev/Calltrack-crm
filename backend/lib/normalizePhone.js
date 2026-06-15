// Normalizes Indian phone numbers to a consistent 10-digit format.
// Handles: +91XXXXXXXXXX, 91XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXX
function normalizePhone(num) {
  if (!num || typeof num !== 'string') return num;
  const digits = num.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

module.exports = normalizePhone;

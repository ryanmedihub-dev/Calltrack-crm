const test = require('node:test');
const assert = require('node:assert');
const { list, anyOf, oidsOf } = require('./multi');

test('multi filter parsing', () => {
  assert.deepStrictEqual(list(' a, b ,,c'), ['a', 'b', 'c']);
  assert.strictEqual(anyOf('missed'), 'missed');
  assert.deepStrictEqual(anyOf('missed,incoming'), { $in: ['missed', 'incoming'] });
  assert.strictEqual(oidsOf('nope'), null);
  const id = '64b7f0c2a1b2c3d4e5f60718';
  assert.strictEqual(String(oidsOf(id)), id);
  assert.strictEqual(oidsOf(`${id},${id}`).$in.length, 2);
});

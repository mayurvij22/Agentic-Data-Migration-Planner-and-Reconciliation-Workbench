/**
 * Tests for the Migration Engine
 * Run with: node server/tests/engine.test.js
 */

const assert = require('assert');
const store = require('../store/inMemoryStore');
const { applyTransformation, getSupportedTransformations } = require('../engine/transformations');
const { validateField, validateRecord } = require('../engine/validationEngine');
const { executeMigration } = require('../engine/migrationEngine');
const { rollbackExecution } = require('../engine/rollbackEngine');
const { reconcile } = require('../engine/reconciliationEngine');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

function setup() {
  store.reset();
  store.setSourceSchema({
    name: 'employees',
    fields: [
      { name: 'id', type: 'integer', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'email', type: 'email', required: true },
      { name: 'salary', type: 'number', required: false },
    ]
  });
  store.setTargetSchema({
    name: 'staff',
    fields: [
      { name: 'staff_id', type: 'integer', required: true },
      { name: 'full_name', type: 'string', required: true, maxLength: 100 },
      { name: 'email_address', type: 'email', required: true },
      { name: 'pay', type: 'number', required: false, min: 0 },
    ]
  });
  store.setSourceRecords([
    { id: 1, name: 'Alice', email: 'alice@test.com', salary: 80000 },
    { id: 2, name: 'Bob', email: 'bob@test.com', salary: 90000 },
    { id: 3, name: 'Carol', email: 'invalid', salary: -5000 },
    { id: 4, name: '', email: 'dave@test.com', salary: 75000 },
  ]);
}

// ═══════════ Transformation Tests ═══════════

console.log('\n📦 Transformation Tests');

test('rename passes value through', () => {
  const result = applyTransformation('hello', { type: 'rename' }, {});
  assert.strictEqual(result.value, 'hello');
});

test('typecast string to integer', () => {
  const result = applyTransformation('42', { type: 'typecast', targetType: 'integer' }, {});
  assert.strictEqual(result.value, 42);
});

test('typecast invalid integer throws', () => {
  assert.throws(() => applyTransformation('abc', { type: 'typecast', targetType: 'integer' }, {}));
});

test('typecast to boolean', () => {
  const result = applyTransformation('true', { type: 'typecast', targetType: 'boolean' }, {});
  assert.strictEqual(result.value, true);
});

test('dateformat to YYYY-MM-DD', () => {
  const result = applyTransformation('2024-03-15T10:00:00Z', { type: 'dateformat', outputFormat: 'YYYY-MM-DD' }, {});
  assert.strictEqual(result.value, '2024-03-15');
});

test('dateformat invalid date throws', () => {
  assert.throws(() => applyTransformation('not-a-date', { type: 'dateformat', outputFormat: 'ISO' }, {}));
});

test('concat multiple fields', () => {
  const record = { first: 'John', last: 'Doe' };
  const result = applyTransformation(null, { type: 'concat', sourceFields: ['first', 'last'], separator: ' ' }, record);
  assert.strictEqual(result.value, 'John Doe');
});

test('split by comma', () => {
  const result = applyTransformation('a,b,c', { type: 'split', separator: ',', index: 1 }, {});
  assert.strictEqual(result.value, 'b');
});

test('default fills null values', () => {
  const result = applyTransformation(null, { type: 'default', defaultValue: 'N/A' }, {});
  assert.strictEqual(result.value, 'N/A');
});

test('default preserves existing values', () => {
  const result = applyTransformation('existing', { type: 'default', defaultValue: 'N/A' }, {});
  assert.strictEqual(result.value, 'existing');
});

test('trim whitespace', () => {
  const result = applyTransformation('  hello  ', { type: 'trim' }, {});
  assert.strictEqual(result.value, 'hello');
});

test('uppercase conversion', () => {
  const result = applyTransformation('hello', { type: 'uppercase' }, {});
  assert.strictEqual(result.value, 'HELLO');
});

test('lowercase conversion', () => {
  const result = applyTransformation('HELLO', { type: 'lowercase' }, {});
  assert.strictEqual(result.value, 'hello');
});

test('map_values maps correctly', () => {
  const result = applyTransformation('M', { type: 'map_values', mapping: { M: 'Male', F: 'Female' } }, {});
  assert.strictEqual(result.value, 'Male');
});

test('computed expression', () => {
  const result = applyTransformation(10, { type: 'computed', expression: '$value * 2' }, {});
  assert.strictEqual(result.value, 20);
});

test('getSupportedTransformations returns 11 types', () => {
  const types = getSupportedTransformations();
  assert.strictEqual(types.length, 11);
});

// ═══════════ Validation Tests ═══════════

console.log('\n🔍 Validation Tests');

test('required field fails when empty', () => {
  const errors = validateField('', { name: 'test', type: 'string', required: true });
  assert.strictEqual(errors.length, 1);
  assert.strictEqual(errors[0].constraint, 'required');
});

test('required field passes with value', () => {
  const errors = validateField('hello', { name: 'test', type: 'string', required: true });
  assert.strictEqual(errors.length, 0);
});

test('integer validation catches non-integer', () => {
  const errors = validateField('abc', { name: 'test', type: 'integer', required: false });
  assert.strictEqual(errors.length, 1);
});

test('email validation catches invalid email', () => {
  const errors = validateField('not-email', { name: 'test', type: 'email', required: false });
  assert.strictEqual(errors.length, 1);
});

test('maxLength validation', () => {
  const errors = validateField('toolong', { name: 'test', type: 'string', maxLength: 3 });
  assert.strictEqual(errors.length, 1);
  assert.strictEqual(errors[0].constraint, 'maxLength');
});

test('min value validation', () => {
  const errors = validateField(-5, { name: 'test', type: 'number', min: 0 });
  assert.strictEqual(errors.length, 1);
  assert.strictEqual(errors[0].constraint, 'min');
});

test('enum validation', () => {
  const errors = validateField('unknown', { name: 'test', type: 'string', enum: ['a', 'b'] });
  assert.strictEqual(errors.length, 1);
  assert.strictEqual(errors[0].constraint, 'enum');
});

// ═══════════ Migration Engine Tests ═══════════

console.log('\n🚀 Migration Engine Tests');

test('dry run produces correct counts', () => {
  setup();
  const plan = store.savePlan({
    mappings: [
      { sourceField: 'id', targetField: 'staff_id', transformation: { type: 'rename' }, isPrimaryKey: true },
      { sourceField: 'name', targetField: 'full_name', transformation: { type: 'rename' } },
      { sourceField: 'email', targetField: 'email_address', transformation: { type: 'rename' } },
      { sourceField: 'salary', targetField: 'pay', transformation: { type: 'rename' } },
    ]
  });
  const exec = executeMigration(plan.id, true);
  assert.strictEqual(exec.type, 'dry_run');
  assert.strictEqual(exec.status, 'completed');
  assert.strictEqual(exec.counts.source, 4);
  // Record 3 has invalid email, Record 4 has empty required name, Record 3 has negative salary
  assert.ok(exec.counts.accepted + exec.counts.quarantined === exec.counts.source);
});

test('dry run does not write to target store', () => {
  setup();
  const plan = store.savePlan({ mappings: [
    { sourceField: 'id', targetField: 'staff_id', transformation: { type: 'rename' }, isPrimaryKey: true },
    { sourceField: 'name', targetField: 'full_name', transformation: { type: 'rename' } },
    { sourceField: 'email', targetField: 'email_address', transformation: { type: 'rename' } },
    { sourceField: 'salary', targetField: 'pay', transformation: { type: 'rename' } },
  ]});
  executeMigration(plan.id, true);
  assert.strictEqual(store.targetRecords.length, 0);
});

test('execution requires approved plan', () => {
  setup();
  const plan = store.savePlan({ mappings: [
    { sourceField: 'id', targetField: 'staff_id', transformation: { type: 'rename' } },
  ]});
  assert.throws(() => executeMigration(plan.id, false), /approved/i);
});

test('execution writes to target store after approval', () => {
  setup();
  const plan = store.savePlan({ mappings: [
    { sourceField: 'id', targetField: 'staff_id', transformation: { type: 'rename' }, isPrimaryKey: true },
    { sourceField: 'name', targetField: 'full_name', transformation: { type: 'rename' } },
    { sourceField: 'email', targetField: 'email_address', transformation: { type: 'rename' } },
    { sourceField: 'salary', targetField: 'pay', transformation: { type: 'rename' } },
  ]});
  store.approvePlan(plan.id);
  const exec = executeMigration(plan.id, false);
  assert.strictEqual(exec.type, 'execute');
  assert.ok(store.targetRecords.length > 0);
  assert.strictEqual(store.targetRecords.length, exec.counts.accepted);
});

test('duplicate records are skipped on retry', () => {
  setup();
  const plan = store.savePlan({ mappings: [
    { sourceField: 'id', targetField: 'staff_id', transformation: { type: 'rename' }, isPrimaryKey: true },
    { sourceField: 'name', targetField: 'full_name', transformation: { type: 'rename' } },
    { sourceField: 'email', targetField: 'email_address', transformation: { type: 'rename' } },
    { sourceField: 'salary', targetField: 'pay', transformation: { type: 'rename' } },
  ]});
  store.approvePlan(plan.id);
  const exec1 = executeMigration(plan.id, false);
  const firstAccepted = exec1.counts.accepted;
  const exec2 = executeMigration(plan.id, false);
  assert.strictEqual(exec2.counts.duplicatesSkipped, firstAccepted);
  assert.strictEqual(exec2.counts.accepted, 0);
});

// ═══════════ Plan Versioning Tests ═══════════

console.log('\n📋 Plan Versioning Tests');

test('plan version increments on update', () => {
  setup();
  const plan1 = store.savePlan({ mappings: [{ sourceField: 'id', targetField: 'staff_id', transformation: { type: 'rename' } }] });
  assert.strictEqual(plan1.version, 1);
  const plan2 = store.savePlan({ ...plan1, mappings: [{ sourceField: 'name', targetField: 'full_name', transformation: { type: 'rename' } }] });
  assert.strictEqual(plan2.version, 2);
  assert.strictEqual(plan2.status, 'draft');
});

test('plan approval sets status to approved', () => {
  setup();
  const plan = store.savePlan({ mappings: [{ sourceField: 'id', targetField: 'staff_id', transformation: { type: 'rename' } }] });
  store.approvePlan(plan.id);
  const approved = store.migrationPlans.find(p => p.id === plan.id);
  assert.strictEqual(approved.status, 'approved');
  assert.ok(approved.approvedAt);
});

// ═══════════ Rollback Tests ═══════════

console.log('\n⏪ Rollback Tests');

test('rollback removes target records', () => {
  setup();
  const plan = store.savePlan({ mappings: [
    { sourceField: 'id', targetField: 'staff_id', transformation: { type: 'rename' }, isPrimaryKey: true },
    { sourceField: 'name', targetField: 'full_name', transformation: { type: 'rename' } },
    { sourceField: 'email', targetField: 'email_address', transformation: { type: 'rename' } },
    { sourceField: 'salary', targetField: 'pay', transformation: { type: 'rename' } },
  ]});
  store.approvePlan(plan.id);
  const exec = executeMigration(plan.id, false);
  const beforeRollback = store.targetRecords.length;
  assert.ok(beforeRollback > 0);
  rollbackExecution(exec.id);
  assert.strictEqual(store.targetRecords.length, 0);
});

test('rollback sets execution status to rolled_back', () => {
  setup();
  const plan = store.savePlan({ mappings: [
    { sourceField: 'id', targetField: 'staff_id', transformation: { type: 'rename' }, isPrimaryKey: true },
    { sourceField: 'name', targetField: 'full_name', transformation: { type: 'rename' } },
    { sourceField: 'email', targetField: 'email_address', transformation: { type: 'rename' } },
    { sourceField: 'salary', targetField: 'pay', transformation: { type: 'rename' } },
  ]});
  store.approvePlan(plan.id);
  const exec = executeMigration(plan.id, false);
  rollbackExecution(exec.id);
  const updated = store.migrationExecutions.find(e => e.id === exec.id);
  assert.strictEqual(updated.status, 'rolled_back');
});

test('cannot rollback a dry run', () => {
  setup();
  const plan = store.savePlan({ mappings: [
    { sourceField: 'id', targetField: 'staff_id', transformation: { type: 'rename' } },
  ]});
  const exec = executeMigration(plan.id, true);
  assert.throws(() => rollbackExecution(exec.id), /dry run/i);
});

// ═══════════ Reconciliation Tests ═══════════

console.log('\n📊 Reconciliation Tests');

test('reconciliation report is balanced after successful migration', () => {
  setup();
  const plan = store.savePlan({ mappings: [
    { sourceField: 'id', targetField: 'staff_id', transformation: { type: 'rename' }, isPrimaryKey: true },
    { sourceField: 'name', targetField: 'full_name', transformation: { type: 'rename' } },
    { sourceField: 'email', targetField: 'email_address', transformation: { type: 'rename' } },
    { sourceField: 'salary', targetField: 'pay', transformation: { type: 'rename' } },
  ]});
  store.approvePlan(plan.id);
  const exec = executeMigration(plan.id, false);
  const report = reconcile(exec.id);
  assert.strictEqual(report.isBalanced, true);
  assert.strictEqual(report.counts.source, 4);
});

// ═══════════ Audit Log Tests ═══════════

console.log('\n📝 Audit Log Tests');

test('audit log records schema changes', () => {
  setup();
  const schemaEntries = store.auditLog.filter(e => e.action === 'SCHEMA_SET');
  assert.ok(schemaEntries.length >= 2);
});

test('audit log records plan operations', () => {
  setup();
  store.savePlan({ mappings: [{ sourceField: 'id', targetField: 'staff_id', transformation: { type: 'rename' } }] });
  const planEntries = store.auditLog.filter(e => e.action === 'PLAN_SAVED');
  assert.ok(planEntries.length > 0);
});

// ═══════════ Summary ═══════════

console.log('\n═══════════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('═══════════════════════════════════════');

if (failed > 0) {
  process.exit(1);
}

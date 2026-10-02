const crypto = require('crypto');

/**
 * In-memory data store — singleton pattern.
 * Holds all application state: schemas, records, plans, executions, audit log.
 * Data resets on server restart (intentional for demo/hackathon scope).
 */
class InMemoryStore {
  constructor() {
    this.maxSampleSize = 500;
    this.reset();
  }

  reset() {
    this.sourceSchema = null;
    this.targetSchema = null;
    this.sourceRecords = [];
    this.targetRecords = [];
    this.quarantinedRecords = [];
    this.migrationPlans = [];
    this.migrationExecutions = [];
    this.auditLog = [];
    this.rollbackSnapshots = {};
  }

  // ──────────── Schema Management ────────────

  setSourceSchema(schema) {
    this.sourceSchema = { ...schema, setAt: new Date().toISOString() };
    this.addAuditEntry('SCHEMA_SET', 'Source schema configured', { schemaName: schema.name, fieldCount: schema.fields.length });
    return this.sourceSchema;
  }

  setTargetSchema(schema) {
    this.targetSchema = { ...schema, setAt: new Date().toISOString() };
    this.addAuditEntry('SCHEMA_SET', 'Target schema configured', { schemaName: schema.name, fieldCount: schema.fields.length });
    return this.targetSchema;
  }

  // ──────────── Source Records ────────────

  setSourceRecords(records) {
    if (records.length > this.maxSampleSize) {
      throw new Error(`Exceeds maximum sample size of ${this.maxSampleSize} records. Got ${records.length}.`);
    }
    this.sourceRecords = records;
    this.addAuditEntry('RECORDS_LOADED', `Loaded ${records.length} source records`, { count: records.length });
    return { count: records.length };
  }

  // ──────────── Migration Plans (Versioned) ────────────

  savePlan(plan) {
    const existingIndex = this.migrationPlans.findIndex(p => p.id === plan.id);
    if (existingIndex >= 0) {
      const existing = this.migrationPlans[existingIndex];
      plan.version = (existing.version || 1) + 1;
      plan.status = 'draft';
      plan.updatedAt = new Date().toISOString();
      plan.createdAt = existing.createdAt;
      this.migrationPlans[existingIndex] = plan;
    } else {
      plan.id = plan.id || `plan_${crypto.randomUUID().slice(0, 8)}`;
      plan.version = 1;
      plan.status = 'draft';
      plan.createdAt = new Date().toISOString();
      this.migrationPlans.push(plan);
    }
    this.addAuditEntry('PLAN_SAVED', `Plan ${plan.id} v${plan.version} saved`, { planId: plan.id, version: plan.version });
    return plan;
  }

  approvePlan(planId) {
    const plan = this.migrationPlans.find(p => p.id === planId);
    if (!plan) throw new Error('Plan not found');
    if (plan.status === 'approved') throw new Error('Plan already approved');
    plan.status = 'approved';
    plan.approvedAt = new Date().toISOString();
    this.addAuditEntry('PLAN_APPROVED', `Plan ${planId} v${plan.version} approved`, { planId, version: plan.version });
    return plan;
  }

  // ──────────── Target Records ────────────

  addTargetRecords(records, executionId) {
    const tagged = records.map(r => ({ ...r, _executionId: executionId, _insertedAt: new Date().toISOString() }));
    this.targetRecords.push(...tagged);
  }

  removeTargetRecordsByExecution(executionId) {
    const before = this.targetRecords.length;
    this.targetRecords = this.targetRecords.filter(r => r._executionId !== executionId);
    return before - this.targetRecords.length;
  }

  // ──────────── Quarantine ────────────

  addQuarantinedRecords(records) {
    this.quarantinedRecords.push(...records);
  }

  // ──────────── Executions ────────────

  addExecution(execution) {
    this.migrationExecutions.push(execution);
    return execution;
  }

  updateExecution(executionId, updates) {
    const idx = this.migrationExecutions.findIndex(e => e.id === executionId);
    if (idx >= 0) {
      Object.assign(this.migrationExecutions[idx], updates);
      return this.migrationExecutions[idx];
    }
    return null;
  }

  // ──────────── Rollback Snapshots ────────────

  saveRollbackSnapshot(executionId) {
    this.rollbackSnapshots[executionId] = {
      targetRecordCount: this.targetRecords.length,
      savedAt: new Date().toISOString()
    };
  }

  // ──────────── Duplicate Detection ────────────

  isDuplicate(record, mappings) {
    const keyMapping = mappings.find(m => m.isPrimaryKey) || mappings[0];
    if (!keyMapping) return false;
    const targetField = keyMapping.targetField;
    const value = record[targetField];
    return this.targetRecords.some(r => r[targetField] === value);
  }

  // ──────────── Audit Log ────────────

  addAuditEntry(action, description, metadata = {}) {
    this.auditLog.push({
      id: `audit_${crypto.randomUUID().slice(0, 8)}`,
      action,
      description,
      metadata,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new InMemoryStore();

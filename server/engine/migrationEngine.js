/**
 * Migration Engine
 * Core logic for transforming records, running dry runs, and executing migrations.
 * Handles quarantine, duplicate detection, and field-level error tracking.
 */

const crypto = require('crypto');
const store = require('../store/inMemoryStore');
const { applyTransformation } = require('./transformations');
const { validateRecord } = require('./validationEngine');

/**
 * Transform a single source record according to the mapping plan.
 */
function transformRecord(sourceRecord, mappings, sourceIndex) {
  const targetRecord = {};
  const transformationLog = [];
  const fieldErrors = [];

  for (const mapping of mappings) {
    try {
      let value;

      if (mapping.transformation?.type === 'concat' && mapping.transformation.sourceFields) {
        // Concat: combine multiple source fields
        const result = applyTransformation(null, mapping.transformation, sourceRecord);
        value = result.value;
        transformationLog.push({
          targetField: mapping.targetField,
          transformation: result.applied,
          sourceFields: mapping.transformation.sourceFields,
          resultValue: value
        });
      } else {
        // Get source value
        value = sourceRecord[mapping.sourceField];

        // Apply transformation if specified (and not just a rename)
        if (mapping.transformation && mapping.transformation.type && mapping.transformation.type !== 'rename') {
          const result = applyTransformation(value, mapping.transformation, sourceRecord);
          value = result.value;
          transformationLog.push({
            sourceField: mapping.sourceField,
            targetField: mapping.targetField,
            originalValue: sourceRecord[mapping.sourceField],
            transformation: result.applied,
            resultValue: value
          });
        } else {
          transformationLog.push({
            sourceField: mapping.sourceField,
            targetField: mapping.targetField,
            originalValue: value,
            transformation: mapping.sourceField !== mapping.targetField ? 'rename' : 'direct copy',
            resultValue: value
          });
        }
      }

      targetRecord[mapping.targetField] = value;
    } catch (error) {
      fieldErrors.push({
        recordIndex: sourceIndex,
        sourceField: mapping.sourceField,
        targetField: mapping.targetField,
        error: error.message,
        value: sourceRecord[mapping.sourceField]
      });
    }
  }

  return { targetRecord, transformationLog, fieldErrors };
}

/**
 * Execute a migration plan (dry run or real execution).
 * @param {string} planId - The plan ID to execute
 * @param {boolean} isDryRun - If true, no data is written to the target store
 * @returns {object} Execution result with counts, errors, and records
 */
function executeMigration(planId, isDryRun = true) {
  const plan = store.migrationPlans.find(p => p.id === planId);
  if (!plan) throw new Error('Migration plan not found');

  if (!isDryRun && plan.status !== 'approved') {
    throw new Error(`Plan must be approved before execution. Current status: "${plan.status}"`);
  }

  if (!store.sourceRecords.length) {
    throw new Error('No source records loaded');
  }

  if (!store.targetSchema) {
    throw new Error('Target schema not configured');
  }

  const executionId = `exec_${crypto.randomUUID().slice(0, 8)}`;
  const execution = {
    id: executionId,
    planId: plan.id,
    planVersion: plan.version,
    type: isDryRun ? 'dry_run' : 'execute',
    status: 'running',
    counts: {
      source: store.sourceRecords.length,
      transformed: 0,
      accepted: 0,
      rejected: 0,
      quarantined: 0,
      duplicatesSkipped: 0
    },
    acceptedRecords: [],
    rejectedRecords: [],
    quarantinedRecords: [],
    transformationLogs: [],
    fieldErrors: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
    rolledBackAt: null
  };

  store.addExecution(execution);

  if (!isDryRun) {
    store.markRollbackable(executionId);
  }

  const mappings = plan.mappings;

  for (let i = 0; i < store.sourceRecords.length; i++) {
    const sourceRecord = store.sourceRecords[i];

    // Step 1: Transform
    const { targetRecord, transformationLog, fieldErrors } = transformRecord(sourceRecord, mappings, i);
    execution.transformationLogs.push({ recordIndex: i, log: transformationLog });

    // Step 2: Check transformation errors → quarantine
    if (fieldErrors.length > 0) {
      execution.fieldErrors.push(...fieldErrors);
      execution.counts.rejected++;
      execution.counts.quarantined++;
      const qRecord = {
        recordIndex: i,
        sourceRecord,
        errors: fieldErrors,
        reason: 'transformation_error'
      };
      execution.quarantinedRecords.push(qRecord);
      if (!isDryRun) {
        store.addQuarantinedRecords([{
          ...qRecord,
          executionId,
          quarantinedAt: new Date().toISOString()
        }]);
      }
      continue;
    }

    execution.counts.transformed++;

    // Step 3: Validate against target schema
    const validationErrors = validateRecord(targetRecord, store.targetSchema);

    if (validationErrors.length > 0) {
      // Validation errors → reject + quarantine
      execution.counts.rejected++;
      execution.counts.quarantined++;

      const rejRecord = { recordIndex: i, sourceRecord, targetRecord, errors: validationErrors };
      execution.rejectedRecords.push(rejRecord);
      execution.quarantinedRecords.push({ ...rejRecord, reason: 'validation_error' });
      execution.fieldErrors.push(...validationErrors.map(e => ({ ...e, recordIndex: i })));

      if (!isDryRun) {
        store.addQuarantinedRecords([{
          ...rejRecord,
          executionId,
          reason: 'validation_error',
          quarantinedAt: new Date().toISOString()
        }]);
      }
    } else {
      // Step 4: Duplicate check (only for real execution)
      if (!isDryRun && store.isDuplicate(targetRecord, mappings)) {
        execution.counts.duplicatesSkipped++;
        continue;
      }

      // Accept the record
      execution.counts.accepted++;
      execution.acceptedRecords.push({ recordIndex: i, targetRecord });

      if (!isDryRun) {
        store.addTargetRecords([targetRecord], executionId);
      }
    }
  }

  // Finalize
  execution.status = 'completed';
  execution.completedAt = new Date().toISOString();
  store.updateExecution(executionId, execution);

  store.addAuditEntry(
    isDryRun ? 'DRY_RUN_COMPLETED' : 'MIGRATION_EXECUTED',
    `${isDryRun ? 'Dry run' : 'Migration'} completed: ${execution.counts.accepted} accepted, ${execution.counts.rejected} rejected, ${execution.counts.quarantined} quarantined, ${execution.counts.duplicatesSkipped} duplicates skipped`,
    { executionId, planId, counts: execution.counts }
  );

  return execution;
}

module.exports = { executeMigration, transformRecord };

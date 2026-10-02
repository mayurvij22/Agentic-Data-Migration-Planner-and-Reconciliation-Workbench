/**
 * Reconciliation Engine
 * Compares source and target record counts, summarizes field errors,
 * and provides side-by-side comparison data.
 */

const store = require('../store/inMemoryStore');

/**
 * Generate a reconciliation report for a given execution.
 */
function reconcile(executionId) {
  const execution = store.migrationExecutions.find(e => e.id === executionId);
  if (!execution) throw new Error('Execution not found');

  const sourceCount = store.sourceRecords.length;
  const targetCount = store.targetRecords.filter(r => r._executionId === executionId).length;
  const quarantinedCount = store.quarantinedRecords.filter(r => r.executionId === executionId).length;
  const dupsSkipped = execution.counts.duplicatesSkipped || 0;

  // For dry runs, use execution counts directly
  const effectiveTarget = execution.type === 'dry_run' ? execution.counts.accepted : targetCount;
  const effectiveQuarantine = execution.type === 'dry_run' ? execution.counts.quarantined : quarantinedCount;

  const report = {
    executionId,
    planId: execution.planId,
    planVersion: execution.planVersion,
    executionType: execution.type,
    status: execution.status,
    counts: {
      source: sourceCount,
      target: effectiveTarget,
      quarantined: effectiveQuarantine,
      duplicatesSkipped: dupsSkipped,
      difference: sourceCount - effectiveTarget - effectiveQuarantine - dupsSkipped
    },
    isBalanced: sourceCount === effectiveTarget + effectiveQuarantine + dupsSkipped,
    executionCounts: execution.counts,
    fieldErrorSummary: summarizeFieldErrors(execution.fieldErrors || []),
    startedAt: execution.startedAt,
    completedAt: execution.completedAt,
    generatedAt: new Date().toISOString()
  };

  store.addAuditEntry('RECONCILIATION_RUN', `Reconciliation for execution ${executionId}`, {
    isBalanced: report.isBalanced,
    counts: report.counts
  });

  return report;
}

/**
 * Summarize field errors by field+constraint combination.
 */
function summarizeFieldErrors(fieldErrors) {
  const summary = {};
  for (const error of fieldErrors) {
    const fieldName = error.field || error.targetField || error.sourceField || 'unknown';
    const constraint = error.constraint || 'error';
    const key = `${fieldName}:${constraint}`;

    if (!summary[key]) {
      summary[key] = {
        field: fieldName,
        constraint,
        error: error.error,
        count: 0,
        sampleValues: []
      };
    }
    summary[key].count++;
    if (summary[key].sampleValues.length < 3) {
      summary[key].sampleValues.push(error.value);
    }
  }
  return Object.values(summary);
}

/**
 * Get side-by-side comparison of source, target, and quarantined records.
 */
function compareRecords(executionId) {
  const execution = store.migrationExecutions.find(e => e.id === executionId);
  if (!execution) throw new Error('Execution not found');

  const targetRecords = execution.type === 'dry_run'
    ? execution.acceptedRecords.map(r => r.targetRecord)
    : store.targetRecords.filter(r => r._executionId === executionId);

  const quarantinedRecords = execution.type === 'dry_run'
    ? execution.quarantinedRecords
    : store.quarantinedRecords.filter(r => r.executionId === executionId);

  return {
    sourceRecords: store.sourceRecords.slice(0, 50),
    targetRecords: targetRecords.slice(0, 50),
    quarantinedRecords: quarantinedRecords.slice(0, 50),
    totalSource: store.sourceRecords.length,
    totalTarget: targetRecords.length,
    totalQuarantined: quarantinedRecords.length
  };
}

module.exports = { reconcile, compareRecords };

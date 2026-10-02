/**
 * Rollback Engine
 * Undoes a migration execution by removing inserted target records
 * and cleaning up quarantined records for that execution.
 */

const store = require('../store/inMemoryStore');

/**
 * Rollback a specific execution.
 * @param {string} executionId
 * @returns {{ executionId, status, rolledBackAt, recordsRemoved }}
 */
function rollbackExecution(executionId) {
  const execution = store.migrationExecutions.find(e => e.id === executionId);
  if (!execution) throw new Error('Execution not found');
  if (execution.type === 'dry_run') throw new Error('Cannot rollback a dry run — no data was written');
  if (execution.status === 'rolled_back') throw new Error('Execution already rolled back');

  if (!store.isRollbackable(executionId)) {
    throw new Error('Execution is not eligible for rollback');
  }

  // Remove target records inserted by this execution
  const removedCount = store.removeTargetRecordsByExecution(executionId);

  // Remove quarantined records from this execution
  const qBefore = store.quarantinedRecords.length;
  store.quarantinedRecords = store.quarantinedRecords.filter(r => r.executionId !== executionId);
  const qRemoved = qBefore - store.quarantinedRecords.length;

  // Update execution status
  execution.status = 'rolled_back';
  execution.rolledBackAt = new Date().toISOString();
  store.updateExecution(executionId, execution);

  store.clearRollbackable(executionId);

  store.addAuditEntry('MIGRATION_ROLLED_BACK', `Execution ${executionId} rolled back: ${removedCount} target records removed, ${qRemoved} quarantine records cleared`, {
    executionId,
    planId: execution.planId,
    recordsRemoved: removedCount,
    quarantineCleared: qRemoved,
    rolledBackAt: execution.rolledBackAt
  });

  return {
    executionId,
    status: 'rolled_back',
    rolledBackAt: execution.rolledBackAt,
    recordsRemoved: removedCount,
    quarantineCleared: qRemoved
  };
}

module.exports = { rollbackExecution };

/**
 * Validation Engine
 * Validates transformed records against target schema field definitions.
 * Returns field-level error evidence for quarantine.
 */

/**
 * Validate a single field value against its schema definition.
 * @param {*} value - The value to validate
 * @param {object} fieldDef - { name, type, required, maxLength, minLength, min, max, enum, pattern }
 * @returns {Array<{ field, constraint, error, value }>}
 */
function validateField(value, fieldDef) {
  const errors = [];

  // Required check
  if (fieldDef.required && (value === null || value === undefined || value === '')) {
    errors.push({
      field: fieldDef.name,
      constraint: 'required',
      error: `Required field "${fieldDef.name}" is missing or empty`,
      value
    });
    return errors;
  }

  // Skip further validation for null/undefined optional fields
  if (value === null || value === undefined || value === '') {
    return errors;
  }

  // Type validation
  switch (fieldDef.type) {
    case 'integer':
      if (!Number.isInteger(Number(value)) || isNaN(Number(value))) {
        errors.push({ field: fieldDef.name, constraint: 'type', error: `Expected integer, got "${value}"`, value });
      }
      break;
    case 'float':
    case 'number':
      if (isNaN(Number(value))) {
        errors.push({ field: fieldDef.name, constraint: 'type', error: `Expected number, got "${value}"`, value });
      }
      break;
    case 'string':
      // Accept any value coercible to string
      break;
    case 'boolean':
      if (typeof value !== 'boolean' && !['true', 'false', '0', '1'].includes(String(value).toLowerCase())) {
        errors.push({ field: fieldDef.name, constraint: 'type', error: `Expected boolean, got "${value}"`, value });
      }
      break;
    case 'date':
      if (isNaN(new Date(value).getTime())) {
        errors.push({ field: fieldDef.name, constraint: 'type', error: `Invalid date: "${value}"`, value });
      }
      break;
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
        errors.push({ field: fieldDef.name, constraint: 'type', error: `Invalid email: "${value}"`, value });
      }
      break;
  }

  // MaxLength
  if (fieldDef.maxLength && String(value).length > fieldDef.maxLength) {
    errors.push({
      field: fieldDef.name,
      constraint: 'maxLength',
      error: `Value exceeds max length ${fieldDef.maxLength} (got ${String(value).length})`,
      value
    });
  }

  // MinLength
  if (fieldDef.minLength && String(value).length < fieldDef.minLength) {
    errors.push({
      field: fieldDef.name,
      constraint: 'minLength',
      error: `Value below min length ${fieldDef.minLength} (got ${String(value).length})`,
      value
    });
  }

  // Min value
  if (fieldDef.min !== undefined && Number(value) < fieldDef.min) {
    errors.push({
      field: fieldDef.name,
      constraint: 'min',
      error: `Value ${value} is below minimum ${fieldDef.min}`,
      value
    });
  }

  // Max value
  if (fieldDef.max !== undefined && Number(value) > fieldDef.max) {
    errors.push({
      field: fieldDef.name,
      constraint: 'max',
      error: `Value ${value} exceeds maximum ${fieldDef.max}`,
      value
    });
  }

  // Enum
  if (fieldDef.enum && Array.isArray(fieldDef.enum) && !fieldDef.enum.includes(value)) {
    errors.push({
      field: fieldDef.name,
      constraint: 'enum',
      error: `Value "${value}" not in allowed values: [${fieldDef.enum.join(', ')}]`,
      value
    });
  }

  // Pattern (regex)
  if (fieldDef.pattern) {
    try {
      if (!new RegExp(fieldDef.pattern).test(String(value))) {
        errors.push({
          field: fieldDef.name,
          constraint: 'pattern',
          error: `Value "${value}" doesn't match pattern /${fieldDef.pattern}/`,
          value
        });
      }
    } catch (_) {
      // Invalid regex in schema definition — skip
    }
  }

  return errors;
}

/**
 * Validate an entire record against the target schema.
 * @param {object} record - The transformed target record
 * @param {object} targetSchema - { fields: [{ name, type, required, ... }] }
 * @returns {Array<{ field, constraint, error, value }>}
 */
function validateRecord(record, targetSchema) {
  const allErrors = [];

  for (const field of targetSchema.fields) {
    const value = record[field.name];
    const fieldErrors = validateField(value, field);
    allErrors.push(...fieldErrors);
  }

  return allErrors;
}

module.exports = { validateField, validateRecord };

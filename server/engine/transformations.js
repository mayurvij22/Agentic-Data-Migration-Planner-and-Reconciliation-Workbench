/**
 * Supported Transformation Rules
 * Each transformation takes a value (and optional config) and returns { value, applied }.
 * Throws on failure so the caller can quarantine the record.
 */

const transformations = {
  rename: (value, _config) => {
    return { value, applied: 'rename (field-level)' };
  },

  typecast: (value, config) => {
    const { targetType } = config;
    let result;
    switch (targetType) {
      case 'integer':
        result = parseInt(value, 10);
        if (isNaN(result)) throw new Error(`Cannot cast "${value}" to integer`);
        break;
      case 'float':
      case 'number':
        result = parseFloat(value);
        if (isNaN(result)) throw new Error(`Cannot cast "${value}" to number`);
        break;
      case 'string':
        result = String(value ?? '');
        break;
      case 'boolean':
        if (typeof value === 'boolean') result = value;
        else result = value === 'true' || value === '1' || value === 1;
        break;
      default:
        throw new Error(`Unsupported target type: ${targetType}`);
    }
    return { value: result, applied: `typecast → ${targetType}` };
  },

  dateformat: (value, config) => {
    const { outputFormat } = config;
    const date = new Date(value);
    if (isNaN(date.getTime())) throw new Error(`Invalid date: "${value}"`);

    let result;
    switch (outputFormat) {
      case 'ISO':
        result = date.toISOString();
        break;
      case 'YYYY-MM-DD':
        result = date.toISOString().split('T')[0];
        break;
      case 'MM/DD/YYYY':
        result = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
        break;
      case 'DD-MM-YYYY':
        result = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
        break;
      default:
        result = date.toISOString();
    }
    return { value: result, applied: `dateformat → ${outputFormat}` };
  },

  concat: (values, config) => {
    const separator = config.separator ?? ' ';
    if (!Array.isArray(values)) throw new Error('Concat requires an array of values');
    return { value: values.filter(v => v != null).join(separator), applied: `concat with "${separator}"` };
  },

  split: (value, config) => {
    const { separator = ',', index } = config;
    const parts = String(value).split(separator);
    const result = index !== undefined ? (parts[index] || '').trim() : parts.map(p => p.trim());
    return { value: result, applied: `split by "${separator}"${index !== undefined ? ` [${index}]` : ''}` };
  },

  default: (value, config) => {
    const isEmpty = value === null || value === undefined || value === '';
    const result = isEmpty ? config.defaultValue : value;
    return { value: result, applied: isEmpty ? `default → "${config.defaultValue}"` : 'no default needed' };
  },

  trim: (value, _config) => {
    const result = typeof value === 'string' ? value.trim() : value;
    return { value: result, applied: 'trim' };
  },

  uppercase: (value, _config) => {
    const result = typeof value === 'string' ? value.toUpperCase() : value;
    return { value: result, applied: 'uppercase' };
  },

  lowercase: (value, _config) => {
    const result = typeof value === 'string' ? value.toLowerCase() : value;
    return { value: result, applied: 'lowercase' };
  },

  map_values: (value, config) => {
    const { mapping, defaultValue } = config;
    const result = mapping && mapping[value] !== undefined
      ? mapping[value]
      : (defaultValue !== undefined ? defaultValue : value);
    return { value: result, applied: `map_values: "${value}" → "${result}"` };
  },

  computed: (value, config) => {
    const { expression } = config;
    let expr = String(expression).replace(/\$value/g, String(value));
    try {
      // Only allow numbers and basic math operators for safety
      if (!/^[\d\s+\-*/().]+$/.test(expr)) {
        throw new Error('Expression contains unsupported characters');
      }
      const result = Function('"use strict"; return (' + expr + ')')();
      return { value: result, applied: `computed: ${expression}` };
    } catch (e) {
      throw new Error(`Failed to evaluate expression "${expression}": ${e.message}`);
    }
  }
};

/**
 * Apply a single transformation to a value.
 * @param {*} value - The input value
 * @param {object} transformation - { type, ...config }
 * @param {object} sourceRecord - Full source record (needed for concat)
 * @returns {{ value: *, applied: string }}
 */
function applyTransformation(value, transformation, sourceRecord) {
  const { type, ...config } = transformation;

  if (!transformations[type]) {
    throw new Error(`Unknown transformation type: "${type}"`);
  }

  // Special handling for concat — needs multiple source values
  if (type === 'concat' && config.sourceFields) {
    const values = config.sourceFields.map(f => sourceRecord[f]);
    return transformations.concat(values, config);
  }

  return transformations[type](value, config);
}

/**
 * Return metadata for all supported transformation types.
 */
function getSupportedTransformations() {
  return [
    { type: 'rename', description: 'Rename a field (maps source → target)', config: {} },
    { type: 'typecast', description: 'Convert data types (string, integer, float, boolean)', config: { targetType: 'string|integer|float|boolean' } },
    { type: 'dateformat', description: 'Reformat date strings', config: { outputFormat: 'ISO|YYYY-MM-DD|MM/DD/YYYY|DD-MM-YYYY' } },
    { type: 'concat', description: 'Merge multiple source fields into one', config: { sourceFields: [], separator: ' ' } },
    { type: 'split', description: 'Split a field into parts by separator', config: { separator: ',', index: 0 } },
    { type: 'default', description: 'Apply a default value for null/empty fields', config: { defaultValue: '' } },
    { type: 'trim', description: 'Trim leading/trailing whitespace', config: {} },
    { type: 'uppercase', description: 'Convert string to uppercase', config: {} },
    { type: 'lowercase', description: 'Convert string to lowercase', config: {} },
    { type: 'map_values', description: 'Map specific values to new values', config: { mapping: {}, defaultValue: null } },
    { type: 'computed', description: 'Simple math expression using $value', config: { expression: '$value * 1' } }
  ];
}

module.exports = { applyTransformation, getSupportedTransformations, transformations };

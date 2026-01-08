import { DmmfField, PrismaContext } from "./types";

const RSQL_WILDCARD = '*';
const ORM_WILDCARD = '';

export const isLike = (value: string): boolean => value.startsWith(RSQL_WILDCARD) && value.endsWith(RSQL_WILDCARD);
export const isStartsWith = (value: string): boolean => !value.startsWith(RSQL_WILDCARD) && value.endsWith(RSQL_WILDCARD);
export const isEndsWith = (value: string): boolean => value.startsWith(RSQL_WILDCARD) && !value.endsWith(RSQL_WILDCARD);

export const convertWildcards = (val: string): string => {
  let convertedValue = val;
  if (convertedValue.startsWith(RSQL_WILDCARD)) {
    convertedValue = `${ORM_WILDCARD}${convertedValue.slice(1)}`;
  }
  if (convertedValue.endsWith(RSQL_WILDCARD)) {
    convertedValue = `${convertedValue.slice(0, -1)}${ORM_WILDCARD}`;
  }
  return convertedValue;
};

const RELATION_QUANTIFIERS = new Set(['some', 'none', 'every']);

const parseSelector = (selector: string) => {
  const parts = selector.split('.');

  const quantifierIndex = parts.findIndex(p =>
    RELATION_QUANTIFIERS.has(p)
  );

  if (quantifierIndex !== -1) {
    return {
      relationPath: parts.slice(0, quantifierIndex),
      quantifier: parts[quantifierIndex],
      field: parts.slice(quantifierIndex + 1).join('.'),
    };
  }

  return {
    relationPath: parts.slice(0, -1),
    quantifier: null,
    field: parts.at(-1)!,
  };
}

export const getFieldFromDmmf = (selector: string, context: PrismaContext): DmmfField | null => {
  const { relationPath, field } = parseSelector(selector);

  let model = context.dmmf.datamodel.models.find(
    m => m.name === context.model
  );

  for (const relation of relationPath) {
    if (!model) {
      throw new Error(`Model ${context.model} not found`);
    }
    
    const relField = model.fields.find(f => f.name === relation);
    if (!relField || relField.kind !== 'object') return null;

    model = context.dmmf.datamodel.models.find(
      m => m.name === relField.type
    );
  }

  return model?.fields.find(f => f.name === field) ?? null;
};

export const coerceByField = (rawValue: string, field?: DmmfField): any => {
  if (!field) {
    return coerceGuessing(rawValue);
  }

  if (field.isList) {
    return rawValue
      .split(',')
      .map(v => coerceByField(v.trim(), { ...field, isList: false }));
  }

  switch (field.kind) {
    case 'enum':
      return coerceEnum(rawValue, field);

    case 'scalar':
      return coerceScalar(rawValue, field.type);
    
    case 'object':
      throw new Error(`Cannot coerce value for relation/object field "${field.type}" directly`);

    default:
      return coerceGuessing(rawValue);
  }
};

const coerceEnum = (value: string, field: DmmfField) => {
  if (!field.enumValues) {
    return value;
  }

  const allowed = field.enumValues.map(e => e.name);
  if (!allowed.includes(value)) {
    throw new Error(
      `Invalid enum value "${value}". Allowed: ${allowed.join(', ')}`
    );
  }

  return value;
};

const coerceScalar = (value: string, type: string) => {
  switch (type) {
    case 'Int': {
      const n = Number.parseInt(value, 10);
      if (Number.isNaN(n)) {
        throw new Error(`Invalid Int value: ${value}`);
      }
      return n;
    }

    case 'BigInt':
      try {
        return BigInt(value);
      } catch {
        throw new Error(`Invalid BigInt value: ${value}`);
      }

    case 'Float':
    case 'Decimal': {
      const n = Number.parseFloat(value);
      if (Number.isNaN(n)) {
        throw new Error(`Invalid ${type} value: ${value}`);
      }
      return n;
    }

    case 'Boolean':
      if (value === 'true' || value === '1') return true;
      if (value === 'false' || value === '0') return false;
      throw new Error(`Invalid Boolean value: ${value}`);

    case 'DateTime': {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) {
        throw new Error(`Invalid DateTime value: ${value}`);
      }
      return d;
    }

    case 'Json':
      try {
        return JSON.parse(value);
      } catch {
        throw new Error(`Invalid JSON value: ${value}`);
      }

    case 'String':
    default:
      return value;
  }
};


const coerceGuessing = (value: string): string | number | boolean | Date => {
  
  const trimmed = value.trim();

  if (trimmed.toLowerCase() === 'true') return true;
  if (trimmed.toLowerCase() === 'false') return false;

  if (trimmed !== "" && !isNaN(+trimmed)) {
    if (!(trimmed.length > 1 && trimmed.startsWith('0'))) {
      return Number(value);
    }
  }

  const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T[\d:.+-Z+])?$/;
  if (isoDateRegex.test(trimmed)) {
    const timestamp = Date.parse(trimmed);
    if (!isNaN(timestamp)) {
      return new Date(timestamp);
    }
  }

  if (
    (value.startsWith('[') && value.endsWith(']')) ||
    (value.startsWith('{') && value.endsWith('}'))
  ) {
    return JSON.parse(value);
  }

  return value;
}
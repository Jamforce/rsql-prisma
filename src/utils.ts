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

export const coerceValue = (value: string): string | number | boolean | Date => {
  
  const trimmed = value.trim();

  if (trimmed.toLocaleLowerCase() === 'true') return true;
  if (trimmed.toLocaleLowerCase() === 'false') return false;

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

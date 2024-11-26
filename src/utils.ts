export const isDate = <T>(value: T): boolean => {
  if (typeof value !== 'string') return false;
  const dateRegex =
    /\d{4}-\d{2}-\d{2}T?(\d{2}:\d{2}:\d{2})?(\+\d{2}:\d{2}Z?)?/gm;
  return !!value.match(dateRegex)?.length;
};

export const getScalarValue = <T>(value: T) => {
  return isDate(value) ? new Date(value as unknown as string) : +value;
};

const RSQL_WILDCARD = '*';
const ORM_WILDCARD = '';

export const isLike = (value: string): boolean => value.startsWith(RSQL_WILDCARD) && value.endsWith(RSQL_WILDCARD);
export const isStartsWith = (value: string): boolean => value.startsWith(RSQL_WILDCARD) && !value.endsWith(RSQL_WILDCARD);
export const isEndsWith = (value: string): boolean => value.endsWith(RSQL_WILDCARD) && !value.startsWith(RSQL_WILDCARD);

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
  if (isDate(value)) {
    return new Date(value);
  }
  if (!isNaN(Number(value))) {
    return Number(value);
  }
  if (value.toLowerCase() === 'true') {
    return true;
  }
  if (value.toLowerCase() === 'false') {
    return false;
  }
  if (value.startsWith('[') && value.endsWith(']')) {
    return JSON.parse(value);
  }
  return value;
}

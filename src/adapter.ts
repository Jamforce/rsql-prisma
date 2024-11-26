import {
  AND,
  AND_VERBOSE,
  ComparisonNode,
  LogicNode,
  EQ,
  ExpressionNode,
  GE,
  GE_VERBOSE,
  GT,
  GT_VERBOSE,
  IN,
  LE,
  LE_VERBOSE,
  LT,
  LT_VERBOSE,
  NEQ,
  OUT,
} from '@rsql/ast';
import { parse } from '@rsql/parser';
import { mergeDeepRight, reduceRight } from 'ramda';
import { getScalarValue, convertWildcards, isLike, isStartsWith, isEndsWith, coerceValue } from './utils';

interface WhereInput {
  AND?: WhereInput | WhereInput[];
  OR?: WhereInput | WhereInput[];
  NOT?: WhereInput | WhereInput[];
  [key: string]: any;
};


/**
 * Converts an RSQL expression node to a Prisma where query.
 *
 * @param node - The expression node to convert.
 * @param options - Optional settings for conversion.
 * @returns The corresponding Prisma where query.
 * @throws Will throw an error if the node type is unknown.
 */
const convertNodeToQuery = <T extends WhereInput>(
  node: ExpressionNode,
  options?: Options
): T => {
  const type = node.type;
  switch (type) {
    case 'COMPARISON':
      return handleComparisonNode(node, options);
    case 'LOGIC':
      return handleLogicalNode(node, options);
    default:
      throw new Error(`Unknown node type: ${type}`);
  }
};

/**
 * Handles logical nodes and converts them to a where query.
 *
 * @param node - The logical node to handle.
 * @param options - Optional settings for conversion.
 * @returns The corresponding Prisma where query.
 */
const handleLogicalNode = <T extends WhereInput>(
  node: LogicNode,
  options?: Options
): T => {
  const leftQuery = convertNodeToQuery<T>(node.left, options);
  const rightQuery = convertNodeToQuery<T>(node.right, options);
  if (node.operator === AND || node.operator === AND_VERBOSE) {
    return { AND: mergeQueries(leftQuery, rightQuery) } as T;
  }
  return { OR: mergeQueries(leftQuery, rightQuery) } as T;
};

/**
 * Handles comparison nodes and converts them to a where query.
 *
 * @param node - The comparison node to handle.
 * @param options - Optional settings for conversion.
 * @returns The corresponding Prisma where query.
 * @throws Will throw an error if the comparison operator is unknown.
 */
const handleComparisonNode = <T extends WhereInput>(
  node: ComparisonNode,
  options?: Options
): T => {
  const selector = node.left.selector;
  const operation = getOperationForNode(node, options);
  if (!operation) {
    throw new Error(`Unknown comparison operator: ${node.operator}`);
  }
  const filter = operation(node, options);
  return resolveRelationPath(selector, filter);
};

/**
 * Extracts the operation for a given comparison node.
 *
 * @param node - The comparison node.
 * @param options - Optional settings for conversion.
 * @returns The operation to be applied for the node's operator.
 */
const getOperationForNode = (node: ComparisonNode, options?: Options) => {
  return (options?.operatorMap || defaultOperatorMap)[node.operator];
};

/**
 * Resolves the relation path for a selector and applies it to the where query.
 *
 * @param selector - The full selector string, potentially containing nested relations.
 * @param filter - The generated where query.
 * @returns The where query with properly resolved relation paths.
 */
const resolveRelationPath = <T extends WhereInput>(
  selector: string,
  filter: WhereInput
): T => {
  const relations = selector.split('.');
  const filterValue: WhereInput = filter['NOT']
    ? (filter['NOT'] as WhereInput)[selector]
    : filter[selector];
  return (relations.length > 1
    ? relations.reduceRight((acc, curr) => ({ [curr]: acc }), filterValue)
    : filter) as T;
};

/**
 * Handles equality comparisons.
 *
 * @param node - The comparison node to handle.
 * @param options - Optional settings for conversion.
 * @returns The corresponding where query for equality.
 */
const handleEqual = <T extends WhereInput>(
  node: ComparisonNode,
  options?: Record<string, any>
): T => {
  const selector = node.left.selector;
  const value = node.right.value as string;
  const mode = options?.caseInsensitive ? 'insensitive' : null;
  const filter: WhereInput = {};
  if (isStartsWith(value)) {
    filter[selector] = { startsWith: convertWildcards(value), mode };
  } else if (isEndsWith(value)) {
    filter[selector] = { endsWith: convertWildcards(value), mode };
  } else if (isLike(value)) {
    filter[selector] = { contains: convertWildcards(value), mode };
  } else {
    filter[selector] = { equals: coerceValue(value) };
  }
  return filter as T;
};

/**
 * Handles inequality comparisons.
 *
 * @param node - The comparison node to handle.
 * @param options - Optional settings for conversion.
 * @returns The corresponding where query for inequality.
 */
const handleNotEqual = <T extends WhereInput>(
  node: ComparisonNode,
  options?: Record<string, any>
): T => {
  const selector = node.left.selector;
  const value = node.right.value as string;
  let filter: WhereInput;
  const mode = options?.caseInsensitive ? 'insensitive' : null;
  if (isStartsWith(value)) {
    filter = { NOT: { [selector]: { startsWith: convertWildcards(value), mode } } };
  } else if (isEndsWith(value)) {
    filter = { NOT: { [selector]: { endsWith: convertWildcards(value), mode } } };
  } else if (isLike(value)) {
    filter = { NOT: { [selector]: { contains: convertWildcards(value), mode } } };
  } else {
    filter = { [selector]: { not: coerceValue(value) } };
  }
  return filter as T;
};

/**
 * Type definition for operator mapping.
 */
type OperatorMap = Record<
  string,
  (node: ComparisonNode, options?: Record<string, any>) => WhereInput
>;

/**
 * Default operator mapping for RSQL operators.
 */
const defaultOperatorMap: OperatorMap = {
  [EQ]: handleEqual,
  [NEQ]: handleNotEqual,
  [GT]: (node: ComparisonNode) => ({
    [node.left.selector]: { gt: getScalarValue(node.right.value) },
  }),
  [GE]: (node: ComparisonNode) => ({
    [node.left.selector]: { gte: getScalarValue(node.right.value) },
  }),
  [LT]: (node: ComparisonNode) => ({
    [node.left.selector]: { lt: getScalarValue(node.right.value) },
  }),
  [LE]: (node: ComparisonNode) => ({
    [node.left.selector]: { lte: getScalarValue(node.right.value) },
  }),
  [IN]: (node: ComparisonNode) => ({
    [node.left.selector]: { in: coerceValue(node.right.value as string) },
  }),
  [OUT]: (node: ComparisonNode) => ({
    [node.left.selector]: { notIn: coerceValue(node.right.value as string) },
  }),
};

defaultOperatorMap[GT_VERBOSE] = defaultOperatorMap[GT];
defaultOperatorMap[GE_VERBOSE] = defaultOperatorMap[GE];
defaultOperatorMap[LT_VERBOSE] = defaultOperatorMap[LT];
defaultOperatorMap[LE_VERBOSE] = defaultOperatorMap[LE];

/**
 * Merges two filter queries into one.
 *
 * @param leftQuery - The left where query.
 * @param rightQuery - The right where query.
 * @returns An array of merged filter queries.
 */
const mergeQueries = <T extends WhereInput>(
  leftQuery: WhereInput,
  rightQuery: WhereInput
): T[] => {
  let mergeResult = null;

  ['AND', 'OR'].forEach(operator => {
    if (leftQuery[operator] && rightQuery[operator]) {
      //console.log(`BOTH: LEFT: ${JSON.stringify(leftQuery)} RIGHT: ${JSON.stringify(rightQuery)}`)
      mergeResult = [leftQuery, rightQuery];
    } else if (leftQuery[operator]) {
      //console.log(`ONLY LEFT: LEFT: ${JSON.stringify(leftQuery)} RIGHT: ${JSON.stringify(rightQuery)}`)
      mergeResult = [
        reduceRight(mergeDeepRight, rightQuery, leftQuery[operator]),
      ];
    } else if (rightQuery[operator]) {
      //console.log(`ONLY RIGHT: LEFT: ${JSON.stringify(leftQuery)} RIGHT: ${JSON.stringify(rightQuery)}`)
      mergeResult = [mergeDeepRight(leftQuery, rightQuery)];
    }
  });
  if (!mergeResult) {
    //console.log(`NOBODY: LEFT: ${JSON.stringify(leftQuery)} RIGHT: ${JSON.stringify(rightQuery)}`)
    mergeResult = [mergeDeepRight(rightQuery, leftQuery)];
  }

  return mergeResult as T[];
};

/**
 * Options for RSQL conversion functions.
 */
export type Options = {
  caseInsensitive?: boolean;
  logger?: any;
  operatorMap?: OperatorMap;
};

/**
 * Converts an RSQL expression node to a Prisma where query.
 *
 * @param expression - The expression node to convert.
 * @param options - Optional settings for conversion.
 * @returns The corresponding Prisma where query.
 */
export const rsqlExpressionToQuery = <T extends WhereInput>(
  expression: ExpressionNode,
  options?: Options
): T => convertNodeToQuery(expression, options);

/**
 * Converts an RSQL string to a Prisma where query.
 *
 * @param rsql - The RSQL string to convert.
 * @param options - Optional settings for conversion.
 * @returns The corresponding Prisma where query.
 */
export const rsqlStringToQuery = <T extends WhereInput>(
  rsql: string,
  options?: Options
): T => {
  const query = rsqlExpressionToQuery<T>(parse(rsql), options);
  options?.logger?.debug(`Source: ${rsql}, Target: ${JSON.stringify(query)}`);
  return query;
};

import { ComparisonNode } from '@rsql/ast';


/**
 * Options for RSQL conversion functions.
 */
export type Options = {
  caseInsensitive?: boolean;
  logger?: any;
  operatorMap?: OperatorMap;
  prisma?: PrismaContext;
};


/**
 * Type definition for operator mapping.
 */
export type OperatorMap = Record<
  string,
  (node: ComparisonNode, options?: Record<string, any>) => WhereInput
>;

export type PrismaContext = {
  model: string;
  dmmf: {
    datamodel: { models: DmmfModel[] }
  };
};

export type DmmfModel = {
  name: string;
  fields: DmmfField[];
};

export type DmmfField = {
  name: string;
  type: string;
  kind: 'scalar' | 'enum' | 'object';
  isList?: boolean;
  isRequired?: boolean;
  enumValues?: { name: string }[];
};


export interface WhereInput {
  AND?: WhereInput | WhereInput[];
  OR?: WhereInput | WhereInput[];
  NOT?: WhereInput | WhereInput[];
  [key: string]: any;
};
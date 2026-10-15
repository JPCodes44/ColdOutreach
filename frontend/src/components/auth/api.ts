import { makeFunctionReference } from 'convex/server';
import type { OperatorIdentity } from './types';

export const operatorMeQuery = makeFunctionReference<
  'query',
  Record<string, never>,
  OperatorIdentity
>('operator:me');

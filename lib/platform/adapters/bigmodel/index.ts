import type { IAuthProbe, IOrderPipeline, PlatformEntryInfo } from '../../types';
import { BigmodelAuthProbe } from './auth-probe';
import { BigmodelOrderPipeline } from './order-pipeline';

export type BigmodelAdapter = PlatformEntryInfo & {
  authProbe: IAuthProbe;
  orderPipeline: IOrderPipeline;
};

export const bigmodelAdapter: BigmodelAdapter = {
  id: 'bigmodel',
  displayName: '智谱 Coding Plan',
  hostPatterns: ['*://*.bigmodel.cn/*'],
  entryUrl: 'https://bigmodel.cn/glm-coding?plantype=personal',

  authProbe: new BigmodelAuthProbe(),
  orderPipeline: new BigmodelOrderPipeline(),
};

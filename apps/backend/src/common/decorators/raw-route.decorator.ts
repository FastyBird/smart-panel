import { SetMetadata } from '@nestjs/common';

export const RAW_ROUTE = 'rawRoute';

export const RawRoute = () => SetMetadata(RAW_ROUTE, true);

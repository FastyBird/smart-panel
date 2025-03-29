import { snakeToCamel } from '../../../common';
import { SystemValidationException } from '../system.exceptions';

import { type ISystemInfo, type ISystemInfoRes, SystemInfoSchema } from './system-info.store.types';

export function transformSystemInfoResponse(response: ISystemInfoRes): ISystemInfo {
	const parsed = SystemInfoSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		throw new SystemValidationException('Failed to validate received system info data.');
	}

	return parsed.data;
}

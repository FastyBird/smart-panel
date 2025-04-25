import { v4 as uuid, validate as uuidValidate, version as uuidVersion } from 'uuid';

import type { IUseUuid } from './types';

export const useUuid = (): IUseUuid => {
	const generate = (): string => {
		return uuid();
	};

	const validate = (uuid: string): boolean => {
		return uuidValidate(uuid) && uuidVersion(uuid) === 4;
	};

	return {
		generate,
		validate,
	};
};

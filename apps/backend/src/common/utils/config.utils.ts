import { ConfigService as NestConfigService } from '@nestjs/config';

export function getEnvValue<T>(configService: NestConfigService, key: string, defaultValue?: T): T {
	const value = configService.get<T>(key);

	if ((typeof value === 'string' && value.trim() === '') || typeof value === 'undefined') {
		return defaultValue;
	}

	if (typeof defaultValue !== 'undefined') {
		if (typeof defaultValue === 'boolean') {
			return ['true', '1', 'on'].includes(String(value).toLowerCase()) as T;
		}

		if (typeof defaultValue === 'number') {
			return Number(value) as T;
		}
	}

	return value as unknown as T;
}

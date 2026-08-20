import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { ReqBulkUpdateExtensionsDto } from './bulk-extensions.dto';

// Same options as the global pipe registered in main.ts.
const pipe = new ValidationPipe({
	transform: true,
	whitelist: true,
	forbidNonWhitelisted: true,
	transformOptions: { enableImplicitConversion: true },
});

const transformRequest = (value: unknown): Promise<ReqBulkUpdateExtensionsDto> =>
	pipe.transform(value, { type: 'body', metatype: ReqBulkUpdateExtensionsDto });

describe('ReqBulkUpdateExtensionsDto', () => {
	it('accepts a valid bulk update payload', async () => {
		const request = await transformRequest({ data: { types: ['devices-shelly-ng-plugin'], enabled: true } });

		expect(request.data.types).toEqual(['devices-shelly-ng-plugin']);
		expect(request.data.enabled).toBe(true);
	});

	it('rejects an empty request body with a 400 instead of leaving data undefined', async () => {
		await expect(transformRequest({})).rejects.toThrow(BadRequestException);
	});

	it('rejects a null data envelope', async () => {
		await expect(transformRequest({ data: null })).rejects.toThrow(BadRequestException);
	});
});

import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { ReqBulkRemoveDevicesDto, ReqBulkUpdateDevicesDto } from './bulk-devices.dto';

// Same options as the global pipe registered in main.ts.
const pipe = new ValidationPipe({
	transform: true,
	whitelist: true,
	forbidNonWhitelisted: true,
	transformOptions: { enableImplicitConversion: true },
});

const transformRemoveRequest = (value: unknown): Promise<ReqBulkRemoveDevicesDto> =>
	pipe.transform(value, { type: 'body', metatype: ReqBulkRemoveDevicesDto });

const transformUpdateRequest = (value: unknown): Promise<ReqBulkUpdateDevicesDto> =>
	pipe.transform(value, { type: 'body', metatype: ReqBulkUpdateDevicesDto });

describe('ReqBulkRemoveDevicesDto', () => {
	it('accepts a valid bulk removal payload', async () => {
		const request = await transformRemoveRequest({ data: { ids: ['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6'] } });

		expect(request.data.ids).toEqual(['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6']);
	});

	it('rejects an empty request body with a 400 instead of leaving data undefined', async () => {
		await expect(transformRemoveRequest({})).rejects.toThrow(BadRequestException);
	});

	it('rejects a null data envelope', async () => {
		await expect(transformRemoveRequest({ data: null })).rejects.toThrow(BadRequestException);
	});
});

describe('ReqBulkUpdateDevicesDto', () => {
	it('accepts a valid bulk update payload', async () => {
		const request = await transformUpdateRequest({
			data: { ids: ['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6'], enabled: true },
		});

		expect(request.data.ids).toEqual(['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6']);
		expect(request.data.enabled).toBe(true);
	});

	it('rejects an empty request body with a 400 instead of leaving data undefined', async () => {
		await expect(transformUpdateRequest({})).rejects.toThrow(BadRequestException);
	});

	it('rejects a null data envelope', async () => {
		await expect(transformUpdateRequest({ data: null })).rejects.toThrow(BadRequestException);
	});
});

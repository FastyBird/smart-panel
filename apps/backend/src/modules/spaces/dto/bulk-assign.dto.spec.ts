import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { ReqBulkAssignDto } from './bulk-assign.dto';

// Same options as the global pipe registered in main.ts.
const pipe = new ValidationPipe({
	transform: true,
	whitelist: true,
	forbidNonWhitelisted: true,
	transformOptions: { enableImplicitConversion: true },
});

const transformRequest = (value: unknown): Promise<ReqBulkAssignDto> =>
	pipe.transform(value, { type: 'body', metatype: ReqBulkAssignDto });

describe('ReqBulkAssignDto', () => {
	it('accepts a valid bulk assignment payload', async () => {
		const request = await transformRequest({ data: { device_ids: ['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6'] } });

		expect(request.data.deviceIds).toEqual(['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6']);
	});

	it('rejects an empty request body with a 400 instead of leaving data undefined', async () => {
		await expect(transformRequest({})).rejects.toThrow(BadRequestException);
	});

	it('rejects a null data envelope', async () => {
		await expect(transformRequest({ data: null })).rejects.toThrow(BadRequestException);
	});

	// The inner shape allows both device_ids and display_ids to be omitted, so an
	// explicit but empty envelope is a different case from an absent one - it is
	// still a defined object and must keep passing.
	it('still accepts an explicitly empty data object', async () => {
		const request = await transformRequest({ data: {} });

		expect(request.data.deviceIds).toBeUndefined();
		expect(request.data.displayIds).toBeUndefined();
	});
});

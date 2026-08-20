import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { ReqBulkRemoveSpacesDto } from './bulk-spaces.dto';

// Same options as the global pipe registered in main.ts.
const pipe = new ValidationPipe({
	transform: true,
	whitelist: true,
	forbidNonWhitelisted: true,
	transformOptions: { enableImplicitConversion: true },
});

const transformRequest = (value: unknown): Promise<ReqBulkRemoveSpacesDto> =>
	pipe.transform(value, { type: 'body', metatype: ReqBulkRemoveSpacesDto });

describe('ReqBulkRemoveSpacesDto', () => {
	it('accepts a valid bulk removal payload', async () => {
		const request = await transformRequest({ data: { ids: ['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6'] } });

		expect(request.data.ids).toEqual(['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6']);
	});

	it('rejects an empty request body with a 400 instead of leaving data undefined', async () => {
		await expect(transformRequest({})).rejects.toThrow(BadRequestException);
	});

	it('rejects a null data envelope', async () => {
		await expect(transformRequest({ data: null })).rejects.toThrow(BadRequestException);
	});
});

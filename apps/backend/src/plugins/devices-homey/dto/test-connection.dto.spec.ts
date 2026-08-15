import { ValidationPipe } from '@nestjs/common';

import {
	HomeyTestCandidateConnectionDto,
	HomeyTestConnectionMode,
	HomeyTestConnectionRequestDto,
	HomeyTestSavedConnectionDto,
} from './test-connection.dto';

const pipe = new ValidationPipe({
	transform: true,
	whitelist: true,
	forbidNonWhitelisted: true,
	transformOptions: { enableImplicitConversion: true },
});

const transformRequest = (value: unknown): Promise<HomeyTestConnectionRequestDto> =>
	pipe.transform(value, { type: 'body', metatype: HomeyTestConnectionRequestDto });

describe('HomeyTestConnectionRequestDto', () => {
	it('selects the saved request subtype without accepting connector overrides', async () => {
		const request = await transformRequest({ data: { mode: HomeyTestConnectionMode.SAVED } });

		expect(request.data).toBeInstanceOf(HomeyTestSavedConnectionDto);
		expect(request.data).toStrictEqual(expect.objectContaining({ mode: HomeyTestConnectionMode.SAVED }));
	});

	it('selects the candidate subtype and transforms the write-only API key', async () => {
		const request = await transformRequest({
			data: {
				mode: HomeyTestConnectionMode.CANDIDATE,
				url: 'http://homey.local:4859',
				api_key: 'candidate-secret',
			},
		});

		expect(request.data).toBeInstanceOf(HomeyTestCandidateConnectionDto);
		expect(request.data).toStrictEqual(
			expect.objectContaining({
				mode: HomeyTestConnectionMode.CANDIDATE,
				url: 'http://homey.local:4859',
				apiKey: 'candidate-secret',
			}),
		);
	});

	it.each([
		{
			data: { mode: HomeyTestConnectionMode.SAVED, url: 'http://homey.local:4859' },
			label: 'saved URL override',
		},
		{
			data: { mode: HomeyTestConnectionMode.SAVED, api_key: 'candidate-secret' },
			label: 'saved API-key override',
		},
		{
			data: { mode: HomeyTestConnectionMode.CANDIDATE, url: 'http://homey.local:4859' },
			label: 'candidate URL without a new key',
		},
		{
			data: { mode: HomeyTestConnectionMode.CANDIDATE, api_key: 'candidate-secret' },
			label: 'candidate key without a URL',
		},
		{
			data: {
				mode: HomeyTestConnectionMode.CANDIDATE,
				url: 'http://user:password@homey.local:4859',
				api_key: 'candidate-secret',
			},
			label: 'URL with embedded credentials',
		},
		{ data: { mode: 'local' }, label: 'unknown discriminator' },
	])('rejects $label', async ({ data }) => {
		await expect(transformRequest({ data })).rejects.toBeDefined();
	});
});

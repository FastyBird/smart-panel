import { Logger } from '@nestjs/common';

import { PROTECT_RTSPS_QUALITIES } from '../devices-unifi-protect.constants';
import { ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';

import { ProtectAdoptionStreamsService, ProtectStreamOutcome } from './protect-adoption-streams.service';

const URL_OF = (quality: string) => `rtsps://192.168.1.1:7441/SENTINELALIAS${quality}?enableSrtp`;

const streams = (...enabled: string[]) =>
	Object.fromEntries(PROTECT_RTSPS_QUALITIES.map((q) => [q, enabled.includes(q) ? URL_OF(q) : null]));

describe('ProtectAdoptionStreamsService', () => {
	let service: ProtectAdoptionStreamsService;
	let client: { getRtspsStreams: jest.Mock; createRtspsStreams: jest.Mock };
	const logged: unknown[][] = [];

	const ensure = (quality: 'high' | 'medium' | 'low' = 'medium', packageCamera = false) =>
		service.ensureStreams(client as never, 'camera-1', { quality, packageCamera });

	beforeEach(() => {
		logged.length = 0;

		for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
			jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
				logged.push(args);
			});
		}

		client = { getRtspsStreams: jest.fn(), createRtspsStreams: jest.fn() };
		service = new ProtectAdoptionStreamsService();
	});

	afterEach(() => jest.restoreAllMocks());

	it('posts the union of enabled and requested qualities', async () => {
		client.getRtspsStreams.mockResolvedValue(streams('high'));
		client.createRtspsStreams.mockResolvedValue(streams('high', 'medium'));

		const result = await ensure('medium');

		expect(client.createRtspsStreams).toHaveBeenCalledWith('camera-1', ['high', 'medium']);
		expect(result).toEqual({
			outcome: ProtectStreamOutcome.ENABLED,
			quality: 'medium',
			enabledQualities: ['high', 'medium'],
			failureCategory: null,
			availability: { high: true, medium: true, low: false, package: false },
		});
	});

	it('adds the package quality for a package camera', async () => {
		client.getRtspsStreams.mockResolvedValue(streams());
		client.createRtspsStreams.mockResolvedValue(streams('high', 'package'));

		const result = await ensure('high', true);

		expect(client.createRtspsStreams).toHaveBeenCalledWith('camera-1', ['high', 'package']);
		expect(result.outcome).toBe('enabled');
		expect(result.enabledQualities).toEqual(['high', 'package']);
	});

	it('does not post when the requested qualities are already enabled', async () => {
		client.getRtspsStreams.mockResolvedValue(streams('medium', 'package'));

		const result = await ensure('medium', true);

		expect(client.createRtspsStreams).not.toHaveBeenCalled();
		expect(result.outcome).toBe('already_enabled');
		expect(result.enabledQualities).toEqual(['medium', 'package']);
	});

	it.each([[ProtectErrorCategory.BAD_REQUEST], [ProtectErrorCategory.PROTOCOL]])(
		'treats a %s answer as already enabled when a re-read shows the streams',
		async (category) => {
			client.getRtspsStreams.mockResolvedValueOnce(streams()).mockResolvedValueOnce(streams('medium'));
			client.createRtspsStreams.mockRejectedValue(new ProtectApiError(category, 'cameras/{id}/rtsps-stream'));

			const result = await ensure('medium');

			expect(client.getRtspsStreams).toHaveBeenCalledTimes(2);
			expect(result.outcome).toBe('already_enabled');
		},
	);

	it('fails with the POST category when the re-read still lacks the streams', async () => {
		client.getRtspsStreams.mockResolvedValue(streams());
		client.createRtspsStreams.mockRejectedValue(
			new ProtectApiError(ProtectErrorCategory.BAD_REQUEST, 'cameras/{id}/rtsps-stream'),
		);

		const result = await ensure('medium');

		expect(result).toMatchObject({ outcome: 'failed', failureCategory: 'bad_request', enabledQualities: [] });
	});

	it('reports a failed POST without throwing and calls the console once', async () => {
		client.getRtspsStreams.mockResolvedValue(streams());
		client.createRtspsStreams.mockRejectedValue(
			new ProtectApiError(ProtectErrorCategory.UNAVAILABLE, 'cameras/{id}/rtsps-stream'),
		);

		const result = await ensure('medium');

		expect(result).toMatchObject({ outcome: 'failed', failureCategory: 'unavailable', availability: null });
		expect(client.createRtspsStreams).toHaveBeenCalledTimes(1);
		expect(client.getRtspsStreams).toHaveBeenCalledTimes(1);
		expect(result.enabledQualities).toEqual([]);
	});

	it('fails without posting when the stream state cannot be read', async () => {
		client.getRtspsStreams.mockRejectedValue(
			new ProtectApiError(ProtectErrorCategory.TIMEOUT, 'cameras/{id}/rtsps-stream'),
		);

		const result = await ensure('medium');

		expect(client.createRtspsStreams).not.toHaveBeenCalled();
		expect(result).toMatchObject({ outcome: 'failed', failureCategory: 'timeout', enabledQualities: null });
	});

	it('reports failed when the console answer lacks a requested quality', async () => {
		client.getRtspsStreams.mockResolvedValue(streams());
		client.createRtspsStreams.mockResolvedValue(streams('high'));

		const result = await ensure('medium');

		expect(result).toMatchObject({ outcome: 'failed', failureCategory: 'protocol', enabledQualities: ['high'] });
	});

	it('maps a non-API error to unavailable and never rejects', async () => {
		client.getRtspsStreams.mockRejectedValue(new Error('boom rtsps://x/SENTINELALIAS'));

		const result = await ensure('medium');

		expect(result).toMatchObject({ outcome: 'failed', failureCategory: 'unavailable' });
	});

	it('keeps aliases out of results and log lines', async () => {
		client.getRtspsStreams.mockResolvedValueOnce(streams('high')).mockResolvedValueOnce(streams('high'));
		client.createRtspsStreams.mockResolvedValue(streams('high', 'medium'));

		const results = [await ensure('medium'), await ensure('high')];

		client.getRtspsStreams.mockRejectedValue(new Error(URL_OF('high')));
		results.push(await ensure('medium'));

		expect(logged.length).toBeGreaterThan(0);
		expect(JSON.stringify([results, logged])).not.toMatch(/SENTINELALIAS|rtsps/);
	});
});

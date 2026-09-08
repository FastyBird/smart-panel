import { CloudflaredMetricsService } from './cloudflared-metrics.service';

describe('CloudflaredMetricsService', () => {
	let service: CloudflaredMetricsService;
	let mockedFetch: jest.SpiedFunction<typeof fetch>;

	beforeEach(() => {
		service = new CloudflaredMetricsService();
		mockedFetch = jest.spyOn(global, 'fetch').mockImplementation();
	});

	afterEach(() => {
		mockedFetch.mockRestore();
	});

	it('parses readyConnections and connectorId from a 200 response', async () => {
		mockedFetch.mockResolvedValue(
			new Response(JSON.stringify({ readyConnections: 4, connectorId: 'abc-123' }), { status: 200 }),
		);

		const result = await service.fetchReady('127.0.0.1:20246');

		expect(result).toEqual({ readyConnections: 4, connectorId: 'abc-123' });
		expect(mockedFetch).toHaveBeenCalledTimes(1);
		expect(mockedFetch.mock.calls[0][0]).toBe('http://127.0.0.1:20246/ready');
		expect(mockedFetch.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
	});

	it('defaults readyConnections/connectorId when the body omits them', async () => {
		mockedFetch.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

		const result = await service.fetchReady('127.0.0.1:20246');

		expect(result).toEqual({ readyConnections: 0, connectorId: '' });
	});

	it('returns null on a 503 response', async () => {
		mockedFetch.mockResolvedValue(new Response('', { status: 503 }));

		const result = await service.fetchReady('127.0.0.1:20246');

		expect(result).toBeNull();
	});

	it('returns null when the connection is refused', async () => {
		mockedFetch.mockRejectedValue(new TypeError('fetch failed'));

		const result = await service.fetchReady('127.0.0.1:20246');

		expect(result).toBeNull();
	});

	it('returns null on a timeout, never throwing', async () => {
		mockedFetch.mockRejectedValue(new DOMException('The operation was aborted.', 'TimeoutError'));

		await expect(service.fetchReady('127.0.0.1:20246')).resolves.toBeNull();
	});

	it('returns null when the body is not valid JSON', async () => {
		mockedFetch.mockResolvedValue(new Response('not json', { status: 200 }));

		const result = await service.fetchReady('127.0.0.1:20246');

		expect(result).toBeNull();
	});
});

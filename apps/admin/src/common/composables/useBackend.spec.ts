import { describe, expect, it, vi } from 'vitest';

import { useBackend } from './useBackend';

const clientMock = {
	GET: vi.fn(),
	POST: vi.fn(),
	PUT: vi.fn(),
	DELETE: vi.fn(),
};

vi.mock('../services/backend', () => ({
	injectBackendClient: vi.fn(() => clientMock),
}));

describe('useBackend', () => {
	it('should return the backend client and pendingRequests ref', () => {
		const { client, pendingRequests } = useBackend();

		expect(client).toBeDefined();

		expect(typeof client.GET).toBe('function');
		expect(typeof client.POST).toBe('function');
		expect(typeof client.PUT).toBe('function');
		expect(typeof client.DELETE).toBe('function');

		expect(pendingRequests).toBeDefined();
		expect(pendingRequests.value).toBe(0);
	});

	it('should allow modifying pendingRequests', () => {
		const { pendingRequests } = useBackend();

		pendingRequests.value += 1;
		expect(pendingRequests.value).toBe(1);

		pendingRequests.value -= 1;
		expect(pendingRequests.value).toBe(0);
	});
});

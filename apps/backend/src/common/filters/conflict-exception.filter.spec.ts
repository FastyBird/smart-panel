import { ArgumentsHost, ConflictException, HttpStatus } from '@nestjs/common';

import { ConflictExceptionFilter } from './conflict-exception.filter';

interface ErrorEnvelope {
	status: string;
	path: string;
	method: string;
	error: { code: string; message: string; details: Record<string, unknown> };
}

function createHost(): {
	host: ArgumentsHost;
	response: { code: jest.Mock; type: jest.Mock; send: jest.Mock<unknown, [ErrorEnvelope]> };
} {
	const response = {
		code: jest.fn().mockReturnThis(),
		type: jest.fn().mockReturnThis(),
		// Given an explicit generic (return, args) instead of a bare `jest.Mock`
		// so `response.send.mock.calls[0][0]` below resolves to `ErrorEnvelope`
		// instead of `any`.
		send: jest.fn<unknown, [ErrorEnvelope]>(),
	};
	const host = {
		switchToHttp: () => ({
			getRequest: () => ({ originalUrl: '/api/v1/remote-access-tailscale-plugin/login', method: 'POST' }),
			getResponse: () => response,
		}),
	} as unknown as ArgumentsHost;

	return { host, response };
}

describe('ConflictExceptionFilter', () => {
	let filter: ConflictExceptionFilter;

	beforeEach(() => {
		filter = new ConflictExceptionFilter();
	});

	it('envelopes a string-thrown ConflictException with no details.code', () => {
		const { host, response } = createHost();

		filter.catch(new ConflictException('a setup job is already running'), host);

		expect(response.code).toHaveBeenCalledWith(HttpStatus.CONFLICT);
		expect(response.type).toHaveBeenCalledWith('application/json');

		const body = response.send.mock.calls[0][0];

		expect(body.error).toEqual({
			code: 'ConflictError',
			message: 'a setup job is already running',
			details: { reason: 'a setup job is already running' },
		});
		expect(body.error.details).not.toHaveProperty('code');
		expect(body.status).toBe('error');
		expect(body.path).toBe('/api/v1/remote-access-tailscale-plugin/login');
		expect(body.method).toBe('POST');
	});

	it('passes an application code through details.code for an object-thrown ConflictException', () => {
		const { host, response } = createHost();

		filter.catch(new ConflictException({ code: 'operator-not-granted', message: 'Access denied' }), host);

		const body = response.send.mock.calls[0][0];

		expect(body.error).toEqual({
			code: 'ConflictError',
			message: 'Access denied',
			details: { reason: 'Access denied', code: 'operator-not-granted' },
		});
	});

	it('ignores a non-string code field on the thrown response', () => {
		const { host, response } = createHost();

		filter.catch(new ConflictException({ code: 42, message: 'weird' } as unknown as Record<string, unknown>), host);

		const body = response.send.mock.calls[0][0];

		expect(body.error.details).toEqual({ reason: 'weird' });
	});

	it('preserves an empty-string application code instead of treating it as absent', () => {
		const { host, response } = createHost();

		filter.catch(new ConflictException({ code: '', message: 'edge case' }), host);

		const body = response.send.mock.calls[0][0];

		expect(body.error.details).toEqual({ reason: 'edge case', code: '' });
	});
});

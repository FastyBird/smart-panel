import { ArgumentsHost, HttpStatus, UnprocessableEntityException } from '@nestjs/common';

import { UnprocessableEntityExceptionFilter } from './unprocessable-entity-exception.filter';

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
			getRequest: () => ({ originalUrl: '/api/v1/remote-access-tailscale-plugin/install', method: 'POST' }),
			getResponse: () => response,
		}),
	} as unknown as ArgumentsHost;

	return { host, response };
}

describe('UnprocessableEntityExceptionFilter', () => {
	let filter: UnprocessableEntityExceptionFilter;

	beforeEach(() => {
		filter = new UnprocessableEntityExceptionFilter();
	});

	it('envelopes a string-thrown UnprocessableEntityException with no details.code', () => {
		const { host, response } = createHost();

		filter.catch(new UnprocessableEntityException('platform not supported'), host);

		expect(response.code).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
		expect(response.type).toHaveBeenCalledWith('application/json');

		const body = response.send.mock.calls[0][0];

		expect(body.error.code).toBe('UnprocessableEntity');
		expect(body.error.message).toBe('The request could not be processed due to semantic issues.');
		expect(body.error.details).toEqual({ reason: 'platform not supported' });
		expect(body.error.details).not.toHaveProperty('code');
	});

	it('passes an application code through details.code for an object-thrown UnprocessableEntityException', () => {
		const { host, response } = createHost();

		filter.catch(
			new UnprocessableEntityException({
				code: 'platform-unsupported',
				message: "the 'docker' platform is unsupported",
			}),
			host,
		);

		const body = response.send.mock.calls[0][0];

		expect(body.error.code).toBe('UnprocessableEntity');
		expect(body.error.details).toEqual({
			reason: "the 'docker' platform is unsupported",
			code: 'platform-unsupported',
		});
	});

	it('ignores a non-string code field on the thrown response', () => {
		const { host, response } = createHost();

		filter.catch(
			new UnprocessableEntityException({ code: 42, message: 'weird' } as unknown as Record<string, unknown>),
			host,
		);

		const body = response.send.mock.calls[0][0];

		expect(body.error.details).toEqual({ reason: 'weird' });
	});
});

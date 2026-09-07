import request from 'supertest';

import { BadRequestException, ConflictException, Controller, Get, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { createGlobalExceptionFilters } from '../src/common/filters/global-filters';

/**
 * A throwaway route set, not part of the app's public API. Exercises the
 * production global exception filter chain (`createGlobalExceptionFilters()`)
 * against a minimal testing module rather than the full `AppModule`, so these
 * assertions observe exactly the response bodies `main.ts` would send, not
 * Nest's raw default filter a bare testing module would otherwise produce
 * (D13, RA-27, #996).
 */
@Controller('error-envelope-probe')
class ErrorEnvelopeProbeController {
	@Get('conflict-string')
	conflictString(): never {
		throw new ConflictException('a setup job is already running');
	}

	@Get('conflict-object')
	conflictObject(): never {
		throw new ConflictException({ code: 'operator-not-granted', message: 'Access denied' });
	}

	@Get('unprocessable-object')
	unprocessableObject(): never {
		throw new UnprocessableEntityException({
			code: 'platform-unsupported',
			message: "the 'docker' platform does not have privileged-worker support",
		});
	}

	@Get('validation')
	validation(): never {
		// Mirrors the exact shape `ValidationExceptionFactory.createException()`
		// (the `ValidationPipe` `exceptionFactory` `main.ts` registers) produces
		// — an array of JSON-encoded `{ field, reason }` strings — without
		// wiring a full DTO + `ValidationPipe` here, since that factory already
		// has its own unit spec covering the encoding itself.
		throw new BadRequestException([JSON.stringify({ field: 'name', reason: 'name must be a string' })]);
	}

	@Get('unexpected')
	unexpected(): never {
		throw new Error('boom: unexpected failure');
	}
}

function buildConfigService(): ConfigService {
	return { get: jest.fn() } as unknown as ConfigService;
}

interface ErrorEnvelopeResponseBody {
	status: string;
	error: { code: string; message: string; details: unknown };
}

describe('API error envelope (e2e) — D13, RA-27, #996', () => {
	let app: NestFastifyApplication;

	beforeAll(async () => {
		const moduleFixture = await Test.createTestingModule({
			controllers: [ErrorEnvelopeProbeController],
		}).compile();

		app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

		app.useGlobalFilters(...createGlobalExceptionFilters(buildConfigService()));

		await app.listen(0, '127.0.0.1');
	});

	afterAll(async () => {
		await app.close();
	});

	it('envelopes a string-thrown ConflictException with no details.code', async () => {
		const response = await request(app.getHttpServer()).get('/error-envelope-probe/conflict-string').expect(409);
		const body = response.body as ErrorEnvelopeResponseBody;

		expect(body.error).toEqual({
			code: 'ConflictError',
			message: 'a setup job is already running',
			details: { reason: 'a setup job is already running' },
		});
	});

	it('envelopes an object-thrown ConflictException with an application code in details.code', async () => {
		const response = await request(app.getHttpServer()).get('/error-envelope-probe/conflict-object').expect(409);
		const body = response.body as ErrorEnvelopeResponseBody;

		expect(body.error).toEqual({
			code: 'ConflictError',
			message: 'Access denied',
			details: { reason: 'Access denied', code: 'operator-not-granted' },
		});
	});

	it('envelopes an object-thrown UnprocessableEntityException with details.code, keeping error.code the coarse class code', async () => {
		const response = await request(app.getHttpServer()).get('/error-envelope-probe/unprocessable-object').expect(422);
		const body = response.body as ErrorEnvelopeResponseBody;

		expect(body.error.code).toBe('UnprocessableEntity');
		expect(body.error.details).toEqual({
			reason: "the 'docker' platform does not have privileged-worker support",
			code: 'platform-unsupported',
		});
	});

	it('leaves a 400 validation failure handled by BadRequestExceptionFilter unaffected', async () => {
		const response = await request(app.getHttpServer()).get('/error-envelope-probe/validation').expect(400);
		const body = response.body as ErrorEnvelopeResponseBody;

		expect(body.error).toEqual({
			code: 'BadRequestError',
			message: 'One or more parameters failed validation.',
			details: [{ field: 'name', reason: 'name must be a string' }],
		});
	});

	it.each([
		['unset (development default)', undefined],
		['production', 'production'],
	])(
		'masks a plain Error as a generic 500 through GlobalErrorFilter regardless of NODE_ENV (%s)',
		async (_label, nodeEnv) => {
			const previousNodeEnv = process.env.NODE_ENV;

			if (nodeEnv) {
				process.env.NODE_ENV = nodeEnv;
			} else {
				delete process.env.NODE_ENV;
			}

			try {
				const response = await request(app.getHttpServer()).get('/error-envelope-probe/unexpected').expect(500);
				const body = response.body as ErrorEnvelopeResponseBody;

				// GlobalErrorFilter never reveals the real message or the
				// exception's own `getResponse()` for a non-HttpException error —
				// this masking is completely unchanged by RA-27, in every
				// NODE_ENV, exactly as before.
				expect(body.error).toEqual({
					code: 'InternalServerError',
					message: 'An unexpected error occurred.',
					details: { reason: 'An unexpected server error occurred.' },
				});
			} finally {
				if (previousNodeEnv === undefined) {
					delete process.env.NODE_ENV;
				} else {
					process.env.NODE_ENV = previousNodeEnv;
				}
			}
		},
	);
});

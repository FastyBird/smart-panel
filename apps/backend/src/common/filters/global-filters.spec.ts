import request from 'supertest';

import { ConflictException, Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { BadRequestExceptionFilter } from './bad-request-exception.filter';
import { ConflictExceptionFilter } from './conflict-exception.filter';
import { GlobalErrorFilter } from './global-error.filter';
import { createGlobalExceptionFilters } from './global-filters';
import { InternalServerErrorExceptionFilter } from './internal-server-error-exception.filter';
import { NotFoundExceptionFilter } from './not-found-exception.filter';
import { QueryFailedExceptionFilter } from './query-failed-exception.filter';
import { UnprocessableEntityExceptionFilter } from './unprocessable-entity-exception.filter';

/**
 * A throwaway route, not part of the app's public API, only used to prove
 * which filter in the chain actually handles a `ConflictException` once the
 * whole array is registered — see the second spec below.
 */
@Controller('conflict-probe')
class ConflictProbeController {
	@Get()
	throwConflict(): never {
		throw new ConflictException({ code: 'already-running', message: 'a setup job is already running' });
	}
}

function buildConfigService(): ConfigService {
	return { get: jest.fn() } as unknown as ConfigService;
}

interface ErrorEnvelopeResponseBody {
	status: string;
	error: { code: string; message: string; details: Record<string, unknown> };
}

describe('createGlobalExceptionFilters()', () => {
	it("returns today's filter chain with ConflictExceptionFilter appended immediately after BadRequestExceptionFilter", () => {
		const filters = createGlobalExceptionFilters(buildConfigService());

		expect(filters.map((filter) => filter.constructor.name)).toEqual([
			GlobalErrorFilter.name,
			InternalServerErrorExceptionFilter.name,
			BadRequestExceptionFilter.name,
			ConflictExceptionFilter.name,
			UnprocessableEntityExceptionFilter.name,
			NotFoundExceptionFilter.name,
			QueryFailedExceptionFilter.name,
		]);
	});

	it('registers ConflictExceptionFilter ahead of BadRequestExceptionFilter in the match order, so a ConflictException comes back enveloped', async () => {
		const moduleFixture = await Test.createTestingModule({
			controllers: [ConflictProbeController],
		}).compile();

		const app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

		app.useGlobalFilters(...createGlobalExceptionFilters(buildConfigService()));

		await app.listen(0, '127.0.0.1');

		try {
			const response = await request(app.getHttpServer()).get('/conflict-probe').expect(409);
			const body = response.body as ErrorEnvelopeResponseBody;

			// Nest consults global filters last-registered-first and stops at the
			// first `@Catch()` match. `BadRequestExceptionFilter` is declared
			// `@Catch(HttpException)`, so it would otherwise match this
			// `ConflictException` too and send it back raw/un-enveloped — this
			// response only looks like this if `ConflictExceptionFilter` (appended
			// after it) was actually the one that handled it (D13, RA-27, #996).
			expect(body.error).toEqual({
				code: 'ConflictError',
				message: 'a setup job is already running',
				details: { reason: 'a setup job is already running', code: 'already-running' },
			});
			expect(body.status).toBe('error');
		} finally {
			await app.close();
		}
	});
});

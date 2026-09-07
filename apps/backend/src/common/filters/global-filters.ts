import { ExceptionFilter } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BadRequestExceptionFilter } from './bad-request-exception.filter';
import { ConflictExceptionFilter } from './conflict-exception.filter';
import { GlobalErrorFilter } from './global-error.filter';
import { InternalServerErrorExceptionFilter } from './internal-server-error-exception.filter';
import { NotFoundExceptionFilter } from './not-found-exception.filter';
import { QueryFailedExceptionFilter } from './query-failed-exception.filter';
import { UnprocessableEntityExceptionFilter } from './unprocessable-entity-exception.filter';

/**
 * The production global exception filter chain, shared by `main.ts` and by
 * e2e specs that need to observe the same response shapes production sends
 * (rather than Nest's raw default filter, which is what a testing module
 * gets when it registers no global filters at all).
 *
 * Nest consults global filters last-registered-first, and the first filter
 * whose `@Catch()` metadata matches wins (`RouterExceptionFilters.create()`
 * reverses the array before `selectExceptionFilterMetadata()` does a
 * `.find(...)` over it). `BadRequestExceptionFilter` is declared
 * `@Catch(HttpException)`, so it would otherwise match every `ConflictException`
 * too (and send it un-enveloped) unless `ConflictExceptionFilter` — a
 * dedicated, narrower `@Catch(ConflictException)` — is registered *after* it
 * in this array, which makes it tried *first* (D13, RA-27, #996).
 */
export function createGlobalExceptionFilters(configService: ConfigService): ExceptionFilter[] {
	return [
		new GlobalErrorFilter(),
		new InternalServerErrorExceptionFilter(),
		new BadRequestExceptionFilter(),
		new ConflictExceptionFilter(),
		new UnprocessableEntityExceptionFilter(),
		new NotFoundExceptionFilter(configService),
		new QueryFailedExceptionFilter(),
	];
}

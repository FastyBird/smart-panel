import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

import { ArgumentsHost, Catch, ConflictException, ExceptionFilter, HttpStatus } from '@nestjs/common';

import { RequestResultState } from '../../app.constants';

/**
 * Catches every `ConflictException` (409) and always emits the standard
 * `BaseErrorResponseModel` envelope, instead of the raw thrown body
 * `BadRequestExceptionFilter` would otherwise send for a non-400 status
 * (it is declared `@Catch(HttpException)` and matches first unless this
 * filter is registered after it — see `createGlobalExceptionFilters()`).
 *
 * `error.code` stays the coarse class code (`'ConflictError'`), matching
 * every other filter in this directory. The application-specific reason
 * code some call sites attach (e.g. `new ConflictException({ code:
 * 'operator-not-granted', message: '...' })`) travels in `error.details.code`
 * so it does not mix with the class-code vocabulary of `error.code`; a
 * string-thrown `ConflictException('...')` simply gets `error.details.reason`
 * with no `details.code` (D13, RA-27, #996).
 */
@Catch(ConflictException)
export class ConflictExceptionFilter implements ExceptionFilter {
	catch(exception: ConflictException, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const request = ctx.getRequest<Request>();
		const response = ctx.getResponse<Response>();
		const status = exception.getStatus() || HttpStatus.CONFLICT;
		const exceptionResponse = exception.getResponse();
		const requestId = uuidv4();

		const details: { reason: string; code?: string } = {
			reason: exception.message,
		};

		const applicationCode = this.extractApplicationCode(exceptionResponse);

		if (applicationCode !== undefined) {
			details.code = applicationCode;
		}

		return response
			.code(status)
			.type('application/json')
			.send({
				status: RequestResultState.ERROR,
				timestamp: new Date().toISOString(),
				request_id: requestId,
				path: request.originalUrl,
				method: request.method,
				error: {
					code: 'ConflictError',
					message: exception.message,
					details,
				},
				metadata: {
					server_time: new Date().toISOString(),
				},
			});
	}

	/**
	 * Passes an application reason code through only when the thrown response
	 * is a plain object carrying a string `code` — a string-thrown
	 * `ConflictException('some text')` (the shape of the 18 existing call
	 * sites across MCP OAuth, the update controller and Tailscale setup)
	 * has no such object and must keep working unchanged.
	 */
	private extractApplicationCode(exceptionResponse: unknown): string | undefined {
		if (typeof exceptionResponse === 'object' && exceptionResponse !== null && 'code' in exceptionResponse) {
			const code = (exceptionResponse as Record<string, unknown>).code;

			return typeof code === 'string' ? code : undefined;
		}

		return undefined;
	}
}

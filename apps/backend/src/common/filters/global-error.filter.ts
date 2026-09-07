import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

import { RequestResultState } from '../../app.constants';

/**
 * In the registered global filter chain (see `createGlobalExceptionFilters()`),
 * every `HttpException` subtype used in this app has its own dedicated filter
 * ahead of this one (`BadRequestExceptionFilter`, `ConflictExceptionFilter`,
 * `UnprocessableEntityExceptionFilter`, `NotFoundExceptionFilter`,
 * `InternalServerErrorExceptionFilter`), and Nest matches the first filter
 * whose `@Catch()` metadata fits. So this `@Catch()` catch-all only ever
 * actually handles non-`HttpException` errors (an unexpected thrown `Error`,
 * etc.) in practice — it still masks those as a generic 500 in production,
 * unchanged (D13, RA-27, #996).
 */
@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
	private readonly logger = new Logger(GlobalErrorFilter.name);

	catch(exception: unknown, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const request = ctx.getRequest<Request>();
		const response = ctx.getResponse<Response>();
		const requestId = uuidv4();

		// Handle known HTTP exceptions
		const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

		const errorMessage = exception instanceof HttpException ? exception.message : 'An unexpected error occurred.';

		let exceptionMessage: string;
		if (exception instanceof Error) {
			exceptionMessage = exception.message;
		} else if (typeof exception === 'object' && exception !== null) {
			try {
				exceptionMessage = JSON.stringify(exception);
			} catch {
				// Handle circular references, BigInt, or other non-serializable values
				exceptionMessage = Object.prototype.toString.call(exception) as string;
			}
		} else if (typeof exception === 'string') {
			exceptionMessage = exception;
		} else {
			exceptionMessage = 'Unknown error';
		}

		this.logger.error(
			`[ERROR] [GlobalErrorFilter] ${request.method} ${request.originalUrl} ${status} - ${exceptionMessage}`,
			exception instanceof Error ? exception.stack : undefined,
		);

		const errorResponse = {
			status: RequestResultState.ERROR,
			timestamp: new Date().toISOString(),
			request_id: requestId,
			path: request.originalUrl,
			method: request.method,
			error: {
				code: exception instanceof HttpException ? exception.name : 'InternalServerError',
				message: errorMessage,
				details: { reason: 'An unexpected server error occurred.' },
			},
			metadata: {
				server_time: new Date().toISOString(),
			},
		};

		response.code(status).type('application/json').send(errorResponse);
	}
}

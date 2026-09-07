import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, UnprocessableEntityException } from '@nestjs/common';

import { RequestResultState } from '../../app.constants';

@Catch(UnprocessableEntityException)
export class UnprocessableEntityExceptionFilter implements ExceptionFilter {
	catch(exception: UnprocessableEntityException, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const request = ctx.getRequest<Request>();
		const response = ctx.getResponse<Response>();
		const status = exception.getStatus() || HttpStatus.INTERNAL_SERVER_ERROR;
		const exceptionResponse = exception.getResponse() as {
			message: unknown; // Safely typing the response structure
		};
		const requestId = uuidv4();

		const details: { reason: unknown; code?: string } = {
			reason: exceptionResponse.message || `The data provided could not be processed in its current state.`,
		};

		// Application reason code pass-through (D13, RA-27, #996) — mirrors
		// `ConflictExceptionFilter`: only a plain object response carrying a
		// string `code` contributes one, so a string-thrown
		// `UnprocessableEntityException('...')` keeps working unchanged.
		const applicationCode = this.extractApplicationCode(exception.getResponse());

		if (applicationCode) {
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
					code: 'UnprocessableEntity',
					message: 'The request could not be processed due to semantic issues.',
					details,
				},
				metadata: {
					server_time: new Date().toISOString(),
				},
			});
	}

	private extractApplicationCode(exceptionResponse: unknown): string | undefined {
		if (typeof exceptionResponse === 'object' && exceptionResponse !== null && 'code' in exceptionResponse) {
			const code = (exceptionResponse as Record<string, unknown>).code;

			return typeof code === 'string' ? code : undefined;
		}

		return undefined;
	}
}

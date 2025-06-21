import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import os from 'os';
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
					details: {
						reason: exceptionResponse.message || `The data provided could not be processed in its current state.`,
					},
				},
				metadata: {
					server_time: new Date().toISOString(),
					cpu_usage: parseFloat(os.loadavg()[0].toFixed(2)),
				},
			});
	}
}

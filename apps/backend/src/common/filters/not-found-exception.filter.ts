import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

import { ArgumentsHost, Catch, ExceptionFilter, NotFoundException } from '@nestjs/common';

import { RequestResultState } from '../../app.constants';

@Catch(NotFoundException)
export class NotFoundExceptionFilter implements ExceptionFilter {
	catch(exception: NotFoundException, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const request = ctx.getRequest<Request>();
		const response = ctx.getResponse<Response>();
		const status = exception.getStatus();
		const requestId = uuidv4();

		const exceptionResponse = exception.getResponse() as { message?: string };

		response
			.code(status)
			.type('application/json')
			.send({
				status: RequestResultState.ERROR,
				timestamp: new Date().toISOString(),
				request_id: requestId,
				path: request.originalUrl,
				method: request.method,
				error: {
					code: 'NotFoundError',
					message: exceptionResponse.message || 'Resource not found.',
					details: {
						reason: exceptionResponse.message || `The requested resource could not be found.`,
					},
				},
				metadata: {
					server_time: new Date().toISOString(),
					cpu_usage: parseFloat(os.loadavg()[0].toFixed(2)),
				},
			});
	}
}

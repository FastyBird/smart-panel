import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, InternalServerErrorException } from '@nestjs/common';

import { RequestResultState } from '../../app.constants';

@Catch(InternalServerErrorException)
export class InternalServerErrorExceptionFilter implements ExceptionFilter {
	catch(exception: InternalServerErrorException, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const request = ctx.getRequest<Request>();
		const response = ctx.getResponse<Response>();
		const status = exception.getStatus() || HttpStatus.INTERNAL_SERVER_ERROR;
		const requestId = uuidv4();
		console.log('ERROR', exception);
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
					code: 'InternalServerError',
					message: 'An unexpected error occurred.',
					details: {
						reason: 'Something went wrong on our side.',
					},
				},
				metadata: {
					server_time: new Date().toISOString(),
					cpu_usage: parseFloat(os.loadavg()[0].toFixed(2)),
				},
			});
	}
}

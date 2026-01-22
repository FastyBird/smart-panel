import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

import { RequestResultState } from '../../app.constants';

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
				exceptionMessage = Object.prototype.toString.call(exception);
			}
		} else if (typeof exception === 'string') {
			exceptionMessage = exception;
		} else {
			exceptionMessage = 'Unknown error';
		}

		this.logger.error(
			`[ERROR] [GlobalErrorFilter] ${exceptionMessage}`,
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
				details:
					exception instanceof HttpException
						? exception.getResponse()
						: { reason: 'An unexpected server error occurred.' },
			},
			metadata: {
				server_time: new Date().toISOString(),
				cpu_usage: parseFloat(os.loadavg()[0].toFixed(2)),
			},
		};

		response.code(status).type('application/json').send(errorResponse);
	}
}

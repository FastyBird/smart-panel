import { Request, Response } from 'express';
import os from 'os';
import { QueryFailedError } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';

import { RequestResultState } from '../../app.constants';

@Catch(QueryFailedError)
export class QueryFailedExceptionFilter implements ExceptionFilter {
	catch(exception: QueryFailedError, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const request = ctx.getRequest<Request>();
		const response: Response = ctx.getResponse<Response>();
		const status = this.getHttpStatus(exception);
		const requestId = uuidv4();

		return response.status(status).json({
			status: RequestResultState.ERROR,
			timestamp: new Date().toISOString(),
			request_id: requestId,
			path: request.originalUrl,
			method: request.method,
			error: {
				code: status === HttpStatus.CONFLICT ? 'ConflictError' : 'InternalServerError',
				message: status === HttpStatus.CONFLICT ? 'A conflict occurred.' : 'An internal server error occurred.',
				details: this.parseErrorDetails(exception),
			},
			metadata: {
				server_time: new Date().toISOString(),
				cpu_usage: parseFloat(os.loadavg()[0].toFixed(2)),
			},
		});
	}

	private getHttpStatus(exception: QueryFailedError): HttpStatus {
		const driverError = exception.driverError as { message?: string };
		if (driverError?.message && this.isUniqueConstraintError(driverError.message)) {
			return HttpStatus.CONFLICT;
		}
		return HttpStatus.INTERNAL_SERVER_ERROR;
	}

	private parseErrorDetails(exception: QueryFailedError): Record<string, string> | { reason: string } {
		const driverError = exception.driverError as { message?: string };

		if (driverError?.message && this.isUniqueConstraintError(driverError.message)) {
			const match = driverError.message.match(/UNIQUE constraint failed: ([\w.]+)/);
			if (match && match[1]) {
				return {
					reason: 'Duplicate entry detected.',
				};
			}
		}

		return {
			reason: 'Unhandled database error.',
		};
	}

	private isUniqueConstraintError(message: string): boolean {
		return message.includes('UNIQUE constraint failed');
	}
}

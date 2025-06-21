import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

import { RequestResultState } from '../../app.constants';
import { IValidationResult } from '../../app.interfaces';

@Catch(HttpException)
export class BadRequestExceptionFilter implements ExceptionFilter {
	catch(exception: HttpException, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const request = ctx.getRequest<Request>();
		const response = ctx.getResponse<Response>();
		const status: HttpStatus = exception.getStatus();
		const exceptionResponse = exception.getResponse() as {
			message: unknown; // Safely typing the response structure
		};
		const requestId = uuidv4();

		if (status === HttpStatus.BAD_REQUEST && Array.isArray(exceptionResponse.message)) {
			const details: IValidationResult[] = exceptionResponse.message.flatMap((msg: unknown) => {
				try {
					const parsedMsg = JSON.parse(msg as string) as IValidationResult | IValidationResult[];
					return Array.isArray(parsedMsg) ? parsedMsg : [parsedMsg];
				} catch {
					return [{ field: 'unknown', reason: msg }] as IValidationResult[];
				}
			});

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
						code: 'BadRequestError',
						message: 'One or more parameters failed validation.',
						details,
					},
					metadata: {
						server_time: new Date().toISOString(),
						cpu_usage: parseFloat(os.loadavg()[0].toFixed(2)),
					},
				});
		} else if (status === HttpStatus.BAD_REQUEST) {
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
						code: 'BadRequestError',
						message: 'The request could not be processed due to invalid input.',
						details: {
							reason: exceptionResponse.message || `The provided input is invalid or incomplete.`,
						},
					},
					metadata: {
						server_time: new Date().toISOString(),
						cpu_usage: parseFloat(os.loadavg()[0].toFixed(2)),
					},
				});
		}

		response.code(status).type('application/json').send(exceptionResponse);
	}
}

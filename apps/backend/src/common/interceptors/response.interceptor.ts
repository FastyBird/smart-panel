import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import os from 'os';
import { Observable, map } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { CallHandler, ExecutionContext, HttpStatus, Injectable, NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RequestResultState } from '../../app.constants';
import { getResponseMeta } from '../utils/http.utils';

export const SKIP_APPLICATION_INTERCEPTOR = 'skipApplicationInterceptor';
export const SkipApplicationInterceptor = () => SetMetadata(SKIP_APPLICATION_INTERCEPTOR, true);

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
	constructor(private readonly reflector: Reflector) {}

	intercept(context: ExecutionContext, next: CallHandler<T>): Observable<any> {
		const skip = this.reflector.get<boolean>('skipApplicationInterceptor', context.getHandler());

		if (skip) {
			return next.handle();
		}

		const request = context.switchToHttp().getRequest<Request>();
		const response = context.switchToHttp().getResponse<Response>();
		const startTime = Date.now();
		const requestId = uuidv4();

		return next.handle().pipe(
			map((data) => {
				const responseTime = Date.now() - startTime;
				if (request.method === 'DELETE') {
					response.status(HttpStatus.NO_CONTENT);

					return null;
				}

				return {
					status: RequestResultState.SUCCESS,
					timestamp: new Date().toISOString(),
					request_id: requestId,
					path: request.originalUrl,
					method: request.method,
					data,
					metadata: {
						...(getResponseMeta(request) ?? {}),
						request_duration_ms: responseTime,
						server_time: new Date().toISOString(),
						cpu_usage: parseFloat(os.loadavg()[0].toFixed(2)),
					},
				};
			}),
		);
	}
}

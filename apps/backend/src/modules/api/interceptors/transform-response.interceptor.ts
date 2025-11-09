import { instanceToPlain } from 'class-transformer';
import { FastifyReply } from 'fastify';
import { Observable, map } from 'rxjs';

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RAW_ROUTE } from '../decorators/raw-route.decorator';

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
	constructor(private readonly reflector: Reflector) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const http = context.switchToHttp();
		const reply = http.getResponse<FastifyReply>();

		const isRaw = this.reflector.get<boolean>(RAW_ROUTE, context.getHandler());

		if (isRaw || reply.sent) {
			return next.handle();
		}

		return next.handle().pipe(
			map((data) => {
				return instanceToPlain(data, {
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
					ignoreDecorators: false,
					groups: ['api'],
					enableCircularCheck: true,
				});
			}),
		);
	}
}

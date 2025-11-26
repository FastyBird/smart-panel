import { instanceToPlain } from 'class-transformer';
import { FastifyReply, FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import { Observable, map } from 'rxjs';

import { CallHandler, ExecutionContext, HttpStatus, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RequestResultState } from '../../../app.constants';
import { BaseSuccessResponseModel } from '../../../common/dto/response.dto';
import { RAW_ROUTE } from '../decorators/raw-route.decorator';
import { ResponseMetadataService } from '../services/response-metadata.service';

@Injectable()
export class OpenApiResponseInterceptor<T> implements NestInterceptor<T, any> {
	constructor(
		private readonly reflector: Reflector,
		private readonly metadataService: ResponseMetadataService,
	) {}

	intercept(context: ExecutionContext, next: CallHandler<T>): Observable<any> {
		const http = context.switchToHttp();
		const reply = http.getResponse<FastifyReply>();

		const isRaw = this.reflector.get<boolean>(RAW_ROUTE, context.getHandler());

		if (isRaw || reply.sent) {
			return next.handle();
		}

		const request = context.switchToHttp().getRequest<Request>();
		const response = context.switchToHttp().getResponse<Response>();
		const metadataContext = this.metadataService.createContext();

		return next.handle().pipe(
			map((data) => {
				if (request.method === 'DELETE') {
					response.status(HttpStatus.NO_CONTENT);

					return null;
				}

				// Safer detection: use instanceof or check for BaseSuccessResponseModel properties
				const isWrapped =
					data instanceof BaseSuccessResponseModel ||
					(data && typeof data === 'object' && 'data' in data && 'status' in data && 'metadata' in data);
				if (isWrapped) {
					const responseModel = instanceToPlain(data, {
						excludeExtraneousValues: true,
						exposeUnsetFields: false,
					}) as BaseSuccessResponseModel<unknown>;

					// Merge metadata from service with existing metadata
					const merged = this.metadataService.mergeMetadata(responseModel.data, request, metadataContext);

					// Use class-transformer to serialize the response
					return merged;
				}

				const plain = instanceToPlain(data, {
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
				})

				// For plain responses, create a new BaseSuccessResponseModel instance
				const metadata = this.metadataService.extractMetadata(request, metadataContext);
				const responseModel = Object.assign(new BaseSuccessResponseModel(), {
					status: RequestResultState.SUCCESS,
					...metadata,
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					data: typeof plain === 'object' && 'data' in plain ? plain.data : plain,
				});

				// Use class-transformer to serialize the response
				return responseModel;
			}),
		);
	}
}

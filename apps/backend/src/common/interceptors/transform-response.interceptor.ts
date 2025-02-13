import { instanceToPlain } from 'class-transformer';
import { isArray, isObject } from 'class-validator';
import { Observable, map } from 'rxjs';

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		return next.handle().pipe(
			map((data) => {
				// Helper function to check and transform a single item
				const transformItem = (item: unknown) =>
					item?.constructor?.name && typeof item === 'object' && item.constructor.name !== 'Object'
						? instanceToPlain(item, { exposeUnsetFields: false, ignoreDecorators: false, groups: ['api'] })
						: item;

				// Handle arrays by mapping each item through the transformation logic
				if (isArray(data)) {
					return data.map(transformItem) as unknown;
				}

				// Handle single objects
				return (isObject(data) ? transformItem(data) : data) as unknown;
			}),
		);
	}
}

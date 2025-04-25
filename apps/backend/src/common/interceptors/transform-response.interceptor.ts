import { instanceToPlain } from 'class-transformer';
import { Observable, map } from 'rxjs';

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
	intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
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

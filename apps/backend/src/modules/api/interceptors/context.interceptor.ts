import { ClsService } from 'nestjs-cls';

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';

@Injectable()
export class ContextInterceptor implements NestInterceptor {
	constructor(private readonly cls: ClsService) {}

	intercept(context: ExecutionContext, next: CallHandler<any>) {
		const req = context.switchToHttp().getRequest();

		return this.cls.run(() => {
			this.cls.set('req', req);

			return next.handle();
		});
	}
}

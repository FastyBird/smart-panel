import { Observable, tap } from 'rxjs';

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';

import { ApiMetricsService } from '../services/api-metrics.service';

@Injectable()
export class ApiMetricsInterceptor implements NestInterceptor {
	constructor(private readonly metrics: ApiMetricsService) {}
	intercept(_ctx: ExecutionContext, next: CallHandler): Observable<any> {
		const started = Date.now();

		return next.handle().pipe(
			tap({
				next: () => this.metrics.record(Date.now() - started, false),
				error: () => this.metrics.record(Date.now() - started, true),
			}),
		);
	}
}

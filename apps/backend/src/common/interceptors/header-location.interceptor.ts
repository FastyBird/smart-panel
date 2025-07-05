import { FastifyReply as Response } from 'fastify';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { API_PREFIX } from '../../app.constants';
import { getEnvValue } from '../utils/config.utils';

@Injectable()
export class HeaderLocationInterceptor implements NestInterceptor {
	private readonly appHost: string;
	private readonly appPort: number;

	constructor(private readonly configService: NestConfigService) {
		this.appHost = getEnvValue<string>(this.configService, 'FB_APP_HOST', 'https://localhost');
		this.appPort = getEnvValue<number>(this.configService, 'FB_BACKEND_PORT', 3000);
	}

	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const httpContext = context.switchToHttp();
		const request: Request = httpContext.getRequest<Request>();
		const response: Response = httpContext.getResponse<Response>();

		// Extract a version dynamically from request URL (assuming format "/api/vX/...")
		const versionMatch = request.url.match(new RegExp(`/${API_PREFIX}/(v\\d+)`));
		const version = versionMatch ? versionMatch[1] : 'v1'; // Default to v1 if not found

		const fullBaseUrl = `${this.appHost}:${this.appPort}/${API_PREFIX}/v${version}`;

		return next.handle().pipe(
			map((data: Record<string, any>) => {
				const locationHeader = response.getHeader('Location') as string | undefined;

				if (locationHeader) {
					let updatedLocation = locationHeader.replace(':baseUrl', fullBaseUrl);

					const placeholders = updatedLocation.match(/:(\w+)/g); // Match all :placeholders

					if (placeholders) {
						placeholders.forEach((placeholder) => {
							const key = placeholder.slice(1); // Remove the leading ':'
							const value = data[key] as string | undefined; // Try to find the value in the response data

							if (value) {
								updatedLocation = updatedLocation.replace(placeholder, String(value));
							}
						});
					}

					// Update the Location header
					response.header('Location', updatedLocation);
				}

				return data; // Pass the original data to the response
			}),
		);
	}
}

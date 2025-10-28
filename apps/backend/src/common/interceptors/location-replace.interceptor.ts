import { FastifyReply as Response } from 'fastify';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { API_PREFIX } from '../../app.constants';
import { getEnvValue } from '../utils/config.utils';

type JsonPrimitive = string | number | boolean | null;

type JsonValue = JsonPrimitive | JsonObject | Array<JsonValue>;

interface JsonObject {
	[k: string]: JsonValue;
}

@Injectable()
export class LocationReplaceInterceptor implements NestInterceptor {
	private readonly appHost: string;
	private readonly appPort: number;

	constructor(private readonly configService: NestConfigService) {
		this.appHost = getEnvValue<string>(this.configService, 'FB_APP_HOST', 'http://localhost');
		this.appPort = getEnvValue<number>(this.configService, 'FB_BACKEND_PORT', 3000);
	}

	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const httpContext = context.switchToHttp();
		const request: Request = httpContext.getRequest<Request>();
		const response: Response = httpContext.getResponse<Response>();

		// Extract a version dynamically from request URL (assuming format "/api/vX/...")
		const versionMatch = request.url.match(new RegExp(`/${API_PREFIX}/(v\\d+)`));
		const version = versionMatch ? versionMatch[1] : 'v1'; // Default to v1 if not found

		const fullBaseUrl = `${this.appHost}:${this.appPort}/${API_PREFIX}/${version}`;

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

				return this.deepReplace(data, fullBaseUrl);
			}),
		);
	}

	private deepReplace(value: unknown, fullBaseUrl: string, depth = 0): unknown {
		if (depth > 10) {
			return value;
		}

		if (
			value === null ||
			typeof value === 'number' ||
			typeof value === 'boolean' ||
			value instanceof Date ||
			(typeof Buffer !== 'undefined' && Buffer.isBuffer(value))
		) {
			return value;
		}

		if (typeof value === 'string') {
			return value.replace(':baseUrl', fullBaseUrl);
		}

		if (Array.isArray(value)) {
			const out: Array<JsonValue> = [];

			for (const el of value) {
				out.push(this.deepReplace(el, fullBaseUrl, depth + 1) as JsonValue);
			}

			return out;
		}

		if (typeof value === 'object') {
			for (const [k, v] of Object.entries(value)) {
				value[k] = this.deepReplace(v, fullBaseUrl, depth + 1) as JsonValue;
			}
		}

		return value;
	}
}

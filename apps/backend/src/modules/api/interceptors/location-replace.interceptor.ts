import { FastifyReply as Response } from 'fastify';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { API_PREFIX } from '../../../app.constants';
import { getEnvValue } from '../../../common/utils/config.utils';

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
			map((data: Record<string, any> | null | undefined) => {
				const locationHeader = response.getHeader('Location') as string | undefined;

				if (locationHeader) {
					let updatedLocation = locationHeader.replace(':baseUrl', fullBaseUrl);

					const placeholders = updatedLocation.match(/:([A-Za-z_]\w*)/g); // Match named :placeholders, not ports

					if (placeholders && data !== null && typeof data === 'object') {
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
			let changed = false;
			const out: Array<JsonValue> = [];

			for (const el of value as unknown[]) {
				const replaced = this.deepReplace(el, fullBaseUrl, depth + 1) as JsonValue;

				changed ||= replaced !== el;
				out.push(replaced);
			}

			// Identity is preserved when nothing was replaced, so an untouched array nested in a frozen
			// object is not mistaken for a change that has to be written back.
			return changed ? out : value;
		}

		if (typeof value === 'object') {
			const record = value as Record<string, unknown>;
			const replacements: [string, unknown][] = [];

			for (const [k, v] of Object.entries(record)) {
				const replaced = this.deepReplace(v, fullBaseUrl, depth + 1);

				if (replaced !== v) {
					replacements.push([k, replaced]);
				}
			}

			if (replacements.length === 0) {
				return value;
			}

			// Responses may carry frozen objects (shared catalogs, immutable previews). Writing to one
			// throws in strict mode and turned an otherwise successful request into a 500, so such an
			// object is copied instead — and only when something in it actually changed. The decision is
			// made for the object as a whole, before anything is written: every replacement lands in the
			// copy, and the original is left exactly as it was.
			const immutable =
				Object.isFrozen(record) || replacements.some(([k]) => !Object.getOwnPropertyDescriptor(record, k)?.writable);
			const target = immutable
				? Object.assign(
						Object.create(Object.getPrototypeOf(record) as object | null) as Record<string, unknown>,
						record,
					)
				: record;

			for (const [k, replaced] of replacements) {
				// A copied non-writable property keeps its descriptor only on the original; on the copy it
				// is an ordinary data property, so plain assignment is enough.
				target[k] = replaced;
			}

			return target;
		}

		return value;
	}
}

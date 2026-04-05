import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import { createReadStream, existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { ArgumentsHost, Catch, ExceptionFilter, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RequestResultState } from '../../app.constants';
import { getEnvValue } from '../utils/config.utils';

@Catch(NotFoundException)
export class NotFoundExceptionFilter implements ExceptionFilter {
	private readonly indexPath: string | null;

	constructor(private readonly configService: ConfigService) {
		const staticRoot = getEnvValue<string>(
			configService,
			'FB_ADMIN_UI_PATH',
			path.resolve(__dirname, '../../../static'),
		);
		const resolved = path.join(staticRoot, 'index.html');

		this.indexPath = existsSync(resolved) ? resolved : null;
	}

	catch(exception: NotFoundException, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const request = ctx.getRequest<Request>();
		const response = ctx.getResponse<Response>();
		const url = request.url;

		// SPA fallback: serve index.html for non-API routes (frontend deep links)
		if (this.indexPath && !url.startsWith('/api/') && !url.startsWith('/socket.io/')) {
			void response.type('text/html').send(createReadStream(this.indexPath));

			return;
		}

		// API 404: return JSON error
		const status = exception.getStatus();
		const requestId = uuidv4();
		const exceptionResponse = exception.getResponse() as { message?: string };

		response
			.code(status)
			.type('application/json')
			.send({
				status: RequestResultState.ERROR,
				timestamp: new Date().toISOString(),
				request_id: requestId,
				path: request.originalUrl,
				method: request.method,
				error: {
					code: 'NotFoundError',
					message: exceptionResponse.message || 'Resource not found.',
					details: {
						reason: exceptionResponse.message || `The requested resource could not be found.`,
					},
				},
				metadata: {
					server_time: new Date().toISOString(),
					cpu_usage: parseFloat(os.loadavg()[0].toFixed(2)),
				},
			});
	}
}

import { FastifyRequest } from 'fastify';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

import { Injectable } from '@nestjs/common';

import { SuccessMetadataDto } from '../../../common/dto/response.dto';
import { getResponseMeta } from '../../../common/utils/http.utils';

export interface ResponseMetadataContext {
	startTime: number;
	requestId: string;
}

export interface ResponseMetadataResult {
	timestamp: string;
	request_id: string;
	path: string;
	method: string;
	metadata: SuccessMetadataDto;
}

@Injectable()
export class ResponseMetadataService {
	/**
	 * Create a new metadata context for tracking request timing and ID
	 */
	createContext(): ResponseMetadataContext {
		return {
			startTime: Date.now(),
			requestId: uuidv4(),
		};
	}

	/**
	 * Extract response metadata from request and context
	 */
	extractMetadata(request: FastifyRequest, context: ResponseMetadataContext): ResponseMetadataResult {
		const responseTime = Date.now() - context.startTime;
		const customMeta = getResponseMeta(request) ?? {};

		return {
			timestamp: new Date().toISOString(),
			request_id: context.requestId,
			path: request.originalUrl,
			method: request.method,
			metadata: {
				...customMeta,
				request_duration_ms: responseTime,
				server_time: new Date().toISOString(),
				cpu_usage: parseFloat(os.loadavg()[0].toFixed(2)),
			} as SuccessMetadataDto,
		};
	}

	/**
	 * Merge metadata into an existing response object
	 */
	mergeMetadata<T extends { metadata?: SuccessMetadataDto }>(
		response: T,
		request: FastifyRequest,
		context: ResponseMetadataContext,
	): T & ResponseMetadataResult {
		const extracted = this.extractMetadata(request, context);
		const existingMeta = response.metadata || {};

		return {
			...response,
			...extracted,
			metadata: {
				...existingMeta,
				...extracted.metadata,
			} as SuccessMetadataDto,
		};
	}
}

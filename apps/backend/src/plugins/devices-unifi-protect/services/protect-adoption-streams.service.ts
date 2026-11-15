import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ProtectApiClient } from '../client/protect-api.client';
import {
	DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	PROTECT_RTSPS_QUALITIES,
	ProtectRtspsQuality,
	ProtectStreamQuality,
} from '../devices-unifi-protect.constants';
import { ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';
import { ProtectStreamAvailability, toStreamAvailability } from '../mappings/mapping-evaluator';
import { ProtectStreamOutcome } from '../models/protect-adoption.model';

export { ProtectStreamOutcome };

export interface ProtectStreamEnablementResult {
	outcome: ProtectStreamOutcome;
	quality: ProtectStreamQuality | null;
	/** Quality names only, canonical order. */
	enabledQualities: ProtectRtspsQuality[];
	failureCategory: ProtectErrorCategory | null;
	/** For the camera status values; presence booleans, never URLs. */
	availability: ProtectStreamAvailability | null;
}

export interface ProtectStreamRequest {
	quality: ProtectStreamQuality;
	packageCamera: boolean;
}

const enabledOf = (availability: ProtectStreamAvailability): ProtectRtspsQuality[] =>
	PROTECT_RTSPS_QUALITIES.filter((quality) => availability[quality]);

@Injectable()
export class ProtectAdoptionStreamsService {
	private readonly logger = createExtensionLogger(DEVICES_UNIFI_PROTECT_PLUGIN_NAME, 'ProtectAdoptionStreamsService');

	/**
	 * Enables the wanted RTSPS qualities without switching off any stream another integration created. The console
	 * answers carry bearer aliases: they are reduced to booleans in the statement that reads them. Never rejects.
	 */
	async ensureStreams(
		client: ProtectApiClient,
		cameraId: string,
		request: ProtectStreamRequest,
	): Promise<ProtectStreamEnablementResult> {
		const result = await this.run(client, cameraId, request);

		this.logger.log(`RTSPS stream enablement finished (${result.outcome})`);

		return result;
	}

	private async run(
		client: ProtectApiClient,
		cameraId: string,
		request: ProtectStreamRequest,
	): Promise<ProtectStreamEnablementResult> {
		const wanted: ProtectRtspsQuality[] = [request.quality, ...(request.packageCamera ? (['package'] as const) : [])];
		let current: ProtectStreamAvailability;

		try {
			current = toStreamAvailability(await client.getRtspsStreams(cameraId));
		} catch (error) {
			return this.failed(request, this.categoryOf(error), null);
		}

		if (wanted.every((quality) => current[quality])) {
			return this.done(ProtectStreamOutcome.ALREADY_ENABLED, request, current);
		}

		const body = PROTECT_RTSPS_QUALITIES.filter((quality) => current[quality] || wanted.includes(quality));

		try {
			const created = toStreamAvailability(await client.createRtspsStreams(cameraId, body));

			if (wanted.every((quality) => created[quality])) {
				return this.done(ProtectStreamOutcome.ENABLED, request, created);
			}

			return this.failed(request, ProtectErrorCategory.PROTOCOL, null);
		} catch (error) {
			const category = this.categoryOf(error);

			if (category !== ProtectErrorCategory.BAD_REQUEST && category !== ProtectErrorCategory.PROTOCOL) {
				return this.failed(request, category, null);
			}

			// 400/409: the streams may already exist; one re-read decides.
			try {
				const reread = toStreamAvailability(await client.getRtspsStreams(cameraId));

				if (wanted.every((quality) => reread[quality])) {
					return this.done(ProtectStreamOutcome.ALREADY_ENABLED, request, reread);
				}
			} catch {
				// The POST's category is the reported failure.
			}

			return this.failed(request, category, null);
		}
	}

	private done(
		outcome: ProtectStreamOutcome,
		request: ProtectStreamRequest,
		availability: ProtectStreamAvailability,
	): ProtectStreamEnablementResult {
		return {
			outcome,
			quality: request.quality,
			enabledQualities: enabledOf(availability),
			failureCategory: null,
			availability,
		};
	}

	private failed(
		request: ProtectStreamRequest,
		category: ProtectErrorCategory,
		availability: ProtectStreamAvailability | null,
	): ProtectStreamEnablementResult {
		return {
			outcome: ProtectStreamOutcome.FAILED,
			quality: request.quality,
			enabledQualities: [],
			failureCategory: category,
			availability,
		};
	}

	private categoryOf(error: unknown): ProtectErrorCategory {
		return error instanceof ProtectApiError ? error.category : ProtectErrorCategory.UNAVAILABLE;
	}
}

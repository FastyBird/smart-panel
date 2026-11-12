import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DeviceCategory, DeviceHiddenFilter } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { DevicesService } from '../../devices/services/devices.service';
import { CAMERAS_MODULE_NAME } from '../cameras.constants';
import {
	CameraOfflineException,
	CameraProfileUnavailableException,
	CameraRateLimitedException,
	CamerasNotFoundException,
	sanitizeProviderError,
} from '../cameras.exceptions';
import { CameraModel, CameraStreamProfileModel } from '../models/camera.model';
import { CameraStreamProfile, ICameraStreamProvider } from '../platforms/camera-stream.provider';

import { CameraStreamProviderRegistryService } from './camera-stream-provider.registry.service';

export const CAMERA_PROVIDER_TIMEOUT_MS = 10_000;

const CAMERA_CATEGORIES: DeviceCategory[] = [DeviceCategory.CAMERA, DeviceCategory.DOORBELL];

export class CameraProviderTimeoutError extends Error {
	constructor() {
		super('Camera provider call timed out');
		this.name = 'CameraProviderTimeoutError';
	}
}

@Injectable()
export class CamerasService {
	private readonly logger = createExtensionLogger(CAMERAS_MODULE_NAME, 'CamerasService');

	constructor(
		private readonly devicesService: DevicesService,
		private readonly registry: CameraStreamProviderRegistryService,
	) {}

	/** Lists visible camera devices only; a hidden device stays reachable by its id. */
	async findAll(): Promise<CameraModel[]> {
		const devices = (await this.devicesService.findAll(undefined, DeviceHiddenFilter.FALSE)).filter((device) =>
			CAMERA_CATEGORIES.includes(device.category),
		);

		return Promise.all(devices.map((device) => this.toModel(device, this.registry.get(device))));
	}

	async getOneOrThrow(deviceId: string): Promise<{ device: DeviceEntity; provider: ICameraStreamProvider | null }> {
		const device = await this.devicesService.findOne(deviceId);

		if (!device || !CAMERA_CATEGORIES.includes(device.category)) {
			throw new CamerasNotFoundException(`Camera ${deviceId} not found`);
		}

		return { device, provider: this.registry.get(device) };
	}

	async getProviderOrThrow(deviceId: string): Promise<{ device: DeviceEntity; provider: ICameraStreamProvider }> {
		const { device, provider } = await this.getOneOrThrow(deviceId);

		if (!provider) {
			throw new CamerasNotFoundException(`Camera ${deviceId} does not support live view`);
		}

		return { device, provider };
	}

	/** Picks the requested profile, or the first available one; the profile must be available. */
	async resolveProfile(
		device: DeviceEntity,
		provider: ICameraStreamProvider,
		profileId?: string,
	): Promise<CameraStreamProfile> {
		const profiles = await this.withTimeout(device.id, () => provider.listProfiles(device));

		const profile = profileId ? profiles.find((p) => p.id === profileId) : profiles.find((p) => p.available);

		if (!profile || !profile.available) {
			throw new CameraProfileUnavailableException(
				profileId ? 'Stream profile is not available' : 'No stream profile is available',
			);
		}

		return profile;
	}

	/**
	 * Looks a profile up by id regardless of its availability. Used by snapshots, which work without an enabled stream.
	 */
	async findProfileById(
		device: DeviceEntity,
		provider: ICameraStreamProvider,
		profileId: string,
	): Promise<CameraStreamProfile> {
		const profiles = await this.withTimeout(device.id, () => provider.listProfiles(device));
		const profile = profiles.find((p) => p.id === profileId);

		if (!profile) {
			throw new CameraProfileUnavailableException('Stream profile is not available');
		}

		return profile;
	}

	async toModel(device: DeviceEntity, provider: ICameraStreamProvider | null): Promise<CameraModel> {
		const model = new CameraModel();

		model.deviceId = device.id;
		model.name = device.name;
		model.category = device.category;
		model.type = device.type;
		model.liveView = provider !== null;
		model.profiles = [];

		if (provider) {
			try {
				const profiles = await this.withTimeout(device.id, () => provider.listProfiles(device));

				model.profiles = profiles.map((profile) => this.toProfileModel(profile));
			} catch (error) {
				// Never log the error message: a provider may embed a source URL in it.
				this.logger.warn(
					`Failed to list camera profiles deviceId=${device.id} error=${error instanceof Error ? error.name : 'UnknownError'}`,
				);
			}
		}

		return model;
	}

	private toProfileModel(profile: CameraStreamProfile): CameraStreamProfileModel {
		const model = new CameraStreamProfileModel();

		model.id = profile.id;
		model.channelId = profile.channelId ?? null;
		model.width = profile.width ?? null;
		model.height = profile.height ?? null;
		model.fps = profile.fps ?? null;
		model.videoCodec = profile.videoCodec ?? null;
		model.audioCodec = profile.audioCodec ?? null;
		model.available = profile.available;
		model.unavailableReason = profile.unavailableReason ?? null;

		return model;
	}

	private async withTimeout<T>(deviceId: string, call: () => Promise<T>): Promise<T> {
		let timer: NodeJS.Timeout | undefined;

		try {
			return await Promise.race([
				call(),
				new Promise<never>((_, reject) => {
					timer = setTimeout(() => reject(new CameraProviderTimeoutError()), CAMERA_PROVIDER_TIMEOUT_MS);
					timer.unref();
				}),
			]);
		} catch (error) {
			if (error instanceof CameraProviderTimeoutError) {
				throw error;
			}

			// Only offline, rate limited and profile unavailable keep their meaning. Never log or forward the error
			// message: a provider may embed a source URL in it.
			if (
				!(
					error instanceof CameraOfflineException ||
					error instanceof CameraRateLimitedException ||
					error instanceof CameraProfileUnavailableException
				)
			) {
				this.logger.warn(
					`Camera provider call failed deviceId=${deviceId} error=${error instanceof Error ? error.name : 'UnknownError'}`,
				);
			}

			throw sanitizeProviderError(error);
		} finally {
			if (timer) clearTimeout(timer);
		}
	}
}

import { Injectable } from '@nestjs/common';

import { ConfigService } from '../../../modules/config/services/config.service';
import {
	DeviceValidationService,
	ValidationIssueSeverity,
} from '../../../modules/devices/services/device-validation.service';
import { PROTECT_RTSPS_QUALITIES } from '../devices-unifi-protect.constants';
import { ProtectUnsupportedDeviceError } from '../errors/protect-adoption.error';
import {
	ProtectMappedDevice,
	ProtectMappingWarningCode,
	ProtectStreamAvailability,
	evaluateProtectMapping,
	toStreamAvailability,
	toValidationInput,
} from '../mappings/mapping-evaluator';
import { ProtectMappingLoaderService } from '../mappings/mapping-loader.service';
import { ProtectModelKey } from '../mappings/mapping.types';
import {
	ProtectMappingPreviewChannelModel,
	ProtectMappingPreviewDeviceModel,
	ProtectMappingPreviewModel,
	ProtectMappingPreviewPropertyModel,
	ProtectMappingPreviewStreamModel,
	ProtectMappingPreviewWarningModel,
	ProtectPreviewWarningCode,
	ProtectPreviewWarningSeverity,
} from '../models/protect-mapping-preview.model';

import { readDefaultStreamQuality } from './protect-default-stream-quality';
import { ProtectFreshDevice, ProtectInventoryService } from './protect-inventory.service';

export interface ProtectPreparedMapping {
	fresh: ProtectFreshDevice;
	device: ProtectMappedDevice;
	streams: ProtectStreamAvailability | null;
	warnings: ProtectMappingPreviewWarningModel[];
	readyToAdopt: boolean;
}

const HEVC_CODEC = /^(h265|hevc)$/i;

const warning = (
	code: ProtectPreviewWarningCode,
	severity: ProtectPreviewWarningSeverity,
	identifier: string | null,
): ProtectMappingPreviewWarningModel =>
	Object.assign(new ProtectMappingPreviewWarningModel(), { code, severity, identifier });

@Injectable()
export class ProtectMappingPreviewService {
	constructor(
		private readonly inventory: ProtectInventoryService,
		private readonly mappingLoader: ProtectMappingLoaderService,
		private readonly deviceValidation: DeviceValidationService,
		private readonly configService: ConfigService,
	) {}

	/** Fresh reads of the device (and of its streams for a camera); throws the adoption errors. */
	async prepare(deviceId: string, modelKey: ProtectModelKey): Promise<ProtectPreparedMapping> {
		const fresh = await this.inventory.fetchDevice(deviceId, modelKey);
		const raw = fresh.entry.raw;
		const streams = modelKey === 'camera' ? await this.readStreams(fresh, deviceId) : null;
		const result = this.evaluate(fresh, streams);

		if (!result.ok) {
			throw new ProtectUnsupportedDeviceError();
		}

		const warnings: ProtectMappingPreviewWarningModel[] = [];
		const info = ProtectPreviewWarningSeverity.INFO;
		const caution = ProtectPreviewWarningSeverity.WARNING;

		if (raw.state !== 'CONNECTED') {
			warnings.push(warning(ProtectPreviewWarningCode.DEVICE_DISCONNECTED, caution, null));
		}

		if (raw.isThirdPartyCamera === true) {
			warnings.push(warning(ProtectPreviewWarningCode.THIRD_PARTY_CAMERA, info, null));
		}

		if (modelKey === 'camera') {
			if (streams === null) {
				warnings.push(warning(ProtectPreviewWarningCode.STREAM_STATE_UNKNOWN, caution, null));
			} else {
				if (!streams.high && !streams.medium && !streams.low) {
					warnings.push(warning(ProtectPreviewWarningCode.STREAM_NOT_ENABLED, caution, 'camera.main'));
				}

				if (raw.hasPackageCamera === true && !streams.package) {
					warnings.push(warning(ProtectPreviewWarningCode.STREAM_NOT_ENABLED, caution, 'camera.package'));
				}
			}
		}

		if (typeof raw.videoCodec === 'string' && HEVC_CODEC.test(raw.videoCodec)) {
			warnings.push(warning(ProtectPreviewWarningCode.HEVC_CODEC, caution, null));
		}

		for (const detection of result.warnings) {
			if (detection.code === ProtectMappingWarningCode.UNSUPPORTED_DETECTION_TYPE) {
				warnings.push(warning(ProtectPreviewWarningCode.UNSUPPORTED_DETECTION_TYPE, info, detection.identifier));
			}
		}

		const validation = this.deviceValidation.validateDeviceStructure(toValidationInput(result.device));
		let readyToAdopt = true;

		for (const issue of validation.issues) {
			const isError = issue.severity === ValidationIssueSeverity.ERROR;

			readyToAdopt = readyToAdopt && !isError;
			warnings.push(
				warning(
					ProtectPreviewWarningCode.SPEC_VALIDATION_FAILED,
					isError ? ProtectPreviewWarningSeverity.ERROR : caution,
					issue.channelCategory ?? null,
				),
			);
		}

		return { fresh, device: result.device, streams, warnings, readyToAdopt };
	}

	async preview(deviceId: string, modelKey: ProtectModelKey): Promise<ProtectMappingPreviewModel> {
		const prepared = await this.prepare(deviceId, modelKey);
		const { device, fresh, streams } = prepared;
		const model = new ProtectMappingPreviewModel();
		const info = new ProtectMappingPreviewDeviceModel();

		info.id = device.protectDeviceId;
		info.modelKey = device.protectModelKey;
		info.name = device.name;
		info.model = typeof fresh.entry.raw.type === 'string' ? fresh.entry.raw.type : null;
		info.state = typeof fresh.entry.raw.state === 'string' ? fresh.entry.raw.state : 'UNKNOWN';

		model.device = info;
		model.identifier = device.identifier;
		model.category = device.category;
		model.mappingName = device.mappingName;
		model.channels = device.channels.map((channel) =>
			Object.assign(new ProtectMappingPreviewChannelModel(), {
				identifier: channel.identifier,
				category: channel.category,
				name: channel.name,
				mappingName: channel.mappingName,
				properties: channel.properties.map((property) =>
					Object.assign(new ProtectMappingPreviewPropertyModel(), {
						identifier: property.identifier,
						category: property.category,
						name: property.name,
						dataType: property.dataType,
						permissions: [...property.permissions],
						unit: property.unit,
						format: property.format,
						step: property.step,
						value: property.value,
						mappingName: property.mappingName,
					}),
				),
			}),
		);
		model.warnings = prepared.warnings;
		model.stream = device.protectModelKey === 'camera' ? this.toStreamModel(fresh, streams) : null;
		model.readyToAdopt = prepared.readyToAdopt;
		const existing = (await this.inventory.getAdoptedByIdentifier()).get(device.identifier) ?? null;

		model.adopted = existing !== null;
		model.adoptedDeviceId = existing?.id ?? null;

		return model;
	}

	/** Re-evaluates the stream status values for new availability; the one implementation of the status rule. */
	toStatusValue(prepared: ProtectPreparedMapping, availability: ProtectStreamAvailability | null): ProtectMappedDevice {
		const result = this.evaluate(prepared.fresh, availability);

		if (!result.ok) {
			throw new ProtectUnsupportedDeviceError();
		}

		return result.device;
	}

	private evaluate(fresh: ProtectFreshDevice, streams: ProtectStreamAvailability | null) {
		return evaluateProtectMapping(this.mappingLoader.getMappings(), {
			nvr: { id: fresh.identity.nvrId, macKey: fresh.identity.nvrMacKey },
			modelKey: fresh.entry.modelKey,
			device: fresh.entry.raw,
			streams,
		});
	}

	/** The URLs become booleans in the same statement; a failed read is reported as unknown, never thrown. */
	private async readStreams(fresh: ProtectFreshDevice, deviceId: string): Promise<ProtectStreamAvailability | null> {
		try {
			return toStreamAvailability(await fresh.client.getRtspsStreams(deviceId));
		} catch {
			return null;
		}
	}

	private toStreamModel(fresh: ProtectFreshDevice, streams: ProtectStreamAvailability | null) {
		const model = new ProtectMappingPreviewStreamModel();

		model.enabledQualities = streams === null ? null : PROTECT_RTSPS_QUALITIES.filter((quality) => streams[quality]);
		model.defaultQuality = readDefaultStreamQuality(this.configService);
		model.packageCamera = fresh.entry.raw.hasPackageCamera === true;

		return model;
	}
}

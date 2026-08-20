import { Injectable } from '@nestjs/common';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelDataInput, DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { HomeyMappingPreviewRequestDto } from '../dto/mapping-preview.dto';
import {
	HomeyMappingPreviewDeviceNotFoundError,
	HomeyMappingPreviewUnavailableError,
} from '../errors/homey-mapping-preview.error';
import { HomeyMappingLoaderService } from '../mappings/mapping-loader.service';
import { HomeyMappingTransformerService } from '../mappings/mapping-transformer.service';
import {
	HomeyMappingConflict,
	HomeyMappingDirection,
	HomeyMappingResolution,
	HomeyTransformDefinition,
	ResolvedHomeyChannelMapping,
	ResolvedHomeyPropertyBinding,
} from '../mappings/mapping.types';
import { HomeyCapability } from '../models/homey-capability.model';
import { HomeyDevice } from '../models/homey-device.model';
import {
	HomeyMappingConversionType,
	HomeyMappingPreviewChannelModel,
	HomeyMappingPreviewConversionModel,
	HomeyMappingPreviewDeviceModel,
	HomeyMappingPreviewModel,
	HomeyMappingPreviewPropertyModel,
	HomeyMappingPreviewRangeModel,
	HomeyMappingPreviewWarningCode,
	HomeyMappingPreviewWarningModel,
	HomeyMappingPreviewWarningScope,
	HomeyMappingPreviewWarningSeverity,
} from '../models/mapping-preview.model';

import { HomeyService } from './homey.service';

const WARNING_SEVERITY_ORDER: Record<HomeyMappingPreviewWarningSeverity, number> = {
	[HomeyMappingPreviewWarningSeverity.ERROR]: 0,
	[HomeyMappingPreviewWarningSeverity.WARNING]: 1,
};

@Injectable()
export class HomeyMappingPreviewService {
	constructor(
		private readonly homeyService: HomeyService,
		private readonly mappingLoader: HomeyMappingLoaderService,
		private readonly mappingTransformer: HomeyMappingTransformerService,
		private readonly deviceValidation: DeviceValidationService,
	) {}

	async generatePreview(request: HomeyMappingPreviewRequestDto): Promise<HomeyMappingPreviewModel> {
		let device: HomeyDevice | null;

		try {
			device = await this.homeyService.getFreshDevice(request.deviceId);
		} catch {
			throw new HomeyMappingPreviewUnavailableError();
		}

		if (device === null) {
			throw new HomeyMappingPreviewDeviceNotFoundError();
		}

		return this.createPreview(device, request.deviceCategory);
	}

	private createPreview(device: HomeyDevice, requestedCategory?: DeviceCategory): HomeyMappingPreviewModel {
		const deviceResolution = this.mappingLoader.resolveDeviceMappings(device);
		const channelResolution = this.mappingLoader.resolveChannelMappings(device);
		const propertyResolution = this.mappingLoader.resolvePropertyMappings(device);
		const warnings: HomeyMappingPreviewWarningModel[] = [];

		this.addConflictWarnings(deviceResolution.conflicts, warnings);
		this.addConflictWarnings(channelResolution.conflicts, warnings);
		this.addConflictWarnings(propertyResolution.conflicts, warnings);

		if (deviceResolution.mappings.length === 0 && deviceResolution.conflicts.length === 0) {
			warnings.push(
				this.warning(
					HomeyMappingPreviewWarningCode.UNSUPPORTED_DEVICE,
					HomeyMappingPreviewWarningSeverity.ERROR,
					HomeyMappingPreviewWarningScope.DEVICE,
					device.id,
					[],
					'No device mapping supports this Homey device contract',
				),
			);
		}

		if (channelResolution.mappings.length === 0 && channelResolution.conflicts.length === 0) {
			warnings.push(
				this.warning(
					HomeyMappingPreviewWarningCode.NO_CHANNEL_MAPPING,
					HomeyMappingPreviewWarningSeverity.ERROR,
					HomeyMappingPreviewWarningScope.DEVICE,
					device.id,
					[],
					'No channel mappings are available for this Homey device',
				),
			);
		}

		if (propertyResolution.mappings.length === 0 && propertyResolution.conflicts.length === 0) {
			warnings.push(
				this.warning(
					HomeyMappingPreviewWarningCode.NO_PROPERTY_MAPPING,
					HomeyMappingPreviewWarningSeverity.ERROR,
					HomeyMappingPreviewWarningScope.DEVICE,
					device.id,
					[],
					'No property mappings are available for this Homey device',
				),
			);
		}

		if (!device.available) {
			warnings.push(
				this.warning(
					HomeyMappingPreviewWarningCode.DEVICE_UNAVAILABLE,
					HomeyMappingPreviewWarningSeverity.WARNING,
					HomeyMappingPreviewWarningScope.DEVICE,
					device.id,
					[],
					'Homey currently reports this device as unavailable',
				),
			);
		}

		const channels = this.createChannels(device, channelResolution, propertyResolution, warnings);
		const recognizedCapabilityIds = new Set(propertyResolution.mappings.map((binding) => binding.capabilityId));
		const unsupportedCapabilityIds = device.capabilities
			.map((capability) => capability.id)
			.filter((capabilityId) => !recognizedCapabilityIds.has(capabilityId))
			.sort((left, right) => this.compareText(left, right));

		for (const capabilityId of unsupportedCapabilityIds) {
			warnings.push(
				this.warning(
					HomeyMappingPreviewWarningCode.UNSUPPORTED_CAPABILITY,
					HomeyMappingPreviewWarningSeverity.WARNING,
					HomeyMappingPreviewWarningScope.CAPABILITY,
					capabilityId,
					[],
					'This Homey capability has no resolved property mapping',
				),
			);
		}

		const suggestedCategory = deviceResolution.mappings[0]?.deviceCategory ?? null;
		const validCategories = deviceResolution.mappings.length === 0 ? [] : this.getValidCategories(channels);
		const selectedCategory = requestedCategory ?? suggestedCategory;

		if (selectedCategory !== null && !validCategories.includes(selectedCategory)) {
			warnings.push(
				this.warning(
					HomeyMappingPreviewWarningCode.INVALID_DEVICE_CATEGORY,
					HomeyMappingPreviewWarningSeverity.ERROR,
					HomeyMappingPreviewWarningScope.DEVICE,
					selectedCategory,
					[],
					'The selected Smart Panel category is incompatible with the proposed channel structure',
				),
			);
		}

		const preview = new HomeyMappingPreviewModel();
		preview.device = this.createDevice(device);
		preview.suggestedCategory = suggestedCategory;
		preview.selectedCategory = selectedCategory;
		preview.validCategories = validCategories;
		preview.channels = channels;
		preview.unsupportedCapabilityIds = unsupportedCapabilityIds;
		preview.warnings = warnings.sort((left, right) => this.compareWarnings(left, right));
		preview.readyToAdopt =
			selectedCategory !== null &&
			channels.some((channel) => channel.properties.length > 0) &&
			!preview.warnings.some((warning) => warning.severity === HomeyMappingPreviewWarningSeverity.ERROR);

		return preview;
	}

	private createDevice(device: HomeyDevice): HomeyMappingPreviewDeviceModel {
		const model = new HomeyMappingPreviewDeviceModel();
		model.id = device.id;
		model.name = device.name;
		model.class = device.class;
		model.zoneId = device.zoneId;
		model.zonePath = [...device.zonePath];
		model.available = device.available;

		return model;
	}

	private createChannels(
		device: HomeyDevice,
		channelResolution: HomeyMappingResolution<ResolvedHomeyChannelMapping>,
		propertyResolution: HomeyMappingResolution<ResolvedHomeyPropertyBinding>,
		warnings: HomeyMappingPreviewWarningModel[],
	): HomeyMappingPreviewChannelModel[] {
		const capabilities = new Map(device.capabilities.map((capability) => [capability.id, capability]));
		const channels = [...channelResolution.mappings]
			.sort((left, right) => this.compareText(left.channel.identifier, right.channel.identifier))
			.map((mapping) => {
				const channel = new HomeyMappingPreviewChannelModel();
				channel.identifier = mapping.channel.identifier;
				channel.mappingName = mapping.name;
				channel.mappingSource = mapping.source;
				channel.category = mapping.channel.category;
				channel.name = mapping.channel.name ?? this.humanize(mapping.channel.identifier);
				channel.properties = [];

				return channel;
			});
		const byIdentifier = new Map(channels.map((channel) => [channel.identifier, channel]));

		for (const binding of [...propertyResolution.mappings].sort((left, right) => this.compareBindings(left, right))) {
			const channelIdentifier = binding.mapping.property.channel;
			const channel = byIdentifier.get(channelIdentifier);

			if (!channel) {
				warnings.push(
					this.warning(
						HomeyMappingPreviewWarningCode.ORPHANED_PROPERTY_MAPPING,
						HomeyMappingPreviewWarningSeverity.ERROR,
						HomeyMappingPreviewWarningScope.CHANNEL,
						channelIdentifier,
						[binding.mapping.name],
						'A resolved property mapping targets a channel that was not resolved',
					),
				);
				continue;
			}

			const capability = capabilities.get(binding.capabilityId);
			if (!capability) {
				continue;
			}

			channel.properties.push(this.createProperty(binding, capability, warnings));
		}

		for (const channel of channels) {
			channel.properties.sort(
				(left, right) =>
					this.compareText(left.capabilityId, right.capabilityId) ||
					this.compareText(left.category, right.category) ||
					this.compareText(left.mappingName, right.mappingName),
			);
		}

		return channels;
	}

	private createProperty(
		binding: ResolvedHomeyPropertyBinding,
		capability: HomeyCapability,
		warnings: HomeyMappingPreviewWarningModel[],
	): HomeyMappingPreviewPropertyModel {
		const { mapping } = binding;
		const mappingCanRead = this.mappingCanRead(mapping.property.direction);
		const mappingCanWrite = this.mappingCanWrite(mapping.property.direction);
		const readable = mappingCanRead && capability.readable;
		const writable = mappingCanWrite && capability.writable;
		const conversion = this.createConversion(mapping.property.transform);
		const property = new HomeyMappingPreviewPropertyModel();

		property.capabilityId = binding.capabilityId;
		property.capabilityBaseId = binding.capabilityBaseId;
		property.mappingName = mapping.name;
		property.mappingSource = mapping.source;
		property.category = mapping.property.category;
		property.dataType = mapping.property.dataType;
		property.direction = mapping.property.direction;
		property.permissions = this.getPermissions(readable, writable);
		property.readable = readable;
		property.writable = writable;
		property.unit = mapping.property.unit ?? capability.unit;
		property.range = this.createRange(
			mapping.property.range?.minimum ?? null,
			mapping.property.range?.maximum ?? null,
			mapping.property.range?.step ?? null,
		);
		property.sourceRange = this.createRange(capability.minimum, capability.maximum, capability.step);
		property.enumValues = capability.enumValues.map((value) => value.id);
		property.currentValue = null;
		property.valueAvailable = false;
		property.capabilityAvailable = capability.available;
		property.conversion = conversion;

		if ((mappingCanRead && !capability.readable) || (mappingCanWrite && !capability.writable)) {
			warnings.push(
				this.warning(
					HomeyMappingPreviewWarningCode.ACCESS_MISMATCH,
					HomeyMappingPreviewWarningSeverity.ERROR,
					HomeyMappingPreviewWarningScope.CAPABILITY,
					capability.id,
					[mapping.name],
					'Homey capability access does not satisfy the resolved mapping direction',
				),
			);
		}

		if (capability.available === false) {
			warnings.push(
				this.warning(
					HomeyMappingPreviewWarningCode.CAPABILITY_UNAVAILABLE,
					HomeyMappingPreviewWarningSeverity.WARNING,
					HomeyMappingPreviewWarningScope.CAPABILITY,
					capability.id,
					[mapping.name],
					'Homey currently reports this capability as unavailable',
				),
			);
		}

		if (readable) {
			try {
				property.currentValue = this.mappingTransformer.read(mapping, capability.value);
				property.valueAvailable = property.currentValue !== null;

				if (!property.valueAvailable) {
					warnings.push(
						this.warning(
							HomeyMappingPreviewWarningCode.VALUE_UNAVAILABLE,
							HomeyMappingPreviewWarningSeverity.WARNING,
							HomeyMappingPreviewWarningScope.CAPABILITY,
							capability.id,
							[mapping.name],
							'No current transformed value is available for this capability',
						),
					);
				}
			} catch {
				warnings.push(
					this.warning(
						HomeyMappingPreviewWarningCode.VALUE_CONVERSION_FAILED,
						HomeyMappingPreviewWarningSeverity.ERROR,
						HomeyMappingPreviewWarningScope.CONVERSION,
						capability.id,
						[mapping.name],
						'The current Homey value could not be converted by the resolved mapping',
					),
				);
			}
		}

		if (conversion.lossy) {
			warnings.push(
				this.warning(
					HomeyMappingPreviewWarningCode.LOSSY_CONVERSION,
					HomeyMappingPreviewWarningSeverity.WARNING,
					HomeyMappingPreviewWarningScope.CONVERSION,
					capability.id,
					[mapping.name],
					'The resolved conversion can discard source precision or range information',
				),
			);
		}

		if (conversion.ambiguous) {
			warnings.push(
				this.warning(
					HomeyMappingPreviewWarningCode.AMBIGUOUS_CONVERSION,
					HomeyMappingPreviewWarningSeverity.WARNING,
					HomeyMappingPreviewWarningScope.CONVERSION,
					capability.id,
					[mapping.name],
					'The resolved conversion has more than one possible source representation',
				),
			);
		}

		return property;
	}

	private createConversion(transform: HomeyTransformDefinition | undefined): HomeyMappingPreviewConversionModel {
		const conversion = new HomeyMappingPreviewConversionModel();
		conversion.type = (transform?.type ?? HomeyMappingConversionType.IDENTITY) as HomeyMappingConversionType;
		conversion.reversible = true;
		conversion.lossy = false;
		conversion.ambiguous = false;
		conversion.inputRange = null;
		conversion.outputRange = null;
		conversion.clamp = null;
		conversion.minimum = null;
		conversion.maximum = null;
		conversion.precision = null;
		conversion.readTableSize = null;
		conversion.writeTableSize = null;

		if (!transform) {
			return conversion;
		}

		switch (transform.type) {
			case 'scale':
				conversion.inputRange = [...transform.input_range];
				conversion.outputRange = [...transform.output_range];
				conversion.clamp = transform.clamp === true;
				conversion.lossy = conversion.clamp;
				conversion.reversible = !conversion.lossy;
				break;
			case 'map': {
				const readEntries = Object.entries(transform.read ?? {});
				const writeEntries = Object.entries(transform.write ?? {});
				const readOutputs = readEntries.map(([, value]) => String(value));
				conversion.readTableSize = readEntries.length;
				conversion.writeTableSize = writeEntries.length;
				conversion.ambiguous = new Set(readOutputs).size !== readOutputs.length;
				conversion.lossy = conversion.ambiguous;
				conversion.reversible =
					readEntries.length > 0 &&
					writeEntries.length > 0 &&
					readEntries.every(([source, target]) => String(transform.write?.[String(target)]) === source) &&
					writeEntries.every(([target, source]) => String(transform.read?.[String(source)]) === target);
				break;
			}
			case 'boolean':
				break;
			case 'clamp':
				conversion.minimum = transform.minimum;
				conversion.maximum = transform.maximum;
				conversion.lossy = true;
				conversion.reversible = false;
				break;
			case 'round':
				conversion.precision = transform.precision ?? 0;
				conversion.lossy = true;
				conversion.reversible = false;
				break;
			case 'constant':
			case 'threshold':
			case 'thresholds':
				conversion.lossy = true;
				conversion.reversible = false;
				break;
		}

		return conversion;
	}

	private createRange(
		minimum: number | null,
		maximum: number | null,
		step: number | null,
	): HomeyMappingPreviewRangeModel | null {
		if (minimum === null && maximum === null && step === null) {
			return null;
		}

		const range = new HomeyMappingPreviewRangeModel();
		range.minimum = minimum;
		range.maximum = maximum;
		range.step = step;

		return range;
	}

	private getPermissions(readable: boolean, writable: boolean): PermissionType[] {
		if (readable && writable) {
			return [PermissionType.READ_WRITE];
		}
		if (readable) {
			return [PermissionType.READ_ONLY];
		}
		if (writable) {
			return [PermissionType.WRITE_ONLY];
		}

		return [];
	}

	private mappingCanRead(direction: HomeyMappingDirection): boolean {
		return direction === 'read_only' || direction === 'bidirectional';
	}

	private mappingCanWrite(direction: HomeyMappingDirection): boolean {
		return direction === 'write_only' || direction === 'bidirectional';
	}

	private getValidCategories(channels: readonly HomeyMappingPreviewChannelModel[]): DeviceCategory[] {
		const validationChannels = this.createValidationChannels(channels);

		return Object.values(DeviceCategory)
			.filter(
				(category) => this.deviceValidation.validateDeviceStructure({ category, channels: validationChannels }).isValid,
			)
			.sort((left, right) => this.compareText(left, right));
	}

	private createValidationChannels(channels: readonly HomeyMappingPreviewChannelModel[]): ChannelDataInput[] {
		return [
			...channels.map((channel) => ({
				category: channel.category,
				properties: channel.properties.map((property) => ({
					category: property.category,
					dataType: property.dataType,
					permissions: property.permissions,
				})),
			})),
			{
				category: ChannelCategory.DEVICE_INFORMATION,
				properties: [
					{
						category: PropertyCategory.MANUFACTURER,
						dataType: DataTypeType.STRING,
						permissions: [PermissionType.READ_ONLY],
					},
					{
						category: PropertyCategory.MODEL,
						dataType: DataTypeType.STRING,
						permissions: [PermissionType.READ_ONLY],
					},
					{
						category: PropertyCategory.SERIAL_NUMBER,
						dataType: DataTypeType.STRING,
						permissions: [PermissionType.READ_ONLY],
					},
					{
						category: PropertyCategory.FIRMWARE_REVISION,
						dataType: DataTypeType.STRING,
						permissions: [PermissionType.READ_ONLY],
					},
					{
						category: PropertyCategory.HARDWARE_REVISION,
						dataType: DataTypeType.STRING,
						permissions: [PermissionType.READ_ONLY],
					},
					{
						category: PropertyCategory.CONNECTION_TYPE,
						dataType: DataTypeType.ENUM,
						permissions: [PermissionType.READ_ONLY],
					},
					{
						category: PropertyCategory.STATUS,
						dataType: DataTypeType.ENUM,
						permissions: [PermissionType.READ_ONLY],
					},
				],
			},
		];
	}

	private addConflictWarnings(
		conflicts: readonly HomeyMappingConflict[],
		warnings: HomeyMappingPreviewWarningModel[],
	): void {
		for (const conflict of conflicts) {
			const code =
				conflict.kind === 'devices'
					? HomeyMappingPreviewWarningCode.DEVICE_MAPPING_CONFLICT
					: conflict.kind === 'channels'
						? HomeyMappingPreviewWarningCode.CHANNEL_MAPPING_CONFLICT
						: HomeyMappingPreviewWarningCode.PROPERTY_MAPPING_CONFLICT;
			const scope =
				conflict.kind === 'properties'
					? HomeyMappingPreviewWarningScope.CAPABILITY
					: conflict.kind === 'channels'
						? HomeyMappingPreviewWarningScope.CHANNEL
						: HomeyMappingPreviewWarningScope.DEVICE;

			warnings.push(
				this.warning(
					code,
					conflict.policy === 'error'
						? HomeyMappingPreviewWarningSeverity.ERROR
						: HomeyMappingPreviewWarningSeverity.WARNING,
					scope,
					conflict.key,
					[...conflict.mappings].sort((left, right) => this.compareText(left, right)),
					`Multiple ${conflict.kind} mapping descriptors have equal priority`,
				),
			);
		}
	}

	private warning(
		code: HomeyMappingPreviewWarningCode,
		severity: HomeyMappingPreviewWarningSeverity,
		scope: HomeyMappingPreviewWarningScope,
		identifier: string | null,
		mappingNames: string[],
		message: string,
	): HomeyMappingPreviewWarningModel {
		const warning = new HomeyMappingPreviewWarningModel();
		warning.code = code;
		warning.severity = severity;
		warning.scope = scope;
		warning.identifier = identifier;
		warning.mappingNames = mappingNames;
		warning.message = message;

		return warning;
	}

	private compareBindings(left: ResolvedHomeyPropertyBinding, right: ResolvedHomeyPropertyBinding): number {
		return (
			this.compareText(left.mapping.property.channel, right.mapping.property.channel) ||
			this.compareText(left.capabilityId, right.capabilityId) ||
			this.compareText(left.mapping.property.category, right.mapping.property.category) ||
			this.compareText(left.mapping.name, right.mapping.name)
		);
	}

	private compareWarnings(left: HomeyMappingPreviewWarningModel, right: HomeyMappingPreviewWarningModel): number {
		return (
			WARNING_SEVERITY_ORDER[left.severity] - WARNING_SEVERITY_ORDER[right.severity] ||
			this.compareText(left.code, right.code) ||
			this.compareText(left.scope, right.scope) ||
			this.compareText(left.identifier ?? '', right.identifier ?? '') ||
			this.compareText(left.mappingNames.join('\u0000'), right.mappingNames.join('\u0000'))
		);
	}

	private humanize(identifier: string): string {
		const value = identifier.replace(/[-_]+/g, ' ').trim();

		return value.length === 0 ? identifier : value[0].toUpperCase() + value.slice(1);
	}

	private compareText(left: string, right: string): number {
		return left < right ? -1 : left > right ? 1 : 0;
	}
}

import { Injectable } from '@nestjs/common';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelDataInput, DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { matchesStep, validatePropertyCommandValue } from '../../../modules/devices/utils/property-command-value.utils';
import { getPropertyMetadata } from '../../../modules/devices/utils/schema.utils';
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
	HomeyMappingScalar,
	HomeyTransformDefinition,
	HomeyValueRangeDefinition,
	ResolvedHomeyChannelMapping,
	ResolvedHomeyPropertyBinding,
	ResolvedHomeyPropertyMapping,
} from '../mappings/mapping.types';
import { HomeyCapability, HomeyCapabilityType } from '../models/homey-capability.model';
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

const INTEGER_DATA_TYPES = new Set<DataTypeType>([
	DataTypeType.CHAR,
	DataTypeType.UCHAR,
	DataTypeType.SHORT,
	DataTypeType.USHORT,
	DataTypeType.INT,
	DataTypeType.UINT,
]);
const MAX_EXHAUSTIVE_NUMERIC_GRID_VALUES = 10_000;

interface NumericGrid {
	readonly base: number;
	readonly minimum: number | null;
	readonly maximum: number | null;
	readonly step: number | null;
}

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

			channel.properties.push(this.createProperty(binding, capability, channel.category, warnings));
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
		channelCategory: ChannelCategory,
		warnings: HomeyMappingPreviewWarningModel[],
	): HomeyMappingPreviewPropertyModel {
		const { mapping } = binding;
		const mappingCanRead = this.mappingCanRead(mapping.property.direction);
		const mappingCanWrite = this.mappingCanWrite(mapping.property.direction);
		const readable = mappingCanRead && capability.readable;
		const writable = mappingCanWrite && capability.writable;
		const effectiveRange = this.getEffectivePropertyRange(mapping, capability);
		const conversion = this.createConversion(mapping, mapping.property.dataType, capability, mappingCanRead);
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
			effectiveRange?.minimum ?? null,
			effectiveRange?.maximum ?? null,
			effectiveRange?.step ?? null,
		);
		property.sourceRange = this.createRange(capability.minimum, capability.maximum, capability.step);
		property.enumValues = capability.enumValues.map((value) => value.id);
		property.panelEnumValues = [];
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

		this.addCapabilityDomainWarning(mapping.property.transform, mapping.name, capability, mappingCanRead, warnings);

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

		if (
			!conversion.reversible &&
			((conversion.type === HomeyMappingConversionType.MAP && mapping.property.direction === 'bidirectional') ||
				conversion.type === HomeyMappingConversionType.BOOLEAN)
		) {
			warnings.push(
				this.warning(
					HomeyMappingPreviewWarningCode.NON_REVERSIBLE_CONVERSION,
					HomeyMappingPreviewWarningSeverity.ERROR,
					HomeyMappingPreviewWarningScope.CONVERSION,
					capability.id,
					[mapping.name],
					'The bidirectional map does not preserve values through a write and read round trip',
				),
			);
		}

		const potentialPanelDomain = this.getPotentialPanelValues(mapping, capability, mappingCanRead, mappingCanWrite);
		const potentialPanelValues = potentialPanelDomain.values;
		if (effectiveRange?.minimum !== undefined) {
			potentialPanelValues.push(effectiveRange.minimum);
		}
		if (effectiveRange?.maximum !== undefined) {
			potentialPanelValues.push(effectiveRange.maximum);
		}
		if (property.valueAvailable) {
			potentialPanelValues.push(property.currentValue);
		}
		property.panelEnumValues =
			property.dataType === DataTypeType.ENUM
				? [...new Set(potentialPanelValues.filter((value): value is string => typeof value === 'string'))]
				: [];

		if (
			!potentialPanelDomain.convertible ||
			!this.isReadableDomainCompatible(
				mapping,
				capability,
				mappingCanRead,
				channelCategory,
				property.category,
				property.dataType,
				effectiveRange,
			) ||
			potentialPanelValues.some(
				(value) =>
					!this.isValidPanelValue(channelCategory, property.category, property.dataType, effectiveRange, value),
			) ||
			this.hasIncompleteWritableEnumDomain(
				channelCategory,
				property.category,
				property.dataType,
				mapping.property.transform,
				mappingCanWrite,
			)
		) {
			warnings.push(
				this.warning(
					HomeyMappingPreviewWarningCode.INVALID_PROPERTY_VALUE_DOMAIN,
					HomeyMappingPreviewWarningSeverity.ERROR,
					HomeyMappingPreviewWarningScope.CONVERSION,
					capability.id,
					[mapping.name],
					'The mapping value domain is incompatible with the Smart Panel property constraints',
				),
			);
		}

		const potentialHomeyWriteDomain = this.getPotentialHomeyWriteValues(
			mapping,
			mappingCanWrite,
			channelCategory,
			property.category,
			property.dataType,
			effectiveRange,
		);
		if (
			!potentialHomeyWriteDomain.convertible ||
			!this.isUnboundedPanelWriteDomainCompatible(
				mapping,
				capability,
				mappingCanWrite,
				channelCategory,
				property.category,
				property.dataType,
			) ||
			potentialHomeyWriteDomain.values.some((value) => !this.isValidHomeyValue(capability, value)) ||
			!this.isWriteStrategyDomainCompatible(mapping, capability) ||
			!this.isNumericWriteGridCompatible(
				mapping,
				capability,
				mappingCanWrite,
				channelCategory,
				property.category,
				property.dataType,
				effectiveRange,
			)
		) {
			warnings.push(
				this.warning(
					HomeyMappingPreviewWarningCode.INVALID_CAPABILITY_VALUE_DOMAIN,
					HomeyMappingPreviewWarningSeverity.ERROR,
					HomeyMappingPreviewWarningScope.CONVERSION,
					capability.id,
					[mapping.name],
					'The write conversion can produce a value outside the declared Homey capability constraints',
				),
			);
		}

		return property;
	}

	private addCapabilityDomainWarning(
		transform: HomeyTransformDefinition | undefined,
		mappingName: string,
		capability: HomeyCapability,
		mappingCanRead: boolean,
		warnings: HomeyMappingPreviewWarningModel[],
	): void {
		if (!mappingCanRead || transform?.type !== 'map') {
			return;
		}

		const readTable = transform.read ?? {};

		if (!this.isReadableMapDomainComplete(capability, readTable)) {
			warnings.push(
				this.warning(
					HomeyMappingPreviewWarningCode.INCOMPLETE_CAPABILITY_DOMAIN,
					HomeyMappingPreviewWarningSeverity.ERROR,
					HomeyMappingPreviewWarningScope.CONVERSION,
					capability.id,
					[mappingName],
					'The readable map does not cover every declared Homey capability value',
				),
			);
		}
	}

	private isReadableMapDomainComplete(
		capability: HomeyCapability,
		readTable: Readonly<Record<string, HomeyMappingScalar>>,
	): boolean {
		if (capability.enumValues.length > 0) {
			return capability.enumValues.every((value) => Object.hasOwn(readTable, value.id));
		}

		switch (capability.type) {
			case HomeyCapabilityType.BOOLEAN:
				return ['false', 'true'].every((value) => Object.hasOwn(readTable, value));
			case HomeyCapabilityType.NUMBER:
				return this.isNumericReadMapDomainComplete(capability, readTable);
			case HomeyCapabilityType.STRING:
			case HomeyCapabilityType.UNKNOWN:
			case HomeyCapabilityType.ENUM:
				return false;
		}
	}

	private isNumericReadMapDomainComplete(
		capability: HomeyCapability,
		readTable: Readonly<Record<string, HomeyMappingScalar>>,
	): boolean {
		if (
			capability.minimum === null ||
			capability.maximum === null ||
			capability.step === null ||
			capability.step <= 0 ||
			capability.maximum < capability.minimum
		) {
			return false;
		}

		const quotient = (capability.maximum - capability.minimum) / capability.step;
		const tolerance = Number.EPSILON * Math.max(1, Math.abs(quotient)) * 16;
		const expectedValues = Math.floor(quotient + tolerance) + 1;
		const coveredValues = new Set<number>();

		for (const key of Object.keys(readTable)) {
			const numericValue = Number(key);
			if (
				key.trim() === '' ||
				!Number.isFinite(numericValue) ||
				String(numericValue) !== key ||
				numericValue < capability.minimum ||
				numericValue > capability.maximum ||
				!matchesStep(numericValue, capability.step, capability.minimum)
			) {
				continue;
			}

			coveredValues.add(numericValue);
		}

		return coveredValues.size === expectedValues;
	}

	private getPotentialPanelValues(
		mapping: ResolvedHomeyPropertyMapping,
		capability: HomeyCapability,
		mappingCanRead: boolean,
		mappingCanWrite: boolean,
	): { values: HomeyMappingScalar[]; convertible: boolean } {
		const transform = mapping.property.transform;
		const values: HomeyMappingScalar[] = [];
		let convertible = true;

		if (!transform) {
			if (mappingCanRead) {
				for (const sourceValue of this.getHomeyDomainValues(capability)) {
					try {
						values.push(this.mappingTransformer.read(mapping, sourceValue));
					} catch {
						convertible = false;
					}
				}
			} else if (mappingCanWrite) {
				values.push(...this.getHomeyDomainValues(capability));
			}

			return { values, convertible };
		}

		if (mappingCanRead) {
			for (const sourceValue of this.getHomeyDomainValues(capability)) {
				try {
					values.push(this.mappingTransformer.read(mapping, sourceValue));
				} catch {
					convertible = false;
				}
			}

			switch (transform.type) {
				case 'scale':
					values.push(...transform.output_range);
					break;
				case 'map':
					values.push(...Object.values(transform.read ?? {}));
					break;
				case 'boolean':
					values.push(false, true);
					break;
				case 'clamp':
					values.push(transform.minimum, transform.maximum);
					break;
				case 'constant':
					values.push(transform.value);
					break;
				case 'threshold':
					values.push(transform.less_than_or_equal, transform.greater_than);
					break;
				case 'thresholds':
					values.push(...transform.thresholds.map((entry) => entry.value), transform.default);
					break;
				case 'round':
					break;
			}
		}

		if (mappingCanWrite && transform.type === 'map') {
			values.push(...Object.keys(transform.write ?? {}));
		}

		return { values, convertible };
	}

	private isReadableDomainCompatible(
		mapping: ResolvedHomeyPropertyMapping,
		capability: HomeyCapability,
		mappingCanRead: boolean,
		channelCategory: ChannelCategory,
		propertyCategory: PropertyCategory,
		dataType: DataTypeType,
		mappingRange: HomeyValueRangeDefinition | undefined,
	): boolean {
		if (!mappingCanRead) {
			return true;
		}

		if (capability.type === HomeyCapabilityType.STRING) {
			if (mapping.property.transform?.type === 'constant') {
				return true;
			}

			return mapping.property.transform === undefined && dataType === DataTypeType.STRING;
		}
		if (capability.type === HomeyCapabilityType.UNKNOWN) {
			return false;
		}
		if (capability.type === HomeyCapabilityType.ENUM && capability.enumValues.length === 0) {
			return false;
		}
		if (capability.type !== HomeyCapabilityType.NUMBER) {
			return true;
		}

		const capabilityGrid: NumericGrid = {
			base: capability.minimum ?? 0,
			minimum: capability.minimum,
			maximum: capability.maximum,
			step: capability.step,
		};
		const exhaustiveValues = this.getExhaustiveGridValues(capabilityGrid);

		if (exhaustiveValues !== null) {
			return exhaustiveValues.every((value) =>
				this.isValidTransformedPanelRead(mapping, channelCategory, propertyCategory, dataType, mappingRange, value),
			);
		}

		const transform = mapping.property.transform;
		if (transform?.type === 'constant' || transform?.type === 'threshold' || transform?.type === 'thresholds') {
			return true;
		}
		if (transform?.type === 'map') {
			return this.isReadableMapDomainComplete(capability, transform.read ?? {});
		}
		if (!this.isNumericDataType(dataType) || capability.minimum === null || capability.maximum === null) {
			return false;
		}

		const panelGrid = this.getPanelNumericGrid(channelCategory, propertyCategory, dataType, mappingRange);
		if (capability.step === null) {
			if (transform?.type === 'boolean') {
				return false;
			}
			if (dataType === DataTypeType.FLOAT) {
				return panelGrid.step === null;
			}

			return INTEGER_DATA_TYPES.has(dataType) && (panelGrid.step === null || matchesStep(1, panelGrid.step, 0));
		}
		if (
			capability.step <= 0 ||
			transform?.type === 'clamp' ||
			transform?.type === 'round' ||
			transform?.type === 'boolean'
		) {
			return false;
		}

		const outputStep = (() => {
			if (transform === undefined) {
				return capability.step;
			}
			if (transform.type !== 'scale') {
				return null;
			}

			const inputSpan = transform.input_range[1] - transform.input_range[0];
			return inputSpan === 0
				? null
				: Math.abs((capability.step * (transform.output_range[1] - transform.output_range[0])) / inputSpan);
		})();

		if (
			outputStep === null ||
			!Number.isFinite(outputStep) ||
			(INTEGER_DATA_TYPES.has(dataType) && !Number.isInteger(outputStep)) ||
			!this.isValidTransformedPanelRead(
				mapping,
				channelCategory,
				propertyCategory,
				dataType,
				mappingRange,
				capability.minimum,
			)
		) {
			return false;
		}

		return panelGrid.step === null || matchesStep(outputStep, panelGrid.step, 0);
	}

	private isValidTransformedPanelRead(
		mapping: ResolvedHomeyPropertyMapping,
		channelCategory: ChannelCategory,
		propertyCategory: PropertyCategory,
		dataType: DataTypeType,
		mappingRange: HomeyValueRangeDefinition | undefined,
		homeyValue: number,
	): boolean {
		try {
			return this.isValidPanelValue(
				channelCategory,
				propertyCategory,
				dataType,
				mappingRange,
				this.mappingTransformer.read(mapping, homeyValue),
			);
		} catch {
			return false;
		}
	}

	private isUnboundedPanelWriteDomainCompatible(
		mapping: ResolvedHomeyPropertyMapping,
		capability: HomeyCapability,
		mappingCanWrite: boolean,
		channelCategory: ChannelCategory,
		propertyCategory: PropertyCategory,
		dataType: DataTypeType,
	): boolean {
		if (!mappingCanWrite || (dataType !== DataTypeType.STRING && dataType !== DataTypeType.ENUM)) {
			return true;
		}

		const metadata = getPropertyMetadata(channelCategory, propertyCategory);
		const variant = metadata?.dataTypeVariants?.find((candidate) => candidate.data_type === dataType);
		const format = variant ? variant.format : metadata?.format;
		const hasFiniteEnumDomain =
			dataType === DataTypeType.ENUM &&
			Array.isArray(format) &&
			format.length > 0 &&
			format.every((value) => typeof value === 'string');

		if (hasFiniteEnumDomain) {
			return true;
		}
		if (mapping.property.transform?.type === 'constant') {
			return true;
		}

		return mapping.property.transform === undefined && capability.type === HomeyCapabilityType.STRING;
	}

	private isValidPanelValue(
		channelCategory: ChannelCategory,
		propertyCategory: PropertyCategory,
		dataType: DataTypeType,
		mappingRange: HomeyValueRangeDefinition | undefined,
		value: HomeyMappingScalar,
	): boolean {
		const metadata = getPropertyMetadata(channelCategory, propertyCategory);

		if (metadata === null) {
			return true;
		}

		const variant = metadata.dataTypeVariants?.find((candidate) => candidate.data_type === dataType);
		const constraints = variant ?? metadata;
		const invalid =
			typeof constraints.invalid === 'string' ||
			typeof constraints.invalid === 'number' ||
			typeof constraints.invalid === 'boolean'
				? constraints.invalid
				: null;
		const canonicalProperty = {
			dataType,
			format: constraints.format,
			invalid,
			step: constraints.step,
		} as ChannelPropertyEntity;

		if (!validatePropertyCommandValue(canonicalProperty, value).valid) {
			return false;
		}

		if (mappingRange === undefined) {
			return true;
		}

		const hasMappingBounds = mappingRange.minimum !== undefined || mappingRange.maximum !== undefined;
		const mappingProperty = {
			dataType,
			format: hasMappingBounds
				? ([mappingRange.minimum ?? null, mappingRange.maximum ?? null] as unknown as number[])
				: constraints.format,
			invalid,
			step: mappingRange.step ?? constraints.step,
		} as ChannelPropertyEntity;

		return validatePropertyCommandValue(mappingProperty, value).valid;
	}

	private getPotentialHomeyWriteValues(
		mapping: ResolvedHomeyPropertyMapping,
		mappingCanWrite: boolean,
		channelCategory: ChannelCategory,
		propertyCategory: PropertyCategory,
		dataType: DataTypeType,
		mappingRange: HomeyValueRangeDefinition | undefined,
	): { values: HomeyMappingScalar[]; convertible: boolean } {
		if (!mappingCanWrite) {
			return { values: [], convertible: true };
		}

		const transform = mapping.property.transform;
		const values: HomeyMappingScalar[] = [];
		let convertible = true;

		for (const panelValue of this.getPanelDomainValues(channelCategory, propertyCategory, dataType, mappingRange)) {
			if (!this.isValidPanelValue(channelCategory, propertyCategory, dataType, mappingRange, panelValue)) {
				continue;
			}

			try {
				values.push(this.mappingTransformer.write(mapping, panelValue));
			} catch {
				convertible = false;
			}
		}

		if (!transform) {
			return { values, convertible };
		}

		switch (transform.type) {
			case 'scale':
				values.push(...transform.input_range);
				break;
			case 'map':
				values.push(...Object.values(transform.write ?? {}));
				break;
			case 'boolean':
				values.push(transform.true_value, transform.false_value);
				break;
			case 'clamp':
				values.push(transform.minimum, transform.maximum);
				break;
			case 'constant':
				values.push(transform.value);
				break;
			case 'threshold':
				values.push(transform.less_than_or_equal, transform.greater_than);
				break;
			case 'thresholds':
				values.push(...transform.thresholds.map((entry) => entry.value), transform.default);
				break;
			case 'round':
				break;
		}

		return { values, convertible };
	}

	private getHomeyDomainValues(capability: HomeyCapability): HomeyMappingScalar[] {
		switch (capability.type) {
			case HomeyCapabilityType.BOOLEAN:
				return [false, true];
			case HomeyCapabilityType.ENUM:
				return capability.enumValues.map((value) => value.id);
			case HomeyCapabilityType.NUMBER:
				return [capability.minimum, capability.maximum].filter((value): value is number => value !== null);
			case HomeyCapabilityType.STRING:
			case HomeyCapabilityType.UNKNOWN:
				return [];
		}
	}

	private getPanelDomainValues(
		channelCategory: ChannelCategory,
		propertyCategory: PropertyCategory,
		dataType: DataTypeType,
		mappingRange: HomeyValueRangeDefinition | undefined,
	): HomeyMappingScalar[] {
		const metadata = getPropertyMetadata(channelCategory, propertyCategory);
		const variant = metadata?.dataTypeVariants?.find((candidate) => candidate.data_type === dataType);
		const format = variant ? variant.format : metadata?.format;
		const values: HomeyMappingScalar[] = [];

		if (dataType === DataTypeType.BOOL) {
			values.push(false, true);
		} else if (dataType === DataTypeType.ENUM && Array.isArray(format)) {
			values.push(...format.filter((value): value is string => typeof value === 'string'));
		} else if (this.isNumericDataType(dataType)) {
			const canonicalMinimum = Array.isArray(format) && typeof format[0] === 'number' ? format[0] : null;
			const canonicalMaximum = Array.isArray(format) && typeof format[1] === 'number' ? format[1] : null;
			const minimumCandidates = [canonicalMinimum, mappingRange?.minimum ?? null].filter(
				(value): value is number => value !== null,
			);
			const maximumCandidates = [canonicalMaximum, mappingRange?.maximum ?? null].filter(
				(value): value is number => value !== null,
			);

			if (minimumCandidates.length > 0) {
				values.push(Math.max(...minimumCandidates));
			}
			if (maximumCandidates.length > 0) {
				values.push(Math.min(...maximumCandidates));
			}
		}

		return values;
	}

	private isNumericDataType(dataType: DataTypeType): boolean {
		return [
			DataTypeType.CHAR,
			DataTypeType.UCHAR,
			DataTypeType.SHORT,
			DataTypeType.USHORT,
			DataTypeType.INT,
			DataTypeType.UINT,
			DataTypeType.FLOAT,
		].includes(dataType);
	}

	private isValidHomeyValue(capability: HomeyCapability, value: HomeyMappingScalar): boolean {
		switch (capability.type) {
			case HomeyCapabilityType.BOOLEAN:
				return typeof value === 'boolean';
			case HomeyCapabilityType.ENUM:
				return (
					typeof value === 'string' &&
					capability.enumValues.length > 0 &&
					capability.enumValues.some((candidate) => candidate.id === value)
				);
			case HomeyCapabilityType.STRING:
				return typeof value === 'string';
			case HomeyCapabilityType.NUMBER:
				if (typeof value !== 'number' || !Number.isFinite(value)) {
					return false;
				}
				if (capability.minimum !== null && value < capability.minimum) {
					return false;
				}
				if (capability.maximum !== null && value > capability.maximum) {
					return false;
				}
				return (
					capability.step === null ||
					(capability.step > 0 && matchesStep(value, capability.step, capability.minimum ?? 0))
				);
			case HomeyCapabilityType.UNKNOWN:
				return false;
		}
	}

	private isNumericWriteGridCompatible(
		mapping: ResolvedHomeyPropertyMapping,
		capability: HomeyCapability,
		mappingCanWrite: boolean,
		channelCategory: ChannelCategory,
		propertyCategory: PropertyCategory,
		dataType: DataTypeType,
		mappingRange: HomeyValueRangeDefinition | undefined,
	): boolean {
		if (!mappingCanWrite || capability.type !== HomeyCapabilityType.NUMBER || !this.isNumericDataType(dataType)) {
			return true;
		}
		if (capability.step !== null && capability.step <= 0) {
			return false;
		}

		const transform = mapping.property.transform;
		const panelGrid = this.getPanelNumericGrid(channelCategory, propertyCategory, dataType, mappingRange);
		const exhaustiveValues = this.getExhaustiveGridValues(panelGrid);

		if (exhaustiveValues !== null) {
			const validPanelValues = exhaustiveValues.filter((value) =>
				this.isValidPanelValue(channelCategory, propertyCategory, dataType, mappingRange, value),
			);

			return (
				validPanelValues.length > 0 &&
				validPanelValues.every((value) => this.isValidTransformedHomeyWrite(mapping, capability, value))
			);
		}

		if (transform?.type === 'constant' || transform?.type === 'threshold' || transform?.type === 'thresholds') {
			return true;
		}
		if (capability.step === null) {
			return transform?.type !== 'map' && transform?.type !== 'boolean';
		}
		if (panelGrid.step === null || !Number.isFinite(panelGrid.step) || panelGrid.step <= 0) {
			return false;
		}

		switch (transform?.type) {
			case undefined:
				return (
					this.isValidTransformedHomeyWrite(mapping, capability, panelGrid.base) &&
					matchesStep(panelGrid.step, capability.step, 0)
				);
			case 'scale': {
				const panelSpan = transform.output_range[1] - transform.output_range[0];
				if (panelSpan === 0 || !this.isValidTransformedHomeyWrite(mapping, capability, panelGrid.base)) {
					return false;
				}

				const transformedStep = Math.abs(
					(panelGrid.step * (transform.input_range[1] - transform.input_range[0])) / panelSpan,
				);

				return Number.isFinite(transformedStep) && matchesStep(transformedStep, capability.step, 0);
			}
			case 'clamp':
				return this.isClampedGridCompatible(mapping, capability, panelGrid, transform.minimum, transform.maximum);
			case 'round': {
				const quantum = 10 ** -(transform.precision ?? 0);
				return (
					matchesStep(panelGrid.step, quantum, 0) &&
					this.isValidTransformedHomeyWrite(mapping, capability, panelGrid.base) &&
					matchesStep(panelGrid.step, capability.step, 0)
				);
			}
			case 'map':
			case 'boolean':
				return false;
		}
	}

	private getPanelNumericGrid(
		channelCategory: ChannelCategory,
		propertyCategory: PropertyCategory,
		dataType: DataTypeType,
		mappingRange: HomeyValueRangeDefinition | undefined,
	): NumericGrid {
		const metadata = getPropertyMetadata(channelCategory, propertyCategory);
		const variant = metadata?.dataTypeVariants?.find((candidate) => candidate.data_type === dataType);
		const constraints = variant ?? metadata;
		const format = constraints?.format;
		const canonicalMinimum = Array.isArray(format) && typeof format[0] === 'number' ? format[0] : null;
		const canonicalMaximum = Array.isArray(format) && typeof format[1] === 'number' ? format[1] : null;
		const minimumCandidates = [canonicalMinimum, mappingRange?.minimum ?? null].filter(
			(value): value is number => value !== null,
		);
		const maximumCandidates = [canonicalMaximum, mappingRange?.maximum ?? null].filter(
			(value): value is number => value !== null,
		);
		const hasMappingBounds = mappingRange?.minimum !== undefined || mappingRange?.maximum !== undefined;

		return {
			base: mappingRange?.minimum ?? (hasMappingBounds ? 0 : (canonicalMinimum ?? 0)),
			minimum: minimumCandidates.length > 0 ? Math.max(...minimumCandidates) : null,
			maximum: maximumCandidates.length > 0 ? Math.min(...maximumCandidates) : null,
			step: mappingRange?.step ?? constraints?.step ?? (INTEGER_DATA_TYPES.has(dataType) ? 1 : null),
		};
	}

	private getExhaustiveGridValues(grid: NumericGrid): number[] | null {
		if (
			grid.minimum === null ||
			grid.maximum === null ||
			grid.maximum < grid.minimum ||
			grid.step === null ||
			!Number.isFinite(grid.step) ||
			grid.step <= 0
		) {
			return null;
		}

		const firstIndex = Math.ceil((grid.minimum - grid.base) / grid.step - Number.EPSILON * 16);
		const firstValue = grid.base + firstIndex * grid.step;
		const valueCount = Math.floor((grid.maximum - firstValue) / grid.step + Number.EPSILON * 16) + 1;

		if (valueCount < 0 || valueCount > MAX_EXHAUSTIVE_NUMERIC_GRID_VALUES) {
			return null;
		}

		return Array.from({ length: valueCount }, (_, index) => Number((firstValue + index * grid.step).toPrecision(15)));
	}

	private isValidTransformedHomeyWrite(
		mapping: ResolvedHomeyPropertyMapping,
		capability: HomeyCapability,
		panelValue: number,
	): boolean {
		try {
			return this.isValidHomeyValue(capability, this.mappingTransformer.write(mapping, panelValue));
		} catch {
			return false;
		}
	}

	private isClampedGridCompatible(
		mapping: ResolvedHomeyPropertyMapping,
		capability: HomeyCapability,
		grid: NumericGrid,
		minimum: number,
		maximum: number,
	): boolean {
		if (
			grid.step === null ||
			capability.step === null ||
			!matchesStep(grid.step, capability.step, 0) ||
			!this.isValidHomeyValue(capability, minimum) ||
			!this.isValidHomeyValue(capability, maximum)
		) {
			return false;
		}

		const firstInteriorIndex = Math.ceil((minimum - grid.base) / grid.step - Number.EPSILON * 16);
		const firstInteriorValue = Number((grid.base + firstInteriorIndex * grid.step).toPrecision(15));

		return firstInteriorValue > maximum || this.isValidTransformedHomeyWrite(mapping, capability, firstInteriorValue);
	}

	private hasIncompleteWritableEnumDomain(
		channelCategory: ChannelCategory,
		propertyCategory: PropertyCategory,
		dataType: DataTypeType,
		transform: HomeyTransformDefinition | undefined,
		mappingCanWrite: boolean,
	): boolean {
		if (!mappingCanWrite || dataType !== DataTypeType.ENUM || transform?.type !== 'map') {
			return false;
		}

		const metadata = getPropertyMetadata(channelCategory, propertyCategory);
		const variant = metadata?.dataTypeVariants?.find((candidate) => candidate.data_type === dataType);
		const format = variant ? variant.format : metadata?.format;

		return (
			Array.isArray(format) &&
			format.every((value): value is string => typeof value === 'string') &&
			format.some((value) => !Object.hasOwn(transform.write ?? {}, value))
		);
	}

	private createConversion(
		mapping: ResolvedHomeyPropertyMapping,
		dataType: DataTypeType,
		capability: HomeyCapability,
		mappingCanRead: boolean,
	): HomeyMappingPreviewConversionModel {
		const transform = mapping.property.transform;
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

		switch (transform?.type) {
			case undefined:
				break;
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
			case 'boolean': {
				const representationsEqual = transform.true_value === transform.false_value;
				conversion.reversible = !representationsEqual;
				conversion.lossy = representationsEqual;
				conversion.ambiguous = representationsEqual;
				break;
			}
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

		if (this.integerNormalizationCanLoseValues(transform, dataType, capability, mappingCanRead)) {
			conversion.lossy = true;
			conversion.reversible = false;
		}

		if (mapping.property.writeStrategy !== undefined) {
			conversion.reversible = true;
			conversion.lossy = false;
			conversion.ambiguous = false;
		}

		return conversion;
	}

	private getEffectivePropertyRange(
		mapping: ResolvedHomeyPropertyMapping,
		capability: HomeyCapability,
	): HomeyValueRangeDefinition | undefined {
		const configured = mapping.property.range;

		if (mapping.property.transform !== undefined || capability.type !== HomeyCapabilityType.NUMBER) {
			return configured;
		}

		const minimumCandidates = [configured?.minimum, capability.minimum].filter(
			(value): value is number => value !== undefined && value !== null,
		);
		const maximumCandidates = [configured?.maximum, capability.maximum].filter(
			(value): value is number => value !== undefined && value !== null,
		);
		const minimum = minimumCandidates.length > 0 ? Math.max(...minimumCandidates) : undefined;
		const maximum = maximumCandidates.length > 0 ? Math.min(...maximumCandidates) : undefined;
		const step = configured?.step ?? capability.step;

		if (minimum === undefined && maximum === undefined && step === undefined) {
			return undefined;
		}

		return { minimum, maximum, step };
	}

	private isWriteStrategyDomainCompatible(mapping: ResolvedHomeyPropertyMapping, capability: HomeyCapability): boolean {
		if (mapping.property.writeStrategy === undefined) {
			return true;
		}

		const modes = new Set(capability.enumValues.map((value) => value.id));

		return modes.has('auto') !== modes.has('heat_cool');
	}

	private integerNormalizationCanLoseValues(
		transform: HomeyTransformDefinition | undefined,
		dataType: DataTypeType,
		capability: HomeyCapability,
		mappingCanRead: boolean,
	): boolean {
		if (!mappingCanRead || capability.type !== HomeyCapabilityType.NUMBER || !INTEGER_DATA_TYPES.has(dataType)) {
			return false;
		}

		switch (transform?.type) {
			case undefined:
				return (
					capability.step === null || !Number.isInteger(capability.minimum ?? 0) || !Number.isInteger(capability.step)
				);
			case 'scale': {
				if (transform.clamp === true || capability.step === null) {
					return true;
				}

				const inputSpan = transform.input_range[1] - transform.input_range[0];
				if (inputSpan === 0) {
					return true;
				}

				const outputSpan = transform.output_range[1] - transform.output_range[0];
				const sourceBase = capability.minimum ?? transform.input_range[0];
				const outputBase =
					transform.output_range[0] + ((sourceBase - transform.input_range[0]) / inputSpan) * outputSpan;
				const outputStep = (capability.step / inputSpan) * outputSpan;

				return !Number.isInteger(outputBase) || !Number.isInteger(outputStep);
			}
			case 'map':
				return Object.values(transform.read ?? {}).some(
					(value) => typeof value !== 'number' || !Number.isInteger(value),
				);
			case 'boolean':
			case 'clamp':
			case 'round':
			case 'constant':
			case 'threshold':
			case 'thresholds':
				return false;
		}
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

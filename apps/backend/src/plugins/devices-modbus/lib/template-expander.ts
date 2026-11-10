import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { getPropertyMetadata } from '../../../modules/devices/utils/schema.utils';
import { MODBUS_DEFAULTS, ModbusByteOrder } from '../devices-modbus.constants';
import { CreateModbusDeviceStructureChannelDto } from '../dto/create-device-structure.dto';
import {
	ModbusTemplate,
	ModbusTemplateAddress,
	ModbusTemplateBinding,
	ModbusTemplateBit,
	ModbusTemplateChannel,
	ModbusTemplateProperty,
} from '../templates/modbus-template.types';

import { ModbusStructureIssue } from './structure-validation';

export interface ModbusTemplateOverrides {
	unit_id?: number;
	poll_interval_ms?: number;
}

export interface ModbusTemplateExpansion {
	template_id: string;
	template_revision: string;
	category: string;
	manufacturer: string;
	model: string;
	unit_id: number;
	poll_interval_ms?: number;
	byte_order?: ModbusByteOrder;
	word_order?: ModbusByteOrder;
	max_read_registers?: number;
	max_read_bits?: number;
	max_read_gap?: number;
	channels: CreateModbusDeviceStructureChannelDto[];
}

export class ModbusTemplateExpansionError extends Error {
	constructor(readonly issues: ModbusStructureIssue[]) {
		super(issues.map((issue) => `${issue.field}: ${issue.reason}`).join('; '));
		this.name = 'ModbusTemplateExpansionError';
	}
}

const MAX_ADDRESS = 65535;
const MAX_BIT = 15;

type PlainBinding = Omit<ModbusTemplateBinding, 'address' | 'bit'> & { address: number; bit?: number };

const computeAddress = (address: ModbusTemplateAddress, i: number): number =>
	typeof address === 'number' ? address : address.base + (address.step ?? 1) * Math.floor(i / (address.every ?? 1));

const computeBit = (bit: ModbusTemplateBit, i: number): number =>
	typeof bit === 'number' ? bit : ((bit.base ?? 0) + (bit.step ?? 1) * i) % (bit.modulo ?? 16);

export function expandModbusTemplate(
	template: ModbusTemplate,
	revision: string,
	overrides: ModbusTemplateOverrides = {},
): ModbusTemplateExpansion {
	const issues: ModbusStructureIssue[] = [];
	const defaults = template.defaults ?? {};

	const unitId = overrides.unit_id ?? defaults.unit_id?.default ?? MODBUS_DEFAULTS.UNIT_ID;
	const minUnit = defaults.unit_id?.min ?? 0;
	const maxUnit = defaults.unit_id?.max ?? 255;

	if (unitId < minUnit || unitId > maxUnit) {
		issues.push({ field: 'unit_id', reason: `must be between ${minUnit} and ${maxUnit}` });
	}

	const channels: CreateModbusDeviceStructureChannelDto[] = [];

	for (const channel of template.channels) {
		const count = channel.repeat?.count ?? 1;

		for (let i = 0; i < count; i++) {
			channels.push(expandChannel(channel, i, channels.length, issues));
		}
	}

	if (issues.length > 0) {
		throw new ModbusTemplateExpansionError(issues);
	}

	return {
		template_id: template.id,
		template_revision: revision,
		category: template.category,
		manufacturer: template.manufacturer,
		model: template.model,
		unit_id: unitId,
		poll_interval_ms: overrides.poll_interval_ms ?? defaults.poll_interval_ms,
		byte_order: defaults.byte_order,
		word_order: defaults.word_order,
		max_read_registers: defaults.max_read_registers,
		max_read_bits: defaults.max_read_bits,
		max_read_gap: defaults.max_read_gap,
		channels,
	};
}

function expandChannel(
	channel: ModbusTemplateChannel,
	i: number,
	index: number,
	issues: ModbusStructureIssue[],
): CreateModbusDeviceStructureChannelDto {
	const path = `channels[${index}]`;
	const substitute = (text: string, field: string): string =>
		text.replace(/\{([A-Za-z0-9_]+)\}/g, (match, word: string) => {
			if (word === 'i') {
				return String(i);
			}

			if (word === 'n') {
				return String(i + 1);
			}

			issues.push({ field, reason: `unknown placeholder {${word}}` });

			return match;
		});

	const identifier = substitute(channel.identifier, `${path}.identifier`);

	return {
		identifier,
		name: substitute(channel.name, `${path}.name`),
		category: channel.category,
		properties: channel.properties.map((property, p) =>
			expandProperty(property, channel, identifier, i, `${path}.properties[${p}]`, substitute, issues),
		),
	} as unknown as CreateModbusDeviceStructureChannelDto;
}

function expandProperty(
	property: ModbusTemplateProperty,
	channel: ModbusTemplateChannel,
	channelIdentifier: string,
	i: number,
	path: string,
	substitute: (text: string, field: string) => string,
	issues: ModbusStructureIssue[],
): Record<string, unknown> {
	const { identifier, name, read, write, ...rest } = property;

	const metadata = getPropertyMetadata(channel.category as ChannelCategory, property.category as PropertyCategory);
	const dataType = property.data_type ?? metadata?.data_type;

	if (dataType === undefined) {
		issues.push({
			field: `${path}.data_type`,
			reason: `data_type is required for ${channelIdentifier}.${property.identifier ?? property.category}`,
		});
	}

	const expanded: Record<string, unknown> = {
		...rest,
		data_type: dataType,
		permissions: property.permissions ?? metadata?.permissions ?? [],
	};

	if (identifier !== undefined) {
		expanded.identifier = substitute(identifier, `${path}.identifier`);
	}

	if (name !== undefined) {
		expanded.name = substitute(name, `${path}.name`);
	}

	if (read) {
		expanded.read = expandBinding(read, i, `${path}.read`, issues);
	}

	if (write) {
		expanded.write = expandBinding(write, i, `${path}.write`, issues);
	}

	return expanded;
}

function expandBinding(
	binding: ModbusTemplateBinding,
	i: number,
	path: string,
	issues: ModbusStructureIssue[],
): PlainBinding {
	const { address, bit, ...rest } = binding;
	const result: PlainBinding = { ...rest, address: computeAddress(address, i) };

	if (result.address < 0 || result.address > MAX_ADDRESS || !Number.isInteger(result.address)) {
		issues.push({
			field: `${path}.address`,
			reason: `computed address ${result.address} is outside 0 to ${MAX_ADDRESS}`,
		});
	}

	if (bit !== undefined) {
		result.bit = computeBit(bit, i);

		if (result.bit < 0 || result.bit > MAX_BIT || !Number.isInteger(result.bit)) {
			issues.push({ field: `${path}.bit`, reason: `computed bit ${result.bit} is outside 0 to ${MAX_BIT}` });
		}
	}

	return result;
}

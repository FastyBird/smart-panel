import {
	ModbusByteOrder,
	ModbusDataType,
	ModbusFraming,
	ModbusRegisterType,
	ModbusWriteFunction,
} from '../devices-modbus.constants';

/** Keys are snake_case exactly as written in the template YAML. */

export type ModbusTemplateAddress = number | { base: number; step?: number; every?: number };

export type ModbusTemplateBit = number | { base?: number; step?: number; modulo?: number };

export interface ModbusTemplateBinding {
	register_type: ModbusRegisterType;
	address: ModbusTemplateAddress;
	data_type: ModbusDataType;
	bit?: ModbusTemplateBit;
	byte_order?: ModbusByteOrder;
	word_order?: ModbusByteOrder;
	scale?: number;
	offset?: number;
	invert?: boolean;
	value_map?: { raw: number; value: string | number | boolean }[];
	write_function?: ModbusWriteFunction;
	poll_interval_ms?: number;
}

export interface ModbusTemplateProperty {
	category: string;
	identifier?: string;
	name?: string;
	data_type?: string;
	permissions?: string[];
	unit?: string;
	format?: (string | number)[];
	static_value?: string | number | boolean;
	read?: ModbusTemplateBinding;
	write?: ModbusTemplateBinding;
}

export interface ModbusTemplateChannel {
	category: string;
	identifier: string;
	name: string;
	repeat?: { count: number };
	properties: ModbusTemplateProperty[];
}

export interface ModbusTemplateDefaults {
	framing?: ModbusFraming;
	port?: number;
	unit_id?: { default: number; min?: number; max?: number; hint?: string };
	poll_interval_ms?: number;
	byte_order?: ModbusByteOrder;
	word_order?: ModbusByteOrder;
	max_read_registers?: number;
	max_read_bits?: number;
	max_read_gap?: number;
}

export interface ModbusTemplate {
	id: string;
	name: string;
	manufacturer: string;
	model: string;
	description?: string;
	category: string;
	defaults?: ModbusTemplateDefaults;
	channels: ModbusTemplateChannel[];
}

export interface ModbusTemplateFile {
	version: '1.0';
	templates: ModbusTemplate[];
}

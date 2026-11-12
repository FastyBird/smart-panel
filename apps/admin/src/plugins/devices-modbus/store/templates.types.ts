import type {
	DevicesModbusPluginByteOrder,
	DevicesModbusPluginDataType,
	DevicesModbusPluginFraming,
	DevicesModbusPluginRegisterType,
	DevicesModbusPluginWriteFunction,
	DevicesModuleDeviceCategory,
} from '../../../openapi.constants';

export type IModbusTemplateSource = 'builtin' | 'user' | string;

export interface IModbusTemplateDefaults {
	framing: DevicesModbusPluginFraming;
	port: number;
	unitId: { default: number; min: number; max: number; hint: string | null };
	pollIntervalMs: number;
	byteOrder: DevicesModbusPluginByteOrder;
	wordOrder: DevicesModbusPluginByteOrder;
}

export interface IModbusTemplateSummary {
	id: string;
	name: string;
	manufacturer: string;
	model: string;
	description: string | null;
	category: DevicesModuleDeviceCategory;
	source: IModbusTemplateSource;
	revision: string;
	path: string;
	overridesBuiltin: boolean;
	channelCount: number;
	pointCount: number;
	defaults: IModbusTemplateDefaults;
}

export interface IModbusTemplateFile {
	source: IModbusTemplateSource;
	path: string;
	loaded: number;
	errors: string[];
	warnings: string[];
}

export interface IModbusTemplateCatalog {
	templates: IModbusTemplateSummary[];
	files: IModbusTemplateFile[];
}

export interface IModbusTemplatePreviewOverrides {
	unitId?: number;
	pollIntervalMs?: number;
}

export interface IModbusTemplatePreviewValueMapEntry {
	raw: number;
	value: string | number | boolean;
}

export interface IModbusTemplatePreviewBinding {
	registerType: DevicesModbusPluginRegisterType;
	address: number;
	dataType: DevicesModbusPluginDataType;
	bit?: number;
	byteOrder?: DevicesModbusPluginByteOrder | null;
	wordOrder?: DevicesModbusPluginByteOrder | null;
	scale?: number;
	offset?: number;
	invert?: boolean;
	valueMap?: IModbusTemplatePreviewValueMapEntry[];
	writeFunction?: DevicesModbusPluginWriteFunction;
	pollIntervalMs?: number;
	longPressMs?: number;
}

export interface IModbusTemplatePreviewProperty {
	category: string;
	identifier?: string;
	name?: string;
	dataType: string;
	permissions: string[];
	unit?: string;
	format?: (string | number)[];
	staticValue?: string | number | boolean;
	read?: IModbusTemplatePreviewBinding;
	write?: IModbusTemplatePreviewBinding;
}

export interface IModbusTemplatePreviewChannel {
	identifier: string;
	name: string;
	category: string;
	properties: IModbusTemplatePreviewProperty[];
}

export interface IModbusTemplatePreview {
	templateId: string;
	templateRevision: string;
	category: DevicesModuleDeviceCategory;
	manufacturer: string;
	model: string;
	endpointDefaults: { framing: DevicesModbusPluginFraming; port: number };
	unitId: number;
	pollIntervalMs: number | null;
	byteOrder: DevicesModbusPluginByteOrder;
	wordOrder: DevicesModbusPluginByteOrder;
	maxReadRegisters: number | null;
	maxReadBits: number | null;
	maxReadGap: number | null;
	channels: IModbusTemplatePreviewChannel[];
}

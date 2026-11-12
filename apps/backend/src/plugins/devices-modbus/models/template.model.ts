import { Expose, Type, plainToInstance } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import {
	MODBUS_DEFAULTS,
	ModbusByteOrder,
	ModbusDataType,
	ModbusFraming,
	ModbusRegisterType,
	ModbusWriteFunction,
} from '../devices-modbus.constants';
import { ModbusTemplateExpansion } from '../lib/template-expander';
import { LoadedModbusTemplate, ModbusTemplateCatalog } from '../services/modbus-templates.service';

const SOURCES = ['builtin', 'user'];

@ApiSchema({ name: 'DevicesModbusPluginDataTemplateUnitId' })
export class ModbusTemplateUnitIdModel {
	@ApiProperty({ description: 'Default unit ID', type: 'integer', example: MODBUS_DEFAULTS.UNIT_ID })
	@Expose()
	default: number;

	@ApiProperty({ description: 'Lowest unit ID the device accepts', type: 'integer', example: 1 })
	@Expose()
	min: number;

	@ApiProperty({ description: 'Highest unit ID the device accepts', type: 'integer', example: 247 })
	@Expose()
	max: number;

	@ApiProperty({
		description: 'How the unit ID is set on the device',
		type: 'string',
		nullable: true,
		example: 'Set with the DIP switches on the board',
	})
	@Expose()
	hint: string | null;
}

@ApiSchema({ name: 'DevicesModbusPluginDataTemplateDefaults' })
export class ModbusTemplateDefaultsModel {
	@ApiProperty({
		description: 'Framing of the gateway the device is usually behind',
		enum: ModbusFraming,
		example: ModbusFraming.TCP,
	})
	@Expose()
	framing: ModbusFraming;

	@ApiProperty({ description: 'TCP port of the gateway', type: 'integer', example: MODBUS_DEFAULTS.PORT })
	@Expose()
	port: number;

	@ApiProperty({
		name: 'unit_id',
		description: 'Unit ID default and allowed range',
		type: () => ModbusTemplateUnitIdModel,
	})
	@Expose()
	@Type(() => ModbusTemplateUnitIdModel)
	unit_id: ModbusTemplateUnitIdModel;

	@ApiProperty({
		description: 'Poll interval in milliseconds',
		type: 'integer',
		example: MODBUS_DEFAULTS.POLL_INTERVAL_MS,
	})
	@Expose()
	poll_interval_ms: number;

	@ApiProperty({ description: 'Byte order', enum: ModbusByteOrder, example: ModbusByteOrder.BIG })
	@Expose()
	byte_order: ModbusByteOrder;

	@ApiProperty({ description: 'Word order', enum: ModbusByteOrder, example: ModbusByteOrder.BIG })
	@Expose()
	word_order: ModbusByteOrder;
}

@ApiSchema({ name: 'DevicesModbusPluginDataTemplateSummary' })
export class ModbusTemplateSummaryModel {
	@ApiProperty({ description: 'Template ID', type: 'string', example: 'qingjun-32di' })
	@Expose()
	id: string;

	@ApiProperty({ description: 'Template name', type: 'string', example: 'Qingjun 32 channel digital input' })
	@Expose()
	name: string;

	@ApiProperty({ description: 'Manufacturer', type: 'string', example: 'Qingjun' })
	@Expose()
	manufacturer: string;

	@ApiProperty({ description: 'Device model', type: 'string', example: 'MODBUS-RTU-32DI' })
	@Expose()
	model: string;

	@ApiProperty({ description: 'Description', type: 'string', nullable: true, example: '32 optically isolated inputs' })
	@Expose()
	description: string | null;

	@ApiProperty({ description: 'Device category', enum: DeviceCategory, example: DeviceCategory.SENSOR })
	@Expose()
	category: string;

	@ApiProperty({ description: 'Where the template was loaded from', enum: SOURCES, example: 'builtin' })
	@Expose()
	source: string;

	@ApiProperty({ description: 'Revision: a hash of the template content', type: 'string', example: '3f2a9c1b0d4e5f67' })
	@Expose()
	revision: string;

	@ApiProperty({
		description: 'File the template was loaded from',
		type: 'string',
		example: '/app/templates/qingjun.yaml',
	})
	@Expose()
	path: string;

	@ApiProperty({
		name: 'overrides_builtin',
		description: 'Whether it replaces a built-in template with the same ID',
		type: 'boolean',
		example: false,
	})
	@Expose()
	overrides_builtin: boolean;

	@ApiProperty({
		name: 'channel_count',
		description: 'Channels created with the default settings',
		type: 'integer',
		example: 32,
	})
	@Expose()
	channel_count: number;

	@ApiProperty({
		name: 'point_count',
		description: 'Properties read from or written to the device',
		type: 'integer',
		example: 32,
	})
	@Expose()
	point_count: number;

	@ApiProperty({ description: 'Defaults of the template', type: () => ModbusTemplateDefaultsModel })
	@Expose()
	@Type(() => ModbusTemplateDefaultsModel)
	defaults: ModbusTemplateDefaultsModel;

	static from(entry: LoadedModbusTemplate): ModbusTemplateSummaryModel {
		const { template } = entry;
		const defaults = template.defaults ?? {};

		return plainToInstance(ModbusTemplateSummaryModel, {
			id: template.id,
			name: template.name,
			manufacturer: template.manufacturer,
			model: template.model,
			description: template.description ?? null,
			category: template.category,
			source: entry.source,
			revision: entry.revision,
			path: entry.path,
			overrides_builtin: entry.overridesBuiltin,
			channel_count: entry.channelCount,
			point_count: entry.pointCount,
			defaults: {
				framing: defaults.framing ?? MODBUS_DEFAULTS.FRAMING,
				port: defaults.port ?? MODBUS_DEFAULTS.PORT,
				unit_id: {
					default: defaults.unit_id?.default ?? MODBUS_DEFAULTS.UNIT_ID,
					min: defaults.unit_id?.min ?? 0,
					max: defaults.unit_id?.max ?? 255,
					hint: defaults.unit_id?.hint ?? null,
				},
				poll_interval_ms: defaults.poll_interval_ms ?? MODBUS_DEFAULTS.POLL_INTERVAL_MS,
				byte_order: defaults.byte_order ?? MODBUS_DEFAULTS.BYTE_ORDER,
				word_order: defaults.word_order ?? MODBUS_DEFAULTS.WORD_ORDER,
			},
		});
	}
}

@ApiSchema({ name: 'DevicesModbusPluginDataTemplateFile' })
export class ModbusTemplateFileModel {
	@ApiProperty({ description: 'Where the file was loaded from', enum: SOURCES, example: 'builtin' })
	@Expose()
	source: string;

	@ApiProperty({ description: 'File path', type: 'string', example: '/app/templates/qingjun.yaml' })
	@Expose()
	path: string;

	@ApiProperty({ description: 'Number of templates loaded from the file', type: 'integer', example: 1 })
	@Expose()
	loaded: number;

	@ApiProperty({ description: 'Errors that kept templates from loading', type: 'array', items: { type: 'string' } })
	@Expose()
	errors: string[];

	@ApiProperty({ description: 'Warnings', type: 'array', items: { type: 'string' } })
	@Expose()
	warnings: string[];
}

@ApiSchema({ name: 'DevicesModbusPluginDataTemplateCatalog' })
export class ModbusTemplateCatalogModel {
	@ApiProperty({ description: 'Loaded templates', type: () => [ModbusTemplateSummaryModel] })
	@Expose()
	@Type(() => ModbusTemplateSummaryModel)
	templates: ModbusTemplateSummaryModel[];

	@ApiProperty({ description: 'Load result of every template file', type: () => [ModbusTemplateFileModel] })
	@Expose()
	@Type(() => ModbusTemplateFileModel)
	files: ModbusTemplateFileModel[];

	static from(catalog: ModbusTemplateCatalog): ModbusTemplateCatalogModel {
		return plainToInstance(ModbusTemplateCatalogModel, {
			templates: catalog.templates.map((entry) => ModbusTemplateSummaryModel.from(entry)),
			files: catalog.files.map((file) => ({
				source: file.source,
				path: file.path,
				loaded: file.loaded,
				errors: file.errors,
				warnings: file.warnings,
			})),
		});
	}
}

@ApiSchema({ name: 'DevicesModbusPluginDataTemplatePreviewValueMapEntry' })
export class ModbusTemplatePreviewValueMapEntryModel {
	@ApiProperty({ description: 'Raw value', type: 'number', example: 1 })
	@Expose()
	raw: number;

	@ApiProperty({
		description: 'Property value the raw value stands for',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		example: true,
	})
	@Expose()
	value: string | number | boolean;
}

@ApiSchema({ name: 'DevicesModbusPluginDataTemplatePreviewBinding' })
export class ModbusTemplatePreviewBindingModel {
	@ApiProperty({ description: 'Register table', enum: ModbusRegisterType, example: ModbusRegisterType.DISCRETE_INPUT })
	@Expose()
	register_type: ModbusRegisterType;

	@ApiProperty({ description: '0-based PDU address', type: 'integer', example: 4 })
	@Expose()
	address: number;

	@ApiProperty({ description: 'Value data type', enum: ModbusDataType, example: ModbusDataType.UINT16 })
	@Expose()
	data_type: ModbusDataType;

	@ApiPropertyOptional({ description: 'Bit index within a register', type: 'integer', example: 0 })
	@Expose()
	bit?: number;

	@ApiPropertyOptional({ description: 'Byte order override', enum: ModbusByteOrder, example: ModbusByteOrder.BIG })
	@Expose()
	byte_order?: ModbusByteOrder;

	@ApiPropertyOptional({ description: 'Word order override', enum: ModbusByteOrder, example: ModbusByteOrder.BIG })
	@Expose()
	word_order?: ModbusByteOrder;

	@ApiPropertyOptional({ description: 'Multiplier applied to the raw value', type: 'number', example: 1 })
	@Expose()
	scale?: number;

	@ApiPropertyOptional({ description: 'Offset added after scaling', type: 'number', example: 0 })
	@Expose()
	offset?: number;

	@ApiPropertyOptional({ description: 'Invert a boolean value', type: 'boolean', example: false })
	@Expose()
	invert?: boolean;

	@ApiPropertyOptional({
		description: 'Raw value to property value mapping',
		type: () => [ModbusTemplatePreviewValueMapEntryModel],
	})
	@Expose()
	@Type(() => ModbusTemplatePreviewValueMapEntryModel)
	value_map?: ModbusTemplatePreviewValueMapEntryModel[];

	@ApiPropertyOptional({
		description: 'Write function code selection',
		enum: ModbusWriteFunction,
		example: ModbusWriteFunction.SINGLE,
	})
	@Expose()
	write_function?: ModbusWriteFunction;

	@ApiPropertyOptional({
		description: 'Per-binding poll interval in milliseconds',
		type: 'integer',
		example: MODBUS_DEFAULTS.POLL_INTERVAL_MS,
	})
	@Expose()
	poll_interval_ms?: number;

	@ApiPropertyOptional({
		description: 'Hold time in milliseconds after which a button press counts as a long press',
		type: 'integer',
		example: MODBUS_DEFAULTS.LONG_PRESS_MS,
	})
	@Expose()
	long_press_ms?: number;
}

@ApiSchema({ name: 'DevicesModbusPluginDataTemplatePreviewProperty' })
export class ModbusTemplatePreviewPropertyModel {
	@ApiProperty({ description: 'Property category', enum: PropertyCategory, example: PropertyCategory.DETECTED })
	@Expose()
	category: string;

	@ApiPropertyOptional({ description: 'Property identifier', type: 'string', example: 'state' })
	@Expose()
	identifier?: string;

	@ApiPropertyOptional({ description: 'Property name', type: 'string', example: 'State' })
	@Expose()
	name?: string;

	@ApiProperty({ description: 'Data type', enum: DataTypeType, example: DataTypeType.BOOL })
	@Expose()
	data_type: string;

	@ApiProperty({
		description: 'Permissions',
		type: 'array',
		items: { type: 'string', enum: Object.values(PermissionType) },
		example: [PermissionType.READ_ONLY],
	})
	@Expose()
	permissions: string[];

	@ApiPropertyOptional({ description: 'Unit', type: 'string', example: 'V' })
	@Expose()
	unit?: string;

	@ApiPropertyOptional({
		description: 'Allowed values or range',
		type: 'array',
		items: { oneOf: [{ type: 'string' }, { type: 'number' }] },
		example: [0, 100],
	})
	@Expose()
	format?: (string | number)[];

	@ApiPropertyOptional({
		description: 'Fixed value of a static property',
		oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
		example: 'generic',
	})
	@Expose()
	static_value?: string | number | boolean;

	@ApiPropertyOptional({ description: 'Read binding', type: () => ModbusTemplatePreviewBindingModel })
	@Expose()
	@Type(() => ModbusTemplatePreviewBindingModel)
	read?: ModbusTemplatePreviewBindingModel;

	@ApiPropertyOptional({ description: 'Write binding', type: () => ModbusTemplatePreviewBindingModel })
	@Expose()
	@Type(() => ModbusTemplatePreviewBindingModel)
	write?: ModbusTemplatePreviewBindingModel;
}

@ApiSchema({ name: 'DevicesModbusPluginDataTemplatePreviewChannel' })
export class ModbusTemplatePreviewChannelModel {
	@ApiProperty({ description: 'Channel identifier', type: 'string', example: 'di_1' })
	@Expose()
	identifier: string;

	@ApiProperty({ description: 'Channel name', type: 'string', example: 'Input 1' })
	@Expose()
	name: string;

	@ApiProperty({ description: 'Channel category', enum: ChannelCategory, example: ChannelCategory.CONTACT })
	@Expose()
	category: string;

	@ApiProperty({ description: 'Channel properties', type: () => [ModbusTemplatePreviewPropertyModel] })
	@Expose()
	@Type(() => ModbusTemplatePreviewPropertyModel)
	properties: ModbusTemplatePreviewPropertyModel[];
}

@ApiSchema({ name: 'DevicesModbusPluginDataTemplatePreviewEndpointDefaults' })
export class ModbusTemplatePreviewEndpointDefaultsModel {
	@ApiProperty({ description: 'Framing of the gateway', enum: ModbusFraming, example: ModbusFraming.TCP })
	@Expose()
	framing: ModbusFraming;

	@ApiProperty({ description: 'TCP port of the gateway', type: 'integer', example: MODBUS_DEFAULTS.PORT })
	@Expose()
	port: number;
}

@ApiSchema({ name: 'DevicesModbusPluginDataTemplatePreview' })
export class ModbusTemplatePreviewModel {
	@ApiProperty({ description: 'Template ID', type: 'string', example: 'qingjun-32di' })
	@Expose()
	template_id: string;

	@ApiProperty({ description: 'Template revision', type: 'string', example: '3f2a9c1b0d4e5f67' })
	@Expose()
	template_revision: string;

	@ApiProperty({ description: 'Device category', enum: DeviceCategory, example: DeviceCategory.SENSOR })
	@Expose()
	category: string;

	@ApiProperty({ description: 'Manufacturer', type: 'string', example: 'Qingjun' })
	@Expose()
	manufacturer: string;

	@ApiProperty({ description: 'Device model', type: 'string', example: 'MODBUS-RTU-32DI' })
	@Expose()
	model: string;

	@ApiProperty({
		description: 'Endpoint defaults to offer when creating the endpoint',
		type: () => ModbusTemplatePreviewEndpointDefaultsModel,
	})
	@Expose()
	@Type(() => ModbusTemplatePreviewEndpointDefaultsModel)
	endpoint_defaults: ModbusTemplatePreviewEndpointDefaultsModel;

	@ApiProperty({ description: 'Unit ID', type: 'integer', example: MODBUS_DEFAULTS.UNIT_ID })
	@Expose()
	unit_id: number;

	@ApiProperty({
		description: 'Poll interval in milliseconds',
		type: 'integer',
		nullable: true,
		example: MODBUS_DEFAULTS.POLL_INTERVAL_MS,
	})
	@Expose()
	poll_interval_ms: number | null;

	@ApiProperty({ description: 'Byte order', enum: ModbusByteOrder, nullable: true, example: ModbusByteOrder.BIG })
	@Expose()
	byte_order: ModbusByteOrder | null;

	@ApiProperty({ description: 'Word order', enum: ModbusByteOrder, nullable: true, example: ModbusByteOrder.BIG })
	@Expose()
	word_order: ModbusByteOrder | null;

	@ApiProperty({
		description: 'Largest register read',
		type: 'integer',
		nullable: true,
		example: MODBUS_DEFAULTS.MAX_READ_REGISTERS,
	})
	@Expose()
	max_read_registers: number | null;

	@ApiProperty({
		description: 'Largest bit read',
		type: 'integer',
		nullable: true,
		example: MODBUS_DEFAULTS.MAX_READ_BITS,
	})
	@Expose()
	max_read_bits: number | null;

	@ApiProperty({
		description: 'Largest gap bridged between reads',
		type: 'integer',
		nullable: true,
		example: MODBUS_DEFAULTS.MAX_READ_GAP,
	})
	@Expose()
	max_read_gap: number | null;

	@ApiProperty({ description: 'Channels the device would get', type: () => [ModbusTemplatePreviewChannelModel] })
	@Expose()
	@Type(() => ModbusTemplatePreviewChannelModel)
	channels: ModbusTemplatePreviewChannelModel[];

	static from(expansion: ModbusTemplateExpansion, entry: LoadedModbusTemplate): ModbusTemplatePreviewModel {
		const defaults = entry.template.defaults ?? {};

		return plainToInstance(ModbusTemplatePreviewModel, {
			template_id: expansion.template_id,
			template_revision: expansion.template_revision,
			category: expansion.category,
			manufacturer: expansion.manufacturer,
			model: expansion.model,
			endpoint_defaults: {
				framing: defaults.framing ?? MODBUS_DEFAULTS.FRAMING,
				port: defaults.port ?? MODBUS_DEFAULTS.PORT,
			},
			unit_id: expansion.unit_id,
			poll_interval_ms: expansion.poll_interval_ms ?? null,
			byte_order: expansion.byte_order ?? null,
			word_order: expansion.word_order ?? null,
			max_read_registers: expansion.max_read_registers ?? null,
			max_read_bits: expansion.max_read_bits ?? null,
			max_read_gap: expansion.max_read_gap ?? null,
			channels: expansion.channels,
		});
	}
}

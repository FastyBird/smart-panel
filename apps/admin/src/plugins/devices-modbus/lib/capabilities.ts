export interface ModbusCapability {
	key: string;
	channelCategory: string;
	propertyCategory: string;
	readable: boolean;
	writable: boolean;
	dataType: 'bool';
}

/** Capabilities a custom (template-less) Modbus device can map. Template points may carry others. */
export const CUSTOM_CAPABILITIES: ModbusCapability[] = [
	{ key: 'binary_input.state', channelCategory: 'binary_input', propertyCategory: 'state', readable: true, writable: false, dataType: 'bool' },
	{ key: 'switcher.on', channelCategory: 'switcher', propertyCategory: 'on', readable: true, writable: true, dataType: 'bool' },
	{ key: 'outlet.on', channelCategory: 'outlet', propertyCategory: 'on', readable: true, writable: true, dataType: 'bool' },
];

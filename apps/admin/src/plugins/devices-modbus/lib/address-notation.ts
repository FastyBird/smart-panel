import { DevicesModbusPluginRegisterType } from '../../../openapi.constants';

export type AddressNotation = 'pdu' | 'one_based' | 'modicon';

export interface ParsedAddress {
	registerType: DevicesModbusPluginRegisterType | null;
	/** 0-based PDU address of the first point */
	start: number;
	count: number;
}

export const MAX_RANGE_POINTS = 256;
const MAX_PDU_ADDRESS = 65535;
const ERROR_PREFIX = 'devicesModbusPlugin.wizard.address.errors.';

/** The message is an i18n key. */
export class AddressNotationError extends Error {
	constructor(key: string) {
		super(`${ERROR_PREFIX}${key}`);
		this.name = 'AddressNotationError';
	}
}

const MODICON_PREFIXES: Record<string, DevicesModbusPluginRegisterType> = {
	'0': DevicesModbusPluginRegisterType.coil,
	'1': DevicesModbusPluginRegisterType.discrete_input,
	'3': DevicesModbusPluginRegisterType.input_register,
	'4': DevicesModbusPluginRegisterType.holding_register,
};

const modiconPrefixOf = (registerType: DevicesModbusPluginRegisterType): string =>
	Object.entries(MODICON_PREFIXES).find(([, type]) => type === registerType)?.[0] ?? '4';

interface ParsedEnd {
	registerType: DevicesModbusPluginRegisterType | null;
	address: number;
}

const parseEnd = (text: string, notation: AddressNotation): ParsedEnd => {
	if (!/^\d+$/.test(text)) {
		throw new AddressNotationError('invalid');
	}

	if (notation === 'pdu') {
		return { registerType: null, address: Number(text) };
	}

	if (notation === 'one_based') {
		const typed = Number(text);

		if (typed < 1) {
			throw new AddressNotationError('zeroNotAllowed');
		}

		return { registerType: null, address: typed - 1 };
	}

	if (text.length !== 5 && text.length !== 6) {
		throw new AddressNotationError('modiconFormat');
	}

	const registerType = MODICON_PREFIXES[text[0]];

	if (registerType === undefined) {
		throw new AddressNotationError('modiconFormat');
	}

	const typed = Number(text.slice(1));

	if (typed < 1) {
		throw new AddressNotationError('zeroNotAllowed');
	}

	return { registerType, address: typed - 1 };
};

export function parseAddressInput(input: string, notation: AddressNotation, registerType: DevicesModbusPluginRegisterType): ParsedAddress {
	void registerType;

	const text = input.trim();

	if (text === '') {
		throw new AddressNotationError('empty');
	}

	const parts = text.split('-').map((part) => part.trim());

	if (parts.length > 2) {
		throw new AddressNotationError('invalid');
	}

	const first = parseEnd(parts[0], notation);
	const last = parts.length === 2 ? parseEnd(parts[1], notation) : first;

	if (first.registerType !== last.registerType) {
		throw new AddressNotationError('modiconMixed');
	}

	if (last.address < first.address) {
		throw new AddressNotationError('reversed');
	}

	const count = last.address - first.address + 1;

	if (count > MAX_RANGE_POINTS) {
		throw new AddressNotationError('tooMany');
	}

	if (last.address > MAX_PDU_ADDRESS) {
		throw new AddressNotationError('outOfRange');
	}

	return { registerType: first.registerType, start: first.address, count };
}

export function formatAddress(pduAddress: number, registerType: DevicesModbusPluginRegisterType, notation: AddressNotation): string {
	if (notation === 'pdu') {
		return String(pduAddress);
	}

	if (notation === 'one_based') {
		return String(pduAddress + 1);
	}

	const digits = pduAddress + 1 > 9999 ? 5 : 4;

	return `${modiconPrefixOf(registerType)}${String(pduAddress + 1).padStart(digits, '0')}`;
}

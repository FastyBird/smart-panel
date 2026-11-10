import { ModbusWriteFunction } from '../devices-modbus.constants';

/** FC05/FC06 can only carry one value; several values (a multi-word value or a merged run) need FC15/FC16. */
export const isMultipleWrite = (preferMultiple: boolean, valueCount: number): boolean =>
	preferMultiple || valueCount > 1;

export const selectWriteFunction = (
	writeFunction: ModbusWriteFunction | null,
	valueCount: number,
): ModbusWriteFunction =>
	isMultipleWrite(writeFunction === ModbusWriteFunction.MULTIPLE, valueCount)
		? ModbusWriteFunction.MULTIPLE
		: ModbusWriteFunction.SINGLE;

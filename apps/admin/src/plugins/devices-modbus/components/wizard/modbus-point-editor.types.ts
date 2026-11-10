import type { AddressNotation } from '../../lib/address-notation';
import type { ModbusPoint } from '../../lib/points';

export interface IModbusPointEditorProps {
	visible: boolean;
	/** The row to edit; the editor works on a copy until Save. */
	point: ModbusPoint | null;
	notation: AddressNotation;
	/** True for rows added in the wizard; template rows keep their capability. */
	capabilityEditable: boolean;
}

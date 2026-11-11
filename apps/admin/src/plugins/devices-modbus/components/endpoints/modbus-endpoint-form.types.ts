import type { IUseModbusEndpointForm } from '../../composables/useModbusEndpointForm';
import type { IModbusEndpoint } from '../../store/endpoints.types';

export interface IModbusEndpointFormProps {
	endpoint?: IModbusEndpoint;
	/** A form state owned by the parent (the wizard); the component creates its own when omitted. */
	form?: IUseModbusEndpointForm;
	/** Locks every field, e.g. while the wizard saves the endpoint. */
	disabled?: boolean;
}

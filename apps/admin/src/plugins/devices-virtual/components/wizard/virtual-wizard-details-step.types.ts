import type { DevicesModuleDeviceCategory } from '../../../../openapi.constants';

export interface IVirtualWizardDetailsStepProps {
	category: DevicesModuleDeviceCategory | null;
	name: string;
	roomId: string | null;
	zoneIds: string[];
}

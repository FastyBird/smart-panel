import type { components } from '../../../openapi';
import type { VirtualWizardSourceOption } from '../components/virtual-wizard-add-sources.types';

export type GroupCapability = components['schemas']['DevicesVirtualPluginDataLightGroupCapability'];
export type GroupCandidate = components['schemas']['DevicesVirtualPluginDataGroupCandidate'];
export type GroupCategory = GroupCapability['category'];
export interface GroupMemberOption extends VirtualWizardSourceOption {
	capabilities: GroupCapability[];
	eligible: boolean;
	reasons: string[];
}

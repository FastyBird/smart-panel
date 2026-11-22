import type { Domain } from '../../../common/components/domain-icon.types';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { configDomain } from '../automations.domains';
import type { IAutomationGraphNode } from '../store/automations.store.types';

import { useAutomationNodeLookups } from './useAutomationNodeLookups';

/** The domain a block works with, from the devices in the devices store (spec section 7: `domain-icon` on blocks) */
export const useAutomationNodeDomain = (): { nodeDomain: (node: Pick<IAutomationGraphNode, 'config'>) => Domain | undefined } => {
	const lookups = useAutomationNodeLookups();

	return {
		nodeDomain: (node) => configDomain(node.config, (id) => lookups.device(id)?.category as DevicesModuleDeviceCategory | undefined),
	};
};

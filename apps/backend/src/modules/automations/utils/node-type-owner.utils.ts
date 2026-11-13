import { ConfigService } from '../../config/services/config.service';
import { AutomationNodeTypeOwner, RegisteredAutomationNodeType } from '../graph/node-type';

/**
 * Whether the module or plugin a node type belongs to is enabled (ADR 0003, decision 13). An owner without a
 * configuration is treated as the service manager treats it: not enabled.
 */
export const isAutomationNodeTypeOwnerEnabled = (
	configService: Pick<ConfigService, 'getModuleConfig' | 'getPluginConfig'>,
	owner: AutomationNodeTypeOwner,
): boolean => {
	try {
		const config =
			owner.kind === 'module' ? configService.getModuleConfig(owner.type) : configService.getPluginConfig(owner.type);

		return config?.enabled === true;
	} catch {
		return false;
	}
};

/**
 * Whether a node type can be offered at the moment: one of the automations module itself always can, one
 * of another module or a plugin only while its owner is enabled.
 */
export const isAutomationNodeTypeOffered = (
	configService: Pick<ConfigService, 'getModuleConfig' | 'getPluginConfig'>,
	nodeType: Pick<RegisteredAutomationNodeType, 'owner'>,
): boolean => nodeType.owner === undefined || isAutomationNodeTypeOwnerEnabled(configService, nodeType.owner);

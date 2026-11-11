import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { AUTOMATIONS_MODULE_NAME } from '../automations.constants';
import { AutomationsException } from '../automations.exceptions';
import {
	AutomationNodeTypeBase,
	AutomationNodeTypeDefinitionError,
	AutomationNodeTypeLookup,
	RegisteredAutomationNodeType,
	normalizeAutomationNodeType,
} from '../graph/node-type';

/**
 * Service for registering and retrieving automation node types ("cards").
 * Modules and plugins register their node types from `onModuleInit`.
 */
@Injectable()
export class AutomationNodeTypeRegistryService {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'AutomationNodeTypeRegistryService');
	private readonly nodeTypes = new Map<string, RegisteredAutomationNodeType>();

	/**
	 * The registry as the framework-free graph validator takes it
	 */
	readonly lookup: AutomationNodeTypeLookup = (type: string) => this.nodeTypes.get(type);

	/**
	 * Register a node type. Registering a type that already exists replaces it.
	 */
	register<TConfig extends object>(nodeType: AutomationNodeTypeBase<TConfig>): void {
		let registered: RegisteredAutomationNodeType;

		try {
			registered = normalizeAutomationNodeType(nodeType);
		} catch (error) {
			if (error instanceof AutomationNodeTypeDefinitionError) {
				this.logger.error(`[REGISTER] Refused an automation node type: ${error.message}`);

				throw new AutomationsException(error.message);
			}

			throw error;
		}

		if (this.nodeTypes.has(registered.type)) {
			this.logger.warn(`[REGISTER] Overwriting existing automation node type: ${registered.type}`);
		}

		this.nodeTypes.set(registered.type, registered);

		this.logger.log(`[REGISTER] Registered automation node type: ${registered.type} (${registered.kind})`);
	}

	/**
	 * Get a registered node type, or undefined when there is none
	 */
	get(type: string): RegisteredAutomationNodeType | undefined {
		return this.nodeTypes.get(type);
	}

	/**
	 * Check if a node type is registered
	 */
	has(type: string): boolean {
		return this.nodeTypes.has(type);
	}

	/**
	 * Get all registered node types, ordered by type
	 */
	list(): RegisteredAutomationNodeType[] {
		return Array.from(this.nodeTypes.values()).sort((a, b) => a.type.localeCompare(b.type));
	}
}

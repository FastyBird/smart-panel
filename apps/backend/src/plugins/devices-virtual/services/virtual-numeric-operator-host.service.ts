import type { DiscoveredBackendExtension } from '@fastybird/smart-panel-extension-sdk';
import {
	Inject,
	Injectable,
	Logger,
	OnApplicationBootstrap,
	OnModuleDestroy,
	OnModuleInit,
	Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { EventType as ConfigEvent } from '../../../modules/config/config.constants';
import { ModulesTypeMapperService } from '../../../modules/config/services/modules-type-mapper.service';
import { PluginsTypeMapperService } from '../../../modules/config/services/plugins-type-mapper.service';
import { DISCOVERED_BACKEND_EXTENSIONS } from '../../../modules/extensions/services/discovered-backend.module';
import { ExtensionsService } from '../../../modules/extensions/services/extensions.service';
import {
	IManagedExtensionService,
	ServiceState,
} from '../../../modules/extensions/services/managed-extension-service.interface';
import { ManagedServiceManagerService } from '../../../modules/extensions/services/managed-service-manager.service';
import { EventType as SystemEvent } from '../../../modules/system/system.constants';

import { VirtualNumericOperatorRegistry } from './virtual-numeric-operator.registry';

class NumericOperatorAdapter implements IManagedExtensionService {
	readonly serviceId = 'numeric-operators';
	readonly owner: { kind: 'module' | 'plugin'; type: string };
	private state: ServiceState = 'stopped';
	private dispose?: () => void;
	constructor(
		private readonly descriptor: DiscoveredBackendExtension,
		private readonly registry: VirtualNumericOperatorRegistry,
	) {
		this.owner = Object.freeze({ kind: descriptor.kind, type: descriptor.configOwnerType });
	}
	getState(): ServiceState {
		return this.state;
	}
	start(): Promise<void> {
		if (!this.dispose) this.dispose = this.registry.activate(this.descriptor.pkgName, this.descriptor.numericOperators);
		this.state = 'started';
		return Promise.resolve();
	}
	/** Revoke synchronously, including before the manager reaches an async config handler. */
	revokeCurrentAuthority(): void {
		this.revoke();
	}
	revoke(): void {
		const dispose = this.dispose;
		this.dispose = undefined;
		dispose?.();
	}
	stop(): Promise<void> {
		this.revoke();
		this.state = 'stopped';
		return Promise.resolve();
	}
	onConfigChanged(): Promise<{ restartRequired: boolean }> {
		this.revoke();
		return Promise.resolve({ restartRequired: true });
	}
}

@Injectable()
export class VirtualNumericOperatorHostService implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = new Logger(VirtualNumericOperatorHostService.name);
	private readonly adapters: NumericOperatorAdapter[] = [];
	private readonly stops: (() => void)[] = [];
	constructor(
		private readonly registry: VirtualNumericOperatorRegistry,
		private readonly manager: ManagedServiceManagerService,
		private readonly modules: ModulesTypeMapperService,
		private readonly plugins: PluginsTypeMapperService,
		private readonly extensions: ExtensionsService,
		private readonly events: EventEmitter2,
		@Optional()
		@Inject(DISCOVERED_BACKEND_EXTENSIONS)
		private readonly discovered: readonly DiscoveredBackendExtension[] = [],
	) {}
	onModuleInit(): void {
		const configUpdated = (payload?: { type: string; source: string }) => {
			for (const adapter of this.adapters)
				if (
					!payload ||
					payload.type === 'section' ||
					(payload.type === adapter.owner.kind && payload.source === adapter.owner.type)
				)
					adapter.revoke();
		};
		this.events.on(ConfigEvent.CONFIG_UPDATED, configUpdated);
		this.stops.push(() => this.events.off(ConfigEvent.CONFIG_UPDATED, configUpdated));
		for (const event of [ConfigEvent.CONFIG_RESET, SystemEvent.SYSTEM_FACTORY_RESET]) {
			const revoke = () => {
				for (const adapter of this.adapters) adapter.revoke();
			};
			this.events.on(event, revoke);
			this.stops.push(() => this.events.off(event, revoke));
		}
	}
	onApplicationBootstrap(): void {
		// All module mappings and metadata exist now. Routes and package names do not imply config ownership.
		const candidates = this.discovered.filter((d) => d.configOwnerType);
		for (const descriptor of candidates) {
			if (!descriptor.numericOperators) continue;
			const matchingOwner = candidates.filter(
				(d) => d.kind === descriptor.kind && d.configOwnerType === descriptor.configOwnerType,
			);
			const matchingPackage = candidates.filter((d) => d.pkgName === descriptor.pkgName);
			const mappings = descriptor.kind === 'module' ? this.modules.getMappings() : this.plugins.getMappings();
			if (
				matchingOwner.length !== 1 ||
				matchingPackage.length !== 1 ||
				!mappings.some(
					(m) =>
						m.type === descriptor.configOwnerType &&
						descriptor.backendExports?.includes(m.class) &&
						descriptor.backendExports?.includes(m.configDto),
				) ||
				!this.extensions.hasOwnerMetadata(descriptor.kind, descriptor.configOwnerType, descriptor.pkgName)
			) {
				this.logger.warn(`Numeric operator owner rejected: ${descriptor.pkgName}`);
				continue;
			}
			try {
				const adapter = new NumericOperatorAdapter(descriptor, this.registry);
				this.manager.register(adapter);
				this.adapters.push(adapter);
			} catch {
				this.logger.warn(`Numeric operator registration rejected: ${descriptor.pkgName}`);
			}
		}
	}
	onModuleDestroy(): void {
		for (const adapter of this.adapters) {
			adapter.revoke();
			this.manager.unregister(adapter.owner.kind, adapter.owner.type, adapter.serviceId);
		}
		for (const stop of this.stops.splice(0)) stop();
		this.adapters.length = 0;
	}
}

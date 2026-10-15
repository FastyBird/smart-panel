import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import {
	IDevicePlatform,
	IDevicePropertyData,
	PreparedCompositeDeviceBatch,
} from '../../../modules/devices/platforms/device.platform';
import { permissionSatisfied } from '../../../modules/devices/utils/property-permissions.utils';
import { guardScriptReadiness } from '../contracts/guard-script.contract';
import {
	ShellyProtectiveCommand,
	ShellyProtectiveCommandResult,
	ShellyProtectiveQualification,
	protectiveReadiness,
} from '../contracts/protective-switch.contract';
import { DelegatesManagerService } from '../delegates/delegates-manager.service';
import { DEVICES_SHELLY_NG_PLUGIN_NAME, DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import { DevicesShellyNgNotImplementedException } from '../devices-shelly-ng.exceptions';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../entities/devices-shelly-ng.entity';
import { ShellyGuardFenceReadback, ShellyGuardRpcSession } from '../services/shelly-guard-rpc-session';

export type IShellyNgDevicePropertyData = IDevicePropertyData & {
	device: ShellyNgDeviceEntity;
};

@Injectable()
export class ShellyNgDevicePlatform implements IDevicePlatform {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_NG_PLUGIN_NAME,
		'ShellyNgDevicePlatform',
	);

	constructor(private readonly delegatesManagerService: DelegatesManagerService) {}

	getType(): string {
		return DEVICES_SHELLY_NG_TYPE;
	}

	getProtectiveReadiness(
		identity: { deviceId: string; model: string; firmware: string },
		componentId: number,
		qualification?: ShellyProtectiveQualification,
	): { supported: boolean; reasons: readonly string[] } {
		const reasons = [...protectiveReadiness(identity, componentId, qualification)];
		if (!this.delegatesManagerService.hasGuardedTransport(identity.deviceId))
			reasons.push('guarded_transport_unavailable');
		return { supported: reasons.length === 0, reasons };
	}

	/**
	 * Validate database relationships and a readable/writable boolean switch leaf for the qualified component.
	 * Return a delegate-bound guard session only when the ordered-script metadata is eligible.
	 */
	prepareGuardRpcSession(
		target: IDevicePropertyData,
		qualification: ShellyProtectiveQualification,
	): ShellyGuardRpcSession | null {
		const { device, channel, property } = target;
		const component = /^switch:(\d+)$/.exec(channel.identifier ?? '');
		if (
			!(device instanceof ShellyNgDeviceEntity) ||
			!(channel instanceof ShellyNgChannelEntity) ||
			!(property instanceof ShellyNgChannelPropertyEntity) ||
			!component ||
			guardScriptReadiness(qualification.guardScript).length > 0 ||
			qualification.componentId !== Number(component[1]) ||
			property.category !== PropertyCategory.ON ||
			property.dataType !== DataTypeType.BOOL ||
			!['output', 'on'].includes(property.identifier) ||
			!permissionSatisfied(PermissionType.READ_ONLY, new Set(property.permissions ?? [])) ||
			!permissionSatisfied(PermissionType.WRITE_ONLY, new Set(property.permissions ?? []))
		)
			return null;
		const deviceId = typeof channel.device === 'string' ? channel.device : channel.device?.id;
		const channelId = typeof property.channel === 'string' ? property.channel : property.channel?.id;
		if (deviceId !== device.id || channelId !== channel.id) return null;
		return this.delegatesManagerService.prepareGuardRpcSession(device, Number(component[1]), qualification);
	}
	/** Route a guard OFF readback for a Shelly property to the delegate manager's lease-checked sample admission. */
	async admitGuardFenceSample(target: IDevicePropertyData, readback: ShellyGuardFenceReadback): Promise<void> {
		if (target.property instanceof ShellyNgChannelPropertyEntity)
			await this.delegatesManagerService.admitGuardFenceSample(target.property, readback);
	}

	/** Internal claim-authorized entrypoint; public generic setters never construct this command. */
	async processProtectiveCommand(
		target: Pick<IShellyNgDevicePropertyData, 'device' | 'channel' | 'property'>,
		command: ShellyProtectiveCommand,
		timeoutMs: number,
		isAdmitted?: () => boolean,
	): Promise<ShellyProtectiveCommandResult> {
		if (command.on && !isAdmitted) return { outcome: 'refused', reasons: ['command_authority_missing'] };
		const { device, channel, property } = target;
		const component = /^switch:(\d+)$/.exec(channel.identifier ?? '');
		const permissions = new Set(property.permissions ?? []);
		if (
			!(device instanceof ShellyNgDeviceEntity) ||
			!(channel instanceof ShellyNgChannelEntity) ||
			!(property instanceof ShellyNgChannelPropertyEntity) ||
			!component ||
			property.category !== PropertyCategory.ON ||
			property.dataType !== DataTypeType.BOOL ||
			!['output', 'on'].includes(property.identifier) ||
			!permissionSatisfied(PermissionType.READ_ONLY, permissions) ||
			!permissionSatisfied(PermissionType.WRITE_ONLY, permissions)
		) {
			return { outcome: 'refused', reasons: ['unsupported_protective_leaf'] };
		}
		const channelDeviceId = typeof channel.device === 'string' ? channel.device : channel.device?.id;
		const propertyChannelId = typeof property.channel === 'string' ? property.channel : property.channel?.id;
		if (channelDeviceId !== device.id || propertyChannelId !== channel.id || !device.identifier)
			return { outcome: 'refused', reasons: ['protective_leaf_identity_mismatch'] };
		return this.delegatesManagerService.protectiveSwitch(
			device.identifier,
			Number(component[1]),
			command,
			timeoutMs,
			isAdmitted,
		);
	}

	getCoverEffectScope(update: IDevicePropertyData): string | null {
		const mac = (update.device as ShellyNgDeviceEntity).canonicalMac;
		return mac &&
			update.channel.category === ChannelCategory.WINDOW_COVERING &&
			/^cover:\d+$/.test(update.channel.identifier ?? '')
			? `shelly-ng:${mac.toUpperCase()}|cover:${Number(update.channel.identifier.split(':')[1])}`
			: null;
	}
	async getCommandReadiness(update: IDevicePropertyData): Promise<{ commandable: boolean; reasons: string[] }> {
		if (update.channel.category !== ChannelCategory.WINDOW_COVERING)
			return { commandable: false, reasons: ['unsupported_readiness_profile'] };
		return this.delegatesManagerService.coverCommandReadiness(update);
	}
	async prepareCompositeBatch(updates: Array<IDevicePropertyData>): Promise<PreparedCompositeDeviceBatch | null> {
		if (updates.length === 0) return null;
		if (updates.some((update) => update.channel.category === ChannelCategory.WINDOW_COVERING)) {
			if (updates.length !== 1) return null;
			return this.delegatesManagerService.prepareCoverAction(updates[0]);
		}

		const groups = new Map<
			string,
			{
				device: ShellyNgDeviceEntity;
				channel: ShellyNgChannelEntity;
				on?: boolean;
				brightness?: number;
				properties: ShellyNgChannelPropertyEntity[];
			}
		>();
		const exact: IDevicePropertyData[] = [];
		for (const update of updates) {
			const { device, channel, property, value } = update;
			if (
				!(device instanceof ShellyNgDeviceEntity) ||
				!(channel instanceof ShellyNgChannelEntity) ||
				!(property instanceof ShellyNgChannelPropertyEntity) ||
				!device.enabled ||
				(typeof channel.device === 'string' ? channel.device : channel.device?.id) !== device.id ||
				(typeof property.channel === 'string' ? property.channel : property.channel?.id) !== channel.id ||
				!permissionSatisfied(PermissionType.WRITE_ONLY, new Set(property.permissions ?? []))
			)
				return null;
			const key = `${device.id}|${channel.id}`;
			const group = groups.get(key) ?? { device, channel, properties: [] };
			if (
				property.category === PropertyCategory.ON &&
				property.identifier === 'output' &&
				property.dataType === DataTypeType.BOOL &&
				typeof value === 'boolean'
			)
				group.on = value;
			else if (
				property.category === PropertyCategory.BRIGHTNESS &&
				property.identifier === 'brightness' &&
				typeof value === 'number' &&
				Number.isInteger(value) &&
				value >= 0 &&
				value <= 100
			)
				group.brightness = value;
			else return null;
			group.properties.push(property);
			groups.set(key, group);
			exact.push(Object.freeze({ device, channel, property, value }));
		}
		const commands: Array<{ isCurrent(): boolean; dispatch(isAdmitted: () => boolean): Promise<boolean> }> = [];
		for (const group of groups.values()) {
			// Brightness writes can energize: require explicit ON so every effect has a core-owned window.
			if (group.on === undefined) return null;
			const command = await this.delegatesManagerService.prepareLightingCommand(
				group.device,
				group.channel.identifier,
				group.on,
				group.brightness,
				group.properties,
			);
			if (!command) return null;
			commands.push(command);
		}
		const isCurrent = (): boolean => commands.every((command) => command.isCurrent());
		return {
			updates: Object.freeze(exact),
			isCurrent,
			dispatch: async (isAdmitted): Promise<boolean> => {
				const guard = (): boolean => isCurrent() && isAdmitted();
				for (const command of commands) if (!guard() || !(await command.dispatch(guard))) return false;
				return true;
			},
		};
	}

	async process({ device, channel, property, value }: IShellyNgDevicePropertyData): Promise<boolean> {
		return this.processBatch([{ device, channel, property, value }]);
	}

	async processBatch(updates: Array<IShellyNgDevicePropertyData>): Promise<boolean> {
		const device = updates[0].device;

		if (!(device instanceof ShellyNgDeviceEntity)) {
			this.logger.error('Failed to update device property, invalid device provided');

			return false;
		}

		const byDeviceChannel = new Map<
			string,
			{
				device: ShellyNgDeviceEntity;
				channel: ShellyNgChannelEntity;
				props: Map<string | number, { property: ShellyNgChannelPropertyEntity; value: string | number | boolean }>;
				order: string[];
			}
		>();

		for (const u of updates) {
			const key = `${u.device.id}|${u.channel.id}`;

			let entry = byDeviceChannel.get(key);

			if (!entry) {
				entry = {
					device: u.device,
					channel: u.channel,
					props: new Map(),
					order: [],
				};

				byDeviceChannel.set(key, entry);
			}

			const propId = u.property.id;

			if (!entry.props.has(propId)) {
				entry.order.push(String(propId));
			}

			entry.props.set(propId, { property: u.property, value: u.value });
		}

		const result = new Map<ShellyNgChannelPropertyEntity['id'], boolean>();

		for (const group of byDeviceChannel.values()) {
			const { device, channel, props, order } = group;
			try {
				const ordered = order.map((id) => props.get(id)).filter(Boolean);
				const response = await this.delegatesManagerService.setChannelValue(device, channel, ordered);

				for (const { property } of props.values()) {
					result.set(property.id, response !== false);
				}

				if (response === false) {
					this.logger.error('Failed to update device property');
				}

				continue;
			} catch (error) {
				if (!(error instanceof DevicesShellyNgNotImplementedException)) {
					const err = error as Error;

					this.logger.error('Error processing property update', {
						message: err.message,
						stack: err.stack,
					});

					return false;
				}
			}

			try {
				for (const { property, value } of props.values()) {
					const response = await this.delegatesManagerService.setPropertyValue(device, property, value);

					result.set(property.id, response !== false);

					if (response === false) {
						this.logger.error('Failed to update device property');
					}
				}
			} catch (error) {
				const err = error as Error;

				this.logger.error('Error processing property update', {
					message: err.message,
					stack: err.stack,
				});

				return false;
			}
		}

		const failed = Array.from(result.values()).filter((success) => !success);

		if (failed.length > 0) {
			this.logger.warn(`Some properties failed to update for device id=${device.id}: ${JSON.stringify(failed)}`, {
				resource: device.id,
			});

			return false;
		}

		this.logger.log(`Successfully processed all property updates for device id=${device.id}`, { resource: device.id });

		return true;
	}
}

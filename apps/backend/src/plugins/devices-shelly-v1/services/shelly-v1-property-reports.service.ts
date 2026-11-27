import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { EventType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { PropertySampleEvidence } from '../../../modules/devices/models/property-sample.model';
import { PropertyReadRequest } from '../../../modules/devices/platforms/device.platform';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { nextSampleIngress } from '../../../modules/devices/services/property-sample-ingress';
import { DEVICES_SHELLY_V1_TYPE, PropertyBinding } from '../devices-shelly-v1.constants';
import { ShellyV1DeviceEntity } from '../entities/devices-shelly-v1.entity';
import { RegisteredDevice, ShellyDevice, ShellyTemperatureReport } from '../interfaces/shellies.interface';
import { ShellyInfoResponse, ShellyStatusResponse } from '../interfaces/shelly-http.interface';
import { readShellyRelayStatus } from '../lib/shellies';
import { findShellyV1Descriptor, getShellyV1Bindings } from '../utils/descriptor.utils';

import { ShelliesAdapterService } from './shellies-adapter.service';
import {
	ShellyV1AdoptedIdentityService,
	shellyV1Address,
	shellyV1PinMatches,
	shellyV1ReportedMac,
} from './shelly-v1-adopted-identity.service';
import { ShellyV1HttpClientService } from './shelly-v1-http-client.service';

type Metadata = { id?: string; type?: string; channel?: string | Metadata; device?: string | Metadata };
type PendingRefresh = { next?: ShellyV1DeviceEntity; completion: Promise<boolean> };

type StatusObservation = {
	device: ShellyV1DeviceEntity;
	peer: ShellyDevice;
	registration: RegisteredDevice;
	host: string;
	bindings: PropertyBinding[];
	isCurrent: () => boolean;
	isBindingCurrent: (channelId: string, propertyId: string) => boolean;
	observedAt: Date;
	ingressSequence: number;
};

/** Only a separate GET of the physical device's status can confirm an idempotent relay command. */
@Injectable()
export class ShellyV1PropertyReportsService {
	private generation = 0;
	private unknownChange = 0;
	private readonly changed = new Map<string, number>();
	private readonly pending = new Map<string, PendingRefresh>();
	private readonly temperatureProbes = new WeakMap<RegisteredDevice, Promise<ShellyInfoResponse | null>>();

	constructor(
		private readonly adapter: ShelliesAdapterService,
		private readonly devices: DevicesService,
		private readonly channels: ChannelsService,
		private readonly properties: ChannelsPropertiesService,
		private readonly identities: ShellyV1AdoptedIdentityService,
		private readonly http: ShellyV1HttpClientService,
	) {}

	@OnEvent(EventType.DEVICE_UPDATED)
	@OnEvent(EventType.DEVICE_DELETED)
	invalidate(entity: Metadata): void {
		this.metadataChanged(entity, 'device');
	}
	@OnEvent(EventType.CHANNEL_UPDATED)
	@OnEvent(EventType.CHANNEL_DELETED)
	channelChanged(entity: Metadata): void {
		this.metadataChanged(entity, 'channel');
	}
	@OnEvent(EventType.CHANNEL_PROPERTY_UPDATED)
	@OnEvent(EventType.CHANNEL_PROPERTY_DELETED)
	propertyChanged(entity: Metadata): void {
		this.metadataChanged(entity, 'property');
	}

	private metadataChanged(entity: Metadata, kind: 'device' | 'channel' | 'property'): void {
		if (entity?.type && entity.type !== DEVICES_SHELLY_V1_TYPE) return;
		const relationId = (relation: string | Metadata | undefined) =>
			typeof relation === 'string' ? relation : relation?.id;
		const channel = entity?.channel;
		const deviceId =
			kind === 'device'
				? entity?.id
				: relationId(entity?.device ?? (typeof channel === 'object' ? channel.device : undefined));
		const channelId = kind === 'channel' ? entity?.id : relationId(channel);
		const propertyId = kind === 'property' ? entity?.id : undefined;
		const version = ++this.generation;
		if (deviceId) this.changed.set(`device:${deviceId}`, version);
		if (channelId) this.changed.set(`channel:${channelId}`, version);
		if (propertyId) this.changed.set(`property:${propertyId}`, version);
		if (!deviceId && !channelId && !propertyId) this.unknownChange = version;
	}

	supports(binding: PropertyBinding): boolean {
		return (
			(binding.category === PropertyCategory.ON && /^relay\d+$/.test(binding.shelliesProperty)) ||
			(binding.category === PropertyCategory.TEMPERATURE && binding.shelliesProperty === 'temperature')
		);
	}

	capture(device: ShellyV1DeviceEntity, generation = this.generation): StatusObservation | null {
		const registration = this.adapter.getRegisteredDevice(device.identifier);
		const peer = registration && this.adapter.getDevice(registration.type, registration.id);
		const descriptor = peer && findShellyV1Descriptor(peer.type);
		if (!device.enabled || !registration?.enabled || !peer?.online || !descriptor || registration.host !== peer.host)
			return null;
		const bindings = getShellyV1Bindings(descriptor, peer).filter((binding) => this.supports(binding));
		if (!bindings.length) return null;
		const host = peer.host;
		const mode = peer.mode;
		const unchanged = (kind: string, id: string) => (this.changed.get(`${kind}:${id}`) ?? 0) <= generation;
		const isCurrent = (): boolean =>
			this.unknownChange <= generation &&
			unchanged('device', device.id) &&
			this.adapter.isRunning() &&
			this.adapter.getRegisteredDevice(device.identifier) === registration &&
			this.adapter.getDevice(registration.type, registration.id) === peer &&
			peer.online &&
			peer.host === host &&
			peer.mode === mode;
		if (!isCurrent()) return null;
		return {
			device,
			peer,
			registration,
			host,
			bindings,
			isCurrent,
			isBindingCurrent: (channelId, propertyId) => unchanged('channel', channelId) && unchanged('property', propertyId),
			observedAt: new Date(),
			ingressSequence: nextSampleIngress(),
		};
	}

	refresh(device: ShellyV1DeviceEntity): Promise<boolean> {
		const pending = this.pending.get(device.id);
		if (pending) {
			pending.next = device;
			return pending.completion;
		}
		const work: PendingRefresh = {
			next: device,
			completion: Promise.resolve().then(async () => {
				let sent = false;
				try {
					while (work.next) {
						const next = work.next;
						work.next = undefined;
						sent = (await this.read(next).catch(() => false)) || sent;
					}
					return sent;
				} finally {
					this.pending.delete(device.id);
				}
			}),
		};
		this.pending.set(device.id, work);
		return work.completion;
	}

	async read(device: ShellyV1DeviceEntity, target?: PropertyReadRequest): Promise<boolean> {
		const source = this.capture(device);
		if (!source || !source.bindings.some((binding) => binding.category === PropertyCategory.ON)) return false;
		if (
			target &&
			!source.bindings.some(
				(binding) =>
					binding.channelIdentifier === target.channel.identifier &&
					binding.propertyIdentifier === target.property.identifier &&
					binding.category === PropertyCategory.ON &&
					binding.category === target.property.category &&
					binding.dataType === target.property.dataType,
			)
		)
			return false;
		// A new request boundary is needed even if an earlier ordinary refresh is pending.
		const read = await readShellyRelayStatus(source.peer, () => {
			target?.dispatching();
			source.ingressSequence = nextSampleIngress();
			source.observedAt = new Date();
		});
		try {
			if (read.status) await this.publish(source, read.status, new Date(), target);
		} catch {
			// Sleeping, offline or unauthenticated devices provide no physical observation.
		}
		return read.sent;
	}

	private readonly temperatureOrigins = new WeakMap<
		ShellyTemperatureReport,
		{ source: StatusObservation; binding: PropertyBinding; mappedIsCurrent?: () => boolean }
	>();
	private readonly temperatureAdmissions = new Map<number, { propertyId: string; published: boolean }>();

	@OnEvent(EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED)
	@OnEvent(EventType.CHANNEL_PROPERTY_SAMPLE_INVALIDATED)
	temperaturePublished(event: {
		propertyId: string;
		sample?: Pick<PropertySampleEvidence, 'ingressSequence' | 'provenance'>;
		evidence?: PropertySampleEvidence;
	}): void {
		const observation = event.sample ?? event.evidence;
		if (observation?.provenance !== 'live' || observation.ingressSequence === undefined) return;
		const pending = this.temperatureAdmissions.get(observation.ingressSequence);
		if (pending?.propertyId === event.propertyId) pending.published = true;
	}

	async temperature(report: ShellyTemperatureReport): Promise<boolean> {
		if (!report.isCurrent() || !report.isLatest()) return false;
		let origin = this.temperatureOrigins.get(report);
		if (!origin) {
			const generation = this.generation;
			const device = await this.devices.findOneBy<ShellyV1DeviceEntity>(
				'identifier',
				report.deviceId,
				DEVICES_SHELLY_V1_TYPE,
			);
			const source = device && this.capture(device, generation);
			const binding = source?.bindings.find((item) => item.shelliesProperty === 'temperature');
			if (!source || !binding) return false;
			const peerIsCurrent = source.isCurrent;
			source.isCurrent = () => peerIsCurrent() && report.isCurrent();
			source.observedAt = report.receivedAt;
			source.ingressSequence = report.ingressSequence;
			origin = { source, binding };
			this.temperatureOrigins.set(report, origin);
		}
		if (!origin.source.isCurrent() || !report.isLatest() || origin.mappedIsCurrent?.() === false) return false;
		const address = shellyV1Address(report.deviceId);
		if (
			!address ||
			address !== shellyV1Address(origin.source.peer.id) ||
			address !== shellyV1Address(origin.source.device.identifier)
		)
			return false;
		if (!(await this.verifyTemperatureHost(origin.source, address))) return false;
		if (!origin.source.isCurrent() || !report.isLatest()) return false;
		return this.reportBinding(origin.source, origin.binding, report.value, report.receivedAt, undefined, report);
	}

	private async verifyTemperatureHost(source: StatusObservation, address: string): Promise<boolean> {
		const { device, registration, host, isCurrent } = source;
		const pin = await this.identities.findPin(device.id);
		if (!isCurrent() || (pin && !shellyV1PinMatches(address, pin.mac))) return false;
		if (address.length === 12) return true;
		// A legacy installation may keep using its configured sensor until explicitly adopted.
		if (!pin) return !!host && device.hostname === host;
		if (pin.verifiedHost === host) return true;

		let probe = this.temperatureProbes.get(registration);
		if (probe === undefined) {
			probe = this.http
				.getDeviceInfo(host)
				.catch((): null => null)
				.finally(() => this.temperatureProbes.delete(registration));
			this.temperatureProbes.set(registration, probe);
		}
		const reported = shellyV1ReportedMac(address, registration.type, await probe);
		if (reported !== pin.mac || !isCurrent()) return false;
		return this.identities.confirmHost(device.id, pin.mac, host, pin.verifiedHost, pin.revision);
	}

	async publish(
		source: StatusObservation,
		status: ShellyStatusResponse,
		receivedAt: Date,
		target?: PropertyReadRequest,
	): Promise<void> {
		const mac = typeof status?.mac === 'string' ? status.mac.toUpperCase() : null;
		const address = shellyV1Address(source.peer.id);
		if (!mac || !address || !/^[0-9A-F]{12}$/.test(mac) || !mac.endsWith(address) || !source.isCurrent()) return;
		const expected = await this.identities.expected(source.device.id, source.device.identifier);
		if (expected !== mac || !source.isCurrent()) return;
		for (const binding of source.bindings) {
			if (
				target &&
				(target.channel.identifier !== binding.channelIdentifier ||
					target.property.identifier !== binding.propertyIdentifier)
			)
				continue;
			if (binding.category !== PropertyCategory.ON) continue;
			const value = status.relays?.[Number(binding.shelliesProperty.slice('relay'.length))]?.ison;
			if (typeof value !== 'boolean') continue;
			await this.reportBinding(source, binding, value, receivedAt, target);
		}
	}

	private async reportBinding(
		source: StatusObservation,
		binding: PropertyBinding,
		value: number | boolean | null,
		receivedAt: Date,
		target?: PropertyReadRequest,
		temperature?: ShellyTemperatureReport,
	): Promise<boolean> {
		const channel = await this.channels.findOneBy(
			'identifier',
			binding.channelIdentifier,
			source.device.id,
			DEVICES_SHELLY_V1_TYPE,
		);
		if (!channel || (target && channel.id !== target.channel.id)) return false;
		const property = await this.properties.findOneBy(
			'identifier',
			binding.propertyIdentifier,
			channel.id,
			DEVICES_SHELLY_V1_TYPE,
		);
		if (
			!property ||
			(target && target.property.id !== property.id) ||
			property.category !== binding.category ||
			property.dataType !== binding.dataType
		)
			return false;
		const isCurrent = (): boolean => source.isCurrent() && source.isBindingCurrent(channel.id, property.id);
		const origin = temperature && this.temperatureOrigins.get(temperature);
		if (!isCurrent() || temperature?.isLatest() === false || origin?.mappedIsCurrent?.() === false) return false;
		if (origin) origin.mappedIsCurrent ??= isCurrent;
		// reportSample also resolves when a write is suppressed. Only the exact accepted sample
		// or invalidated fault counts as publication of a CoIoT serial.
		const admission = temperature && { propertyId: property.id, published: false };
		if (admission) this.temperatureAdmissions.set(source.ingressSequence, admission);
		try {
			await this.properties.reportSample(
				property.id,
				{ type: DEVICES_SHELLY_V1_TYPE, value },
				{
					sampledAt: source.observedAt,
					observedAt: source.observedAt,
					receivedAt,
					ingressSequence: source.ingressSequence,
					provenance: 'live',
					...(temperature && { isCurrent: temperature.isLatest }),
					sourceIsCurrent: isCurrent,
				},
			);
		} catch (error) {
			if (!admission?.published) throw error;
		} finally {
			if (admission) this.temperatureAdmissions.delete(source.ingressSequence);
		}
		return admission?.published ?? true;
	}
}

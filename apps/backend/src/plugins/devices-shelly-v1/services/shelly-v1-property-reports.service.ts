import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { EventType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { PropertyReadRequest } from '../../../modules/devices/platforms/device.platform';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { nextSampleIngress } from '../../../modules/devices/services/property-sample-ingress';
import {
	DEVICES_SHELLY_V1_TYPE,
	PropertyBinding,
	SHELLY_V1_CHANNEL_IDENTIFIERS,
	SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS,
} from '../devices-shelly-v1.constants';
import { ShellyV1DeviceEntity } from '../entities/devices-shelly-v1.entity';
import { ShellyDevice, ShellyTemperatureReport } from '../interfaces/shellies.interface';
import { ShellyStatusResponse } from '../interfaces/shelly-http.interface';
import { findShellyV1Descriptor, getShellyV1Bindings } from '../utils/descriptor.utils';

import { ShelliesAdapterService } from './shellies-adapter.service';

type StatusObservation = {
	device: ShellyV1DeviceEntity;
	peer: ShellyDevice;
	bindings: PropertyBinding[];
	isCurrent: () => boolean;
	observedAt: Date;
	ingressSequence: number;
};

/** Only a separate GET of the physical device's status can confirm an idempotent relay command. */
@Injectable()
export class ShellyV1PropertyReportsService {
	private generation = 0;
	private readonly pending = new Map<string, Promise<boolean>>();

	constructor(
		private readonly adapter: ShelliesAdapterService,
		private readonly devices: DevicesService,
		private readonly channels: ChannelsService,
		private readonly properties: ChannelsPropertiesService,
	) {}

	@OnEvent(EventType.DEVICE_UPDATED)
	@OnEvent(EventType.DEVICE_DELETED)
	@OnEvent(EventType.CHANNEL_UPDATED)
	@OnEvent(EventType.CHANNEL_DELETED)
	@OnEvent(EventType.CHANNEL_PROPERTY_UPDATED)
	@OnEvent(EventType.CHANNEL_PROPERTY_DELETED)
	invalidate(entity: { type?: string }): void {
		if (entity?.type === DEVICES_SHELLY_V1_TYPE) this.generation++;
	}

	supports(binding: PropertyBinding): boolean {
		return (
			(binding.category === PropertyCategory.ON && /^relay\d+$/.test(binding.shelliesProperty)) ||
			(binding.category === PropertyCategory.TEMPERATURE && binding.shelliesProperty === 'temperature')
		);
	}

	capture(device: ShellyV1DeviceEntity): StatusObservation | null {
		const registration = this.adapter.getRegisteredDevice(device.identifier);
		const peer = registration && this.adapter.getDevice(registration.type, registration.id);
		const descriptor = peer && findShellyV1Descriptor(peer.type);
		if (!device.enabled || !registration?.enabled || !peer?.online || !descriptor) return null;
		const bindings = getShellyV1Bindings(descriptor, peer).filter((binding) => this.supports(binding));
		if (!bindings.length) return null;
		const host = peer.host;
		const mode = peer.mode;
		const generation = this.generation;
		const isCurrent = (): boolean =>
			this.generation === generation &&
			this.adapter.isRunning() &&
			this.adapter.getRegisteredDevice(device.identifier) === registration &&
			this.adapter.getDevice(registration.type, registration.id) === peer &&
			peer.online &&
			peer.host === host &&
			peer.mode === mode;
		if (!isCurrent()) return null;
		return { device, peer, bindings, isCurrent, observedAt: new Date(), ingressSequence: nextSampleIngress() };
	}

	refresh(device: ShellyV1DeviceEntity): Promise<boolean> {
		const pending = this.pending.get(device.id);
		if (pending !== undefined) return pending;
		const read = this.read(device).finally(() => this.pending.delete(device.id));
		this.pending.set(device.id, read);
		return read;
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
		target?.dispatching();
		source.ingressSequence = nextSampleIngress();
		source.observedAt = new Date();
		try {
			const status = await source.peer.getStatus();
			await this.publish(source, status, new Date(), target);
		} catch {
			// Sleeping, offline or unauthenticated devices provide no physical observation.
		}
		return true;
	}

	async temperature(report: ShellyTemperatureReport): Promise<void> {
		const generation = this.generation;
		const device = await this.devices.findOneBy<ShellyV1DeviceEntity>(
			'identifier',
			report.deviceId,
			DEVICES_SHELLY_V1_TYPE,
		);
		if (!device || !report.isCurrent() || this.generation !== generation) return;
		const source = this.capture(device);
		const binding = source?.bindings.find((item) => item.shelliesProperty === 'temperature');
		if (!source || !binding) return;
		source.observedAt = report.receivedAt;
		source.ingressSequence = report.ingressSequence;
		await this.reportBinding(source, binding, report.value, report.receivedAt);
	}

	async publish(
		source: StatusObservation,
		status: ShellyStatusResponse,
		receivedAt: Date,
		target?: PropertyReadRequest,
	): Promise<void> {
		const mac = status?.mac?.toUpperCase();
		const id = source.peer.id.split('-').at(-1)?.toUpperCase();
		if (!mac || !/^[0-9A-F]{12}$/.test(mac) || !id || !source.isCurrent()) return;
		if (id !== mac) {
			// Older CoIoT identities may contain only the last three bytes. The original
			// adopted serial number identifies the hardware behind a reused IP address.
			if (!/^[0-9A-F]{6}$/.test(id) || !mac.endsWith(id)) return;
			const info = await this.channels.findOneBy(
				'identifier',
				SHELLY_V1_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION,
				source.device.id,
				DEVICES_SHELLY_V1_TYPE,
			);
			const serial =
				info &&
				(await this.properties.findOneBy(
					'identifier',
					SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.SERIAL_NUMBER,
					info.id,
					DEVICES_SHELLY_V1_TYPE,
				));
			const expected = serial?.value?.value;
			if (typeof expected !== 'string' || expected.toUpperCase() !== mac || !source.isCurrent()) return;
		}
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
	): Promise<void> {
		const channel = await this.channels.findOneBy(
			'identifier',
			binding.channelIdentifier,
			source.device.id,
			DEVICES_SHELLY_V1_TYPE,
		);
		if (!channel || (target && channel.id !== target.channel.id)) return;
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
			property.dataType !== binding.dataType ||
			!source.isCurrent()
		)
			return;
		await this.properties.reportSample(
			property.id,
			{ type: DEVICES_SHELLY_V1_TYPE, value },
			{
				sampledAt: source.observedAt,
				observedAt: source.observedAt,
				receivedAt,
				ingressSequence: source.ingressSequence,
				provenance: 'live',
				sourceIsCurrent: source.isCurrent,
			},
		);
	}
}

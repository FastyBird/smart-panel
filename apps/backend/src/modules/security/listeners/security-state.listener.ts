import { Repository } from 'typeorm';

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { ChannelCategory, EventType as DevicesEventType, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { EventType, SECURITY_STATE_DEBOUNCE_MS } from '../security.constants';
import { SecurityAggregatorService } from '../services/security-aggregator.service';
import { SecurityAlertAckService } from '../services/security-alert-ack.service';
import { SecurityEventsService } from '../services/security-events.service';

/**
 * Property categories that can impact security state.
 */
const SECURITY_PROPERTY_CATEGORIES: PropertyCategory[] = [
	PropertyCategory.STATE,
	PropertyCategory.ALARM_STATE,
	PropertyCategory.TRIGGERED,
	PropertyCategory.TAMPERED,
	PropertyCategory.ACTIVE,
	PropertyCategory.FAULT,
	PropertyCategory.LAST_EVENT,
	PropertyCategory.DETECTED,
	PropertyCategory.CONCENTRATION,
	PropertyCategory.STATUS,
];

/**
 * Channel categories relevant to security monitoring.
 */
const SECURITY_CHANNEL_CATEGORIES: ChannelCategory[] = [
	ChannelCategory.ALARM,
	ChannelCategory.SMOKE,
	ChannelCategory.CARBON_MONOXIDE,
	ChannelCategory.LEAK,
	ChannelCategory.GAS,
	ChannelCategory.MOTION,
	ChannelCategory.OCCUPANCY,
	ChannelCategory.CONTACT,
];

@Injectable()
export class SecurityStateListener implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(SecurityStateListener.name);

	private debounceTimer: NodeJS.Timeout | null = null;
	private processingLock: Promise<void> = Promise.resolve();
	private seeded = false;

	constructor(
		@InjectRepository(ChannelEntity)
		private readonly channelRepository: Repository<ChannelEntity>,
		private readonly aggregator: SecurityAggregatorService,
		private readonly eventsService: SecurityEventsService,
		private readonly ackService: SecurityAlertAckService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async onModuleInit(): Promise<void> {
		this.logger.debug('Security state listener initialized');

		// Seed the events snapshot on startup so transitions during downtime
		// are not silently missed.
		try {
			await this.enqueueStateChange();
		} catch (error) {
			this.logger.warn(`Failed to seed security state on init: ${error}`);
		}
	}

	onModuleDestroy(): void {
		if (this.debounceTimer != null) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
	}

	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_CREATED)
	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_VALUE_SET)
	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_UPDATED)
	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_DELETED)
	async handlePropertyChanged(property: ChannelPropertyEntity): Promise<void> {
		try {
			await this.processPropertyChange(property);
		} catch (error) {
			this.logger.warn(`Failed to process security property change: ${error}`);
		}
	}

	@OnEvent(DevicesEventType.CHANNEL_CREATED)
	@OnEvent(DevicesEventType.CHANNEL_DELETED)
	handleChannelChanged(channel: ChannelEntity): void {
		if (!SECURITY_CHANNEL_CATEGORIES.includes(channel.category)) {
			return;
		}

		this.scheduleStateRecalculation();
	}

	@OnEvent(DevicesEventType.DEVICE_DELETED)
	handleDeviceDeleted(_device: DeviceEntity): void {
		// Channels are individually removed (emitting CHANNEL_DELETED) before
		// DEVICE_DELETED fires, but this is a safety net for edge cases where
		// the cascade may not trigger channel-level events.
		this.scheduleStateRecalculation();
	}

	private async processPropertyChange(property: ChannelPropertyEntity): Promise<void> {
		// Quick-filter by property category
		if (!SECURITY_PROPERTY_CATEGORIES.includes(property.category)) {
			return;
		}

		// Resolve channel to check if it's security-relevant
		const channelId = typeof property.channel === 'string' ? property.channel : property.channel?.id;

		if (!channelId) {
			return;
		}

		const channel = await this.channelRepository
			.createQueryBuilder('channel')
			.where('channel.id = :channelId', { channelId })
			.getOne();

		if (!channel) {
			return;
		}

		if (!SECURITY_CHANNEL_CATEGORIES.includes(channel.category)) {
			return;
		}

		// Schedule debounced state recalculation
		this.scheduleStateRecalculation();
	}

	/**
	 * Global debounce — single timer for all security state changes.
	 * Prevents flooding when multiple properties update quickly.
	 */
	private scheduleStateRecalculation(): void {
		if (this.debounceTimer != null) {
			clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = setTimeout(() => {
			this.debounceTimer = null;
			void this.enqueueStateChange();
		}, SECURITY_STATE_DEBOUNCE_MS);
	}

	/**
	 * Serialize state changes so only one processSecurityStateChange()
	 * runs at a time. Prevents out-of-order status emissions when a
	 * slower run finishes after a faster one.
	 */
	private async enqueueStateChange(): Promise<void> {
		const previous = this.processingLock;
		let resolve: () => void = () => {};
		this.processingLock = new Promise<void>((r) => (resolve = r));

		try {
			await previous;
			await this.processSecurityStateChange();
		} finally {
			resolve();
		}
	}

	private async processSecurityStateChange(): Promise<void> {
		try {
			const { status, providerErrors } = await this.aggregator.aggregateWithErrors();

			// Record transitions
			try {
				await this.eventsService.recordAlertTransitions(status.activeAlerts, status.armedState, status.alarmState);
			} catch (error) {
				this.logger.warn(`Failed to record alert transitions: ${error}`);
			}

			// Sync ack records — clean up stale acks only when aggregation is reliable
			if (providerErrors === 0 || status.activeAlerts.length > 0) {
				try {
					await this.syncAckRecords(status);
				} catch (error) {
					this.logger.warn(`Failed to sync ack records: ${error}`);
				}
			}

			// Apply acknowledgements for the emitted status
			if (status.activeAlerts.length > 0) {
				await this.annotateAcknowledgements(status);
			}

			// Emit status update
			this.eventEmitter.emit(EventType.SECURITY_STATUS, status);

			this.seeded = true;
		} catch (error) {
			this.logger.warn(`Failed to process security state change: ${error}`);
		}
	}

	/**
	 * Read-only acknowledgement annotation: looks up ack records and sets
	 * alert.acknowledged flag without writing to DB.
	 */
	private async annotateAcknowledgements(
		status: import('../models/security-status.model').SecurityStatusModel,
	): Promise<void> {
		const alertIds = status.activeAlerts.map((a) => a.id);
		const ackRecords = await this.ackService.findByIds(alertIds);
		const ackMap = new Map(ackRecords.map((r) => [r.id, r]));

		for (const alert of status.activeAlerts) {
			const record = ackMap.get(alert.id);

			if (record == null) {
				alert.acknowledged = false;

				continue;
			}

			const alertTime = new Date(alert.timestamp);
			alertTime.setMilliseconds(0);
			const alertTimeValid = !Number.isNaN(alertTime.getTime());

			if (alertTimeValid && (record.lastEventAt == null || alertTime > record.lastEventAt)) {
				// New event occurrence — acknowledged is false
				alert.acknowledged = false;
			} else {
				alert.acknowledged = record.acknowledged;
			}
		}
	}

	/**
	 * Sync ack records: reset acks for alerts with newer timestamps,
	 * and clean up stale ack records for alerts that no longer exist.
	 */
	private async syncAckRecords(status: import('../models/security-status.model').SecurityStatusModel): Promise<void> {
		// Reset acks for alerts with newer timestamps
		if (status.activeAlerts.length > 0) {
			const alertIds = status.activeAlerts.map((a) => a.id);
			const ackRecords = await this.ackService.findByIds(alertIds);
			const ackMap = new Map(ackRecords.map((r) => [r.id, r]));

			for (const alert of status.activeAlerts) {
				const record = ackMap.get(alert.id);

				if (record == null) {
					continue;
				}

				const alertTime = new Date(alert.timestamp);
				alertTime.setMilliseconds(0);
				const alertTimeValid = !Number.isNaN(alertTime.getTime());

				if (alertTimeValid && (record.lastEventAt == null || alertTime > record.lastEventAt)) {
					await this.ackService.resetAcknowledgement(alert.id, alertTime);
				}
			}
		}

		// Clean up stale ack records
		const activeIds = status.activeAlerts.map((a) => a.id);
		await this.ackService.cleanupStale(activeIds);
	}
}

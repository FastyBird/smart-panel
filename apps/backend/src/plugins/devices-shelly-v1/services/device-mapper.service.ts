import { Injectable, Optional } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { PropertySampleEvidence } from '../../../modules/devices/models/property-sample.model';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DeviceProvisionQueueService } from '../../../modules/devices/services/device-provision-queue.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	getPropertyDefaultValue,
	getPropertyMetadata,
	getRequiredProperties,
} from '../../../modules/devices/utils/schema.utils';
import {
	DEVICES_SHELLY_V1_PLUGIN_NAME,
	DEVICES_SHELLY_V1_TYPE,
	PropertyBinding,
	SHELLY_AUTH_USERNAME,
	SHELLY_V1_CHANNEL_IDENTIFIERS,
	SHELLY_V1_CHANNEL_PREFIX_TO_CATEGORY,
	SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS,
} from '../devices-shelly-v1.constants';
import { DevicesShellyV1NotSupportedException } from '../devices-shelly-v1.exceptions';
import { CreateShellyV1ChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateShellyV1ChannelDto } from '../dto/create-channel.dto';
import { CreateShellyV1DeviceDto } from '../dto/create-device.dto';
import { UpdateShellyV1ChannelPropertyDto } from '../dto/update-channel-property.dto';
import { UpdateShellyV1ChannelDto } from '../dto/update-channel.dto';
import {
	ShellyV1ChannelEntity,
	ShellyV1ChannelPropertyEntity,
	ShellyV1DeviceEntity,
} from '../entities/devices-shelly-v1.entity';
import {
	NormalizedDeviceEvent,
	RegisteredDevice,
	ShellyDevice,
	ShellyDevicePropertyValue,
} from '../interfaces/shellies.interface';
import { ShellyInfoResponse, ShellyStatusResponse } from '../interfaces/shelly-http.interface';
import { findShellyV1Descriptor, getShellyV1Bindings } from '../utils/descriptor.utils';
import { getSyntheticProperties, isSyntheticProperty } from '../utils/synthetic-properties.utils';
import { VALUE_MAP_REGISTRY, mapValueToCanonical, validateEnumValue } from '../utils/value-mapping.utils';

import { ShelliesAdapterService } from './shellies-adapter.service';
import {
	ShellyV1AdoptedIdentityService,
	ShellyV1AdoptionState,
	shellyV1Address,
	shellyV1DiscoveryOwner,
	shellyV1PinMatches,
	shellyV1RegistrationMatchesPin,
	shellyV1ReportedMac,
} from './shelly-v1-adopted-identity.service';
import { ShellyV1HttpClientService } from './shelly-v1-http-client.service';
import { ShellyV1InputTrackerService } from './shelly-v1-input-tracker.service';

type DiscoveryReading = { value: NonNullable<ShellyDevicePropertyValue>; evidence: PropertySampleEvidence };
type DiscoverySnapshot = {
	type: string;
	host: string;
	mode: ShellyDevice['mode'];
	readBinding: (binding: PropertyBinding, newlyCreated: boolean) => Promise<DiscoveryReading | null>;
};

@Injectable()
export class DeviceMapperService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_V1_PLUGIN_NAME,
		'DeviceMapperService',
	);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
		private readonly shelliesAdapter: ShelliesAdapterService,
		private readonly httpClient: ShellyV1HttpClientService,
		private readonly provisionQueue: DeviceProvisionQueueService,
		private readonly identities: ShellyV1AdoptedIdentityService,
		@Optional() private readonly inputTracker?: ShellyV1InputTrackerService,
	) {}

	/**
	 * Map and create or update a discovered device
	 */
	async mapDevice(event: NormalizedDeviceEvent, createIfNotExists = true): Promise<ShellyV1DeviceEntity | null> {
		const peer = this.shelliesAdapter.getDevice(event.type, event.id);
		const registration = this.shelliesAdapter.getRegisteredDevice(event.id, event.type);
		const inputBoundary = this.inputTracker?.captureBaseline();
		const counters = [0, 1, 2].map((index) => peer?.[`inputEventCounter${index}`]);
		return this.provisionQueue.enqueue(event.id, () =>
			this.doMapDevice(event, peer, registration, counters, createIfNotExists, inputBoundary),
		);
	}

	private async doMapDevice(
		event: NormalizedDeviceEvent,
		shellyDevice: ShellyDevice | undefined,
		registration: RegisteredDevice | undefined,
		counters: ShellyDevice[string][],
		createIfNotExists: boolean,
		inputBoundary?: number,
	): Promise<ShellyV1DeviceEntity | null> {
		if (!shellyDevice || !registration) {
			this.logger.warn(`Device ${event.id} not found in adapter`);
			throw new DevicesShellyV1NotSupportedException(`Device ${event.id} not found in adapter`);
		}

		const { host, type, id } = event;
		const mode = shellyDevice.mode;
		let boundDevice: Pick<ShellyV1DeviceEntity, 'id' | 'identifier' | 'hostname'> | undefined;
		let reusedClaim: RegisteredDevice['catalog'];
		const isEndpointCurrent = (): boolean =>
			registration?.id === id &&
			registration.type === type &&
			registration.host === host &&
			shellyDevice.host === host &&
			shellyDevice.mode === mode &&
			this.shelliesAdapter.getDevice(type, id) === shellyDevice &&
			this.shelliesAdapter.getRegisteredDevice(id, type) === registration &&
			(!reusedClaim || registration.catalog === reusedClaim) &&
			(!boundDevice || this.shelliesAdapter.getRegisteredDeviceForCatalog(boundDevice) === registration);
		const assertEndpoint = (): void => {
			if (!isEndpointCurrent())
				throw new DevicesShellyV1NotSupportedException('Discovered Shelly endpoint changed during mapping.');
		};
		assertEndpoint();
		const candidates = await this.identities.captureDiscovery(id);
		assertEndpoint();
		const claim = registration.catalog;
		let claimed: ShellyV1AdoptionState | null = null;
		if (claim) {
			try {
				claimed = shellyV1DiscoveryOwner(candidates, claim.mac, host);
				if (claimed?.id !== claim.deviceId || claimed.pin?.mac !== claim.mac)
					throw new DevicesShellyV1NotSupportedException('The registered Shelly catalog identity has changed.');
			} catch (error) {
				this.shelliesAdapter.releaseCatalogDevice(claim.deviceId);
				throw error;
			}
		}
		if (!createIfNotExists && !candidates.exact && candidates.aliases.length === 0) return null;

		// Find the device descriptor for this device type
		const descriptor = findShellyV1Descriptor(event.type);

		if (!descriptor) {
			this.logger.warn(`No descriptor found for device type: ${event.type}`);
			throw new DevicesShellyV1NotSupportedException(`Unsupported device type: ${event.type}`);
		}

		// Variables to store credentials for HTTP requests
		let username: string | undefined;
		let password: string | undefined;
		let credentialRevision: number | undefined;
		const assertCredentialRevision = (): void => {
			if (password !== undefined && registration?.credentialRevision !== credentialRevision)
				throw new DevicesShellyV1NotSupportedException('Shelly credentials changed during discovery.');
		};

		const address = shellyV1Address(id);
		const deviceInfo =
			candidates.exact?.enabled === false && candidates.exact.hostname === host && candidates.aliases.length === 0
				? undefined
				: await this.httpClient.getDeviceInfo(host).catch((): undefined => undefined);
		const mac = shellyV1ReportedMac(id, type, deviceInfo);
		assertEndpoint();
		if (claim && deviceInfo && mac !== claim.mac) {
			this.shelliesAdapter.releaseCatalogDevice(claim.deviceId);
			throw new DevicesShellyV1NotSupportedException('Discovered Shelly endpoint does not match the adopted identity.');
		}
		const verifiedClaim =
			!deviceInfo &&
			claimed &&
			registration.catalog === claim &&
			claim.revision === claimed.pin.revision &&
			claimed.hostname === host &&
			shellyV1RegistrationMatchesPin(registration, claimed, claimed.pin) &&
			this.shelliesAdapter.getRegisteredDeviceForCatalog(claimed) === registration;
		if (verifiedClaim) {
			reusedClaim = claim;
			boundDevice = claimed;
		}
		const ownerMac = mac ?? (verifiedClaim ? claim.mac : null);
		const adoptionState = shellyV1DiscoveryOwner(candidates, ownerMac, host);
		if (!adoptionState && !createIfNotExists) return null;
		const catalogIdentifier = adoptionState?.identifier ?? id;
		let device = adoptionState
			? await this.devicesService.findOneBy<ShellyV1DeviceEntity>('id', adoptionState.id, DEVICES_SHELLY_V1_TYPE)
			: null;
		assertEndpoint();
		if (
			adoptionState &&
			(!device ||
				device.id !== adoptionState.id ||
				device.identifier !== catalogIdentifier ||
				device.hostname !== adoptionState.hostname ||
				device.enabled !== adoptionState.enabled)
		)
			throw new DevicesShellyV1NotSupportedException('Discovered Shelly endpoint changed during mapping.');
		const pin = adoptionState?.pin;
		const catalogAddress = shellyV1Address(catalogIdentifier);
		let expected = pin?.mac ?? (device && catalogAddress?.length === 12 ? catalogAddress : null);
		let requiresPin = !!pin;
		let revision = pin?.revision;
		const assertVerifiedEndpoint = async (): Promise<void> => {
			assertEndpoint();
			const catalog =
				catalogIdentifier === id
					? await this.identities.captureDevice(catalogIdentifier)
					: shellyV1DiscoveryOwner(await this.identities.captureDiscovery(id), ownerMac, host);
			assertEndpoint();
			const current = catalog?.pin;
			if (password !== undefined && catalog?.password !== password)
				throw new DevicesShellyV1NotSupportedException('Shelly credentials changed during discovery.');
			if (
				!catalog ||
				catalog.id !== device.id ||
				(catalogIdentifier !== id && catalog.identifier !== catalogIdentifier) ||
				catalog.enabled !== device.enabled ||
				catalog.hostname !== host ||
				!!current !== requiresPin ||
				(current &&
					(!shellyV1PinMatches(id, current.mac) ||
						current.verifiedHost !== host ||
						(!!expected && current.mac !== expected) ||
						(!!mac && current.mac !== mac) ||
						(revision !== undefined && current.revision !== revision)))
			)
				throw new DevicesShellyV1NotSupportedException(
					'Discovered Shelly endpoint no longer matches the adopted identity.',
				);
			if (current) revision = current.revision;
		};
		const bindVerifiedPeer = (): void => {
			if (
				requiresPin &&
				mac &&
				!this.shelliesAdapter.bindCatalogDevice(registration, shellyDevice, device, mac, revision)
			)
				throw new DevicesShellyV1NotSupportedException('Could not bind a unique Shelly peer to the catalog device.');
			boundDevice = device;
			assertEndpoint();
		};
		const disablePeer = async (): Promise<ShellyV1DeviceEntity> => {
			this.shelliesAdapter.updateDeviceEnabledStatus(id, false, type);
			registration = this.shelliesAdapter.getRegisteredDevice(id, type);
			await this.deviceConnectivityService.setConnectionState(
				device.id,
				{ state: ConnectionState.UNKNOWN },
				isEndpointCurrent,
			);
			return device;
		};

		if (
			(pin && (!shellyV1PinMatches(id, pin.mac) || !shellyV1PinMatches(catalogIdentifier, pin.mac))) ||
			(deviceInfo && address && !mac) ||
			(expected && mac && mac !== expected) ||
			(pin && pin.verifiedHost !== host && (!expected || mac !== expected)) ||
			(device && device.hostname !== host && (!address || !expected || mac !== expected))
		)
			throw new DevicesShellyV1NotSupportedException('Discovered Shelly endpoint does not match the adopted identity.');
		const firstAlias = !!adoptionState && !pin && id !== catalogIdentifier;
		if (device && !device.enabled && !(firstAlias && device.hostname === host)) {
			if ((pin && pin.mac === mac && pin.verifiedHost === host && device.hostname === host) || verifiedClaim) {
				await assertVerifiedEndpoint();
				bindVerifiedPeer();
			}
			return disablePeer();
		}

		// lastSeen changes on every CoIoT packet. It can fence this snapshot but cannot date an individual value.
		const bindings = getShellyV1Bindings(descriptor, shellyDevice);
		const values = Object.fromEntries(
			bindings.map(({ shelliesProperty }) => [shelliesProperty, shellyDevice[shelliesProperty]]),
		);
		const lastSeen = shellyDevice.lastSeen;
		const snapshot: DiscoverySnapshot = {
			type,
			host,
			mode,
			readBinding: async (binding, newlyCreated) => {
				const key = binding.shelliesProperty;
				if (!newlyCreated && values[key] == null) return null;
				await assertVerifiedEndpoint();
				const raw = newlyCreated ? shellyDevice[key] : values[key];
				const seen = newlyCreated ? shellyDevice.lastSeen : lastSeen;
				const isCurrent = () => isEndpointCurrent() && shellyDevice.lastSeen === seen && shellyDevice[key] === raw;
				if (!isCurrent()) return null;
				const value = this.discoveryValue(binding, raw);
				if (value === null) return null;
				const receivedAt = new Date();
				return {
					value,
					evidence: {
						sampledAt: receivedAt,
						receivedAt,
						provenance: 'cached',
						replay: true,
						ageUnknown: true,
						seedOnly: { assertCurrent: assertVerifiedEndpoint },
						isCurrent,
					},
				};
			},
		};

		if (!device) {
			let deviceName = id;
			try {
				const settings = await this.httpClient.getDeviceSettings(host);
				deviceName = settings.name || id;
			} catch (error) {
				this.logger.warn(`Failed to fetch device settings from ${host}`, {
					message: error instanceof Error ? error.message : String(error),
				});
			}
			assertEndpoint();
			const createDto: CreateShellyV1DeviceDto = {
				type: DEVICES_SHELLY_V1_TYPE,
				identifier: event.id,
				name: deviceName,
				category: descriptor.categories[0] || DeviceCategory.GENERIC,
				enabled: true,
				hostname: host,
			};

			device = await this.identities.createDevice(createDto, mac ?? undefined, assertEndpoint);
			expected = mac ?? (address?.length === 12 ? address : null);
			requiresPin = address?.length === 6 && !!mac;

			this.logger.log(`Creating new device: ${event.id} with name: ${deviceName}`, { resource: device.id });
		} else {
			if (device.hostname !== host || firstAlias) {
				device = await this.identities.updateDevice(
					adoptionState,
					{ type: DEVICES_SHELLY_V1_TYPE, hostname: host },
					expected ? (mac ?? undefined) : undefined,
					{ assertEndpoint, reportedIdentifier: id },
				);
				if (firstAlias) requiresPin = true;
				revision = undefined;
				assertEndpoint();
			} else if (pin && pin.verifiedHost !== host && mac && expected === mac) {
				if (!(await this.identities.confirmHost(device.id, mac, host, pin.verifiedHost, pin.revision)))
					throw new DevicesShellyV1NotSupportedException('Could not confirm the adopted Shelly endpoint.');
				revision = undefined;
				assertEndpoint();
			}
		}

		await assertVerifiedEndpoint();
		bindVerifiedPeer();
		if (!device.enabled) return disablePeer();
		this.shelliesAdapter.updateDeviceEnabledStatus(id, true, type);
		registration = this.shelliesAdapter.getRegisteredDevice(id, type);
		if (adoptionState && device.password) {
			password = device.password;
			credentialRevision = registration.credentialRevision;
			await assertVerifiedEndpoint();
			try {
				const login = await this.httpClient.getLoginSettings(host);
				username = login.username || SHELLY_AUTH_USERNAME;
			} catch {
				username = SHELLY_AUTH_USERNAME;
			}
			await assertVerifiedEndpoint();
			assertCredentialRevision();
			if (!this.shelliesAdapter.setDeviceAuthCredentials(shellyDevice, host, username, password))
				throw new DevicesShellyV1NotSupportedException('The registered Shelly peer changed during credential setup.');
			credentialRevision = registration.credentialRevision;
		}

		await assertVerifiedEndpoint();
		assertCredentialRevision();
		await this.createDeviceInformationChannel(
			device,
			snapshot,
			deviceInfo,
			expected,
			assertVerifiedEndpoint,
			username,
			password,
		);
		await assertVerifiedEndpoint();
		await this.createChannelsFromBindings(device, bindings, snapshot);
		await assertVerifiedEndpoint();

		// Baseline input event counters on discovery/mapping to prevent stale events on startup
		if (this.inputTracker) {
			for (let i = 0; i < 3; i++) {
				const counter = counters[i];
				if (typeof counter === 'number') {
					this.inputTracker.baseline(device.id, i, counter, inputBoundary);
				}
			}
		}

		// Set device connection state to CONNECTED after successful discovery
		await this.deviceConnectivityService.setConnectionState(
			device.id,
			{ state: ConnectionState.CONNECTED },
			isEndpointCurrent,
		);
		assertEndpoint();

		this.logger.log(`Device ${device.identifier} discovery completed and set to CONNECTED`, { resource: device.id });

		return device;
	}

	/**
	 * Create device_information channel with device metadata properties
	 */
	private async createDeviceInformationChannel(
		device: ShellyV1DeviceEntity,
		shellyDevice: DiscoverySnapshot,
		deviceInfo: ShellyInfoResponse | undefined,
		adoptedMac: string | null,
		assertVerifiedEndpoint: () => Promise<void>,
		username?: string,
		password?: string,
	): Promise<void> {
		const channelIdentifier = SHELLY_V1_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION;

		// Fetch additional device information from HTTP API
		let deviceStatus: ShellyStatusResponse | undefined;

		try {
			deviceStatus = await this.httpClient.getDeviceStatus(shellyDevice.host, undefined, username, password);
		} catch (error) {
			this.logger.warn(`Failed to fetch device info from ${shellyDevice.host}`, {
				message: error instanceof Error ? error.message : String(error),
				resource: device.id,
			});
			// Continue with discovery even if HTTP requests fail
			deviceStatus = null;
		}

		await assertVerifiedEndpoint();
		// Check if a channel already exists
		let channel = await this.channelsService.findOneBy<ShellyV1ChannelEntity>(
			'identifier',
			channelIdentifier,
			device.id,
			DEVICES_SHELLY_V1_TYPE,
		);

		if (!channel) {
			const createChannelDto: CreateShellyV1ChannelDto = {
				type: DEVICES_SHELLY_V1_TYPE,
				device: device.id,
				identifier: channelIdentifier,
				name: 'Device Information',
				category: ChannelCategory.DEVICE_INFORMATION,
			};

			channel = await this.channelsService.create<ShellyV1ChannelEntity, CreateShellyV1ChannelDto>(createChannelDto);
		}

		// Define device information properties
		const deviceInfoProperties: Array<{
			identifier: string;
			name: string;
			category: PropertyCategory;
			dataType: DataTypeType;
			format?: number[] | string[];
			value?: string | number | boolean | null;
		}> = [
			{
				identifier: SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.MANUFACTURER,
				name: 'Manufacturer',
				category: PropertyCategory.MANUFACTURER,
				dataType: DataTypeType.STRING,
				value: 'Shelly',
			},
			{
				identifier: SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.MODEL,
				name: 'Model',
				category: PropertyCategory.MODEL,
				dataType: DataTypeType.STRING,
				value: shellyDevice.type,
			},
			{
				identifier: SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.SERIAL_NUMBER,
				name: 'Serial Number',
				category: PropertyCategory.SERIAL_NUMBER,
				dataType: DataTypeType.STRING,
				value: adoptedMac,
			},
			{
				identifier: SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.FIRMWARE_VERSION,
				name: 'Firmware Version',
				category: PropertyCategory.FIRMWARE_REVISION,
				dataType: DataTypeType.STRING,
				value: deviceInfo?.fw || null,
			},
			{
				identifier: SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.LINK_QUALITY,
				name: 'Link Quality',
				category: PropertyCategory.LINK_QUALITY,
				dataType: DataTypeType.UCHAR,
				format: [0, 100],
				value: deviceStatus?.wifi_sta?.rssi ? this.rssiToQuality(deviceStatus.wifi_sta.rssi) : null,
			},
			{
				identifier: SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.STATUS,
				name: 'Status',
				category: PropertyCategory.STATUS,
				dataType: DataTypeType.ENUM,
				format: [ConnectionState.CONNECTED, ConnectionState.DISCONNECTED, ConnectionState.UNKNOWN],
			},
		];

		// Add mode property if a device has it
		if (shellyDevice['mode']) {
			const modeValue = shellyDevice['mode'];

			deviceInfoProperties.push({
				identifier: SHELLY_V1_DEVICE_INFO_PROPERTY_IDENTIFIERS.MODE,
				name: 'Mode',
				category: PropertyCategory.MODE,
				dataType: DataTypeType.STRING,
				value: typeof modeValue === 'function' ? null : modeValue,
			});
		}

		// Create or update device information properties
		for (const propDef of deviceInfoProperties) {
			await this.createOrUpdateProperty(channel, propDef);
		}
	}

	/**
	 * Create channels and properties from bindings
	 */
	private async createChannelsFromBindings(
		device: ShellyV1DeviceEntity,
		bindings: PropertyBinding[],
		shellyDevice: DiscoverySnapshot,
	): Promise<void> {
		// Group bindings by channel
		const channelBindingsMap = new Map<string, PropertyBinding[]>();

		for (const binding of bindings) {
			if (!channelBindingsMap.has(binding.channelIdentifier)) {
				channelBindingsMap.set(binding.channelIdentifier, []);
			}

			channelBindingsMap.get(binding.channelIdentifier).push(binding);
		}

		// Determine channel categories and sort so control channels are created first
		const channelEntries = Array.from(channelBindingsMap.entries()).map(([identifier, channelBindings]) => ({
			identifier,
			bindings: channelBindings,
			category: this.inferChannelCategory(identifier, channelBindings, device.category),
		}));

		// Sort: control channels (light, switch, etc.) first, then monitoring channels (power, energy)
		const controlCategories = [
			ChannelCategory.LIGHT,
			ChannelCategory.OUTLET,
			ChannelCategory.SWITCHER,
			ChannelCategory.FAN,
			ChannelCategory.VALVE,
			ChannelCategory.WINDOW_COVERING,
		];
		const monitoringCategories = [ChannelCategory.ELECTRICAL_POWER, ChannelCategory.ELECTRICAL_ENERGY];

		channelEntries.sort((a, b) => {
			const aIsControl = controlCategories.includes(a.category);
			const bIsControl = controlCategories.includes(b.category);
			if (aIsControl && !bIsControl) return -1;
			if (!aIsControl && bIsControl) return 1;
			return 0;
		});

		// Map to store created channel identifiers -> channel IDs
		const channelIdMap = new Map<string, string>();

		// Create channels and their properties
		for (const entry of channelEntries) {
			// Find parent for monitoring channels
			let parentId: string | undefined;
			if (monitoringCategories.includes(entry.category)) {
				parentId = this.findParentChannelId(entry.identifier, channelIdMap, controlCategories, channelEntries);
			}

			const channel = await this.createChannelWithProperties(
				device,
				entry.identifier,
				entry.bindings,
				shellyDevice,
				parentId,
			);

			if (channel) {
				channelIdMap.set(entry.identifier, channel.id);
			}
		}
	}

	/**
	 * Find a parent channel ID for monitoring channels
	 * Matches based on channel index (e.g., power_0 -> light_0 or switch_0)
	 */
	private findParentChannelId(
		channelIdentifier: string,
		channelIdMap: Map<string, string>,
		controlCategories: ChannelCategory[],
		channelEntries: Array<{ identifier: string; category: ChannelCategory }>,
	): string | undefined {
		// Extract index from channel identifier (e.g., "power_0" -> "0")
		const match = channelIdentifier.match(/_(\d+)$/);
		const index = match ? match[1] : null;

		if (!index) {
			// No index, try to find any control channel
			for (const [identifier, id] of channelIdMap.entries()) {
				const entry = channelEntries.find((e) => e.identifier === identifier);
				if (entry && controlCategories.includes(entry.category)) {
					return id;
				}
			}
			return undefined;
		}

		// Find control channel with same index
		for (const [identifier, id] of channelIdMap.entries()) {
			const entry = channelEntries.find((e) => e.identifier === identifier);
			if (entry && controlCategories.includes(entry.category) && identifier.endsWith(`_${index}`)) {
				return id;
			}
		}

		return undefined;
	}

	/**
	 * Create a channel with its properties
	 */
	private async createChannelWithProperties(
		device: ShellyV1DeviceEntity,
		channelIdentifier: string,
		bindings: PropertyBinding[],
		shellyDevice: DiscoverySnapshot,
		parentId?: string,
	): Promise<ShellyV1ChannelEntity | null> {
		// Check if a channel already exists
		let channel = await this.channelsService.findOneBy<ShellyV1ChannelEntity>(
			'identifier',
			channelIdentifier,
			device.id,
			DEVICES_SHELLY_V1_TYPE,
		);

		if (!channel) {
			const channelCategory = this.inferChannelCategory(channelIdentifier, bindings, device.category);
			const channelName = this.formatChannelName(channelIdentifier);

			const createChannelDto: CreateShellyV1ChannelDto = {
				type: DEVICES_SHELLY_V1_TYPE,
				device: device.id,
				identifier: channelIdentifier,
				name: channelName,
				category: channelCategory,
				parent: parentId ?? null,
			};

			channel = await this.channelsService.create<ShellyV1ChannelEntity, CreateShellyV1ChannelDto>(createChannelDto);
		} else {
			// Update existing channel with parent if needed
			channel = await this.channelsService.update<ShellyV1ChannelEntity, UpdateShellyV1ChannelDto>(channel.id, {
				type: DEVICES_SHELLY_V1_TYPE,
				parent: parentId ?? null,
			});
		}

		// Publish cached device values only after the catalog operation, with the observation guard.
		for (const binding of bindings) {
			await this.createOrUpdateProperty(
				channel,
				{
					identifier: binding.propertyIdentifier,
					name: this.formatPropertyName(binding.propertyIdentifier),
					category: binding.category,
					dataType: binding.dataType,
					permissions: binding.permissions,
					format: binding.format,
				},
				(newlyCreated) => shellyDevice.readBinding(binding, newlyCreated),
			);
		}

		// Ensure all required properties from schema exist
		await this.ensureRequiredProperties(channel, bindings, shellyDevice);

		// Ensure synthetic properties (e.g., battery status derived from percentage)
		await this.ensureSyntheticProperties(channel, shellyDevice);

		return channel;
	}

	private discoveryValue(
		binding: PropertyBinding,
		raw: ShellyDevice[string],
	): NonNullable<ShellyDevicePropertyValue> | null {
		if (raw == null || typeof raw === 'function') return null;
		if (binding.category === PropertyCategory.ON && /^relay\d+$/.test(binding.shelliesProperty))
			return typeof raw === 'boolean' || raw === 0 || raw === 1 ? Boolean(raw) : null;
		if (binding.dataType === DataTypeType.BOOL && typeof raw === 'number') return Boolean(raw);
		if (binding.dataType !== DataTypeType.ENUM) return raw;

		let value = raw;
		if (binding.valueMap) {
			const mapping = VALUE_MAP_REGISTRY[binding.valueMap];
			if (mapping) {
				const mapped = mapValueToCanonical(
					raw,
					mapping.forward,
					`${binding.channelIdentifier}.${binding.propertyIdentifier}`,
				);
				if (mapped === null || !binding.format) return null;
				value = mapped;
			} else {
				this.logger.warn(`Value map "${binding.valueMap}" not found in registry for ${binding.propertyIdentifier}`);
			}
		}
		return !binding.format || validateEnumValue(value, binding.format, binding.propertyIdentifier) ? value : null;
	}

	/**
	 * Ensure all required properties from schema exist for the channel
	 * If a required property is missing, create it with schema default value
	 */
	private async ensureRequiredProperties(
		channel: ShellyV1ChannelEntity,
		bindings: PropertyBinding[],
		_shellyDevice: DiscoverySnapshot,
	): Promise<void> {
		// Get required properties from schema for this channel category
		const requiredProperties = getRequiredProperties(channel.category);

		this.logger.debug(
			`Checking required properties for channel ${channel.identifier} (${channel.category}): ${requiredProperties.join(', ')}`,
		);

		// Get existing property categories from bindings
		const existingPropertyCategories = bindings.map((b) => b.category);

		// Check each required property
		for (const requiredPropertyCategory of requiredProperties) {
			// Skip if already exists in bindings
			if (existingPropertyCategories.includes(requiredPropertyCategory)) {
				continue;
			}

			// Skip if it's a synthetic property (will be handled separately)
			if (isSyntheticProperty(channel.category, requiredPropertyCategory)) {
				continue;
			}

			// Get property metadata from schema
			const propertyMetadata = getPropertyMetadata(channel.category, requiredPropertyCategory);

			if (!propertyMetadata) {
				this.logger.warn(
					`No schema metadata found for required property ${requiredPropertyCategory} in channel ${channel.category}`,
				);
				continue;
			}

			// Get default value from schema
			const defaultValue = getPropertyDefaultValue(channel.category, requiredPropertyCategory);

			// Create the missing required property with schema metadata and default value
			await this.createOrUpdateProperty(channel, {
				identifier: `${requiredPropertyCategory.toLowerCase()}`,
				name: this.formatPropertyName(requiredPropertyCategory.toLowerCase()),
				category: requiredPropertyCategory,
				dataType: propertyMetadata.data_type,
				permissions: propertyMetadata.permissions,
				format: propertyMetadata.format ?? undefined,
				value: defaultValue,
			});
		}
	}

	/**
	 * Ensure synthetic properties are created and updated
	 * Synthetic properties are derived from other properties (e.g., battery status from percentage)
	 */
	private async ensureSyntheticProperties(
		channel: ShellyV1ChannelEntity,
		_shellyDevice: DiscoverySnapshot,
	): Promise<void> {
		// Get synthetic properties for this channel category
		const syntheticProperties = getSyntheticProperties(channel.category);

		if (syntheticProperties.length === 0) {
			return;
		}

		// Process each synthetic property
		for (const syntheticProp of syntheticProperties) {
			// Find the source property in the channel
			const sourceProperty = await this.channelsPropertiesService.findOneBy<ShellyV1ChannelPropertyEntity>(
				'category',
				syntheticProp.sourcePropertyCategory,
				channel.id,
			);

			if (!sourceProperty) {
				this.logger.warn(
					`Source property ${syntheticProp.sourcePropertyCategory} not found for synthetic property ${syntheticProp.propertyCategory} in channel ${channel.identifier}`,
				);
				continue;
			}

			// Check if the synthetic property already exists (to preserve user-configured values)
			const existingSyntheticProperty = await this.channelsPropertiesService.findOneBy<ShellyV1ChannelPropertyEntity>(
				'category',
				syntheticProp.propertyCategory,
				channel.id,
			);

			// Derive the synthetic value from the source property (passing existing value to preserve if needed)
			const syntheticValue = syntheticProp.deriveValue(
				sourceProperty.value?.value ?? null,
				existingSyntheticProperty?.value?.value ?? null,
			);

			// Get property metadata from schema
			const propertyMetadata = getPropertyMetadata(channel.category, syntheticProp.propertyCategory);

			if (!propertyMetadata) {
				this.logger.warn(
					`No schema metadata found for synthetic property ${syntheticProp.propertyCategory} in channel ${channel.category}`,
				);
				continue;
			}

			// Create or update the synthetic property
			await this.createOrUpdateProperty(channel, {
				identifier: `${syntheticProp.propertyCategory.toLowerCase()}`,
				name: this.formatPropertyName(syntheticProp.propertyCategory.toLowerCase()),
				category: syntheticProp.propertyCategory,
				dataType: propertyMetadata.data_type,
				permissions: propertyMetadata.permissions,
				format: propertyMetadata.format ?? undefined,
				value: syntheticValue,
			});
		}
	}

	/**
	 * Create or update a property with its initial value
	 */
	private async createOrUpdateProperty(
		channel: ShellyV1ChannelEntity,
		propDef: {
			identifier: string;
			name: string;
			category: PropertyCategory;
			dataType: DataTypeType;
			permissions?: PermissionType[];
			format?: number[] | string[];
			value?: string | number | boolean | null;
		},
		readBinding?: (newlyCreated: boolean) => Promise<DiscoveryReading | null>,
	): Promise<void> {
		// Check if a property already exists
		const existingProperty = await this.channelsPropertiesService.findOneBy<ShellyV1ChannelPropertyEntity>(
			'identifier',
			propDef.identifier,
			channel.id,
			DEVICES_SHELLY_V1_TYPE,
		);

		let property = existingProperty;
		if (!existingProperty) {
			const createPropertyDto: CreateShellyV1ChannelPropertyDto = {
				type: DEVICES_SHELLY_V1_TYPE,
				identifier: propDef.identifier,
				name: propDef.name,
				category: propDef.category,
				data_type: propDef.dataType,
				permissions: propDef.permissions || [PermissionType.READ_ONLY],
				...(propDef.format !== undefined && { format: propDef.format }),
				...(propDef.value !== undefined && propDef.value !== null && { value: propDef.value }),
			};

			property = await this.channelsPropertiesService.create<
				ShellyV1ChannelPropertyEntity,
				CreateShellyV1ChannelPropertyDto
			>(channel.id, createPropertyDto);
		} else {
			// Update existing property metadata and value (preserve name and description)

			await this.channelsPropertiesService.update<ShellyV1ChannelPropertyEntity, UpdateShellyV1ChannelPropertyDto>(
				existingProperty.id,
				toInstance(UpdateShellyV1ChannelPropertyDto, {
					type: DEVICES_SHELLY_V1_TYPE,
					// Don't update identifier or name - preserve user configuration
					category: propDef.category,
					data_type: propDef.dataType,
					permissions: propDef.permissions || [PermissionType.READ_ONLY],
					...(propDef.format !== undefined && { format: propDef.format }),
					...(propDef.value !== undefined && propDef.value !== null && { value: propDef.value }),
				}),
			);
		}
		if (!property?.id || !readBinding) return;
		const reading = await readBinding(!existingProperty);
		if (reading)
			await this.channelsPropertiesService.reportSample(
				property.id,
				{ type: DEVICES_SHELLY_V1_TYPE, value: reading.value },
				reading.evidence,
			);
	}

	/**
	 * Relay-type channel prefix to device-category-aware channel mapping.
	 * When the device category implies a specific channel type, the relay
	 * channel should match (e.g. outlet device → outlet channel).
	 */
	private static readonly RELAY_DEVICE_CATEGORY_TO_CHANNEL: Partial<Record<DeviceCategory, ChannelCategory>> = {
		[DeviceCategory.OUTLET]: ChannelCategory.OUTLET,
		[DeviceCategory.SWITCHER]: ChannelCategory.SWITCHER,
		[DeviceCategory.PUMP]: ChannelCategory.SWITCHER,
		[DeviceCategory.VALVE]: ChannelCategory.VALVE,
	};

	/**
	 * Infer a channel category from its property bindings
	 * 1. If channelCategory is defined in PropertyBinding, use that
	 * 2. For relay channels, use device category to determine channel type
	 * 3. If not, try to find category in SHELLY_V1_CHANNEL_PREFIX_TO_CATEGORY by prefix
	 * 4. If not found, use default property-based mapping
	 */
	private inferChannelCategory(
		channelIdentifier: string,
		bindings: PropertyBinding[],
		deviceCategory?: DeviceCategory,
	): ChannelCategory {
		// Step 1: Check if any binding has an explicit channelCategory defined
		for (const binding of bindings) {
			if (binding.channelCategory !== undefined) {
				return binding.channelCategory;
			}
		}

		// Step 2: For relay channels, use device category to determine channel type
		const prefix = channelIdentifier.split('_')[0];
		if (prefix === 'relay' && deviceCategory) {
			const mapped = DeviceMapperService.RELAY_DEVICE_CATEGORY_TO_CHANNEL[deviceCategory];
			if (mapped) {
				return mapped;
			}
		}

		// Step 3: Try to find category by channel identifier prefix
		if (SHELLY_V1_CHANNEL_PREFIX_TO_CATEGORY[prefix]) {
			return SHELLY_V1_CHANNEL_PREFIX_TO_CATEGORY[prefix];
		}

		// Step 3: Fall back to property-based inference
		for (const binding of bindings) {
			switch (binding.category) {
				case PropertyCategory.ON:
				case PropertyCategory.BRIGHTNESS:
				case PropertyCategory.LEVEL:
					return ChannelCategory.LIGHT;
				case PropertyCategory.POWER:
					return ChannelCategory.ELECTRICAL_POWER;
				case PropertyCategory.CONSUMPTION:
					return ChannelCategory.ELECTRICAL_ENERGY;
				case PropertyCategory.TEMPERATURE:
					return ChannelCategory.TEMPERATURE;
				case PropertyCategory.HUMIDITY:
					return ChannelCategory.HUMIDITY;
				case PropertyCategory.DETECTED:
					return ChannelCategory.CONTACT;
			}
		}

		return ChannelCategory.GENERIC;
	}

	/**
	 * Format channel identifier into a human-readable name
	 */
	private formatChannelName(identifier: string): string {
		// Convert snake_case to Title Case
		return identifier
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	/**
	 * Format property identifier into a human-readable name
	 */
	private formatPropertyName(identifier: string): string {
		// Convert snake_case to Title Case
		return identifier
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	/**
	 * Convert RSSI (dBm) to signal quality percentage (0-100)
	 */
	private rssiToQuality(rssi: number): number {
		if (rssi <= -100) return 0;
		if (rssi >= -50) return 100;

		return Math.round(2 * (rssi + 100));
	}
}

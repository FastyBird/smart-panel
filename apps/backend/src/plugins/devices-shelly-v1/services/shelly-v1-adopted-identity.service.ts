import { randomUUID } from 'node:crypto';
import { EntityManager, IsNull, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { SqliteDataSource, registerSqliteCommitGuard } from '../../../common/database/sqlite-data-source';
import { DeviceCreationContext } from '../../../modules/devices/services/device-creation-context';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import { DevicesShellyV1ValidationException } from '../devices-shelly-v1.exceptions';
import { CreateShellyV1DeviceDto } from '../dto/create-device.dto';
import { UpdateShellyV1DeviceDto } from '../dto/update-device.dto';
import { ShellyV1DeviceEntity } from '../entities/devices-shelly-v1.entity';
import { ShellyV1AdoptedIdentityEntity } from '../entities/shelly-v1-adopted-identity.entity';
import type { RegisteredDevice } from '../interfaces/shellies.interface';
import type { ShellyInfoResponse } from '../interfaces/shelly-http.interface';
import { shellyV1Address, shellyV1PinMatches } from '../utils/shelly-v1-address.utils';

export { shellyV1Address, shellyV1PinMatches } from '../utils/shelly-v1-address.utils';

type CatalogSettings = Pick<
	ShellyV1DeviceEntity,
	'id' | 'identifier' | 'hostname' | 'password' | 'name' | 'category' | 'enabled'
>;

export function shellyV1AdoptionState(
	device: CatalogSettings,
	pin: Pick<ShellyV1AdoptedIdentityEntity, 'mac' | 'verifiedHost' | 'revision'> | null,
) {
	return {
		id: device.id,
		identifier: device.identifier,
		hostname: device.hostname,
		password: device.password ?? null,
		name: device.name,
		category: device.category,
		enabled: Boolean(device.enabled),
		pin: pin && { mac: pin.mac, verifiedHost: pin.verifiedHost, revision: pin.revision },
	};
}

export type ShellyV1AdoptionState = ReturnType<typeof shellyV1AdoptionState>;

type CatalogRow = CatalogSettings & {
	mac: string | null;
	verifiedHost: string | null;
	revision: number | null;
};

function fromRow(row: CatalogRow): ShellyV1AdoptionState {
	return shellyV1AdoptionState(
		row,
		row.mac === null ? null : { mac: row.mac, verifiedHost: row.verifiedHost, revision: row.revision },
	);
}

export interface ShellyV1DiscoveryCandidates {
	exact: ShellyV1AdoptionState | null;
	aliases: ShellyV1AdoptionState[];
}

function claimsMac(row: ShellyV1AdoptionState, mac: string): boolean {
	return row.pin?.mac === mac || shellyV1Address(row.identifier) === mac;
}

/** Only a verified full MAC can select a catalog alias, including an original full-address identifier. */
export function shellyV1DiscoveryOwner(
	{ exact, aliases }: ShellyV1DiscoveryCandidates,
	mac: string | null | undefined,
	host: string,
): ShellyV1AdoptionState | null {
	if (aliases.length === 0) return exact;
	if (mac) {
		const matches = aliases.filter((alias) => claimsMac(alias, mac));
		if (matches.length === 0) return exact;
		const distinctExact =
			exact?.pin?.verifiedHost &&
			exact.pin.verifiedHost !== host &&
			exact.hostname !== host &&
			exact.pin.mac !== mac &&
			shellyV1PinMatches(exact.identifier, exact.pin.mac);
		if ((!exact || distinctExact) && matches.length === 1) {
			const [match] = matches;
			if (shellyV1PinMatches(match.identifier, mac) && (!match.pin || match.pin.mac === mac)) return match;
		}
	}
	throw new DevicesShellyV1ValidationException('Shelly discovery cannot verify a unique adopted hardware identity.');
}

export function shellyV1ReportedMac(
	identifier: string,
	type: string,
	info: Pick<ShellyInfoResponse, 'mac' | 'type'> | null | undefined,
): string | null {
	const mac = typeof info?.mac === 'string' ? info.mac.toUpperCase() : null;
	return mac && info?.type === type && shellyV1PinMatches(identifier, mac) ? mac : null;
}

/** A runtime alias belongs to the catalog UUID and full hardware pin verified at this endpoint. */
export function shellyV1RegistrationMatchesPin(
	registration: RegisteredDevice,
	device: Pick<ShellyV1DeviceEntity, 'id' | 'identifier'>,
	pin: Pick<ShellyV1AdoptedIdentityEntity, 'mac' | 'verifiedHost'> | null,
): boolean {
	const { catalog } = registration;
	if (!catalog) return registration.id === device.identifier;
	return (
		catalog.deviceId === device.id &&
		pin?.mac === catalog.mac &&
		pin.verifiedHost === registration.host &&
		shellyV1PinMatches(registration.id, catalog.mac) &&
		shellyV1PinMatches(device.identifier, catalog.mac)
	);
}

/** A short CoIoT address is unique only after adoption records the full hardware MAC. */
@Injectable()
export class ShellyV1AdoptedIdentityService {
	constructor(
		@InjectRepository(ShellyV1AdoptedIdentityEntity)
		private readonly identities: Repository<ShellyV1AdoptedIdentityEntity>,
		private readonly devices: DevicesService,
		private readonly structure: DeviceStructureLockService,
	) {}

	/** A verified short address is published only after the catalog row and its pin commit together. */
	async createDevice(
		dto: CreateShellyV1DeviceDto,
		mac?: string,
		assertEndpoint?: () => void,
	): Promise<ShellyV1DeviceEntity> {
		const address = shellyV1Address(dto.identifier);
		const pin = address?.length === 6 && !!mac;
		if ((mac && !shellyV1PinMatches(dto.identifier, mac)) || (pin && !dto.hostname))
			throw new Error('Shelly hardware identity does not match the selected device.');
		const createDto = { ...dto, id: dto.id ?? randomUUID() };
		const dataSource = this.identities.manager.connection;
		return this.structure.runExclusive(() =>
			DeviceCreationContext.run(
				(work) =>
					dataSource instanceof SqliteDataSource
						? dataSource.transactionWithWriteIntent(work)
						: dataSource.transaction(work),
				DEVICES_SHELLY_V1_TYPE,
				async (context) => {
					assertEndpoint?.();
					if (assertEndpoint && dataSource instanceof SqliteDataSource)
						registerSqliteCommitGuard(context.manager, () => {
							assertEndpoint();
							return true;
						});
					// A competing discovery can adopt the hardware under another identifier while the probe is in flight.
					if (address && (await this.hardwareAlreadyOwned(context.manager, dto.identifier, mac)))
						throw new DevicesShellyV1ValidationException(
							'Shelly hardware is already adopted. Retry with the current device.',
						);
					const created = await this.devices.create<ShellyV1DeviceEntity, CreateShellyV1DeviceDto>(createDto, context);
					if (pin)
						await context.manager.insert(ShellyV1AdoptedIdentityEntity, {
							deviceId: created.id,
							mac,
							verifiedHost: createDto.hostname,
						});
					assertEndpoint?.();
					return created;
				},
				() => undefined,
			),
		);
	}

	findPin(deviceId: string): Promise<ShellyV1AdoptedIdentityEntity | null> {
		return this.identities.findOneBy({ deviceId });
	}

	private catalogQuery(manager: EntityManager = this.identities.manager) {
		return manager
			.createQueryBuilder(ShellyV1DeviceEntity, 'device')
			.leftJoin(ShellyV1AdoptedIdentityEntity, 'pin', 'pin.deviceId = device.id')
			.select('device.id', 'id')
			.addSelect('device.identifier', 'identifier')
			.addSelect('device.hostname', 'hostname')
			.addSelect('device.password', 'password')
			.addSelect('device.name', 'name')
			.addSelect('device.category', 'category')
			.addSelect('device.enabled', 'enabled')
			.addSelect('pin.mac', 'mac')
			.addSelect('pin.verifiedHost', 'verifiedHost')
			.addSelect('pin.revision', 'revision');
	}

	async captureDevice(identifier: string): Promise<ShellyV1AdoptionState | null> {
		const row = await this.catalogQuery()
			.where('device.identifier = :identifier', { identifier })
			.getRawOne<CatalogRow>();
		return row ? fromRow(row) : null;
	}

	async captureDiscovery(
		identifier: string,
		manager: EntityManager = this.identities.manager,
	): Promise<ShellyV1DiscoveryCandidates> {
		const query = this.catalogQuery(manager).where('device.identifier = :identifier', { identifier });
		const address = shellyV1Address(identifier);
		if (address) {
			query.orWhere('pin.mac LIKE :suffix OR UPPER(device.identifier) LIKE :suffix', { suffix: `%${address}` });
		}
		const candidates = (await query.getRawMany<CatalogRow>()).map(fromRow);
		return {
			exact: candidates.find((row) => row.identifier === identifier) ?? null,
			aliases: candidates.filter((row) => {
				if (!address || row.identifier === identifier) return false;
				const catalogAddress = shellyV1Address(row.identifier);
				return (
					(row.pin && shellyV1PinMatches(identifier, row.pin.mac)) ||
					(catalogAddress?.length === 12 && catalogAddress.endsWith(address))
				);
			}),
		};
	}

	/** Read through the active writer so concurrent adoptions of different SDK identifiers cannot claim the same MAC. */
	private async hardwareAlreadyOwned(
		manager: EntityManager,
		identifier: string,
		reportedMac?: string,
	): Promise<boolean> {
		const { exact, aliases } = await this.captureDiscovery(identifier, manager);
		const address = shellyV1Address(identifier);
		const mac = reportedMac ?? (address?.length === 12 ? address : null);
		return !!exact || aliases.some((row) => !mac || claimsMac(row, mac));
	}

	async validateIdentifier(
		device: ShellyV1DeviceEntity,
		previous: Readonly<Partial<ShellyV1DeviceEntity>>,
	): Promise<void> {
		if (device.identifier === previous.identifier) return;
		const pin = await this.findPin(device.id);
		if (pin && !shellyV1PinMatches(device.identifier, pin.mac))
			throw new DevicesShellyV1ValidationException('Shelly identifier does not match its adopted hardware identity.');
	}

	/** Only the pinned hardware can move, and a delayed observation cannot undo a newer confirmation. */
	async confirmHost(
		deviceId: string,
		mac: string,
		host: string,
		previousHost: string | null,
		previousRevision: number,
	): Promise<boolean> {
		if (!Number.isSafeInteger(previousRevision) || previousRevision < 1) return false;
		if (host === previousHost)
			return this.identities.existsBy({ deviceId, mac, verifiedHost: host, revision: previousRevision });
		const match = { deviceId, mac, verifiedHost: previousHost ?? IsNull(), revision: previousRevision };
		const update = await this.identities.update(match, { verifiedHost: host });
		return update.affected === 1;
	}

	async expected(deviceId: string, identifier: string): Promise<string | null> {
		const address = shellyV1Address(identifier);
		if (!address) return null;
		const pin = await this.findPin(deviceId);
		if (pin) return shellyV1PinMatches(identifier, pin.mac) ? pin.mac : null;
		return address.length === 12 ? address : null;
	}

	/** An endpoint observation belongs to the catalog and pin revision captured before the request. */
	async updateDevice(
		state: ShellyV1AdoptionState,
		dto: UpdateShellyV1DeviceDto & { hostname: string },
		mac?: string,
		{
			assertEndpoint,
			reportedIdentifier = state.identifier,
		}: { assertEndpoint?: () => void; reportedIdentifier?: string } = {},
	): Promise<ShellyV1DeviceEntity> {
		const short = shellyV1Address(state.identifier)?.length === 6;
		const alias = reportedIdentifier !== state.identifier;
		if (
			(alias && (!mac || !shellyV1PinMatches(reportedIdentifier, mac))) ||
			(mac !== undefined && !shellyV1PinMatches(state.identifier, mac)) ||
			(state.pin && (!shellyV1PinMatches(state.identifier, state.pin.mac) || (mac && state.pin.mac !== mac))) ||
			(!mac &&
				(short || state.pin) &&
				(state.hostname !== dto.hostname || (state.pin && state.pin.verifiedHost !== dto.hostname)))
		)
			throw new DevicesShellyV1ValidationException('Shelly endpoint does not match the adopted hardware identity.');

		const stale = () =>
			new DevicesShellyV1ValidationException(
				'Shelly adoption changed during verification. Retry with the current device.',
			);
		return this.devices.update<ShellyV1DeviceEntity, UpdateShellyV1DeviceDto>(state.id, dto, {
			assertCurrent: assertEndpoint,
			persist: async (manager) => {
				const sameDevice = await manager.existsBy(ShellyV1DeviceEntity, {
					id: state.id,
					identifier: state.identifier ?? IsNull(),
					hostname: state.hostname ?? IsNull(),
					...(dto.name !== undefined && { name: state.name }),
					...(dto.category !== undefined && { category: state.category }),
					...(dto.password !== undefined && { password: state.password ?? IsNull() }),
				});
				const pins = manager.getRepository(ShellyV1AdoptedIdentityEntity);
				const pin = await pins.findOneBy({ deviceId: state.id });
				if (
					!sameDevice ||
					pin?.mac !== state.pin?.mac ||
					pin?.verifiedHost !== state.pin?.verifiedHost ||
					pin?.revision !== state.pin?.revision
				)
					throw stale();
				if (!mac) return false;
				const candidates = await this.captureDiscovery(reportedIdentifier, manager);
				if (shellyV1DiscoveryOwner(candidates, mac, dto.hostname)?.id !== state.id) throw stale();
				if (!pin && (short || alias)) {
					await pins.insert({ deviceId: state.id, mac, verifiedHost: dto.hostname });
					return true;
				}
				if (!pin || pin.verifiedHost === dto.hostname) return false;
				const update = await pins.update(
					{ deviceId: state.id, mac, revision: pin.revision },
					{ verifiedHost: dto.hostname },
				);
				if (update.affected !== 1) throw stale();
				return true;
			},
		});
	}

	/** A manual scan may know only the full MAC and host of a legacy, unpinned short-address device. */
	async findLegacyAtHost(hostname: string, mac: string): Promise<ShellyV1AdoptionState | null> {
		const rows = await this.catalogQuery()
			.where('device.hostname = :hostname AND pin.deviceId IS NULL', { hostname })
			.getRawMany<CatalogRow>();
		const matches = rows.filter(
			(row) => shellyV1Address(row.identifier)?.length === 6 && shellyV1PinMatches(row.identifier, mac),
		);
		if (matches.length > 1)
			throw new DevicesShellyV1ValidationException(
				'Multiple legacy Shelly devices match this host and hardware address.',
			);
		return matches.length === 1 ? fromRow(matches[0]) : null;
	}
}

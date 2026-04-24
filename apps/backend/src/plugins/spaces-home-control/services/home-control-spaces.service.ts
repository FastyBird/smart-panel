import { DataSource, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpacesTypeMapperService } from '../../../modules/spaces/services/spaces-type-mapper.service';
import { SpacesService } from '../../../modules/spaces/services/spaces.service';
import {
	SPACES_MODULE_NAME,
	SpaceRoomCategory,
	SpaceType,
	SpaceZoneCategory,
} from '../../../modules/spaces/spaces.constants';

/**
 * Home-control-specific space queries and proposals.
 *
 * Wraps the generic `SpacesService` with room/zone-shaped lookups that
 * only make sense in the home-control domain (the Room/Zone subtypes
 * are contributed by this plugin). Keeping these methods out of the
 * core service preserves the "modules own generic behaviour, plugins
 * own domain behaviour" boundary from Phase 3.
 */
@Injectable()
export class HomeControlSpacesService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'HomeControlSpacesService');

	constructor(
		@InjectRepository(DeviceEntity)
		private readonly deviceRepository: Repository<DeviceEntity>,
		private readonly dataSource: DataSource,
		private readonly spacesService: SpacesService,
		private readonly spacesTypeMapper: SpacesTypeMapperService,
	) {}

	async proposeSpaces(): Promise<
		{
			name: string;
			type: SpaceType;
			category: SpaceRoomCategory | SpaceZoneCategory | null;
			deviceIds: string[];
			deviceCount: number;
		}[]
	> {
		this.logger.debug('Proposing spaces based on device names');

		// Token to (type, category) mapping for intelligent space proposals
		const tokenMapping: Record<string, { type: SpaceType; category: SpaceRoomCategory | SpaceZoneCategory | null }> = {
			// Room tokens
			'living room': { type: SpaceType.ROOM, category: SpaceRoomCategory.LIVING_ROOM },
			bedroom: { type: SpaceType.ROOM, category: SpaceRoomCategory.BEDROOM },
			'master bedroom': { type: SpaceType.ROOM, category: SpaceRoomCategory.BEDROOM },
			'guest bedroom': { type: SpaceType.ROOM, category: SpaceRoomCategory.GUEST_ROOM },
			'guest room': { type: SpaceType.ROOM, category: SpaceRoomCategory.GUEST_ROOM },
			'guests room': { type: SpaceType.ROOM, category: SpaceRoomCategory.GUEST_ROOM },
			'kids bedroom': { type: SpaceType.ROOM, category: SpaceRoomCategory.BEDROOM },
			'children bedroom': { type: SpaceType.ROOM, category: SpaceRoomCategory.BEDROOM },
			kitchen: { type: SpaceType.ROOM, category: SpaceRoomCategory.KITCHEN },
			bathroom: { type: SpaceType.ROOM, category: SpaceRoomCategory.BATHROOM },
			'master bathroom': { type: SpaceType.ROOM, category: SpaceRoomCategory.BATHROOM },
			'guest bathroom': { type: SpaceType.ROOM, category: SpaceRoomCategory.BATHROOM },
			toilet: { type: SpaceType.ROOM, category: SpaceRoomCategory.TOILET },
			wc: { type: SpaceType.ROOM, category: SpaceRoomCategory.TOILET },
			restroom: { type: SpaceType.ROOM, category: SpaceRoomCategory.TOILET },
			lavatory: { type: SpaceType.ROOM, category: SpaceRoomCategory.TOILET },
			hallway: { type: SpaceType.ROOM, category: SpaceRoomCategory.HALLWAY },
			hall: { type: SpaceType.ROOM, category: SpaceRoomCategory.HALLWAY },
			corridor: { type: SpaceType.ROOM, category: SpaceRoomCategory.HALLWAY },
			entrance: { type: SpaceType.ROOM, category: SpaceRoomCategory.ENTRYWAY },
			entry: { type: SpaceType.ROOM, category: SpaceRoomCategory.ENTRYWAY },
			entryway: { type: SpaceType.ROOM, category: SpaceRoomCategory.ENTRYWAY },
			foyer: { type: SpaceType.ROOM, category: SpaceRoomCategory.ENTRYWAY },
			vestibule: { type: SpaceType.ROOM, category: SpaceRoomCategory.ENTRYWAY },
			garage: { type: SpaceType.ROOM, category: SpaceRoomCategory.GARAGE },
			office: { type: SpaceType.ROOM, category: SpaceRoomCategory.OFFICE },
			'home office': { type: SpaceType.ROOM, category: SpaceRoomCategory.OFFICE },
			study: { type: SpaceType.ROOM, category: SpaceRoomCategory.OFFICE },
			'dining room': { type: SpaceType.ROOM, category: SpaceRoomCategory.DINING_ROOM },
			laundry: { type: SpaceType.ROOM, category: SpaceRoomCategory.LAUNDRY },
			'laundry room': { type: SpaceType.ROOM, category: SpaceRoomCategory.LAUNDRY },
			'utility room': { type: SpaceType.ROOM, category: SpaceRoomCategory.UTILITY_ROOM },
			utility: { type: SpaceType.ROOM, category: SpaceRoomCategory.UTILITY_ROOM },
			'boiler room': { type: SpaceType.ROOM, category: SpaceRoomCategory.UTILITY_ROOM },
			nursery: { type: SpaceType.ROOM, category: SpaceRoomCategory.NURSERY },
			playroom: { type: SpaceType.ROOM, category: SpaceRoomCategory.MEDIA_ROOM },
			'game room': { type: SpaceType.ROOM, category: SpaceRoomCategory.MEDIA_ROOM },
			'media room': { type: SpaceType.ROOM, category: SpaceRoomCategory.MEDIA_ROOM },
			theater: { type: SpaceType.ROOM, category: SpaceRoomCategory.MEDIA_ROOM },
			gym: { type: SpaceType.ROOM, category: SpaceRoomCategory.GYM },
			workshop: { type: SpaceType.ROOM, category: SpaceRoomCategory.WORKSHOP },
			closet: { type: SpaceType.ROOM, category: SpaceRoomCategory.CLOSET },
			'walk-in closet': { type: SpaceType.ROOM, category: SpaceRoomCategory.CLOSET },
			wardrobe: { type: SpaceType.ROOM, category: SpaceRoomCategory.CLOSET },
			pantry: { type: SpaceType.ROOM, category: SpaceRoomCategory.PANTRY },
			storage: { type: SpaceType.ROOM, category: SpaceRoomCategory.STORAGE },
			'storage room': { type: SpaceType.ROOM, category: SpaceRoomCategory.STORAGE },
			mudroom: { type: SpaceType.ROOM, category: SpaceRoomCategory.HALLWAY },
			sunroom: { type: SpaceType.ROOM, category: SpaceRoomCategory.LIVING_ROOM },
			sauna: { type: SpaceType.ROOM, category: SpaceRoomCategory.OTHER },
			// Zone tokens
			basement: { type: SpaceType.ZONE, category: SpaceZoneCategory.FLOOR_BASEMENT },
			attic: { type: SpaceType.ZONE, category: SpaceZoneCategory.FLOOR_ATTIC },
			patio: { type: SpaceType.ZONE, category: SpaceZoneCategory.OUTDOOR_TERRACE },
			balcony: { type: SpaceType.ZONE, category: SpaceZoneCategory.OUTDOOR_BALCONY },
			terrace: { type: SpaceType.ZONE, category: SpaceZoneCategory.OUTDOOR_TERRACE },
			garden: { type: SpaceType.ZONE, category: SpaceZoneCategory.OUTDOOR_GARDEN },
			backyard: { type: SpaceType.ZONE, category: SpaceZoneCategory.OUTDOOR_BACKYARD },
			'front yard': { type: SpaceType.ZONE, category: SpaceZoneCategory.OUTDOOR_FRONT_YARD },
			porch: { type: SpaceType.ZONE, category: SpaceZoneCategory.OUTDOOR_TERRACE },
			pool: { type: SpaceType.ZONE, category: SpaceZoneCategory.OUTDOOR_BACKYARD },
			spa: { type: SpaceType.ROOM, category: SpaceRoomCategory.OTHER },
			driveway: { type: SpaceType.ZONE, category: SpaceZoneCategory.OUTDOOR_DRIVEWAY },
		};

		const tokens = Object.keys(tokenMapping);

		// Get all devices (including those already assigned, for completeness)
		const devices = await this.deviceRepository.find({
			select: ['id', 'name'],
		});

		// Map to store space token -> device IDs
		const spaceMap = new Map<string, string[]>();

		for (const device of devices) {
			const deviceNameLower = device.name.toLowerCase();

			// Try to match room tokens in device name (prefer longest match)
			let matchedToken: string | null = null;
			let matchLength = 0;

			for (const token of tokens) {
				if (deviceNameLower.includes(token) && token.length > matchLength) {
					matchedToken = token;
					matchLength = token.length;
				}
			}

			if (matchedToken) {
				const existingDevices = spaceMap.get(matchedToken) ?? [];
				existingDevices.push(device.id);
				spaceMap.set(matchedToken, existingDevices);
			}
		}

		// Convert map to array and sort by device count (descending)
		const proposals = Array.from(spaceMap.entries())
			.map(([token, deviceIds]) => {
				const mapping = tokenMapping[token];
				// Capitalize the token for display name
				const name = token
					.split(' ')
					.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
					.join(' ');

				return {
					name,
					type: mapping.type,
					category: mapping.category,
					deviceIds,
					deviceCount: deviceIds.length,
				};
			})
			.sort((a, b) => b.deviceCount - a.deviceCount);

		this.logger.debug(`Proposed ${proposals.length} spaces from device names`);

		return proposals;
	}

	/**
	 * Get child rooms for a zone
	 */
	async getChildRooms(zoneId: string): Promise<SpaceEntity[]> {
		this.logger.debug(`Fetching child rooms for zone id=${zoneId}`);

		const zone = await this.spacesService.getOneOrThrow(zoneId);

		if (zone.type !== SpaceType.ZONE) {
			this.logger.warn(`Space ${zoneId} is not a zone, returning empty list`);
			return [];
		}

		// Use the Room subtype's repository to filter by discriminator. TableInheritance
		// excludes `type` from ordinary column metadata (see TypeORM #3261), so
		// `repository.find({ where: { type: ... } })` on the base SpaceEntity repo is a
		// silent no-op. The subtype repository scopes to the right discriminator.
		const roomMapping = this.spacesTypeMapper.getMapping(SpaceType.ROOM);
		const children = await this.dataSource.getRepository(roomMapping.class).find({
			where: { parentId: zoneId },
			order: { displayOrder: 'ASC', name: 'ASC' },
		});

		this.logger.debug(`Found ${children.length} child rooms for zone`);

		return children;
	}

	/**
	 * Get parent zone for a room
	 */
	async getParentZone(roomId: string): Promise<SpaceEntity | null> {
		this.logger.debug(`Fetching parent zone for room id=${roomId}`);

		const room = await this.spacesService.getOneOrThrow(roomId);

		if (!room.parentId) {
			this.logger.debug(`Room ${roomId} has no parent zone`);
			return null;
		}

		const parent = await this.spacesService.findOne(room.parentId);

		return parent;
	}

	/**
	 * Get all zones (for parent selection dropdown)
	 */
	async findAllZones(): Promise<SpaceEntity[]> {
		this.logger.debug('Fetching all zones');

		// Same reason as getChildRooms: query via the subtype-specific repository
		// rather than filtering `type` on the base repo.
		const zoneMapping = this.spacesTypeMapper.getMapping(SpaceType.ZONE);
		const zones = await this.dataSource.getRepository(zoneMapping.class).find({
			order: { displayOrder: 'ASC', name: 'ASC' },
		});

		this.logger.debug(`Found ${zones.length} zones`);

		return zones;
	}
}

import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { PermissionType, PropertyCategory } from '../../devices/devices.constants';
import {
	ChannelsPropertiesService,
	VisiblePropertySearchSummary,
	VisiblePropertySearchSummaryPage,
} from '../../devices/services/channels.properties.service';
import {
	DevicesService,
	VisibleDeviceSearchSummary,
	VisibleDeviceSearchSummaryPage,
	VisibleDeviceSummaryScope,
} from '../../devices/services/devices.service';
import { isSupportedPropertyCommandDataType } from '../../devices/utils/property-command-value.utils';
import { SceneCategory } from '../../scenes/scenes.constants';
import { SceneSearchSummary, SceneSearchSummaryPage, ScenesService } from '../../scenes/services/scenes.service';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { SpaceSearchSummary, SpaceSearchSummaryPage, SpacesService } from '../../spaces/services/spaces.service';
import { SpaceType, isFloorZoneCategory } from '../../spaces/spaces.constants';
import {
	HOME_SEARCH_ENTITY_KINDS,
	HOME_SEARCH_LIMIT_PROFILES,
	HomeSearchCandidateCapability,
	HomeSearchEntityKind,
	HomeSearchMatchReason,
} from '../home-context.constants';
import { HomeContextSpaceNotFoundError } from '../home-context.errors';
import { HomeSearchInvalidCursorError, HomeSearchInvalidQueryError } from '../home-search.errors';
import { HomeEntitySearchQuery } from '../models/home-search-query.model';
import {
	HomeDeviceSearchResult,
	HomeEntitySearchResponse,
	HomeEntitySearchResult,
	HomePropertySearchResult,
	HomeSceneSearchResult,
	HomeSpaceSearchResult,
} from '../models/home-search-result.model';
import { homeEntitySearchQuerySchema } from '../schemas/home-search-input.schemas';
import { homeEntitySearchResponseSchema } from '../schemas/home-search-output.schemas';

const SQLITE_UNICODE61_FOLD_OVERRIDES: Readonly<Record<string, string>> = {
	µ: 'μ',
	ſ: 's',
	ς: 'σ',
	ϐ: 'β',
	ϑ: 'θ',
	ϕ: 'φ',
	ϖ: 'π',
	ϰ: 'κ',
	ϱ: 'ρ',
	ϵ: 'ε',
	ẛ: 's',
};

const KIND_ORDER = new Map<HomeSearchEntityKind, number>(HOME_SEARCH_ENTITY_KINDS.map((kind, index) => [kind, index]));

interface HomeEntitySearchScope {
	spaceIds?: string[];
	parentSpaceId?: string;
	deviceScope?: VisibleDeviceSummaryScope;
	roomParentId?: string;
	primarySpaceIds?: string[];
	primarySpaceId?: string;
	primarySpaceParentId?: string;
}

interface RankedHomeEntity {
	entity: HomeEntitySearchResult;
	rankTier: number;
	lexicalScore: number;
	normalizedName: string;
	id: string;
}

interface HomeSearchCursorPayload {
	v: 1;
	fingerprint: string;
	offset: number;
}

@Injectable()
export class HomeSearchQueryService {
	constructor(
		private readonly spacesService: SpacesService,
		private readonly devicesService: DevicesService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly scenesService: ScenesService,
	) {}

	async searchEntities(query: HomeEntitySearchQuery): Promise<HomeEntitySearchResponse> {
		const input = homeEntitySearchQuerySchema.parse(query);
		const profile = HOME_SEARCH_LIMIT_PROFILES[input.profile];
		const normalizedQuery = this.normalize(input.query);
		const tokens = normalizedQuery.split(' ').filter(Boolean);

		if (tokens.length === 0) {
			throw new HomeSearchInvalidQueryError('no_search_tokens');
		}
		if (tokens.length > profile.maxQueryTokens) {
			throw new HomeSearchInvalidQueryError('too_many_tokens', profile.maxQueryTokens);
		}

		const requestedKinds = input.kinds ?? [...HOME_SEARCH_ENTITY_KINDS];
		const selectedKinds = this.getEffectiveKinds(requestedKinds, input.candidateCapability);
		const selectedKindSet = new Set(selectedKinds);
		const match = tokens.map((token) => `"${token}"*`).join(' AND ');
		const fingerprint = this.createCursorFingerprint(input, normalizedQuery, requestedKinds);
		const cursorOffset = this.decodeCursor(input.cursor, fingerprint, profile.maxPageableResults);
		const selectedSpace = input.spaceId ? await this.spacesService.findOne(input.spaceId) : null;

		if (input.spaceId && !selectedSpace) {
			throw new HomeContextSpaceNotFoundError(input.spaceId);
		}

		const scope = selectedSpace ? this.resolveSearchScope(selectedSpace) : {};
		const propertyCategories = this.filterEnumValues(input.categories, Object.values(PropertyCategory));
		const sceneCategories = this.filterEnumValues(input.categories, Object.values(SceneCategory));
		const candidateLimit = profile.maxCandidatesPerKind;
		const emptySpacePage: SpaceSearchSummaryPage = { spaces: [], total: 0 };
		const emptyDevicePage: VisibleDeviceSearchSummaryPage = { devices: [], total: 0 };
		const emptyPropertyPage: VisiblePropertySearchSummaryPage = { properties: [], total: 0 };
		const emptyScenePage: SceneSearchSummaryPage = { scenes: [], total: 0 };
		const resultQuery = selectedSpace?.type === SpaceType.MASTER ? { ...input, spaceId: undefined } : input;
		const [spacePage, devicePage, propertyPage, scenePage] = await Promise.all([
			selectedKindSet.has('space')
				? this.spacesService.searchSummaryPage({
						match,
						rawQuery: input.query,
						normalizedQuery,
						normalizedTokens: tokens,
						offset: 0,
						limit: candidateLimit,
						spaceIds: scope.spaceIds,
						parentSpaceId: scope.parentSpaceId,
						categories: input.categories,
					})
				: Promise.resolve(emptySpacePage),
			selectedKindSet.has('device')
				? this.devicesService.searchVisibleSummaryPage({
						match,
						rawQuery: input.query,
						normalizedQuery,
						normalizedTokens: tokens,
						offset: 0,
						limit: candidateLimit,
						scope: scope.deviceScope,
						roomParentId: scope.roomParentId,
						categories: input.categories,
					})
				: Promise.resolve(emptyDevicePage),
			selectedKindSet.has('property')
				? this.channelsPropertiesService.searchVisibleSummaryPage({
						match,
						rawQuery: input.query,
						normalizedQuery,
						normalizedTokens: tokens,
						offset: 0,
						limit: candidateLimit,
						scope: scope.deviceScope,
						roomParentId: scope.roomParentId,
						categories: propertyCategories,
						candidateCapability:
							input.candidateCapability === 'read' || input.candidateCapability === 'write'
								? input.candidateCapability
								: undefined,
					})
				: Promise.resolve(emptyPropertyPage),
			selectedKindSet.has('scene')
				? this.scenesService.searchSummaryPage({
						match,
						rawQuery: input.query,
						normalizedQuery,
						normalizedTokens: tokens,
						offset: 0,
						limit: candidateLimit,
						primarySpaceIds: scope.primarySpaceIds,
						primarySpaceId: scope.primarySpaceId,
						primarySpaceParentId: scope.primarySpaceParentId,
						categories: sceneCategories,
						candidateTrigger: input.candidateCapability === 'trigger' ? true : undefined,
					})
				: Promise.resolve(emptyScenePage),
		]);

		const rankedEntities: RankedHomeEntity[] = [
			...spacePage.spaces.map((space) => ({
				entity: this.mapSpace(space, resultQuery),
				rankTier: space.rankTier,
				lexicalScore: space.lexicalScore,
				normalizedName: this.normalize(space.name),
				id: space.id,
			})),
			...devicePage.devices.map((device) => ({
				entity: this.mapDevice(device, resultQuery),
				rankTier: device.rankTier,
				lexicalScore: device.lexicalScore,
				normalizedName: this.normalize(device.name),
				id: device.id,
			})),
			...propertyPage.properties.map((property) => ({
				entity: this.mapProperty(property, resultQuery),
				rankTier: property.rankTier,
				lexicalScore: property.lexicalScore,
				normalizedName: this.normalize(property.name ?? property.identifier ?? property.id),
				id: property.id,
			})),
			...scenePage.scenes.map((scene) => ({
				entity: this.mapScene(scene, resultQuery),
				rankTier: scene.rankTier,
				lexicalScore: scene.lexicalScore,
				normalizedName: this.normalize(scene.name),
				id: scene.id,
			})),
		].sort((left, right) => this.compareRankedEntities(left, right));
		const entities = rankedEntities.map(({ entity }) => entity).slice(0, profile.maxPageableResults);
		const limit = input.limit ?? profile.defaultResults;
		const returnedEntities = entities.slice(cursorOffset, cursorOffset + limit);
		const totalsByKind = {
			space: spacePage.total,
			device: devicePage.total,
			property: propertyPage.total,
			scene: scenePage.total,
		};
		const total = Object.values(totalsByKind).reduce((sum, count) => sum + count, 0);
		const nextOffset = cursorOffset + returnedEntities.length;
		const hasMoreCandidates = nextOffset < entities.length;
		const truncated = nextOffset < total;
		const refineRequired = truncated && !hasMoreCandidates;
		const result: HomeEntitySearchResponse = {
			query: input.query,
			entities: returnedEntities,
			observed_at: new Date().toISOString(),
			total,
			returned: returnedEntities.length,
			totals_by_kind: totalsByKind,
			partial: false,
			truncated,
			refine_required: refineRequired,
			...(input.candidateCapability ? { candidate_capability_filter: input.candidateCapability } : {}),
			...(hasMoreCandidates ? { next_cursor: this.encodeCursor(fingerprint, nextOffset) } : {}),
		};

		homeEntitySearchResponseSchema.parse(result);

		return result;
	}

	private mapSpace(space: SpaceSearchSummary, query: HomeEntitySearchQuery): HomeSpaceSearchResult {
		return {
			kind: 'space',
			id: space.id,
			name: space.name,
			score: this.getScore(space.rankTier),
			reasons: this.withFilterReasons(this.getMatchReason(space.rankTier), query),
			type: space.type,
			category: space.category,
			parent_id: space.parentId,
			candidate_capabilities: [],
		};
	}

	private mapDevice(device: VisibleDeviceSearchSummary, query: HomeEntitySearchQuery): HomeDeviceSearchResult {
		return {
			kind: 'device',
			id: device.id,
			name: device.name,
			score: this.getScore(device.rankTier),
			reasons: this.withFilterReasons(this.getMatchReason(device.rankTier), query),
			identifier: device.identifier,
			category: device.category,
			enabled: device.enabled,
			room_id: device.roomId,
			candidate_capabilities: [],
		};
	}

	private mapProperty(property: VisiblePropertySearchSummary, query: HomeEntitySearchQuery): HomePropertySearchResult {
		const displayName = property.name ?? property.identifier ?? property.id;

		return {
			kind: 'property',
			id: property.id,
			name: displayName,
			score: this.getScore(property.rankTier),
			reasons: this.withFilterReasons(this.getMatchReason(property.rankTier), query),
			property_name: property.name,
			identifier: property.identifier,
			category: property.category,
			data_type: property.dataType,
			permissions: property.permissions,
			device: {
				id: property.deviceId,
				name: property.deviceName,
				enabled: property.deviceEnabled,
			},
			channel: {
				id: property.channelId,
				name: property.channelName,
				category: property.channelCategory,
			},
			candidate_capabilities: this.getPropertyCandidateCapabilities(property),
		};
	}

	private mapScene(scene: SceneSearchSummary, query: HomeEntitySearchQuery): HomeSceneSearchResult {
		return {
			kind: 'scene',
			id: scene.id,
			name: scene.name,
			score: this.getScore(scene.rankTier),
			reasons: this.withFilterReasons(this.getMatchReason(scene.rankTier), query),
			category: scene.category,
			enabled: scene.enabled,
			triggerable: scene.triggerable,
			primary_space_id: scene.primarySpaceId,
			candidate_capabilities: scene.enabled && scene.triggerable ? ['trigger'] : [],
		};
	}

	private getScore(rankTier: number): number {
		return [1000, 900, 800, 600][rankTier] ?? 500;
	}

	private getMatchReason(rankTier: number): HomeSearchMatchReason {
		return (['exact_id', 'exact_name', 'name_prefix', 'lexical_match'] as const)[rankTier] ?? 'lexical_match';
	}

	private withFilterReasons(matchReason: HomeSearchMatchReason, query: HomeEntitySearchQuery): HomeSearchMatchReason[] {
		return [
			matchReason,
			...(query.spaceId ? (['space_filter'] as const) : []),
			...(query.categories ? (['category_filter'] as const) : []),
			...(query.candidateCapability ? (['candidate_capability_filter'] as const) : []),
		];
	}

	private getEffectiveKinds(
		requestedKinds: HomeSearchEntityKind[],
		candidateCapability?: HomeSearchCandidateCapability,
	): HomeSearchEntityKind[] {
		if (candidateCapability === 'read' || candidateCapability === 'write') {
			return requestedKinds.includes('property') ? ['property'] : [];
		}
		if (candidateCapability === 'trigger') {
			return requestedKinds.includes('scene') ? ['scene'] : [];
		}

		return requestedKinds;
	}

	private getPropertyCandidateCapabilities(property: VisiblePropertySearchSummary): Array<'read' | 'write'> {
		const capabilities: Array<'read' | 'write'> = [];
		const permissions = new Set(property.permissions);

		if (permissions.has(PermissionType.READ_ONLY) || permissions.has(PermissionType.READ_WRITE)) {
			capabilities.push('read');
		}
		if (
			property.deviceEnabled &&
			isSupportedPropertyCommandDataType(property.dataType) &&
			(permissions.has(PermissionType.READ_WRITE) || permissions.has(PermissionType.WRITE_ONLY))
		) {
			capabilities.push('write');
		}

		return capabilities;
	}

	private createCursorFingerprint(
		query: HomeEntitySearchQuery,
		normalizedQuery: string,
		requestedKinds: HomeSearchEntityKind[],
	): string {
		const requestedKindSet = new Set(requestedKinds);
		const canonicalKinds = HOME_SEARCH_ENTITY_KINDS.filter((kind) => requestedKindSet.has(kind));
		const canonicalCategories = query.categories ? [...query.categories].sort() : [];
		const serializedFilters = JSON.stringify({
			cursorVersion: 1,
			rankingVersion: 1,
			profile: query.profile,
			rawQuery: query.query,
			query: normalizedQuery,
			kinds: canonicalKinds,
			spaceId: query.spaceId ?? null,
			categories: canonicalCategories,
			candidateCapability: query.candidateCapability ?? null,
			maxCandidatesPerKind: HOME_SEARCH_LIMIT_PROFILES[query.profile].maxCandidatesPerKind,
			maxPageableResults: HOME_SEARCH_LIMIT_PROFILES[query.profile].maxPageableResults,
		});

		return createHash('sha256').update(serializedFilters).digest('base64url');
	}

	private decodeCursor(cursor: string | undefined, fingerprint: string, maxOffset: number): number {
		if (cursor === undefined) {
			return 0;
		}

		try {
			if (!/^[A-Za-z0-9_-]+$/.test(cursor)) {
				throw new HomeSearchInvalidCursorError('malformed');
			}

			const cursorBuffer = Buffer.from(cursor, 'base64url');

			if (cursorBuffer.toString('base64url') !== cursor) {
				throw new HomeSearchInvalidCursorError('malformed');
			}

			const decoded = cursorBuffer.toString('utf8');
			const parsed = JSON.parse(decoded) as Partial<HomeSearchCursorPayload>;

			if (
				Object.keys(parsed).length !== 3 ||
				parsed.v !== 1 ||
				typeof parsed.fingerprint !== 'string' ||
				typeof parsed.offset !== 'number' ||
				!Number.isSafeInteger(parsed.offset) ||
				parsed.offset < 0
			) {
				throw new HomeSearchInvalidCursorError('malformed');
			}
			if (parsed.fingerprint !== fingerprint) {
				throw new HomeSearchInvalidCursorError('query_mismatch');
			}
			if (parsed.offset >= maxOffset) {
				throw new HomeSearchInvalidCursorError('offset_out_of_range');
			}

			return parsed.offset;
		} catch (error) {
			if (error instanceof HomeSearchInvalidCursorError) {
				throw error;
			}

			throw new HomeSearchInvalidCursorError('malformed');
		}
	}

	private encodeCursor(fingerprint: string, offset: number): string {
		const payload: HomeSearchCursorPayload = { v: 1, fingerprint, offset };

		return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
	}

	private compareRankedEntities(left: RankedHomeEntity, right: RankedHomeEntity): number {
		return (
			left.rankTier - right.rankTier ||
			left.lexicalScore - right.lexicalScore ||
			left.normalizedName.localeCompare(right.normalizedName) ||
			left.id.localeCompare(right.id) ||
			(KIND_ORDER.get(left.entity.kind) ?? 0) - (KIND_ORDER.get(right.entity.kind) ?? 0)
		);
	}

	private filterEnumValues<T extends string>(values: string[] | undefined, allowed: T[]): T[] | undefined {
		if (values === undefined) {
			return undefined;
		}

		const allowedValues = new Set<string>(allowed);

		return values.filter((value): value is T => allowedValues.has(value));
	}

	private resolveSearchScope(space: SpaceEntity): HomeEntitySearchScope {
		if (space.type === SpaceType.MASTER) {
			return {};
		}
		if (space.type === SpaceType.ROOM) {
			return {
				spaceIds: [space.id],
				deviceScope: { roomIds: [space.id] },
				primarySpaceId: space.id,
			};
		}
		if (space.type === SpaceType.ENTRY) {
			return {
				spaceIds: [space.id],
				deviceScope: { roomIds: [] },
				primarySpaceIds: [],
			};
		}
		if (space.type !== SpaceType.ZONE) {
			return {
				spaceIds: [space.id],
				deviceScope: { roomIds: [] },
				primarySpaceIds: [],
			};
		}

		const category = (space as { category?: string | null }).category ?? null;

		if (!isFloorZoneCategory(category)) {
			return {
				spaceIds: [space.id],
				deviceScope: { zoneId: space.id },
				primarySpaceId: space.id,
			};
		}

		return {
			spaceIds: [space.id],
			parentSpaceId: space.id,
			roomParentId: space.id,
			primarySpaceId: space.id,
			primarySpaceParentId: space.id,
		};
	}

	private normalize(value: string): string {
		const canonicalValue = value
			.normalize('NFD')
			.replace(/\p{M}/gu, '')
			.split('')
			.map((character) => {
				const codePoint = character.codePointAt(0) ?? 0;

				if (codePoint >= 0x13a0 && codePoint <= 0x13f5) {
					return character;
				}

				return SQLITE_UNICODE61_FOLD_OVERRIDES[character] ?? character.toLocaleLowerCase('en-US');
			})
			.join('');

		return canonicalValue
			.replace(/[^\p{L}\p{N}]+/gu, ' ')
			.trim()
			.replace(/\s+/g, ' ');
	}
}

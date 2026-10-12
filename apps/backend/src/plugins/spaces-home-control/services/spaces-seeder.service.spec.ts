/* eslint-disable @typescript-eslint/unbound-method */
import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { SeedTools } from '../../../modules/seed/services/seed.service';
import { SpacesService } from '../../../modules/spaces/services/spaces.service';
import { SpaceRoomCategory, SpaceType, SpaceZoneCategory } from '../../../modules/spaces/spaces.constants';

import { SpaceClimateRoleService } from './space-climate-role.service';
import { SpaceLightingRoleService } from './space-lighting-role.service';
import { SpacesSeederService } from './spaces-seeder.service';

/**
 * Regression coverage for Codex P1 on PR #588: the seeder normalizes each
 * incoming JSON record through `toInstance(DTO, record)`, and
 * `toInstance` runs with `excludeExtraneousValues: true`. After the
 * `category` / `suggestions_enabled` / `status_widgets` columns moved
 * off `CreateSpaceDto` onto `CreateHomeControlSpaceDto`, normalizing
 * against the base DTO silently stripped those fields — which then
 * tripped the "Category is required for zones" guard downstream.
 *
 * Tests below verify the seeder now uses the home-control subtype DTO
 * so seed records reach `SpacesService.create()` intact.
 */
describe('SpacesSeederService.createSpace', () => {
	let service: SpacesSeederService;
	let spacesService: SpacesService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SpacesSeederService,
				{
					provide: SpacesService,
					useValue: {
						findOne: jest.fn().mockResolvedValue(null),
						create: jest.fn().mockImplementation((dto: { id?: string }) => Promise.resolve({ id: dto.id ?? uuid() })),
					},
				},
				{
					provide: SpaceLightingRoleService,
					useValue: { set: jest.fn(), getAllForSpace: jest.fn().mockResolvedValue([]) },
				},
				{
					provide: SpaceClimateRoleService,
					useValue: { set: jest.fn(), getAllForSpace: jest.fn().mockResolvedValue([]) },
				},
				{
					provide: SeedTools,
					useValue: { loadJsonData: jest.fn().mockReturnValue([]) },
				},
			],
		}).compile();

		service = module.get<SpacesSeederService>(SpacesSeederService);
		spacesService = module.get<SpacesService>(SpacesService);
	});

	it('should preserve zone category through the seeder normalizer', async () => {
		const seedRecord = {
			id: uuid(),
			name: 'Ground Floor',
			type: SpaceType.ZONE,
			category: SpaceZoneCategory.FLOOR_GROUND,
		};

		await (service as unknown as { createSpace: (s: Record<string, unknown>) => Promise<boolean> }).createSpace(
			seedRecord,
		);

		expect(spacesService.create).toHaveBeenCalledWith(
			expect.objectContaining({
				type: SpaceType.ZONE,
				category: SpaceZoneCategory.FLOOR_GROUND,
			}),
		);
	});

	it('should preserve room suggestions_enabled=false through the seeder normalizer', async () => {
		const seedRecord = {
			id: uuid(),
			name: 'Living Room',
			type: SpaceType.ROOM,
			category: SpaceRoomCategory.LIVING_ROOM,
			suggestions_enabled: false,
		};

		await (service as unknown as { createSpace: (s: Record<string, unknown>) => Promise<boolean> }).createSpace(
			seedRecord,
		);

		// `@Transform` on the entity maps `suggestions_enabled` (snake_case)
		// onto `suggestionsEnabled` (camelCase). Either key surviving means
		// the field wasn't stripped.
		const createMock = spacesService.create as jest.Mock;
		const [callArg] = createMock.mock.calls[0] as [Record<string, unknown>];
		expect(callArg.suggestionsEnabled ?? callArg.suggestions_enabled).toBe(false);
	});
});

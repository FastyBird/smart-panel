/* eslint-disable @typescript-eslint/unbound-method */
import { DataSource, Repository } from 'typeorm';

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SpacesTypeMapperService } from '../../../modules/spaces/services/spaces-type-mapper.service';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import { SignageAnnouncementEntity } from '../entities/signage-announcement.entity';
import { SignageInfoPanelSpaceEntity } from '../entities/signage-info-panel-space.entity';

import { SignageInfoPanelResetService } from './signage-info-panel-reset.service';

describe('SignageInfoPanelResetService', () => {
	let service: SignageInfoPanelResetService;
	let announcementsRepository: Repository<SignageAnnouncementEntity>;
	let spacesTypeMapper: SpacesTypeMapperService;
	let dataSource: DataSource;

	const mockAnnouncementsDeleteBuilder = {
		delete: jest.fn().mockReturnThis(),
		from: jest.fn().mockReturnThis(),
		execute: jest.fn(),
	};

	const mockSignageSpacesDeleteBuilder = {
		delete: jest.fn().mockReturnThis(),
		execute: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SignageInfoPanelResetService,
				{
					provide: getRepositoryToken(SignageAnnouncementEntity),
					useValue: {
						createQueryBuilder: jest.fn(() => mockAnnouncementsDeleteBuilder),
					},
				},
				{
					provide: SpacesTypeMapperService,
					useValue: {
						getMapping: jest.fn(() => ({
							type: SpaceType.SIGNAGE_INFO_PANEL,
							class: SignageInfoPanelSpaceEntity,
							createDto: class {},
							updateDto: class {},
						})),
					},
				},
				{
					provide: DataSource,
					useValue: {
						getRepository: jest.fn(() => ({
							createQueryBuilder: jest.fn(() => mockSignageSpacesDeleteBuilder),
						})),
					},
				},
			],
		}).compile();

		service = module.get(SignageInfoPanelResetService);
		announcementsRepository = module.get(getRepositoryToken(SignageAnnouncementEntity));
		spacesTypeMapper = module.get(SpacesTypeMapperService);
		dataSource = module.get(DataSource);
	});

	it('deletes announcements and signage spaces on reset', async () => {
		mockAnnouncementsDeleteBuilder.execute.mockResolvedValueOnce({ affected: 3 });
		mockSignageSpacesDeleteBuilder.execute.mockResolvedValueOnce({ affected: 1 });

		const result = await service.reset();

		expect(result).toEqual({ success: true });
		expect(announcementsRepository.createQueryBuilder).toHaveBeenCalled();
		expect(mockAnnouncementsDeleteBuilder.from).toHaveBeenCalledWith(SignageAnnouncementEntity);
		expect(spacesTypeMapper.getMapping).toHaveBeenCalledWith(SpaceType.SIGNAGE_INFO_PANEL);
		expect(dataSource.getRepository).toHaveBeenCalledWith(SignageInfoPanelSpaceEntity);
	});

	it('returns failure when the underlying delete throws', async () => {
		mockAnnouncementsDeleteBuilder.execute.mockRejectedValueOnce(new Error('db gone'));

		const result = await service.reset();

		expect(result).toEqual({ success: false, reason: 'db gone' });
	});
});

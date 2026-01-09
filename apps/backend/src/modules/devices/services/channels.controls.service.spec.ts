/*
eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-argument,
@typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Expose, Transform } from 'class-transformer';
import { IsString } from 'class-validator';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { ChannelCategory, EventType } from '../devices.constants';
import { DevicesValidationException } from '../devices.exceptions';
import { CreateChannelControlDto } from '../dto/create-channel-control.dto';
import { ChannelControlEntity, ChannelEntity } from '../entities/devices.entity';

import { ChannelsControlsService } from './channels.controls.service';
import { ChannelsService } from './channels.service';

class MockChannel extends ChannelEntity {
	@Expose({ name: 'mock_value' })
	@IsString()
	@Transform(({ obj }: { obj: { mock_value?: string; mockValue?: string } }) => obj.mock_value || obj.mockValue, {
		toClassOnly: true,
	})
	mockValue: string;

	@Expose()
	get type(): string {
		return 'mock';
	}
}

describe('ChannelsControlsService', () => {
	let channelsService: ChannelsService;
	let channelsControlsService: ChannelsControlsService;
	let repository: Repository<ChannelControlEntity>;
	let eventEmitter: EventEmitter2;

	const mockChannel: MockChannel = {
		id: uuid().toString(),
		type: 'mock',
		category: ChannelCategory.GENERIC,
		identifier: null,
		name: 'Test Channel',
		description: 'Test description',
		createdAt: new Date(),
		updatedAt: new Date(),
		device: uuid().toString(),
		parentId: null,
		parent: null,
		children: [],
		controls: [],
		properties: [],
		mockValue: 'Some value',
	};

	const mockChannelControl: ChannelControlEntity = {
		id: uuid().toString(),
		name: 'Test Control',
		channel: mockChannel.id,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockManager: jest.Mocked<Partial<EntityManager>> = {
		findOneOrFail: jest.fn(),
		remove: jest.fn(),
	};

	beforeEach(async () => {
		const mockRepository = () => ({
			find: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			remove: jest.fn(),
			delete: jest.fn(),
			createQueryBuilder: jest.fn(() => ({
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getMany: jest.fn(),
				getOne: jest.fn(),
			})),
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ChannelsControlsService,
				{ provide: getRepositoryToken(ChannelControlEntity), useFactory: mockRepository },
				{
					provide: DataSource,
					useValue: {
						manager: mockManager,
						transaction: jest.fn(async (cb: (m: any) => any) => await cb(mockManager)),
						getRepository: jest.fn(() => {}),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(() => {}),
					},
				},
				{
					provide: ChannelsService,
					useValue: {
						getOneOrThrow: jest.fn(() => {}),
					},
				},
			],
		}).compile();

		channelsService = module.get<ChannelsService>(ChannelsService);
		channelsControlsService = module.get<ChannelsControlsService>(ChannelsControlsService);
		repository = module.get<Repository<ChannelControlEntity>>(getRepositoryToken(ChannelControlEntity));
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(channelsService).toBeDefined();
		expect(channelsControlsService).toBeDefined();
		expect(repository).toBeDefined();
		expect(eventEmitter).toBeDefined();
	});

	describe('findAllControls', () => {
		it('should return all controls for a channel', async () => {
			const mockChannelControls = [mockChannelControl];

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getMany: jest
					.fn()
					.mockResolvedValue(mockChannelControls.map((entity) => toInstance(ChannelControlEntity, entity))),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await channelsControlsService.findAll(mockChannel.id);

			expect(result).toEqual(mockChannelControls.map((entity) => toInstance(ChannelControlEntity, entity)));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('control');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('control.channel', 'channel');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('channel.id = :channelId', { channelId: mockChannel.id });
			expect(queryBuilderMock.getMany).toHaveBeenCalled();
		});
	});

	describe('findOneControl', () => {
		it('should return a channel control if found', async () => {
			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(ChannelControlEntity, mockChannelControl)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await channelsControlsService.findOne(mockChannelControl.id, mockChannel.id);

			expect(result).toEqual(toInstance(ChannelControlEntity, mockChannelControl));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('control');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('control.channel', 'channel');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('control.id = :id', { id: mockChannelControl.id });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('channel.id = :channelId', { channelId: mockChannel.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});

		it('should return null if the channel control is not found', async () => {
			const controlId = uuid().toString();

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await channelsControlsService.findOne(controlId, mockChannel.id);

			expect(result).toEqual(null);

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('control');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('control.channel', 'channel');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('control.id = :id', { id: controlId });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('channel.id = :channelId', { channelId: mockChannel.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});
	});

	describe('create', () => {
		it('should create and return a new channel control', async () => {
			const createDto: CreateChannelControlDto = { name: 'reboot' };
			const mockCreateControl: Partial<ChannelControlEntity> = {
				name: createDto.name,
				channel: mockChannel.id,
			};
			const mockCreatedControl: ChannelControlEntity = {
				id: uuid().toString(),
				name: mockCreateControl.name,
				channel: mockCreateControl.id,
				createdAt: new Date(),
				updatedAt: null,
			};

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest
					.fn()
					.mockReturnValueOnce(null)
					.mockResolvedValueOnce(toInstance(ChannelControlEntity, mockCreatedControl)),
			};

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'create').mockReturnValue(toInstance(ChannelControlEntity, mockCreatedControl));
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(ChannelControlEntity, mockCreatedControl));

			const result = await channelsControlsService.create(mockChannel.id, createDto);

			expect(result).toEqual(toInstance(ChannelControlEntity, mockCreatedControl));
			expect(repository.create).toHaveBeenCalledWith(toInstance(ChannelControlEntity, mockCreateControl));
			expect(repository.save).toHaveBeenCalledWith(toInstance(ChannelControlEntity, mockCreatedControl));
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_CONTROL_CREATED,
				toInstance(ChannelControlEntity, mockCreatedControl),
			);
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('control.channel', 'channel');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('control.name = :name', { name: createDto.name });
			expect(queryBuilderMock.where).toHaveBeenCalledWith('control.id = :id', { id: mockCreatedControl.id });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('channel.id = :channelId', { channelId: mockChannel.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalledTimes(2);
		});

		it('should throw DevicesValidationException if the channel control with same name already exists', async () => {
			const createDto: CreateChannelControlDto = { name: 'reboot' };

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValueOnce(mockChannelControl),
			};

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			await expect(channelsControlsService.create(mockChannel.id, createDto)).rejects.toThrow(
				DevicesValidationException,
			);

			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('control.channel', 'channel');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('control.name = :name', { name: createDto.name });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('channel.id = :channelId', { channelId: mockChannel.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});
	});

	describe('remove', () => {
		it('should remove a channel control', async () => {
			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));
			jest
				.spyOn(channelsControlsService, 'findOne')
				.mockResolvedValue(toInstance(ChannelControlEntity, mockChannelControl));
			jest.spyOn(mockManager, 'findOneOrFail').mockResolvedValue(toInstance(ChannelControlEntity, mockChannelControl));

			jest.spyOn(mockManager, 'remove');

			await channelsControlsService.remove(mockChannelControl.id, mockChannel.id);

			expect(mockManager.remove).toHaveBeenCalledWith(toInstance(ChannelControlEntity, mockChannelControl));
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_CONTROL_DELETED,
				toInstance(ChannelControlEntity, mockChannelControl),
			);
		});
	});
});

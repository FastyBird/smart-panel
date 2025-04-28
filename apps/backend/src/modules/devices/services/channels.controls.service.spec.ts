/*
eslint-disable @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-argument,
@typescript-eslint/no-unsafe-member-access
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Expose, Transform, plainToInstance } from 'class-transformer';
import { IsString } from 'class-validator';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

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
		name: 'Test Channel',
		description: 'Test description',
		createdAt: new Date(),
		updatedAt: new Date(),
		device: uuid().toString(),
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
					provide: ChannelsService,
					useValue: {
						getOneOrThrow: jest.fn(() => {}),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(() => {}),
					},
				},
			],
		}).compile();

		channelsService = module.get<ChannelsService>(ChannelsService);
		channelsControlsService = module.get<ChannelsControlsService>(ChannelsControlsService);
		repository = module.get<Repository<ChannelControlEntity>>(getRepositoryToken(ChannelControlEntity));
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);
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

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(plainToInstance(ChannelEntity, mockChannel));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getMany: jest
					.fn()
					.mockResolvedValue(mockChannelControls.map((entity) => plainToInstance(ChannelControlEntity, entity))),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await channelsControlsService.findAll(mockChannel.id);

			expect(result).toEqual(mockChannelControls.map((entity) => plainToInstance(ChannelControlEntity, entity)));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('control');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('control.channel', 'channel');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('channel.id = :channelId', { channelId: mockChannel.id });
			expect(queryBuilderMock.getMany).toHaveBeenCalled();
		});
	});

	describe('findOneControl', () => {
		it('should return a channel control if found', async () => {
			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(plainToInstance(ChannelEntity, mockChannel));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(plainToInstance(ChannelControlEntity, mockChannelControl)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await channelsControlsService.findOne(mockChannelControl.id, mockChannel.id);

			expect(result).toEqual(plainToInstance(ChannelControlEntity, mockChannelControl));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('control');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('control.channel', 'channel');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('control.id = :id', { id: mockChannelControl.id });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('channel.id = :channelId', { channelId: mockChannel.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});

		it('should return null if the channel control is not found', async () => {
			const controlId = uuid().toString();

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(plainToInstance(ChannelEntity, mockChannel));

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
					.mockResolvedValueOnce(plainToInstance(ChannelControlEntity, mockCreatedControl)),
			};

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(plainToInstance(ChannelEntity, mockChannel));

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'create').mockReturnValue(mockCreatedControl);
			jest.spyOn(repository, 'save').mockResolvedValue(mockCreatedControl);

			const result = await channelsControlsService.create(mockChannel.id, createDto);

			expect(result).toEqual(plainToInstance(ChannelControlEntity, mockCreatedControl));
			expect(repository.create).toHaveBeenCalledWith(
				plainToInstance(ChannelControlEntity, mockCreateControl, {
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
				}),
			);
			expect(repository.save).toHaveBeenCalledWith(mockCreatedControl);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_CONTROL_CREATED,
				plainToInstance(ChannelControlEntity, mockCreatedControl),
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

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(plainToInstance(ChannelEntity, mockChannel));

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
			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(plainToInstance(ChannelEntity, mockChannel));
			jest
				.spyOn(channelsControlsService, 'findOne')
				.mockResolvedValue(plainToInstance(ChannelControlEntity, mockChannelControl));

			jest.spyOn(repository, 'delete');

			await channelsControlsService.remove(mockChannelControl.id, mockChannel.id);

			expect(repository.delete).toHaveBeenCalledWith(mockChannelControl.id);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_CONTROL_DELETED,
				plainToInstance(ChannelControlEntity, mockChannelControl),
			);
		});
	});
});

/*
eslint-disable @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-member-access,
@typescript-eslint/no-unsafe-argument
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { TokenType } from '../auth.constants';
import { AuthException, AuthNotFoundException } from '../auth.exceptions';
import { CreateLongLiveTokenDto, CreateTokenDto } from '../dto/create-token.dto';
import { UpdateLongLiveTokenDto, UpdateTokenDto } from '../dto/update-token.dto';
import { LongLiveTokenEntity, TokenEntity } from '../entities/auth.entity';

import { TokensTypeMapperService } from './tokens-type-mapper.service';
import { TokensService } from './tokens.service';

jest.mock('../utils/token.utils', () => ({
	hashToken: jest.fn((token) => `hashed-${token}`),
}));

jest.mock('bcrypt', () => ({
	hash: jest.fn(),
	compare: jest.fn(),
}));

describe('TokensService', () => {
	let service: TokensService;
	let repository: Repository<TokenEntity>;
	let mapper: TokensTypeMapperService;
	let dataSource: DataSource;

	const mockToken: LongLiveTokenEntity = {
		id: uuid().toString(),
		type: TokenType.LONG_LIVE,
		name: 'Token name',
		description: 'Token description',
		hashedToken: 'hashed-test-token',
		expiresAt: new Date(),
		createdAt: new Date(),
		owner: null,
		revoked: false,
		updateToken: (): void => {},
	};

	beforeEach(async () => {
		const mockRepository = () => ({
			find: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			remove: jest.fn(),
			createQueryBuilder: jest.fn(() => ({
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getMany: jest.fn(),
				getOne: jest.fn(),
			})),
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TokensService,
				{ provide: getRepositoryToken(TokenEntity), useFactory: mockRepository },
				{
					provide: TokensTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => ({
							type: 'mock',
							class: LongLiveTokenEntity,
							createDto: CreateLongLiveTokenDto,
							updateDto: UpdateLongLiveTokenDto,
						})),
					},
				},
				{
					provide: DataSource,
					useValue: {
						getRepository: jest.fn(() => {}),
					},
				},
			],
		}).compile();

		service = module.get<TokensService>(TokensService);
		repository = module.get<Repository<TokenEntity>>(getRepositoryToken(TokenEntity));
		mapper = module.get<TokensTypeMapperService>(TokensTypeMapperService);
		dataSource = module.get<DataSource>(DataSource);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
		expect(repository).toBeDefined();
		expect(mapper).toBeDefined();
		expect(dataSource).toBeDefined();
	});

	describe('getOneOrThrow', () => {
		it('should return a token if found', async () => {
			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(plainToInstance(LongLiveTokenEntity, mockToken)),
			};

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await service.getOneOrThrow(mockToken.id);

			expect(result).toEqual(plainToInstance(LongLiveTokenEntity, mockToken));
		});

		it('should throw an error if token not found', async () => {
			jest.spyOn(service, 'findOne').mockResolvedValue(null);

			await expect(service.getOneOrThrow('invalid-id')).rejects.toThrow(AuthNotFoundException);
		});
	});

	describe('create', () => {
		it('should create and return a new token', async () => {
			const createDto: CreateLongLiveTokenDto = {
				type: TokenType.LONG_LIVE,
				token: 'test-token',
				name: 'Token name',
				description: 'Token description',
				owner: null,
				expiresAt: new Date(),
			};
			const mockCreateToken: Partial<LongLiveTokenEntity> = {
				type: createDto.type,
				token: createDto.token,
				name: createDto.name,
				description: createDto.description,
				expiresAt: createDto.expiresAt,
				owner: null,
			};
			const mockCreatedToken: LongLiveTokenEntity = {
				id: uuid().toString(),
				type: mockCreateToken.type,
				name: mockCreateToken.name,
				description: mockCreateToken.description,
				token: mockCreateToken.token,
				hashedToken: mockCreateToken.token,
				expiresAt: mockCreateToken.expiresAt,
				revoked: false,
				createdAt: new Date(),
				owner: null,
				updateToken: (): void => {},
			};

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(plainToInstance(LongLiveTokenEntity, mockCreatedToken)),
			};

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'create').mockReturnValue(mockCreatedToken);
			jest.spyOn(repository, 'save').mockResolvedValue(mockCreatedToken);

			jest.spyOn(service, 'findAll').mockResolvedValue([]);

			const result = await service.create(createDto);

			expect(result).toEqual(plainToInstance(LongLiveTokenEntity, mockCreatedToken));
			expect(repository.create).toHaveBeenCalledWith(
				plainToInstance(LongLiveTokenEntity, mockCreateToken, {
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
				}),
			);
			expect(repository.save).toHaveBeenCalledWith(mockCreatedToken);
			expect(repository.createQueryBuilder).toHaveBeenCalledWith('token');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('token.owner', 'owner');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('token.id = :fieldValue', {
				fieldValue: mockCreatedToken.id,
			});
			expect(queryBuilderMock.getOne).toHaveBeenCalledTimes(1);
		});

		it('should throw an error if token already exists', async () => {
			const createDto: CreateTokenDto = { token: 'test-token', type: 'mock', expiresAt: new Date() };

			jest.spyOn(service, 'findAll').mockResolvedValue([{} as TokenEntity]);

			// @ts-expect-error: bcrypt is mocked, but TypeScript still reports an error when mocking the method
			jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

			await expect(service.create(createDto)).rejects.toThrow(AuthException);
		});
	});

	describe('update', () => {
		it('should update and return the token', async () => {
			const updateDto: UpdateLongLiveTokenDto = {
				type: TokenType.LONG_LIVE,
				revoked: true,
			};
			const mockUpdateToken: LongLiveTokenEntity = {
				id: mockToken.id,
				type: mockToken.type,
				name: 'Token name',
				description: 'Token description',
				hashedToken: mockToken.hashedToken,
				expiresAt: mockToken.expiresAt,
				revoked: updateDto.revoked,
				createdAt: mockToken.createdAt,
				owner: null,
				updateToken: (): void => {},
			};
			const mockUpdatedToken: LongLiveTokenEntity = {
				id: mockUpdateToken.id,
				type: mockUpdateToken.type,
				name: mockUpdateToken.name,
				description: mockUpdateToken.description,
				hashedToken: mockUpdateToken.hashedToken,
				expiresAt: mockUpdateToken.expiresAt,
				revoked: mockUpdateToken.revoked,
				createdAt: mockUpdateToken.createdAt,
				updatedAt: new Date(),
				owner: null,
				updateToken: (): void => {},
			};

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest
					.fn()
					.mockResolvedValueOnce(plainToInstance(LongLiveTokenEntity, mockToken))
					.mockResolvedValueOnce(plainToInstance(LongLiveTokenEntity, mockUpdatedToken)),
			};

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'save').mockResolvedValue(mockUpdatedToken);

			const result = await service.update(mockToken.id, updateDto);

			expect(result).toEqual(plainToInstance(LongLiveTokenEntity, mockUpdatedToken));
			expect(repository.save).toHaveBeenCalledWith(plainToInstance(LongLiveTokenEntity, mockUpdateToken));
			expect(repository.createQueryBuilder).toHaveBeenCalledWith('token');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('token.owner', 'owner');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('token.id = :fieldValue', { fieldValue: mockToken.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalledTimes(2);
		});

		it('should throw an error if token not found', async () => {
			jest.spyOn(service, 'getOneOrThrow').mockRejectedValue(new AuthNotFoundException('Token not found'));

			await expect(service.update('invalid-id', {} as UpdateTokenDto)).rejects.toThrow(AuthNotFoundException);
		});
	});

	describe('remove', () => {
		it('should remove a token and its children', async () => {
			const token = { id: 'token-id', children: [{ id: 'child-token-id' }] } as unknown as TokenEntity;

			jest.spyOn(service, 'getOneOrThrow').mockResolvedValue(token);
			jest.spyOn(repository, 'remove').mockResolvedValue(undefined);

			await service.remove(token.id);

			expect(service.getOneOrThrow).toHaveBeenCalledWith(token.id);
			expect(repository.remove).toHaveBeenCalledWith(token);
			expect(repository.remove).toHaveBeenCalledWith(token['children'][0]);
		});

		it('should throw an error if token not found', async () => {
			jest.spyOn(service, 'getOneOrThrow').mockRejectedValue(new AuthNotFoundException('Token not found'));

			await expect(service.remove('invalid-id')).rejects.toThrow(AuthNotFoundException);
		});
	});
});

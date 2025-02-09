import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Repository } from 'typeorm';

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { WebsocketGateway } from '../../websocket/gateway/websocket.gateway';
import { EventType } from '../devices.constants';
import { DevicesNotFoundException, DevicesValidationException } from '../devices.exceptions';
import { CreateDeviceControlDto } from '../dto/create-device-control.dto';
import { DeviceControlEntity } from '../entities/devices.entity';

import { DevicesService } from './devices.service';

@Injectable()
export class DevicesControlsService {
	private readonly logger = new Logger(DevicesControlsService.name);

	constructor(
		@InjectRepository(DeviceControlEntity)
		private readonly repository: Repository<DeviceControlEntity>,
		private readonly devicesService: DevicesService,
		private readonly gateway: WebsocketGateway,
	) {}

	async findAll(deviceId: string): Promise<DeviceControlEntity[]> {
		this.logger.debug(`[LOOKUP ALL] Fetching all controls for deviceId=${deviceId}`);

		const device = await this.devicesService.getOneOrThrow(deviceId);

		const controls = await this.repository
			.createQueryBuilder('control')
			.innerJoinAndSelect('control.device', 'device')
			.where('device.id = :deviceId', { deviceId: device.id })
			.getMany();

		this.logger.debug(`[LOOKUP ALL] Found ${controls.length} controls for deviceId=${deviceId}`);

		return controls;
	}

	async findOne(id: string, deviceId: string): Promise<DeviceControlEntity | null> {
		this.logger.debug(`[LOOKUP] Fetching control with id=${id} for deviceId=${deviceId}`);

		const device = await this.devicesService.getOneOrThrow(deviceId);

		const control = await this.repository
			.createQueryBuilder('control')
			.innerJoinAndSelect('control.device', 'device')
			.where('control.id = :id', { id })
			.andWhere('device.id = :deviceId', { deviceId: device.id })
			.getOne();

		if (!control) {
			this.logger.warn(`[LOOKUP] Control with id=${id} for deviceId=${deviceId} not found`);

			return null;
		}

		this.logger.debug(`[LOOKUP] Successfully fetched control with id=${id} for deviceId=${deviceId}`);

		return control;
	}

	async findOneByName(name: string, deviceId: string): Promise<DeviceControlEntity | null> {
		this.logger.debug(`[LOOKUP] Fetching control with name=${name} for deviceId=${deviceId}`);

		const device = await this.devicesService.getOneOrThrow(deviceId);

		const control = await this.repository
			.createQueryBuilder('control')
			.innerJoinAndSelect('control.device', 'device')
			.where('control.name = :name', { name })
			.andWhere('device.id = :deviceId', { deviceId: device.id })
			.getOne();

		if (!control) {
			this.logger.warn(`[LOOKUP] Control with name=${name} for deviceId=${deviceId} not found`);

			return null;
		}

		this.logger.debug(`[LOOKUP] Successfully fetched control with name=${name} for deviceId=${deviceId}`);

		return control;
	}

	async create(deviceId: string, createDeviceControlDto: CreateDeviceControlDto): Promise<DeviceControlEntity> {
		this.logger.debug(`[CREATE] Creating new control for deviceId=${deviceId}`);

		const device = await this.devicesService.getOneOrThrow(deviceId);

		const existingControl = await this.findOneByName(createDeviceControlDto.name, device.id);

		if (existingControl !== null) {
			throw new DevicesValidationException('Device control name must be unique');
		}

		const dtoInstance = await this.validateDto<CreateDeviceControlDto>(CreateDeviceControlDto, createDeviceControlDto);

		const control = this.repository.create(
			plainToInstance(
				DeviceControlEntity,
				{
					...dtoInstance,
					device: device.id,
				},
				{
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
				},
			),
		);
		await this.repository.save(control);

		const savedControl = await this.getOneOrThrow(control.id, device.id);

		this.logger.debug(`[CREATE] Successfully created control with id=${savedControl.id} for deviceId=${deviceId}`);

		this.gateway.sendMessage(EventType.DEVICE_CONTROL_CREATED, savedControl);

		return savedControl;
	}

	async remove(id: string, deviceId: string): Promise<void> {
		this.logger.debug(`[DELETE] Removing control with id=${id} for deviceId=${deviceId}`);

		const device = await this.devicesService.getOneOrThrow(deviceId);
		const control = await this.getOneOrThrow(id, device.id);

		await this.repository.remove(control);

		this.logger.log(`[DELETE] Successfully removed control with id=${id} for deviceId=${deviceId}`);

		this.gateway.sendMessage(EventType.DEVICE_CONTROL_DELETED, control);
	}

	async getOneOrThrow(id: string, deviceId: string): Promise<DeviceControlEntity> {
		const control = await this.findOne(id, deviceId);

		if (!control) {
			this.logger.error(`[ERROR] Control with id=${id} for deviceId=${deviceId} not found`);

			throw new DevicesNotFoundException('Device control does not exist');
		}

		return control;
	}

	private async validateDto<T extends object>(DtoClass: new () => T, dto: any): Promise<T> {
		const dtoInstance = plainToInstance(DtoClass, dto, {
			enableImplicitConversion: true,
			excludeExtraneousValues: true,
			exposeUnsetFields: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] ${JSON.stringify(errors)}`);

			throw new DevicesValidationException('Provided control data are invalid.');
		}

		return dtoInstance;
	}
}

import { validate } from 'class-validator';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { DEVICES_MODULE_NAME, EventType } from '../devices.constants';
import { DevicesNotFoundException, DevicesValidationException } from '../devices.exceptions';
import { CreateDeviceControlDto } from '../dto/create-device-control.dto';
import { DeviceControlEntity } from '../entities/devices.entity';

@Injectable()
export class DevicesControlsService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DevicesControlsService');

	constructor(
		@InjectRepository(DeviceControlEntity)
		private readonly repository: Repository<DeviceControlEntity>,
		private readonly dataSource: DataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findAll(deviceId: string): Promise<DeviceControlEntity[]> {
		return this.repository
			.createQueryBuilder('control')
			.innerJoinAndSelect('control.device', 'device')
			.where('device.id = :deviceId', { deviceId })
			.getMany();
	}

	async findOne(id: string, deviceId: string): Promise<DeviceControlEntity | null> {
		return this.repository
			.createQueryBuilder('control')
			.innerJoinAndSelect('control.device', 'device')
			.where('control.id = :id', { id })
			.andWhere('device.id = :deviceId', { deviceId })
			.getOne();
	}

	async findOneByName(name: string, deviceId: string): Promise<DeviceControlEntity | null> {
		return this.repository
			.createQueryBuilder('control')
			.innerJoinAndSelect('control.device', 'device')
			.where('control.name = :name', { name })
			.andWhere('device.id = :deviceId', { deviceId })
			.getOne();
	}

	async create(deviceId: string, createDeviceControlDto: CreateDeviceControlDto): Promise<DeviceControlEntity> {
		this.logger.debug(`Creating new control for deviceId=${deviceId}`);

		const existingControl = await this.findOneByName(createDeviceControlDto.name, deviceId);

		if (existingControl !== null) {
			throw new DevicesValidationException('Device control name must be unique');
		}

		const dtoInstance = await this.validateDto<CreateDeviceControlDto>(CreateDeviceControlDto, createDeviceControlDto);

		const control = this.repository.create(
			toInstance(DeviceControlEntity, {
				...dtoInstance,
				device: deviceId,
			}),
		);
		await this.repository.save(control);

		const savedControl = await this.getOneOrThrow(control.id, deviceId);

		this.logger.debug(`Successfully created control with id=${savedControl.id} for deviceId=${deviceId}`);

		this.eventEmitter.emit(EventType.DEVICE_CONTROL_CREATED, savedControl);

		return savedControl;
	}

	async remove(id: string, deviceId: string, manager: EntityManager = this.dataSource.manager): Promise<void> {
		this.logger.debug(`Removing control with id=${id} for deviceId=${deviceId}`);

		const control = await manager.findOneOrFail<DeviceControlEntity>(DeviceControlEntity, {
			where: { id, device: { id: deviceId } },
		});

		// Capture control entity before removal to preserve ID for event emission
		const controlForEvent = { ...control };

		await manager.remove(control);

		this.logger.log(`Successfully removed control with id=${id} for deviceId=${deviceId}`);

		// Emit event with the control entity captured before removal to preserve ID
		this.eventEmitter.emit(EventType.DEVICE_CONTROL_DELETED, controlForEvent);
	}

	async getOneOrThrow(id: string, deviceId: string): Promise<DeviceControlEntity> {
		const control = await this.findOne(id, deviceId);

		if (!control) {
			this.logger.error(`Control with id=${id} for deviceId=${deviceId} not found`);

			throw new DevicesNotFoundException('Device control does not exist');
		}

		return control;
	}

	private async validateDto<T extends object>(DtoClass: new () => T, dto: any): Promise<T> {
		const dtoInstance = toInstance(DtoClass, dto, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`Validation failed: ${JSON.stringify(errors)}`);

			throw new DevicesValidationException('Provided control data are invalid.');
		}

		return dtoInstance;
	}
}

import { FindOptionsWhere, Repository } from 'typeorm';

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DEVICES_MODBUS_PLUGIN_NAME, MODBUS_DEFAULTS, ModbusFraming } from '../devices-modbus.constants';
import { ModbusValidationException } from '../devices-modbus.exceptions';
import { CreateModbusEndpointDto } from '../dto/create-endpoint.dto';
import { UpdateModbusEndpointDto } from '../dto/update-endpoint.dto';
import { ModbusDeviceEntity } from '../entities/devices-modbus.entity';
import { ModbusEndpointEntity } from '../entities/modbus-endpoint.entity';

import { ModbusConnectionsService } from './modbus-connections.service';

const defaultInterRequestDelayMs = (framing: ModbusFraming): number =>
	framing === ModbusFraming.RTU_OVER_TCP
		? MODBUS_DEFAULTS.INTER_REQUEST_DELAY_MS_RTU_OVER_TCP
		: MODBUS_DEFAULTS.INTER_REQUEST_DELAY_MS_TCP;

const validationError = (field: string, reason: string): ModbusValidationException =>
	new ModbusValidationException([JSON.stringify({ field, reason })]);

@Injectable()
export class ModbusEndpointsService {
	private readonly logger = createExtensionLogger(DEVICES_MODBUS_PLUGIN_NAME, 'ModbusEndpointsService');

	constructor(
		@InjectRepository(ModbusEndpointEntity)
		private readonly repository: Repository<ModbusEndpointEntity>,
		@InjectRepository(ModbusDeviceEntity)
		private readonly devicesRepository: Repository<ModbusDeviceEntity>,
		private readonly connections: ModbusConnectionsService,
	) {}

	async findAll(): Promise<ModbusEndpointEntity[]> {
		return this.repository.find({ order: { name: 'ASC' } });
	}

	async findOne(id: string): Promise<ModbusEndpointEntity | null> {
		return this.repository.findOne({ where: { id } });
	}

	/** Finds the endpoint at this address; the host is compared case-insensitively. */
	async findByHostAndPort(host: string, port: number): Promise<ModbusEndpointEntity | null> {
		const wanted = host.toLowerCase();
		const endpoints = await this.repository.find();

		return endpoints.find((endpoint) => endpoint.port === port && endpoint.host.toLowerCase() === wanted) ?? null;
	}

	async getOneOrThrow(id: string): Promise<ModbusEndpointEntity> {
		const endpoint = await this.findOne(id);

		if (!endpoint) {
			throw new NotFoundException('Requested endpoint does not exist');
		}

		return endpoint;
	}

	async create(dto: CreateModbusEndpointDto): Promise<ModbusEndpointEntity> {
		const port = dto.port ?? MODBUS_DEFAULTS.PORT;
		const framing = dto.framing ?? MODBUS_DEFAULTS.FRAMING;

		await this.assertUniqueAddress(dto.host, port);

		const endpoint = this.repository.create({
			name: dto.name,
			host: dto.host,
			port,
			framing,
			connectTimeoutMs: dto.connect_timeout_ms ?? MODBUS_DEFAULTS.CONNECT_TIMEOUT_MS,
			requestTimeoutMs: dto.request_timeout_ms ?? MODBUS_DEFAULTS.REQUEST_TIMEOUT_MS,
			interRequestDelayMs: dto.inter_request_delay_ms ?? defaultInterRequestDelayMs(framing),
			maxInFlight: framing === ModbusFraming.RTU_OVER_TCP ? 1 : (dto.max_in_flight ?? MODBUS_DEFAULTS.MAX_IN_FLIGHT),
			enabled: dto.enabled ?? true,
		});

		const saved = await this.repository.save(endpoint);

		await this.reconcile(saved.id);

		return saved;
	}

	async update(id: string, dto: UpdateModbusEndpointDto): Promise<ModbusEndpointEntity> {
		const endpoint = await this.getOneOrThrow(id);

		const host = dto.host ?? endpoint.host;
		const port = dto.port ?? endpoint.port;

		if (host !== endpoint.host || port !== endpoint.port) {
			await this.assertUniqueAddress(host, port, id);
		}

		const framing = dto.framing ?? endpoint.framing;
		const framingChanged = framing !== endpoint.framing;

		endpoint.name = dto.name ?? endpoint.name;
		endpoint.host = host;
		endpoint.port = port;
		endpoint.framing = framing;
		endpoint.connectTimeoutMs = dto.connect_timeout_ms ?? endpoint.connectTimeoutMs;
		endpoint.requestTimeoutMs = dto.request_timeout_ms ?? endpoint.requestTimeoutMs;
		endpoint.interRequestDelayMs =
			dto.inter_request_delay_ms ??
			(framingChanged ? defaultInterRequestDelayMs(framing) : endpoint.interRequestDelayMs);
		endpoint.maxInFlight = framing === ModbusFraming.RTU_OVER_TCP ? 1 : (dto.max_in_flight ?? endpoint.maxInFlight);
		endpoint.enabled = dto.enabled ?? endpoint.enabled;

		const saved = await this.repository.save(endpoint);

		await this.reconcile(id);

		return saved;
	}

	async remove(id: string): Promise<void> {
		const endpoint = await this.getOneOrThrow(id);

		const devices = await this.devicesRepository.find({
			where: { endpointId: id } as FindOptionsWhere<ModbusDeviceEntity>,
		});

		if (devices.length > 0) {
			const names = devices.map((device) => device.name).join(', ');

			throw validationError('id', `Endpoint is used by devices and cannot be deleted: ${names}`);
		}

		await this.repository.remove(endpoint);

		await this.reconcile(id);
	}

	/**
	 * The change is already committed, so a reconcile failure must not turn it into an error response. The runtime
	 * re-reconciles on start and on the next change.
	 */
	private async reconcile(endpointId: string): Promise<void> {
		try {
			await this.connections.reconcile();
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to reconcile connections after change to endpoint id=${endpointId}`, {
				message: err.message,
				stack: err.stack,
			});
		}
	}

	private async assertUniqueAddress(host: string, port: number, ignoreId?: string): Promise<void> {
		const existing = await this.repository.findOne({ where: { host, port } });

		if (existing && existing.id !== ignoreId) {
			throw validationError('host', `Another endpoint already uses ${host}:${port}.`);
		}
	}
}

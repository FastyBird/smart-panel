import {
	Body,
	Controller,
	Delete,
	Get,
	Header,
	Logger,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	UnprocessableEntityException,
} from '@nestjs/common';

import { ReqCreateDisplayInstanceDto } from '../dto/create-display-instance.dto';
import { ReqUpdateDisplayInstanceDto } from '../dto/update-display-instance.dto';
import { DisplayInstanceEntity } from '../entities/users.entity';
import { Roles } from '../guards/roles.guard';
import { DisplaysInstancesService } from '../services/displays-instances.service';
import { UsersService } from '../services/users.service';
import { UserRole } from '../users.constants';
import { USERS_MODULE_PREFIX } from '../users.constants';

@Controller('displays-instances')
export class DisplaysInstancesController {
	private readonly logger = new Logger(DisplaysInstancesController.name);

	constructor(
		private readonly displaysService: DisplaysInstancesService,
		private readonly usersService: UsersService,
	) {}

	@Get()
	async findAll(): Promise<DisplayInstanceEntity[]> {
		this.logger.debug('[LOOKUP ALL] Fetching all displays instances');

		const displays = await this.displaysService.findAll();

		this.logger.debug(`[LOOKUP ALL] Retrieved ${displays.length} displays instances`);

		return displays;
	}

	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<DisplayInstanceEntity> {
		this.logger.debug(`[LOOKUP] Fetching display instance id=${id}`);

		const display = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found display instance id=${display.id}`);

		return display;
	}

	@Get('by-uid/:uid')
	async findOneByUid(@Param('uid', new ParseUUIDPipe({ version: '4' })) uid: string): Promise<DisplayInstanceEntity> {
		this.logger.debug(`[LOOKUP] Fetching display instance uid=${uid}`);

		const display = await this.displaysService.findByUid(uid);

		if (!display) {
			this.logger.error(`[ERROR] display instance with uid=${uid} not found`);

			throw new NotFoundException('Requested display instance does not exist');
		}

		this.logger.debug(`[LOOKUP] Found display instance id=${display.id}`);

		return display;
	}

	@Post()
	@Header('Location', `:baseUrl/${USERS_MODULE_PREFIX}/displays/:id`)
	@Roles(UserRole.DISPLAY)
	async create(@Body() createDto: ReqCreateDisplayInstanceDto): Promise<DisplayInstanceEntity> {
		this.logger.debug('[CREATE] Incoming request to create a new display instance');

		const existingDisplay = await this.displaysService.findByUid(createDto.data.uid);

		if (existingDisplay) {
			this.logger.warn('[CREATE] Display instance is trying to use used uid');

			throw new UnprocessableEntityException('Trying to create display instance with used uid');
		}

		const displayUser = await this.usersService.findOne(createDto.data.user);

		if (!displayUser) {
			this.logger.warn('[CREATE] Display instance is trying to register without provided user');

			throw new UnprocessableEntityException('Trying to create display instance with used uid');
		}

		const display = await this.displaysService.create(displayUser.id, createDto.data);

		this.logger.debug(`[CREATE] Successfully created display instance id=${display.id}`);

		return display;
	}

	@Patch(':id')
	@Roles(UserRole.DISPLAY, UserRole.OWNER)
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: ReqUpdateDisplayInstanceDto,
	): Promise<DisplayInstanceEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for display instance id=${id}`);

		const display = await this.getOneOrThrow(id);

		const updatedDisplay = await this.displaysService.update(display.id, updateDto.data);

		this.logger.debug(`[UPDATE] Successfully updated display instance id=${updatedDisplay.id}`);

		return updatedDisplay;
	}

	@Delete(':id')
	@Roles(UserRole.DISPLAY, UserRole.OWNER)
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete display instance id=${id}`);

		const display = await this.getOneOrThrow(id);

		await this.displaysService.remove(display.id);

		this.logger.debug(`[DELETE] Successfully deleted display instance id=${id}`);
	}

	private async getOneOrThrow(id: string): Promise<DisplayInstanceEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of display instance id=${id}`);

		const display = await this.displaysService.findOne(id);

		if (!display) {
			this.logger.error(`[ERROR] display instance with id=${id} not found`);

			throw new NotFoundException('Requested display instance does not exist');
		}

		return display;
	}
}

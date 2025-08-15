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

import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { ReqCreateDisplayProfileDto } from '../dto/create-display-profile.dto';
import { ReqUpdateDisplayProfileDto } from '../dto/update-display-profile.dto';
import { DisplayProfileEntity } from '../entities/system.entity';
import { DisplaysProfilesService } from '../services/displays-profiles.service';
import { SYSTEM_MODULE_PREFIX } from '../system.constants';

@Controller('displays-profiles')
export class DisplaysProfilesController {
	private readonly logger = new Logger(DisplaysProfilesController.name);

	constructor(private readonly displaysService: DisplaysProfilesService) {}

	@Get()
	async findAll(): Promise<DisplayProfileEntity[]> {
		this.logger.debug('[LOOKUP ALL] Fetching all displays profiles');

		const displays = await this.displaysService.findAll();

		this.logger.debug(`[LOOKUP ALL] Retrieved ${displays.length} displays profiles`);

		return displays;
	}

	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<DisplayProfileEntity> {
		this.logger.debug(`[LOOKUP] Fetching display profile id=${id}`);

		const display = await this.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found display profile id=${display.id}`);

		return display;
	}

	@Get('by-uid/:uid')
	async findOneByUid(@Param('uid', new ParseUUIDPipe({ version: '4' })) uid: string): Promise<DisplayProfileEntity> {
		this.logger.debug(`[LOOKUP] Fetching display profile uid=${uid}`);

		const display = await this.displaysService.findByUid(uid);

		if (!display) {
			this.logger.error(`[ERROR] display profile with uid=${uid} not found`);

			throw new NotFoundException('Requested display profile does not exist');
		}

		this.logger.debug(`[LOOKUP] Found display profile id=${display.id}`);

		return display;
	}

	@Post()
	@Header('Location', `:baseUrl/${SYSTEM_MODULE_PREFIX}/displays/:id`)
	@Roles(UserRole.DISPLAY)
	async create(@Body() createDto: ReqCreateDisplayProfileDto): Promise<DisplayProfileEntity> {
		this.logger.debug('[CREATE] Incoming request to create a new display profile');

		const existingDisplay = await this.displaysService.findByUid(createDto.data.uid);

		if (existingDisplay) {
			this.logger.warn('[CREATE] Display profile is trying to use used uid');

			throw new UnprocessableEntityException('Trying to create display profile with used uid');
		}

		const display = await this.displaysService.create(createDto.data);

		this.logger.debug(`[CREATE] Successfully created display profile id=${display.id}`);

		return display;
	}

	@Patch(':id')
	@Roles(UserRole.DISPLAY, UserRole.OWNER)
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() updateDto: ReqUpdateDisplayProfileDto,
	): Promise<DisplayProfileEntity> {
		this.logger.debug(`[UPDATE] Incoming update request for display profile id=${id}`);

		const display = await this.getOneOrThrow(id);

		const updatedDisplay = await this.displaysService.update(display.id, updateDto.data);

		this.logger.debug(`[UPDATE] Successfully updated display profile id=${updatedDisplay.id}`);

		return updatedDisplay;
	}

	@Delete(':id')
	@Roles(UserRole.DISPLAY, UserRole.OWNER)
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		this.logger.debug(`[DELETE] Incoming request to delete display profile id=${id}`);

		const display = await this.getOneOrThrow(id);

		await this.displaysService.remove(display.id);

		this.logger.debug(`[DELETE] Successfully deleted display profile id=${id}`);
	}

	private async getOneOrThrow(id: string): Promise<DisplayProfileEntity> {
		this.logger.debug(`[LOOKUP] Checking existence of display profile id=${id}`);

		const display = await this.displaysService.findOne(id);

		if (!display) {
			this.logger.error(`[ERROR] display profile with id=${id} not found`);

			throw new NotFoundException('Requested display profile does not exist');
		}

		return display;
	}
}

import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query,
	Req,
} from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import { setResponseMeta } from '../../../common/utils/http.utils';
import { coerceBooleanSafe } from '../../../common/utils/transform.utils';
import { runBulkOperation } from '../../api/utils/bulk.utils';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { Roles } from '../../users/guards/roles.guard';
import { UserRole } from '../../users/users.constants';
import { ReqBulkRemoveNotificationsDto } from '../dto/bulk-remove-notifications.dto';
import { ReqBulkUpdateNotificationsDto } from '../dto/bulk-update-notifications.dto';
import { ReqUpdateNotificationDto } from '../dto/update-notification.dto';
import { NotificationEntity } from '../entities/notifications.entity';
import {
	BulkResultResponseModel,
	NotificationResponseModel,
	NotificationsResponseModel,
} from '../models/notifications-response.model';
import {
	NOTIFICATIONS_DEFAULT_PAGE_SIZE,
	NOTIFICATIONS_MAX_PAGE_SIZE,
	NOTIFICATIONS_MODULE_API_TAG_NAME,
	NOTIFICATIONS_MODULE_NAME,
	NotificationKind,
	NotificationSeverity,
} from '../notifications.constants';
import { NotificationsException } from '../notifications.exceptions';
import { NotificationsService, NotificationsStatusFilter } from '../services/notifications.service';

@ApiTags(NOTIFICATIONS_MODULE_API_TAG_NAME)
@Controller('notifications')
export class NotificationsController {
	private readonly logger = createExtensionLogger(NOTIFICATIONS_MODULE_NAME, 'NotificationsController');

	constructor(private readonly notificationsService: NotificationsService) {}

	@ApiOperation({
		tags: [NOTIFICATIONS_MODULE_API_TAG_NAME],
		summary: 'List notifications',
		description:
			'Retrieves a page of notifications ordered newest first. Defaults to active notifications - neither dismissed nor resolved.',
		operationId: 'get-notifications-module-notifications',
	})
	@ApiQuery({
		name: 'status',
		required: false,
		enum: ['active', 'dismissed', 'resolved', 'all'],
		description: 'Filters by lifecycle state. Defaults to active (neither dismissed nor resolved).',
	})
	@ApiQuery({
		name: 'severity',
		required: false,
		enum: NotificationSeverity,
		isArray: true,
		description: 'Filters by severity. Repeat the parameter to filter by several severities at once.',
	})
	@ApiQuery({
		name: 'source',
		required: false,
		type: 'string',
		description: 'Filters by the emitting extension type.',
	})
	@ApiQuery({ name: 'kind', required: false, enum: NotificationKind, description: 'Filters by event or issue.' })
	@ApiQuery({ name: 'unread', required: false, type: 'boolean', description: 'Filters by read state.' })
	@ApiQuery({
		name: 'after_id',
		required: false,
		type: 'string',
		description: 'Cursor: continues the list after this notification id.',
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		schema: {
			type: 'integer',
			minimum: 1,
			maximum: NOTIFICATIONS_MAX_PAGE_SIZE,
			default: NOTIFICATIONS_DEFAULT_PAGE_SIZE,
		},
		description: `Maximum number of notifications to return (default ${NOTIFICATIONS_DEFAULT_PAGE_SIZE}, max ${NOTIFICATIONS_MAX_PAGE_SIZE}).`,
	})
	@ApiSuccessResponse(NotificationsResponseModel, 'Notifications retrieved successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Get()
	async findAll(
		@Req() req: Request,
		@Query('status') status?: NotificationsStatusFilter,
		@Query('severity') severityQuery?: string | string[],
		@Query('source') source?: string,
		@Query('kind') kind?: NotificationKind,
		@Query('unread') unreadQuery?: string,
		@Query('after_id') afterId?: string,
		@Query('limit') limit: number | string = NOTIFICATIONS_DEFAULT_PAGE_SIZE,
	): Promise<NotificationsResponseModel> {
		let severity: NotificationSeverity[] | undefined;

		try {
			severity = this.parseSeverity(severityQuery);
		} catch (error) {
			if (error instanceof NotificationsException) {
				throw new BadRequestException(error.message);
			}

			throw error;
		}

		// Mirrors GET /logs: a non-numeric value falls back to the default page size, while
		// an out-of-range number is clamped to the nearest bound rather than rejected.
		const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
		const lim = Math.min(
			Math.max(isNaN(parsedLimit) ? NOTIFICATIONS_DEFAULT_PAGE_SIZE : parsedLimit, 1),
			NOTIFICATIONS_MAX_PAGE_SIZE,
		);

		// One extra row over the page size answers "is there another page" without a
		// separate count query - the same shape as GET /logs.
		const rows = await this.notificationsService.findAll({
			status,
			severity,
			source,
			kind,
			unread: unreadQuery === undefined ? undefined : coerceBooleanSafe(unreadQuery),
			afterId,
			limit: lim + 1,
		});

		const page = rows.slice(0, lim);
		const hasMore = rows.length > lim;
		const nextCursor = hasMore ? page[page.length - 1].id : undefined;

		setResponseMeta(req, { next_cursor: nextCursor, has_more: hasMore });

		const response = new NotificationsResponseModel();

		response.data = page;

		return response;
	}

	@ApiOperation({
		tags: [NOTIFICATIONS_MODULE_API_TAG_NAME],
		summary: 'Retrieve a notification',
		description: 'Fetches a single notification by its unique ID.',
		operationId: 'get-notifications-module-notification',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Notification ID' })
	@ApiSuccessResponse(NotificationResponseModel, 'Notification retrieved successfully')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Notification not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<NotificationResponseModel> {
		const notification = await this.getOneOrThrow(id);

		const response = new NotificationResponseModel();

		response.data = notification;

		return response;
	}

	@ApiOperation({
		tags: [NOTIFICATIONS_MODULE_API_TAG_NAME],
		summary: 'Update a notification',
		description: 'Marks a notification read/unread and/or dismissed/restored.',
		operationId: 'update-notifications-module-notification',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Notification ID' })
	@ApiBody({ type: ReqUpdateNotificationDto, description: 'The read and/or dismissed state to set' })
	@ApiSuccessResponse(NotificationResponseModel, 'Notification updated successfully')
	@ApiBadRequestResponse('Invalid UUID format or request data')
	@ApiNotFoundResponse('Notification not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Patch(':id')
	async update(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqUpdateNotificationDto,
	): Promise<NotificationResponseModel> {
		let notification = await this.getOneOrThrow(id);

		if (body.data.read !== undefined) {
			notification = await this.notificationsService.markRead(id, body.data.read);
		}

		if (body.data.dismissed !== undefined) {
			notification = await this.notificationsService.dismiss(id, body.data.dismissed);
		}

		const response = new NotificationResponseModel();

		response.data = notification;

		return response;
	}

	@ApiOperation({
		tags: [NOTIFICATIONS_MODULE_API_TAG_NAME],
		summary: 'Delete a notification',
		description:
			'Removes a notification outright. Its source is not told, so an issue whose condition still holds is raised again.',
		operationId: 'delete-notifications-module-notification',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Notification ID' })
	@ApiNoContentResponse({ description: 'Notification deleted successfully' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Notification not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Delete(':id')
	@HttpCode(204)
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		const notification = await this.getOneOrThrow(id);

		await this.notificationsService.remove(notification.id);
	}

	@ApiOperation({
		tags: [NOTIFICATIONS_MODULE_API_TAG_NAME],
		summary: 'Update several notifications',
		description:
			'Marks every notification in the supplied selection read/unread and/or dismissed/restored. Each notification is processed independently, so one that can not be updated is reported in the response rather than aborting the rest of the selection.',
		operationId: 'bulk-update-notifications-module-notifications',
	})
	@ApiBody({ type: ReqBulkUpdateNotificationsDto, description: 'The notifications to update and the state to set' })
	@ApiSuccessResponse(BulkResultResponseModel, 'Returns which notifications were updated and which were not')
	@ApiBadRequestResponse('Invalid request data')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Post('bulk-update')
	@HttpCode(200)
	async bulkUpdate(@Body() body: ReqBulkUpdateNotificationsDto): Promise<BulkResultResponseModel> {
		const response = new BulkResultResponseModel();

		response.data = await runBulkOperation(
			body.data.ids,
			async (id) => {
				if (body.data.read !== undefined) {
					await this.notificationsService.markRead(id, body.data.read);
				}

				if (body.data.dismissed !== undefined) {
					await this.notificationsService.dismiss(id, body.data.dismissed);
				}
			},
			{
				fallbackReason: 'Notification could not be updated',
				safeErrors: [NotificationsException],
				logger: this.logger,
			},
		);

		return response;
	}

	@ApiOperation({
		tags: [NOTIFICATIONS_MODULE_API_TAG_NAME],
		summary: 'Remove several notifications',
		description:
			'Removes every notification in the supplied selection. Each notification is processed independently, so one that can not be removed is reported in the response rather than aborting the rest of the selection.',
		operationId: 'bulk-remove-notifications-module-notifications',
	})
	@ApiBody({ type: ReqBulkRemoveNotificationsDto, description: 'The notifications to remove' })
	@ApiSuccessResponse(BulkResultResponseModel, 'Returns which notifications were removed and which were not')
	@ApiBadRequestResponse('Invalid request data')
	@ApiInternalServerErrorResponse('Internal server error')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@Post('bulk-remove')
	@HttpCode(200)
	async bulkRemove(@Body() body: ReqBulkRemoveNotificationsDto): Promise<BulkResultResponseModel> {
		const response = new BulkResultResponseModel();

		response.data = await runBulkOperation(
			body.data.ids,
			async (id) => {
				await this.notificationsService.remove(id);
			},
			{
				fallbackReason: 'Notification could not be removed',
				safeErrors: [NotificationsException],
				logger: this.logger,
			},
		);

		return response;
	}

	/**
	 * Normalises `severity` into an array of valid enum values. Fastify's query parser
	 * hands back a plain string for one occurrence of the parameter and an array for
	 * several, so both shapes are accepted here.
	 */
	private parseSeverity(raw?: string | string[]): NotificationSeverity[] | undefined {
		if (raw === undefined) {
			return undefined;
		}

		const values = Array.isArray(raw) ? raw : [raw];
		const validValues = Object.values(NotificationSeverity);
		const invalid = values.filter((value) => !validValues.includes(value as NotificationSeverity));

		if (invalid.length > 0) {
			throw new NotificationsException(
				`Invalid severity value(s): ${invalid.join(', ')}. Expected one of: ${validValues.join(', ')}.`,
			);
		}

		return values as NotificationSeverity[];
	}

	private async getOneOrThrow(id: string): Promise<NotificationEntity> {
		const notification = await this.notificationsService.findOne(id);

		if (!notification) {
			throw new NotFoundException('Requested notification does not exist');
		}

		return notification;
	}
}

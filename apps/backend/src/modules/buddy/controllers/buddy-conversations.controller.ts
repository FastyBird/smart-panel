import { Body, Controller, Delete, Get, HttpCode, Logger, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiCreatedSuccessResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { BUDDY_MODULE_API_TAG_NAME, BUDDY_MODULE_PREFIX } from '../buddy.constants';
import { CreateConversationDto, ReqCreateConversationDto } from '../dto/create-conversation.dto';
import { ReqSendMessageDto, SendMessageDto } from '../dto/send-message.dto';
import { ConversationResponseModel, ConversationsResponseModel } from '../models/conversation-response.model';
import { MessageResponseModel } from '../models/message-response.model';
import { BuddyConversationService } from '../services/buddy-conversation.service';

@ApiTags(BUDDY_MODULE_API_TAG_NAME)
@Controller('conversations')
export class BuddyConversationsController {
	private readonly logger = new Logger(BuddyConversationsController.name);

	constructor(private readonly conversationService: BuddyConversationService) {}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'List all buddy conversations',
		description: 'Retrieves a list of all buddy conversations, ordered by most recent first.',
		operationId: 'get-buddy-module-conversations',
	})
	@ApiSuccessResponse(ConversationsResponseModel, 'Conversations successfully retrieved')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(): Promise<ConversationsResponseModel> {
		this.logger.debug('[LOOKUP ALL] Fetching all conversations');

		const conversations = await this.conversationService.findAll();

		this.logger.debug(`[LOOKUP ALL] Retrieved ${String(conversations.length)} conversations`);

		const response = new ConversationsResponseModel();
		response.data = conversations;

		return response;
	}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'Get a specific conversation with messages',
		description: 'Retrieves a specific buddy conversation including all its messages.',
		operationId: 'get-buddy-module-conversation',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Conversation ID' })
	@ApiSuccessResponse(ConversationResponseModel, 'Conversation successfully retrieved')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Conversation not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<ConversationResponseModel> {
		this.logger.debug(`[LOOKUP] Fetching conversation id=${id}`);

		const conversation = await this.conversationService.getOneOrThrow(id);

		this.logger.debug(`[LOOKUP] Found conversation id=${conversation.id}`);

		const response = new ConversationResponseModel();
		response.data = conversation;

		return response;
	}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'Create a new conversation',
		description: 'Creates a new buddy conversation with an optional title and space scope.',
		operationId: 'create-buddy-module-conversation',
	})
	@ApiBody({ type: ReqCreateConversationDto, description: 'Conversation data' })
	@ApiCreatedSuccessResponse(
		ConversationResponseModel,
		'Conversation successfully created',
		`/api/v1/modules/${BUDDY_MODULE_PREFIX}/conversations/123e4567-e89b-12d3-a456-426614174000`,
	)
	@ApiBadRequestResponse('Invalid request data')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	async create(@Body() body: ReqCreateConversationDto): Promise<ConversationResponseModel> {
		this.logger.debug('[CREATE] Creating new conversation');

		const dto: CreateConversationDto = body.data;
		const conversation = await this.conversationService.create(dto.title ?? undefined, dto.spaceId ?? undefined);

		this.logger.debug(`[CREATE] Created conversation id=${conversation.id}`);

		const response = new ConversationResponseModel();
		response.data = conversation;

		return response;
	}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'Send a message in a conversation',
		description:
			'Sends a message to the buddy in a specific conversation. The buddy responds using the configured AI provider with full home context.',
		operationId: 'send-buddy-module-conversation-message',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Conversation ID' })
	@ApiBody({ type: ReqSendMessageDto, description: 'Message data' })
	@ApiCreatedSuccessResponse(MessageResponseModel, 'Message sent and buddy response received')
	@ApiBadRequestResponse('Invalid request data or UUID format')
	@ApiNotFoundResponse('Conversation not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post(':id/messages')
	async sendMessage(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqSendMessageDto,
	): Promise<MessageResponseModel> {
		this.logger.debug(`[MESSAGE] Sending message to conversation id=${id}`);

		const dto: SendMessageDto = body.data;
		const assistantMessage = await this.conversationService.sendMessage(id, dto.content);

		this.logger.debug(`[MESSAGE] Received assistant response id=${assistantMessage.id}`);

		const response = new MessageResponseModel();
		response.data = assistantMessage;

		return response;
	}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'Delete a conversation',
		description: 'Deletes a buddy conversation and all its messages.',
		operationId: 'delete-buddy-module-conversation',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Conversation ID' })
	@ApiNoContentResponse({ description: 'Conversation successfully deleted.' })
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Conversation not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Delete(':id')
	@HttpCode(204)
	async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
		this.logger.debug(`[DELETE] Deleting conversation id=${id}`);

		await this.conversationService.remove(id);

		this.logger.debug(`[DELETE] Deleted conversation id=${id}`);
	}
}

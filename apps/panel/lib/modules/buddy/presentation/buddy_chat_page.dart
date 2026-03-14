import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/toast.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/buddy/models/buddy_config.dart';
import 'package:fastybird_smart_panel/modules/buddy/models/message.dart';
import 'package:fastybird_smart_panel/modules/buddy/repositories/buddy.dart';
import 'package:fastybird_smart_panel/modules/buddy/presentation/widgets/message_bubble.dart';
import 'package:fastybird_smart_panel/modules/buddy/presentation/widgets/voice_input_overlay.dart';
import 'package:fastybird_smart_panel/modules/buddy/service.dart';
import 'package:fastybird_smart_panel/modules/buddy/services/audio_playback_service.dart';
import 'package:fastybird_smart_panel/modules/config/module.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/module_config_repository.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';

/// Full-screen chat page for the buddy module.
///
/// Provides:
/// - Header with title and back button
/// - Scrollable message list (newest at bottom)
/// - Suggestion cards section
/// - Text input with send button
/// - Microphone button that opens full-screen voice input overlay
/// - Loading indicator while waiting for AI response
/// - Empty state when no messages
/// - Disabled state when AI provider is not configured
class BuddyChatPage extends StatefulWidget {
	const BuddyChatPage({super.key});

	@override
	State<BuddyChatPage> createState() => _BuddyChatPageState();
}

class _BuddyChatPageState extends State<BuddyChatPage> {
	final TextEditingController _inputController = TextEditingController();
	final ScrollController _scrollController = ScrollController();
	final FocusNode _inputFocusNode = FocusNode();

	late final BuddyService _buddyService;
	late final ModuleConfigRepository<BuddyConfigModel> _buddyConfigRepo;
	late final AudioPlaybackService _audioPlaybackService;

	String _buddyName = 'Buddy';

	bool _initialized = false;
	bool _initFailed = false;
	bool _initProviderMissing = false;

	/// Track message count so _scrollToBottom fires only on new messages.
	int _lastMessageCount = 0;

	/// Whether voice mode is active (last input was via microphone).
	/// When true, TTS auto-play is enabled for new assistant messages.
	bool _voiceModeActive = false;

	/// The last assistant message ID we auto-played, to avoid replaying.
	String? _lastAutoPlayedMessageId;

	@override
	void initState() {
		super.initState();
		_buddyService = context.read<BuddyService>();
		// Sync message count before adding listener to avoid false "new messages" trigger
		_lastMessageCount = _buddyService.messages.length;
		_buddyService.addListener(_onBuddyServiceChanged);

		_buddyConfigRepo = locator<ConfigModuleService>()
				.getModuleRepository<BuddyConfigModel>('buddy-module');
		_buddyName = _buddyConfigRepo.data?.name ?? 'Buddy';
		_buddyConfigRepo.addListener(_onBuddyConfigChanged);

		_audioPlaybackService = AudioPlaybackService(
			getToken: () => _buddyService.getCurrentToken(),
		);
		_audioPlaybackService.addListener(_onPlaybackChanged);

		WidgetsBinding.instance.addPostFrameCallback((_) {
			_initializeConversation();
		});
	}

	Future<void> _initializeConversation() async {
		final buddyService = context.read<BuddyService>();

		if (!buddyService.hasActiveConversation) {
			final spaceId = locator<DisplayRepository>().display?.roomId;
			final conversation = await buddyService.startNewConversation(
				spaceId: spaceId,
			);

			if (conversation == null && mounted) {
				setState(() {
					_initProviderMissing = buddyService.isProviderNotConfigured;
					_initFailed = true;
					_initialized = true;
				});

				return;
			}
		}

		if (mounted) {
			setState(() {
				_initFailed = false;
				_initialized = true;
			});
		}
	}

	void _scrollToBottom() {
		if (!mounted) return;

		// With reverse: true, scroll position 0 is the bottom of the chat.
		WidgetsBinding.instance.addPostFrameCallback((_) {
			if (mounted && _scrollController.hasClients) {
				_scrollController.jumpTo(0);
			}
		});
	}

	Future<void> _sendMessage() async {
		final text = _inputController.text.trim();

		if (text.isEmpty) return;

		final buddyService = context.read<BuddyService>();

		if (!buddyService.hasActiveConversation) return;

		_inputController.clear();
		_voiceModeActive = false;

		await buddyService.sendMessage(text);

		if (mounted) {
			_scrollToBottom();
		}
	}

	Future<void> _openVoiceOverlay() async {
		final sent = await VoiceInputOverlay.show(context);

		if (sent && mounted) {
			_voiceModeActive = true;
			_scrollToBottom();
		}
	}

	void _onBuddyServiceChanged() {
		if (!mounted) return;

		// Show toast when a new error occurs
		if (_buddyService.hasError) {
			final localizations = AppLocalizations.of(context)!;
			final errorMessage = _localizedBuddyError(localizations, _buddyService.errorType);

			Toast.showError(context, message: errorMessage);
			_buddyService.clearError();
		}

		final messages = _buddyService.messages;
		final messageCount = messages.length;

		if (messageCount > _lastMessageCount) {
			_scrollToBottom();

			// Auto-play TTS for new assistant messages when voice mode is active
			final displayRepo = locator<DisplayRepository>();
			final canPlayAudio = displayRepo.audioOutputSupported && displayRepo.hasSpeakerEnabled;

			if (_voiceModeActive && canPlayAudio && _buddyService.isTtsConfigured && messageCount > 0) {
				final lastMessage = messages.last;

				if (lastMessage.role == BuddyMessageRole.assistant &&
						lastMessage.id != _lastAutoPlayedMessageId) {
					_lastAutoPlayedMessageId = lastMessage.id;

					final audioUrl = _buddyService.getMessageAudioUrl(lastMessage.id);

					if (audioUrl != null) {
						_audioPlaybackService.playMessageAudio(lastMessage.id, audioUrl).catchError((_) {});
					}
				}
			}
		}

		_lastMessageCount = messageCount;
	}

	void _onBuddyConfigChanged() {
		if (!mounted) return;

		setState(() {
			_buddyName = _buddyConfigRepo.data?.name ?? 'Buddy';
		});
	}

	void _onPlaybackChanged() {
		if (!mounted) return;

		setState(() {});
	}

	@override
	void dispose() {
		_buddyService.removeListener(_onBuddyServiceChanged);
		_buddyConfigRepo.removeListener(_onBuddyConfigChanged);
		_audioPlaybackService.removeListener(_onPlaybackChanged);
		_audioPlaybackService.dispose();
		_inputController.dispose();
		_scrollController.dispose();
		_inputFocusNode.dispose();
		super.dispose();
	}

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;

		final bgColor = isDark ? AppBgColorDark.page : AppBgColorLight.page;

		return Scaffold(
			backgroundColor: bgColor,
			body: SafeArea(
				child: Column(
					children: [
						PageHeader(
							title: _buddyName,
							leading: Row(
								mainAxisSize: MainAxisSize.min,
								spacing: AppSpacings.pMd,
								children: [
									HeaderIconButton(
										icon: MdiIcons.arrowLeft,
										onTap: () => Navigator.of(context).pop(),
									),
									HeaderMainIcon(
										icon: Icons.smart_toy_outlined,
									),
								],
							),
							trailing: HeaderIconButton(
								icon: MdiIcons.chatPlusOutline,
								onTap: _startNewConversation,
							),
						),
						Expanded(
							child: _initialized
								? _initFailed
									? _initProviderMissing
										? _buildProviderNotConfiguredState(context, isDark)
										: _buildInitFailedState(context, isDark)
									: Consumer<BuddyService>(
										builder: (context, buddyService, _) {
											return _buildBody(context, isDark, buddyService);
										},
									)
								: Center(
									child: CircularProgressIndicator(
										color: Theme.of(context).colorScheme.primary,
									),
								),
						),
						_buildInput(context, isDark),
					],
				),
			),
		);
	}

	Future<void> _startNewConversation() async {
		final buddyService = context.read<BuddyService>();
		final spaceId = locator<DisplayRepository>().display?.roomId;

		await buddyService.createNewConversation(spaceId: spaceId);
	}

	Widget _buildBody(BuildContext context, bool isDark, BuddyService buddyService) {
		final messages = buddyService.messages;
		final hasMessages = messages.isNotEmpty;

		if (!hasMessages && !buddyService.isLoadingMessages) {
			return _buildEmptyState(context, isDark);
		}

		final displayRepo = locator<DisplayRepository>();
		final canPlayAudio = displayRepo.audioOutputSupported && displayRepo.hasSpeakerEnabled;

		return ListView(
			controller: _scrollController,
			reverse: true,
			padding: EdgeInsets.symmetric(vertical: AppSpacings.pMd),
			children: [
				// Loading indicator while waiting for AI response
				if (buddyService.isSendingMessage)
					_buildTypingIndicator(context, isDark),

				// Messages in reverse order (newest first for reverse ListView)
				...messages.reversed.map(
					(message) => MessageBubble(
						key: ValueKey(message.id),
						message: message,
						showSpeakerIcon: canPlayAudio && buddyService.isTtsConfigured,
						audioPlaybackService: _audioPlaybackService,
						audioUrl: message.role == BuddyMessageRole.assistant
							? buddyService.getMessageAudioUrl(message.id)
							: null,
					),
				),
			],
		);
	}

	Widget _buildEmptyState(BuildContext context, bool isDark) {
		final localizations = AppLocalizations.of(context)!;
		final secondaryColor = isDark
			? AppTextColorDark.secondary
			: AppTextColorLight.secondary;
		final placeholderColor = isDark
			? AppTextColorDark.placeholder
			: AppTextColorLight.placeholder;

		return Center(
			child: Padding(
				padding: AppSpacings.paddingXl,
				child: Column(
					mainAxisAlignment: MainAxisAlignment.center,
					children: [
						Icon(
							Icons.chat_bubble_outline,
							size: AppSpacings.scale(48),
							color: placeholderColor,
						),
						SizedBox(height: AppSpacings.pLg),
						Text(
							localizations.buddy_empty_state_message,
							style: TextStyle(
								fontSize: AppFontSize.base,
								color: secondaryColor,
							),
							textAlign: TextAlign.center,
						),
					],
				),
			),
		);
	}

	Widget _buildInitFailedState(BuildContext context, bool isDark) {
		final localizations = AppLocalizations.of(context)!;
		final warningColor = isDark ? AppColorsDark.warning : AppColorsLight.warning;
		final secondaryColor = isDark
			? AppTextColorDark.secondary
			: AppTextColorLight.secondary;

		return Center(
			child: Padding(
				padding: AppSpacings.paddingXl,
				child: Column(
					mainAxisAlignment: MainAxisAlignment.center,
					children: [
						Icon(
							Icons.cloud_off_outlined,
							size: AppSpacings.scale(48),
							color: warningColor,
						),
						SizedBox(height: AppSpacings.pLg),
						Text(
							localizations.buddy_init_failed_message,
							style: TextStyle(
								fontSize: AppFontSize.base,
								color: secondaryColor,
							),
							textAlign: TextAlign.center,
						),
						SizedBox(height: AppSpacings.pMd),
						TextButton.icon(
							onPressed: _retryInitialization,
							icon: Icon(
								Icons.refresh,
								size: AppSpacings.scale(16),
							),
							label: Text(
								localizations.action_retry,
								style: TextStyle(
									fontSize: AppFontSize.base,
								),
							),
						),
					],
				),
			),
		);
	}

	Widget _buildProviderNotConfiguredState(BuildContext context, bool isDark) {
		final localizations = AppLocalizations.of(context)!;
		final secondaryColor = isDark
			? AppTextColorDark.secondary
			: AppTextColorLight.secondary;
		final placeholderColor = isDark
			? AppTextColorDark.placeholder
			: AppTextColorLight.placeholder;

		return Center(
			child: Padding(
				padding: AppSpacings.paddingXl,
				child: Column(
					mainAxisAlignment: MainAxisAlignment.center,
					children: [
						Icon(
							Icons.smart_toy_outlined,
							size: AppSpacings.scale(48),
							color: placeholderColor,
						),
						SizedBox(height: AppSpacings.pLg),
						Text(
							localizations.buddy_provider_not_configured_title,
							style: TextStyle(
								fontSize: AppFontSize.base,
								fontWeight: FontWeight.w600,
								color: secondaryColor,
							),
							textAlign: TextAlign.center,
						),
						SizedBox(height: AppSpacings.pSm),
						Text(
							localizations.buddy_provider_not_configured_description,
							style: TextStyle(
								fontSize: AppFontSize.small,
								color: placeholderColor,
							),
							textAlign: TextAlign.center,
						),
					],
				),
			),
		);
	}

	Future<void> _retryInitialization() async {
		setState(() {
			_initialized = false;
			_initFailed = false;
			_initProviderMissing = false;
		});
		await _initializeConversation();
	}

	Widget _buildTypingIndicator(BuildContext context, bool isDark) {
		final localizations = AppLocalizations.of(context)!;
		final overlayColor = isDark ? AppBgColorDark.overlay : AppBgColorLight.overlay;

		return Padding(
			padding: EdgeInsets.symmetric(
				horizontal: AppSpacings.pMd,
				vertical: AppSpacings.pXs,
			),
			child: Row(
				mainAxisAlignment: MainAxisAlignment.start,
				children: [
					SizedBox(width: AppSpacings.pXl),
					Container(
						padding: EdgeInsets.symmetric(
							horizontal: AppSpacings.pLg,
							vertical: AppSpacings.pMd,
						),
						decoration: BoxDecoration(
							color: overlayColor,
							borderRadius: BorderRadius.circular(AppBorderRadius.medium),
						),
						child: Row(
							mainAxisSize: MainAxisSize.min,
							children: [
								SizedBox(
									width: AppSpacings.scale(16),
									height: AppSpacings.scale(16),
									child: CircularProgressIndicator(
										strokeWidth: 2,
										color: isDark
											? AppTextColorDark.placeholder
											: AppTextColorLight.placeholder,
									),
								),
								SizedBox(width: AppSpacings.pMd),
								Text(
									localizations.buddy_thinking,
									style: TextStyle(
										fontSize: AppFontSize.small,
										color: isDark
											? AppTextColorDark.placeholder
											: AppTextColorLight.placeholder,
										fontStyle: FontStyle.italic,
									),
								),
							],
						),
					),
				],
			),
		);
	}

	String _localizedBuddyError(AppLocalizations localizations, BuddyErrorType? errorType) {
		if (errorType == null) {
			return localizations.buddy_error_generic;
		}
		switch (errorType) {
			case BuddyErrorType.loadConversations:
				return localizations.buddy_error_load_conversations;
			case BuddyErrorType.createConversation:
				return localizations.buddy_error_create_conversation;
			case BuddyErrorType.loadMessages:
				return localizations.buddy_error_load_messages;
			case BuddyErrorType.sendMessage:
				return localizations.buddy_error_send_message;
			case BuddyErrorType.providerNotConfigured:
				return localizations.buddy_error_provider_not_configured;
			case BuddyErrorType.requestTimeout:
				return localizations.buddy_error_request_timeout;
			case BuddyErrorType.connectionError:
				return localizations.buddy_error_connection_error;
			case BuddyErrorType.generic:
				return localizations.buddy_error_generic;
		}
	}

	Widget _buildInput(BuildContext context, bool isDark) {
		final localizations = AppLocalizations.of(context)!;
		final borderColor = isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
		final inputBg = isDark ? AppBgColorDark.overlay : AppBgColorLight.overlay;
		final textColor = isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
		final hintColor = isDark
			? AppTextColorDark.placeholder
			: AppTextColorLight.placeholder;

		final displayRepo = locator<DisplayRepository>();
		final canRecordAudio = displayRepo.audioInputSupported && displayRepo.hasMicrophoneEnabled;

		return Consumer<BuddyService>(
			builder: (context, buddyService, _) {
				final isDisabled = !_initialized || buddyService.isProviderNotConfigured || _initFailed;
				final isMicDisabled = isDisabled || buddyService.isSttNotConfigured || !canRecordAudio;
				final isSending = buddyService.isSendingMessage;

				return Container(
					padding: EdgeInsets.symmetric(
						horizontal: AppSpacings.pMd,
						vertical: AppSpacings.pMd,
					),
					decoration: BoxDecoration(
						border: Border(
							top: BorderSide(color: borderColor),
						),
					),
					child: Row(
						children: [
							Expanded(
								child: Container(
									decoration: BoxDecoration(
										color: inputBg,
										borderRadius:
											BorderRadius.circular(AppBorderRadius.round),
									),
									child: TextField(
										controller: _inputController,
										focusNode: _inputFocusNode,
										enabled: !isDisabled && !isSending,
										style: TextStyle(
											fontSize: AppFontSize.base,
											color: textColor,
										),
										decoration: InputDecoration(
											hintText: _initProviderMissing
													? localizations.buddy_provider_not_configured_title
													: _initFailed
														? localizations.buddy_hint_init_failed
														: !_initialized
															? localizations.buddy_hint_starting_conversation
															: buddyService.isProviderNotConfigured
																? localizations.buddy_provider_not_configured_title
																: localizations.buddy_hint_default,
											hintStyle: TextStyle(
												fontSize: AppFontSize.base,
												color: hintColor,
											),
											border: InputBorder.none,
											contentPadding: EdgeInsets.symmetric(
												horizontal: AppSpacings.pLg,
												vertical: AppSpacings.pMd,
											),
										),
										onSubmitted: (_) => _sendMessage(),
										textInputAction: TextInputAction.send,
									),
								),
							),
							SizedBox(width: AppSpacings.pSm),
							_buildMicButton(context, isDark, isSending || isMicDisabled),
							SizedBox(width: AppSpacings.pSm),
							_buildSendButton(context, isDark, isSending || isDisabled),
						],
					),
				);
			},
		);
	}

	Widget _buildMicButton(BuildContext context, bool isDark, bool disabled) {
		final accentColor = ThemeColorFamily.get(
			isDark ? Brightness.dark : Brightness.light,
			ThemeColors.primary,
		).base;

		return GestureDetector(
			onTap: disabled ? null : _openVoiceOverlay,
			child: Container(
				width: AppSpacings.scale(36),
				height: AppSpacings.scale(36),
				decoration: BoxDecoration(
					color: disabled
						? accentColor.withValues(alpha: 0.3)
						: accentColor,
					shape: BoxShape.circle,
				),
				child: Icon(
					Icons.mic,
					size: AppSpacings.scale(18),
					color: Colors.white,
				),
			),
		);
	}

	Widget _buildSendButton(BuildContext context, bool isDark, bool disabled) {
		final accentColor = ThemeColorFamily.get(
			isDark ? Brightness.dark : Brightness.light,
			ThemeColors.primary,
		).base;

		return GestureDetector(
			onTap: disabled ? null : _sendMessage,
			child: Container(
				width: AppSpacings.scale(36),
				height: AppSpacings.scale(36),
				decoration: BoxDecoration(
					color: disabled
						? accentColor.withValues(alpha: 0.3)
						: accentColor,
					shape: BoxShape.circle,
				),
				child: Icon(
					Icons.send,
					size: AppSpacings.scale(18),
					color: Colors.white,
				),
			),
		);
	}
}

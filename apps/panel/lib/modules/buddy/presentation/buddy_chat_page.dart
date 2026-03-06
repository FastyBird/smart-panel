import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/buddy/models/buddy_config.dart';
import 'package:fastybird_smart_panel/modules/buddy/models/message.dart';
import 'package:fastybird_smart_panel/modules/buddy/repositories/buddy.dart';
import 'package:fastybird_smart_panel/modules/buddy/presentation/widgets/message_bubble.dart';
import 'package:fastybird_smart_panel/modules/buddy/presentation/widgets/suggestion_card.dart';
import 'package:fastybird_smart_panel/modules/buddy/service.dart';
import 'package:fastybird_smart_panel/modules/buddy/services/audio_playback_service.dart';
import 'package:fastybird_smart_panel/modules/buddy/services/audio_recording_service.dart';
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
/// - Microphone button for voice input (press-and-hold)
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
	late final AudioRecordingService _audioRecordingService;
	late final AudioPlaybackService _audioPlaybackService;

	String _buddyName = 'Buddy';

	bool _initialized = false;
	bool _initFailed = false;
	bool _initProviderMissing = false;

	/// Track message count so _scrollToBottom fires only on new messages.
	int _lastMessageCount = 0;

	/// Track the last recording state + displayed second so we skip
	/// sub-second rebuilds that produce no visible change.
	bool _lastIsRecording = false;
	int _lastRecordingSecond = -1;

	/// Whether voice mode is active (last input was via microphone).
	/// When true, TTS auto-play is enabled for new assistant messages.
	bool _voiceModeActive = false;

	/// The last assistant message ID we auto-played, to avoid replaying.
	String? _lastAutoPlayedMessageId;

	@override
	void initState() {
		super.initState();
		_buddyService = context.read<BuddyService>();
		_buddyService.addListener(_onBuddyServiceChanged);

		_buddyConfigRepo = locator<ConfigModuleService>()
				.getModuleRepository<BuddyConfigModel>('buddy-module');
		_buddyName = _buddyConfigRepo.data?.name ?? 'Buddy';
		_buddyConfigRepo.addListener(_onBuddyConfigChanged);

		_audioRecordingService = AudioRecordingService();
		_audioRecordingService.addListener(_onRecordingChanged);
		_audioRecordingService.checkPermission();

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
			_scrollToBottom();
		}
	}

	void _scrollToBottom() {
		if (!mounted) return;

		// Wait two frames: the first lets the ListView lay out its children,
		// the second ensures maxScrollExtent is up-to-date.
		WidgetsBinding.instance.addPostFrameCallback((_) {
			WidgetsBinding.instance.addPostFrameCallback((_) {
				if (mounted && _scrollController.hasClients) {
					_scrollController.jumpTo(
						_scrollController.position.maxScrollExtent,
					);
				}
			});
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

	Future<void> _startRecording() async {
		final localizations = AppLocalizations.of(context)!;
		final started = await _audioRecordingService.startRecording();

		if (!started && mounted) {
			ScaffoldMessenger.of(context).showSnackBar(
				SnackBar(
					content: Text(localizations.buddy_recording_permission_error),
					duration: const Duration(seconds: 2),
				),
			);
		}
	}

	Future<void> _stopRecordingAndSend() async {
		final localizations = AppLocalizations.of(context)!;
		// Capture the service reference before any async gap — the widget
		// may be disposed during stopRecording, making context.read unsafe.
		final buddyService = context.read<BuddyService>();

		// Check minimum duration before stopping — if too short, cancel
		// and give the user visible feedback instead of silently discarding.
		if (_audioRecordingService.isRecording &&
				_audioRecordingService.recordingDuration < const Duration(milliseconds: 500)) {
			await _audioRecordingService.cancelRecording();

			if (mounted) {
				ScaffoldMessenger.of(context).showSnackBar(
					SnackBar(
						content: Text(localizations.buddy_recording_too_short),
						duration: const Duration(seconds: 2),
					),
				);
			}

			return;
		}

		final recorded = await _audioRecordingService.stopRecording();

		if (recorded == null) return;

		if (!buddyService.hasActiveConversation) return;

		_voiceModeActive = true;

		await buddyService.sendAudioMessage(recorded.bytes, recorded.mimeType);

		if (mounted) {
			_scrollToBottom();
		}
	}

	Future<bool> _handleSuggestionFeedback(
		String suggestionId,
		String feedback,
	) async {
		final buddyService = context.read<BuddyService>();

		if (feedback == 'applied') {
			return buddyService.acceptSuggestion(suggestionId);
		} else {
			return buddyService.dismissSuggestion(suggestionId);
		}
	}

	void _onBuddyServiceChanged() {
		if (!mounted) return;

		final messages = _buddyService.messages;
		final messageCount = messages.length;

		if (messageCount > _lastMessageCount) {
			_scrollToBottom();

			// Auto-play TTS for new assistant messages when voice mode is active
			if (_voiceModeActive && _buddyService.isTtsConfigured && messageCount > 0) {
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

	void _onRecordingChanged() {
		if (!mounted) return;

		// When auto-stop fires, immediately submit the recorded audio.
		if (_audioRecordingService.wasAutoStopped) {
			_stopRecordingAndSend().catchError((_) {});
		}

		// The recording timer fires every 100ms but the indicator only
		// shows whole seconds. Skip rebuilds that produce no visible change.
		final isRecording = _audioRecordingService.isRecording;
		final currentSecond = _audioRecordingService.recordingDuration.inSeconds;

		if (isRecording == _lastIsRecording && currentSecond == _lastRecordingSecond) {
			return;
		}

		_lastIsRecording = isRecording;
		_lastRecordingSecond = currentSecond;

		setState(() {});
	}

	@override
	void dispose() {
		_buddyService.removeListener(_onBuddyServiceChanged);
		_buddyConfigRepo.removeListener(_onBuddyConfigChanged);
		_audioRecordingService.removeListener(_onRecordingChanged);
		_audioPlaybackService.removeListener(_onPlaybackChanged);
		_audioRecordingService.dispose();
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
											final suggestions = buddyService.suggestions;

											return Stack(
												children: [
													_buildBody(context, isDark, buddyService),
													if (suggestions.isNotEmpty)
														Positioned(
															top: 0,
															left: 0,
															right: 0,
															child: BuddySuggestionCard(
																key: ValueKey(suggestions.first.id),
																suggestion: suggestions.first,
																onFeedback: (id, feedback) =>
																	_handleSuggestionFeedback(id, feedback),
																onAnimationComplete: (id) {
																	context.read<BuddyService>().removeSuggestion(id);
																},
															),
														),
												],
											);
										},
									)
								: Center(
									child: CircularProgressIndicator(
										color: Theme.of(context).colorScheme.primary,
									),
								),
						),
						if (_audioRecordingService.isRecording)
							_buildRecordingIndicator(context, isDark),
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

		if (mounted) {
			_scrollToBottom();
		}
	}

	Widget _buildBody(BuildContext context, bool isDark, BuddyService buddyService) {
		final messages = buddyService.messages;
		final hasMessages = messages.isNotEmpty;

		return ListView(
			controller: _scrollController,
			padding: EdgeInsets.symmetric(vertical: AppSpacings.pMd),
			children: [
				// Empty state
				if (!hasMessages && !buddyService.isLoadingMessages)
					_buildEmptyState(context, isDark),

				// Messages
				...messages.map(
					(message) => MessageBubble(
						key: ValueKey(message.id),
						message: message,
						showSpeakerIcon: buddyService.isTtsConfigured,
						audioPlaybackService: _audioPlaybackService,
						audioUrl: message.role == BuddyMessageRole.assistant
							? buddyService.getMessageAudioUrl(message.id)
							: null,
					),
				),

				// Loading indicator while waiting for AI response
				if (buddyService.isSendingMessage)
					_buildTypingIndicator(context, isDark),

				// Error state
				if (buddyService.hasError)
					_buildErrorMessage(context, isDark, buddyService.errorType),
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

	Widget _buildErrorMessage(BuildContext context, bool isDark, BuddyErrorType? errorType) {
		final localizations = AppLocalizations.of(context)!;
		final warningColor = isDark ? AppColorsDark.warning : AppColorsLight.warning;

		return Padding(
			padding: EdgeInsets.symmetric(
				horizontal: AppSpacings.pLg,
				vertical: AppSpacings.pSm,
			),
			child: Container(
				padding: AppSpacings.paddingMd,
				decoration: BoxDecoration(
					color: warningColor.withValues(alpha: 0.1),
					borderRadius: BorderRadius.circular(AppBorderRadius.base),
				),
				child: Row(
					children: [
						Icon(
							Icons.warning_amber_rounded,
							size: AppSpacings.scale(16),
							color: warningColor,
						),
						SizedBox(width: AppSpacings.pMd),
						Expanded(
							child: Text(
								_localizedBuddyError(localizations, errorType),
								style: TextStyle(
									fontSize: AppFontSize.small,
									color: warningColor,
								),
							),
						),
					],
				),
			),
		);
	}

	Widget _buildRecordingIndicator(BuildContext context, bool isDark) {
		final localizations = AppLocalizations.of(context)!;
		final dangerColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;
		final borderColor = isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
		final seconds = _audioRecordingService.recordingDuration.inSeconds;
		final maxSeconds = AudioRecordingService.maxDuration.inSeconds;

		return Container(
			padding: EdgeInsets.symmetric(
				horizontal: AppSpacings.pLg,
				vertical: AppSpacings.pSm,
			),
			decoration: BoxDecoration(
				border: Border(
					top: BorderSide(color: borderColor),
				),
			),
			child: Row(
				children: [
					Icon(
						Icons.fiber_manual_record,
						color: dangerColor,
						size: AppSpacings.scale(12),
					),
					SizedBox(width: AppSpacings.pSm),
					Text(
						localizations.buddy_recording_progress(seconds, maxSeconds),
						style: TextStyle(
							fontSize: AppFontSize.small,
							color: dangerColor,
							fontWeight: FontWeight.w500,
						),
					),
					const Spacer(),
					GestureDetector(
						onTap: () => _audioRecordingService.cancelRecording(),
						child: Text(
							localizations.button_cancel,
							style: TextStyle(
								fontSize: AppFontSize.small,
								color: isDark
									? AppTextColorDark.secondary
									: AppTextColorLight.secondary,
							),
						),
					),
				],
			),
		);
	}

	Widget _buildInput(BuildContext context, bool isDark) {
		final localizations = AppLocalizations.of(context)!;
		final borderColor = isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
		final inputBg = isDark ? AppBgColorDark.overlay : AppBgColorLight.overlay;
		final textColor = isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
		final hintColor = isDark
			? AppTextColorDark.placeholder
			: AppTextColorLight.placeholder;

		return Consumer<BuddyService>(
			builder: (context, buddyService, _) {
				final isDisabled = !_initialized || buddyService.isProviderNotConfigured || _initFailed;
				final isMicDisabled = isDisabled || buddyService.isSttNotConfigured;
				final isSending = buddyService.isSendingMessage;
				final isRecording = _audioRecordingService.isRecording;

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
										enabled: !isDisabled && !isSending && !isRecording,
										style: TextStyle(
											fontSize: AppFontSize.base,
											color: textColor,
										),
										decoration: InputDecoration(
											hintText: isRecording
												? localizations.buddy_hint_recording
												: _initProviderMissing
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
							_buildSendButton(context, isDark, isSending || isDisabled || isRecording),
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
		final dangerColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;
		final isRecording = _audioRecordingService.isRecording;
		final buttonColor = isRecording ? dangerColor : accentColor;

		return GestureDetector(
			onLongPressStart: disabled || isRecording ? null : (_) => _startRecording(),
			onLongPressEnd: disabled && !isRecording ? null : (_) => _stopRecordingAndSend(),
			onTap: disabled && !isRecording
				? null
				: () {
					if (isRecording) {
						_stopRecordingAndSend();
					} else {
						_startRecording();
					}
				},
			child: Container(
				width: AppSpacings.scale(36),
				height: AppSpacings.scale(36),
				decoration: BoxDecoration(
					color: disabled
						? buttonColor.withValues(alpha: 0.3)
						: buttonColor,
					shape: BoxShape.circle,
				),
				child: Icon(
					isRecording ? Icons.stop : Icons.mic,
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

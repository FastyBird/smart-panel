import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/buddy/presentation/widgets/message_bubble.dart';
import 'package:fastybird_smart_panel/modules/buddy/presentation/widgets/suggestion_card.dart';
import 'package:fastybird_smart_panel/modules/buddy/service.dart';

/// Sliding chat drawer for the buddy module.
///
/// Opens from the right edge and provides:
/// - Header with title and close button
/// - Scrollable message list (newest at bottom)
/// - Suggestion cards section
/// - Text input with send button
/// - Loading indicator while waiting for AI response
/// - Empty state when no messages
/// - Disabled state when AI provider is not configured
class BuddyChatDrawer extends StatefulWidget {
	final VoidCallback onClose;

	const BuddyChatDrawer({
		super.key,
		required this.onClose,
	});

	@override
	State<BuddyChatDrawer> createState() => _BuddyChatDrawerState();
}

class _BuddyChatDrawerState extends State<BuddyChatDrawer> {
	final TextEditingController _inputController = TextEditingController();
	final ScrollController _scrollController = ScrollController();
	final FocusNode _inputFocusNode = FocusNode();

	bool _initialized = false;

	@override
	void initState() {
		super.initState();
		_initializeConversation();
	}

	Future<void> _initializeConversation() async {
		final buddyService = context.read<BuddyService>();

		if (!buddyService.hasActiveConversation) {
			await buddyService.startNewConversation();
		}

		if (mounted) {
			setState(() {
				_initialized = true;
			});
			_scrollToBottom();
		}
	}

	void _scrollToBottom() {
		WidgetsBinding.instance.addPostFrameCallback((_) {
			if (_scrollController.hasClients) {
				_scrollController.animateTo(
					_scrollController.position.maxScrollExtent,
					duration: const Duration(milliseconds: 200),
					curve: Curves.easeOut,
				);
			}
		});
	}

	Future<void> _sendMessage() async {
		final text = _inputController.text.trim();

		if (text.isEmpty) return;

		_inputController.clear();

		final buddyService = context.read<BuddyService>();
		await buddyService.sendMessage(text);

		_scrollToBottom();
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

	@override
	void dispose() {
		_inputController.dispose();
		_scrollController.dispose();
		_inputFocusNode.dispose();
		super.dispose();
	}

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;

		final bgColor = isDark ? AppBgColorDark.base : AppBgColorLight.base;

		return Container(
			color: bgColor,
			child: SafeArea(
				child: Column(
					children: [
						_buildHeader(context, isDark),
						Expanded(
							child: _initialized
								? _buildBody(context, isDark)
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

	Widget _buildHeader(BuildContext context, bool isDark) {
		final accentColor = ThemeColorFamily.get(
			isDark ? Brightness.dark : Brightness.light,
			ThemeColors.primary,
		).base;

		final titleColor = isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
		final borderColor = isDark ? AppBorderColorDark.light : AppBorderColorLight.light;

		return Container(
			padding: EdgeInsets.symmetric(
				horizontal: AppSpacings.pMd,
				vertical: AppSpacings.pMd,
			),
			decoration: BoxDecoration(
				border: Border(
					bottom: BorderSide(color: borderColor),
				),
			),
			child: Row(
				children: [
					Icon(
						Icons.smart_toy_outlined,
						color: accentColor,
						size: AppSpacings.scale(22),
					),
					SizedBox(width: AppSpacings.pMd),
					Expanded(
						child: Text(
							'Buddy',
							style: TextStyle(
								fontSize: AppFontSize.large,
								fontWeight: FontWeight.w600,
								color: titleColor,
							),
						),
					),
					IconButton(
						icon: Icon(
							Icons.close,
							size: AppSpacings.scale(20),
							color: isDark
								? AppTextColorDark.secondary
								: AppTextColorLight.secondary,
						),
						onPressed: widget.onClose,
						padding: EdgeInsets.zero,
						constraints: BoxConstraints(
							minWidth: AppSpacings.scale(32),
							minHeight: AppSpacings.scale(32),
						),
					),
				],
			),
		);
	}

	Widget _buildBody(BuildContext context, bool isDark) {
		return Consumer<BuddyService>(
			builder: (context, buddyService, _) {
				final messages = buddyService.messages;
				final suggestions = buddyService.suggestions;
				final hasMessages = messages.isNotEmpty;
				final hasSuggestions = suggestions.isNotEmpty;

				// Auto-scroll when new messages arrive
				if (hasMessages) {
					_scrollToBottom();
				}

				return ListView(
					controller: _scrollController,
					padding: EdgeInsets.symmetric(vertical: AppSpacings.pMd),
					children: [
						// Suggestions section
						if (hasSuggestions) ...[
							Padding(
								padding: EdgeInsets.symmetric(
									horizontal: AppSpacings.pLg,
									vertical: AppSpacings.pSm,
								),
								child: Text(
									'Suggestions',
									style: TextStyle(
										fontSize: AppFontSize.small,
										fontWeight: FontWeight.w600,
										color: isDark
											? AppTextColorDark.secondary
											: AppTextColorLight.secondary,
									),
								),
							),
							...suggestions.map(
								(suggestion) => BuddySuggestionCard(
									key: ValueKey(suggestion.id),
									suggestion: suggestion,
									onFeedback: (id, feedback) =>
										_handleSuggestionFeedback(id, feedback),
								),
							),
							SizedBox(height: AppSpacings.pMd),
						],

						// Empty state
						if (!hasMessages && !buddyService.isLoadingMessages)
							_buildEmptyState(context, isDark),

						// Messages
						...messages.map(
							(message) => MessageBubble(
								key: ValueKey(message.id),
								message: message,
							),
						),

						// Loading indicator while waiting for AI response
						if (buddyService.isSendingMessage)
							_buildTypingIndicator(context, isDark),

						// Error state
						if (buddyService.hasError)
							_buildErrorMessage(context, isDark, buddyService.error!),
					],
				);
			},
		);
	}

	Widget _buildEmptyState(BuildContext context, bool isDark) {
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
							'Ask me anything about your home!',
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

	Widget _buildTypingIndicator(BuildContext context, bool isDark) {
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
									'Thinking...',
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

	Widget _buildErrorMessage(BuildContext context, bool isDark, String error) {
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
								error,
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

	Widget _buildInput(BuildContext context, bool isDark) {
		final borderColor = isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
		final inputBg = isDark ? AppBgColorDark.overlay : AppBgColorLight.overlay;
		final textColor = isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
		final hintColor = isDark
			? AppTextColorDark.placeholder
			: AppTextColorLight.placeholder;

		return Consumer<BuddyService>(
			builder: (context, buddyService, _) {
				final isDisabled = buddyService.isProviderNotConfigured;
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
											hintText: isDisabled
												? 'AI provider not configured'
												: 'Ask about your home...',
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
							SizedBox(width: AppSpacings.pMd),
							_buildSendButton(context, isDark, isSending || isDisabled),
						],
					),
				);
			},
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

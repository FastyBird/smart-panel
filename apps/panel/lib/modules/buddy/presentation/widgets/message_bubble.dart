import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:intl/intl.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/buddy/models/message.dart';
import 'package:fastybird_smart_panel/modules/buddy/services/audio_playback_service.dart';

/// Chat bubble widget for user and assistant messages.
///
/// User messages are right-aligned with primary color background.
/// Assistant messages are left-aligned with surface color background
/// and render markdown formatting (bold, italic, lists, code, etc.).
///
/// When [showSpeakerIcon] is true and the message is from the assistant,
/// a speaker icon is shown that plays the TTS audio for the message.
class MessageBubble extends StatelessWidget {
	final BuddyMessageModel message;
	final bool showSpeakerIcon;
	final AudioPlaybackService? audioPlaybackService;
	final String? audioUrl;

	const MessageBubble({
		super.key,
		required this.message,
		this.showSpeakerIcon = false,
		this.audioPlaybackService,
		this.audioUrl,
	});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final isUser = message.role == BuddyMessageRole.user;

		final accentColor = ThemeColorFamily.get(
			isDark ? Brightness.dark : Brightness.light,
			ThemeColors.primary,
		).base;

		final bubbleColor = isUser
			? accentColor
			: isDark
				? AppBgColorDark.overlay
				: AppBgColorLight.overlay;

		final textColor = isUser
			? Colors.white
			: isDark
				? AppTextColorDark.primary
				: AppTextColorLight.primary;

		final timestampColor = isUser
			? Colors.white.withValues(alpha: 0.7)
			: isDark
				? AppTextColorDark.placeholder
				: AppTextColorLight.placeholder;

		final timeFormat = DateFormat.Hm();

		return Padding(
			padding: EdgeInsets.symmetric(
				horizontal: AppSpacings.pMd,
				vertical: AppSpacings.pXs,
			),
			child: Row(
				mainAxisAlignment:
					isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
				crossAxisAlignment: CrossAxisAlignment.end,
				children: [
					if (isUser) SizedBox(width: AppSpacings.pXl),
					Flexible(
						child: Container(
							padding: EdgeInsets.symmetric(
								horizontal: AppSpacings.pLg,
								vertical: AppSpacings.pMd,
							),
							decoration: BoxDecoration(
								color: bubbleColor,
								borderRadius: BorderRadius.only(
									topLeft: Radius.circular(AppBorderRadius.medium),
									topRight: Radius.circular(AppBorderRadius.medium),
									bottomLeft: isUser
										? Radius.circular(AppBorderRadius.medium)
										: Radius.circular(AppBorderRadius.small),
									bottomRight: isUser
										? Radius.circular(AppBorderRadius.small)
										: Radius.circular(AppBorderRadius.medium),
								),
							),
							child: Column(
								crossAxisAlignment: CrossAxisAlignment.start,
								children: [
									if (isUser)
										Text(
											message.content,
											style: TextStyle(
												fontSize: AppFontSize.small,
												color: textColor,
												height: 1.4,
											),
										)
									else
										_buildMarkdownBody(context, isDark, textColor),
									SizedBox(height: AppSpacings.pXs),
									Row(
										mainAxisSize: MainAxisSize.min,
										children: [
											Text(
												timeFormat.format(message.createdAt),
												style: TextStyle(
													fontSize: AppFontSize.extraExtraSmall,
													color: timestampColor,
												),
											),
											if (!isUser && showSpeakerIcon && audioPlaybackService != null && audioUrl != null)
												_buildSpeakerButton(isDark, timestampColor),
										],
									),
								],
							),
						),
					),
					if (!isUser) SizedBox(width: AppSpacings.pXl),
				],
			),
		);
	}

	Widget _buildSpeakerButton(bool isDark, Color iconColor) {
		final service = audioPlaybackService!;
		final isPlaying = service.isPlayingMessage(message.id);
		final isLoading = service.isLoadingMessage(message.id);
		final hasError = service.currentMessageId == message.id && service.error != null;

		return Padding(
			padding: EdgeInsets.only(left: AppSpacings.pSm),
			child: GestureDetector(
				onTap: () {
					if (isPlaying || isLoading) {
						service.stop();
					} else {
						service.playMessageAudio(message.id, audioUrl!);
					}
				},
				child: SizedBox(
					width: AppSpacings.scale(18),
					height: AppSpacings.scale(18),
					child: isLoading
						? SizedBox(
								width: AppSpacings.scale(12),
								height: AppSpacings.scale(12),
								child: CircularProgressIndicator(
									strokeWidth: 1.5,
									color: iconColor,
								),
							)
						: Icon(
								hasError
									? Icons.volume_off_outlined
									: isPlaying
										? Icons.stop_circle_outlined
										: Icons.volume_up_outlined,
								size: AppSpacings.scale(14),
								color: hasError ? Colors.red.shade300 : iconColor,
							),
				),
			),
		);
	}

	Widget _buildMarkdownBody(BuildContext context, bool isDark, Color textColor) {
		final secondaryColor = isDark
			? AppTextColorDark.secondary
			: AppTextColorLight.secondary;

		final codeBg = isDark
			? AppBgColorDark.base
			: AppBgColorLight.base;

		final fontSize = AppFontSize.small;

		return MarkdownBody(
			data: message.content,
			shrinkWrap: true,
			styleSheet: MarkdownStyleSheet(
				p: TextStyle(
					fontSize: fontSize,
					color: textColor,
					height: 1.4,
				),
				strong: TextStyle(
					fontSize: fontSize,
					color: textColor,
					fontWeight: FontWeight.w700,
				),
				em: TextStyle(
					fontSize: fontSize,
					color: textColor,
					fontStyle: FontStyle.italic,
				),
				h1: TextStyle(
					fontSize: AppFontSize.large,
					color: textColor,
					fontWeight: FontWeight.w700,
				),
				h2: TextStyle(
					fontSize: AppFontSize.base,
					color: textColor,
					fontWeight: FontWeight.w700,
				),
				h3: TextStyle(
					fontSize: fontSize,
					color: textColor,
					fontWeight: FontWeight.w700,
				),
				listBullet: TextStyle(
					fontSize: fontSize,
					color: textColor,
				),
				code: TextStyle(
					fontSize: AppFontSize.extraSmall,
					color: secondaryColor,
					backgroundColor: codeBg,
				),
				codeblockDecoration: BoxDecoration(
					color: codeBg,
					borderRadius: BorderRadius.circular(AppBorderRadius.small),
				),
				codeblockPadding: EdgeInsets.all(AppSpacings.pMd),
				blockquoteDecoration: BoxDecoration(
					border: Border(
						left: BorderSide(
							color: secondaryColor.withValues(alpha: 0.4),
							width: 3,
						),
					),
				),
				blockquotePadding: EdgeInsets.only(left: AppSpacings.pMd),
				// Remove extra spacing around markdown blocks
				pPadding: EdgeInsets.zero,
				h1Padding: EdgeInsets.zero,
				h2Padding: EdgeInsets.zero,
				h3Padding: EdgeInsets.zero,
			),
		);
	}
}

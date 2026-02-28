import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/buddy/models/message.dart';

/// Chat bubble widget for user and assistant messages.
///
/// User messages are right-aligned with primary color background.
/// Assistant messages are left-aligned with surface color background.
class MessageBubble extends StatelessWidget {
	final BuddyMessageModel message;

	const MessageBubble({
		super.key,
		required this.message,
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
					if (!isUser) SizedBox(width: AppSpacings.pXl),
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
									Text(
										message.content,
										style: TextStyle(
											fontSize: AppFontSize.base,
											color: textColor,
											height: 1.4,
										),
									),
									SizedBox(height: AppSpacings.pXs),
									Text(
										timeFormat.format(message.createdAt),
										style: TextStyle(
											fontSize: AppFontSize.extraExtraSmall,
											color: timestampColor,
										),
									),
								],
							),
						),
					),
					if (isUser) SizedBox(width: AppSpacings.pXl),
				],
			),
		);
	}
}

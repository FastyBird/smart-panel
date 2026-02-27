import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/buddy/models/conversation.dart';

class MessageBubble extends StatelessWidget {
  final BuddyMessageModel message;

  const MessageBubble({
    super.key,
    required this.message,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isUser = message.isUser;

    final bubbleColor = isUser
        ? ThemeColorFamily.get(
            isDark ? Brightness.dark : Brightness.light,
            ThemeColors.primary,
          ).base
        : isDark
            ? AppBgColorDark.overlay
            : AppBgColorLight.overlay;

    final textColor = isUser
        ? Colors.white
        : isDark
            ? AppTextColorDark.primary
            : AppTextColorLight.primary;

    final timeColor = isUser
        ? Colors.white.withValues(alpha: 0.7)
        : isDark
            ? AppTextColorDark.placeholder
            : AppTextColorLight.placeholder;

    final timeStr = DateFormat.Hm().format(message.createdAt);

    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.75,
        ),
        child: Container(
          margin: EdgeInsets.only(
            top: AppSpacings.pXs,
            bottom: AppSpacings.pXs,
            left: isUser ? AppSpacings.pXl : 0,
            right: isUser ? 0 : AppSpacings.pXl,
          ),
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pMd,
            vertical: AppSpacings.pSm,
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
            crossAxisAlignment:
                isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
            children: [
              Text(
                message.content,
                style: TextStyle(
                  fontSize: AppFontSize.small,
                  color: textColor,
                  height: 1.4,
                ),
              ),
              SizedBox(height: AppSpacings.pXs),
              Text(
                timeStr,
                style: TextStyle(
                  fontSize: AppFontSize.extraExtraSmall,
                  color: timeColor,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

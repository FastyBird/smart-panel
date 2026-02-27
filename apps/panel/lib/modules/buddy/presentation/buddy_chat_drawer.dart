import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/buddy/models/suggestion.dart';
import 'package:fastybird_smart_panel/modules/buddy/presentation/widgets/message_bubble.dart';
import 'package:fastybird_smart_panel/modules/buddy/presentation/widgets/suggestion_card.dart';
import 'package:fastybird_smart_panel/modules/buddy/service.dart';

class BuddyChatDrawer extends StatefulWidget {
  const BuddyChatDrawer({super.key});

  @override
  State<BuddyChatDrawer> createState() => _BuddyChatDrawerState();
}

class _BuddyChatDrawerState extends State<BuddyChatDrawer> {
  final BuddyService _buddyService = locator<BuddyService>();
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _focusNode = FocusNode();

  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _buddyService.addListener(_onServiceChanged);
    _ensureConversation();
  }

  @override
  void dispose() {
    _buddyService.removeListener(_onServiceChanged);
    _textController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onServiceChanged() {
    if (mounted) {
      setState(() {});
      _scrollToBottom();
    }
  }

  Future<void> _ensureConversation() async {
    if (_buddyService.activeConversation == null) {
      await _buddyService.startNewConversation();
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

  Future<void> _handleSend() async {
    final text = _textController.text.trim();
    if (text.isEmpty || _buddyService.isSendingMessage) return;

    _textController.clear();
    setState(() {
      _errorMessage = null;
    });

    final result = await _buddyService.sendMessage(text);

    if (result == null && mounted) {
      setState(() {
        _errorMessage = 'Failed to send message. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? AppBgColorDark.page : AppBgColorLight.page;
    final headerColor =
        isDark ? AppBgColorDark.overlay : AppBgColorLight.overlay;
    final borderColor =
        isDark ? AppBorderColorDark.lighter : AppBorderColorLight.light;
    final titleColor =
        isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
    final accentColor = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      ThemeColors.primary,
    ).base;

    final messages = _buddyService.activeMessages;
    final suggestions = _buddyService.suggestions;

    return Container(
      color: bgColor,
      child: SafeArea(
        child: Column(
          children: [
            // Header
            Container(
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacings.pMd,
                vertical: AppSpacings.pSm,
              ),
              decoration: BoxDecoration(
                color: headerColor,
                border: Border(
                  bottom: BorderSide(color: borderColor),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    MdiIcons.robotHappyOutline,
                    color: accentColor,
                    size: AppSpacings.scale(24),
                  ),
                  SizedBox(width: AppSpacings.pSm),
                  Text(
                    'Buddy',
                    style: TextStyle(
                      fontSize: AppFontSize.base,
                      fontWeight: FontWeight.w600,
                      color: titleColor,
                    ),
                  ),
                  const Spacer(),
                  GestureDetector(
                    onTap: () => Navigator.of(context).pop(),
                    child: Icon(
                      MdiIcons.close,
                      color:
                          isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
                      size: AppSpacings.scale(22),
                    ),
                  ),
                ],
              ),
            ),

            // Content area
            Expanded(
              child: messages.isEmpty && suggestions.isEmpty
                  ? _buildEmptyState(isDark)
                  : _buildMessageList(
                      isDark, messages, suggestions, accentColor),
            ),

            // Error message
            if (_errorMessage != null)
              Container(
                width: double.infinity,
                padding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pMd,
                  vertical: AppSpacings.pSm,
                ),
                color: isDark
                    ? AppBgColorDark.overlay
                    : Colors.red.shade50,
                child: Text(
                  _errorMessage!,
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    color: isDark ? Colors.red.shade300 : Colors.red.shade700,
                  ),
                ),
              ),

            // Input area
            _buildInputArea(isDark, borderColor, accentColor),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    final color =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final accentColor = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      ThemeColors.primary,
    ).base;

    return Center(
      child: Padding(
        padding: AppSpacings.paddingLg,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              MdiIcons.robotHappyOutline,
              size: AppSpacings.scale(48),
              color: accentColor.withValues(alpha: 0.4),
            ),
            SizedBox(height: AppSpacings.pMd),
            Text(
              'Ask me anything about your home!',
              style: TextStyle(
                fontSize: AppFontSize.base,
                color: color,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageList(
    bool isDark,
    List messages,
    List<BuddySuggestionModel> suggestions,
    Color accentColor,
  ) {
    return ListView(
      controller: _scrollController,
      padding: EdgeInsets.all(AppSpacings.pMd),
      children: [
        // Suggestion cards at top
        if (suggestions.isNotEmpty) ...[
          ...suggestions.map(
            (s) => BuddySuggestionCard(
              suggestion: s,
              onApply: () => _buddyService.applySuggestion(s.id),
              onDismiss: () => _buddyService.dismissSuggestion(s.id),
            ),
          ),
          SizedBox(height: AppSpacings.pMd),
        ],

        // Messages
        ...messages.map(
          (m) => MessageBubble(message: m),
        ),

        // Loading indicator
        if (_buddyService.isSendingMessage)
          Align(
            alignment: Alignment.centerLeft,
            child: Padding(
              padding: EdgeInsets.only(
                top: AppSpacings.pSm,
                left: AppSpacings.pSm,
              ),
              child: _TypingIndicator(color: accentColor),
            ),
          ),
      ],
    );
  }

  Widget _buildInputArea(bool isDark, Color borderColor, Color accentColor) {
    final inputBgColor =
        isDark ? AppBgColorDark.overlay : AppBgColorLight.overlay;
    final hintColor =
        isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder;
    final textColor =
        isDark ? AppTextColorDark.primary : AppTextColorLight.primary;

    return Container(
      padding: EdgeInsets.all(AppSpacings.pSm),
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
                color: inputBgColor,
                borderRadius: BorderRadius.circular(AppBorderRadius.medium),
              ),
              child: TextField(
                controller: _textController,
                focusNode: _focusNode,
                style: TextStyle(
                  fontSize: AppFontSize.small,
                  color: textColor,
                ),
                decoration: InputDecoration(
                  hintText: 'Type a message...',
                  hintStyle: TextStyle(
                    fontSize: AppFontSize.small,
                    color: hintColor,
                  ),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: AppSpacings.pMd,
                    vertical: AppSpacings.pSm,
                  ),
                ),
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _handleSend(),
                enabled: !_buddyService.isSendingMessage,
              ),
            ),
          ),
          SizedBox(width: AppSpacings.pSm),
          GestureDetector(
            onTap: _buddyService.isSendingMessage ? null : _handleSend,
            child: Container(
              padding: EdgeInsets.all(AppSpacings.pSm),
              decoration: BoxDecoration(
                color: _buddyService.isSendingMessage
                    ? accentColor.withValues(alpha: 0.5)
                    : accentColor,
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
              ),
              child: Icon(
                MdiIcons.send,
                color: Colors.white,
                size: AppSpacings.scale(20),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TypingIndicator extends StatefulWidget {
  final Color color;

  const _TypingIndicator({required this.color});

  @override
  State<_TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<_TypingIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(3, (index) {
            final delay = index * 0.2;
            final value = (_controller.value - delay).clamp(0.0, 1.0);
            final double opacity =
                (0.3 + 0.7 * (1.0 - (2.0 * value - 1.0).abs()))
                    .clamp(0.3, 1.0);

            return Container(
              margin: EdgeInsets.symmetric(horizontal: AppSpacings.scale(2)),
              width: AppSpacings.scale(8),
              height: AppSpacings.scale(8),
              decoration: BoxDecoration(
                color: widget.color.withValues(alpha: opacity),
                shape: BoxShape.circle,
              ),
            );
          }),
        );
      },
    );
  }
}

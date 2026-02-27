import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/buddy/models/suggestion.dart';

class BuddySuggestionCard extends StatefulWidget {
  final BuddySuggestionModel suggestion;
  final VoidCallback onApply;
  final VoidCallback onDismiss;

  const BuddySuggestionCard({
    super.key,
    required this.suggestion,
    required this.onApply,
    required this.onDismiss,
  });

  @override
  State<BuddySuggestionCard> createState() => _BuddySuggestionCardState();
}

class _BuddySuggestionCardState extends State<BuddySuggestionCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;
  late final Animation<double> _fadeAnimation;
  late final Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();

    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );

    _fadeAnimation = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeOut),
    );

    _slideAnimation =
        Tween<Offset>(begin: Offset.zero, end: const Offset(1.0, 0.0)).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeOut),
    );
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  void _handleFeedback(VoidCallback callback) {
    _animController.forward().then((_) {
      callback();
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final cardColor = isDark ? AppBgColorDark.overlay : AppBgColorLight.overlay;
    final borderColor =
        isDark ? AppBorderColorDark.lighter : AppBorderColorLight.light;
    final titleColor =
        isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
    final reasonColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    final accentColor = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      ThemeColors.primary,
    ).base;

    return SlideTransition(
      position: _slideAnimation,
      child: FadeTransition(
        opacity: _fadeAnimation,
        child: Container(
          margin: EdgeInsets.only(bottom: AppSpacings.pSm),
          padding: EdgeInsets.all(AppSpacings.pMd),
          decoration: BoxDecoration(
            color: cardColor,
            borderRadius: BorderRadius.circular(AppBorderRadius.base),
            border: Border.all(color: borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    MdiIcons.lightbulbOnOutline,
                    size: AppSpacings.scale(18),
                    color: accentColor,
                  ),
                  SizedBox(width: AppSpacings.pSm),
                  Expanded(
                    child: Text(
                      widget.suggestion.title,
                      style: TextStyle(
                        fontSize: AppFontSize.small,
                        fontWeight: FontWeight.w600,
                        color: titleColor,
                      ),
                    ),
                  ),
                ],
              ),
              SizedBox(height: AppSpacings.pSm),
              Text(
                widget.suggestion.reason,
                style: TextStyle(
                  fontSize: AppFontSize.extraSmall,
                  color: reasonColor,
                  height: 1.3,
                ),
              ),
              SizedBox(height: AppSpacings.pMd),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  GestureDetector(
                    onTap: () => _handleFeedback(widget.onDismiss),
                    child: Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: AppSpacings.pMd,
                        vertical: AppSpacings.pXs,
                      ),
                      decoration: BoxDecoration(
                        borderRadius:
                            BorderRadius.circular(AppBorderRadius.small),
                        border: Border.all(color: borderColor),
                      ),
                      child: Text(
                        'Dismiss',
                        style: TextStyle(
                          fontSize: AppFontSize.extraSmall,
                          color: reasonColor,
                        ),
                      ),
                    ),
                  ),
                  SizedBox(width: AppSpacings.pSm),
                  GestureDetector(
                    onTap: () => _handleFeedback(widget.onApply),
                    child: Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: AppSpacings.pMd,
                        vertical: AppSpacings.pXs,
                      ),
                      decoration: BoxDecoration(
                        color: accentColor,
                        borderRadius:
                            BorderRadius.circular(AppBorderRadius.small),
                      ),
                      child: Text(
                        'Apply',
                        style: TextStyle(
                          fontSize: AppFontSize.extraSmall,
                          color: Colors.white,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

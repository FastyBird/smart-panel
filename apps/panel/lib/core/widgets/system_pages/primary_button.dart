import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/system_pages/theme.dart';

/// Primary action button for system pages
class SystemPagePrimaryButton extends StatefulWidget {
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final double minWidth;
  final bool isDark;
  final bool isLoading;

  const SystemPagePrimaryButton({
    super.key,
    required this.label,
    this.icon,
    this.onPressed,
    this.minWidth = 180,
    this.isDark = false,
    this.isLoading = false,
  });

  @override
  State<SystemPagePrimaryButton> createState() =>
      _SystemPagePrimaryButtonState();
}

class _SystemPagePrimaryButtonState extends State<SystemPagePrimaryButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final accent = SystemPagesTheme.accent(widget.isDark);
    final isDisabled = widget.onPressed == null || widget.isLoading;

    return GestureDetector(
      onTapDown: !isDisabled ? (_) => setState(() => _isPressed = true) : null,
      onTapUp: !isDisabled ? (_) => setState(() => _isPressed = false) : null,
      onTapCancel: !isDisabled ? () => setState(() => _isPressed = false) : null,
      onTap: !isDisabled ? widget.onPressed : null,
      child: AnimatedScale(
        scale: _isPressed ? 0.96 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: Container(
          constraints: BoxConstraints(minWidth: widget.minWidth),
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pLg,
            vertical: AppSpacings.pMd,
          ),
          decoration: BoxDecoration(
            color: isDisabled ? accent.withValues(alpha: 0.5) : accent,
            borderRadius: BorderRadius.circular(AppBorderRadius.medium),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (widget.isLoading) ...[
                SizedBox(
                  width: AppSpacings.pLg,
                  height: AppSpacings.pLg,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.white.withValues(alpha: 0.8),
                  ),
                ),
                SizedBox(width: AppSpacings.pSm),
              ] else if (widget.icon != null) ...[
                Icon(
                  widget.icon,
                  color: AppColors.white,
                  size: AppSpacings.pLg + AppSpacings.pSm,
                ),
                SizedBox(width: AppSpacings.pSm),
              ],
              Text(
                widget.label,
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: AppFontSize.base,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

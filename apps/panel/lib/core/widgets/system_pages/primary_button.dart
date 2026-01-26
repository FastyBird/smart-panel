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

  const SystemPagePrimaryButton({
    super.key,
    required this.label,
    this.icon,
    this.onPressed,
    this.minWidth = 180,
    this.isDark = false,
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

    return GestureDetector(
      onTapDown: widget.onPressed != null
          ? (_) => setState(() => _isPressed = true)
          : null,
      onTapUp: widget.onPressed != null
          ? (_) => setState(() => _isPressed = false)
          : null,
      onTapCancel: widget.onPressed != null
          ? () => setState(() => _isPressed = false)
          : null,
      onTap: widget.onPressed,
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
            color: widget.onPressed != null
                ? accent
                : accent.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(AppBorderRadius.medium),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (widget.icon != null) ...[
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

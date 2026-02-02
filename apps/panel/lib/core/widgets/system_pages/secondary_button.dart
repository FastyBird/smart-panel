import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/system_pages/theme.dart';

/// Secondary action button for system pages
class SystemPageSecondaryButton extends StatefulWidget {
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final bool isDark;
  final double minWidth;

  const SystemPageSecondaryButton({
    super.key,
    required this.label,
    this.icon,
    this.onPressed,
    this.isDark = false,
    this.minWidth = 180,
  });

  @override
  State<SystemPageSecondaryButton> createState() =>
      _SystemPageSecondaryButtonState();
}

class _SystemPageSecondaryButtonState extends State<SystemPageSecondaryButton> {
  final ScreenService _screenService = locator<ScreenService>();
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
            color: SystemPagesTheme.card(widget.isDark),
            borderRadius: BorderRadius.circular(AppBorderRadius.base),
            border: Border.all(
              color: _isPressed
                  ? accent
                  : SystemPagesTheme.border(widget.isDark),
              width: _screenService.scale(2),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (widget.icon != null) ...[
                Icon(
                  widget.icon,
                  color: widget.onPressed != null
                      ? SystemPagesTheme.textPrimary(widget.isDark)
                      : SystemPagesTheme.textMuted(widget.isDark),
                  size: AppSpacings.pLg + AppSpacings.pSm,
                ),
                SizedBox(width: AppSpacings.pSm),
              ],
              Text(
                widget.label,
                style: TextStyle(
                  color: widget.onPressed != null
                      ? SystemPagesTheme.textPrimary(widget.isDark)
                      : SystemPagesTheme.textMuted(widget.isDark),
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

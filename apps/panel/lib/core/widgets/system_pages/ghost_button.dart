import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/system_pages/theme.dart';

/// Subtle ghost button for tertiary actions
class SystemPageGhostButton extends StatefulWidget {
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final bool isDark;

  const SystemPageGhostButton({
    super.key,
    required this.label,
    this.icon,
    this.onPressed,
    this.isDark = false,
  });

  @override
  State<SystemPageGhostButton> createState() => _SystemPageGhostButtonState();
}

class _SystemPageGhostButtonState extends State<SystemPageGhostButton> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final accent = SystemPagesTheme.accent(widget.isDark);
    final color = _isHovered
        ? accent
        : SystemPagesTheme.textSecondary(widget.isDark);

    return GestureDetector(
      onTapDown: widget.onPressed != null
          ? (_) => setState(() => _isHovered = true)
          : null,
      onTapUp: widget.onPressed != null
          ? (_) => setState(() => _isHovered = false)
          : null,
      onTapCancel: widget.onPressed != null
          ? () => setState(() => _isHovered = false)
          : null,
      onTap: widget.onPressed,
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pMd,
          vertical: AppSpacings.pSm,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (widget.icon != null) ...[
              Icon(widget.icon, color: color, size: 18),
              SizedBox(width: AppSpacings.pXs),
            ],
            Text(
              widget.label,
              style: TextStyle(
                color: color,
                fontSize: AppFontSize.small,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

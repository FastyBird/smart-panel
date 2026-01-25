import 'package:flutter/material.dart';

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
      onTapDown: (_) => setState(() => _isHovered = true),
      onTapUp: (_) => setState(() => _isHovered = false),
      onTapCancel: () => setState(() => _isHovered = false),
      onTap: widget.onPressed,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (widget.icon != null) ...[
              Icon(widget.icon, color: color, size: 18),
              const SizedBox(width: 8),
            ],
            Text(
              widget.label,
              style: TextStyle(
                color: color,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

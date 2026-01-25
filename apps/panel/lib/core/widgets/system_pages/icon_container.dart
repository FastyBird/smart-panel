import 'package:flutter/material.dart';

/// Circular container for status icons
/// Used for error, warning, success states
class IconContainer extends StatelessWidget {
  final IconData icon;
  final Color color;
  final double size;
  final double iconSize;

  const IconContainer({
    super.key,
    required this.icon,
    required this.color,
    this.size = 80,
    this.iconSize = 40,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        shape: BoxShape.circle,
      ),
      child: Icon(icon, color: color, size: iconSize),
    );
  }
}

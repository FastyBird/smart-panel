import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_card.dart';

/// A card that constrains its own height in portrait orientation.
///
/// **Portrait**: height = `min(screenHeight * fraction, maxHeight)`.
/// **Landscape**: no height constraint — the parent (typically `Expanded`)
/// controls the card's size.
class HeroCard extends StatelessWidget {
  final Widget child;

  /// Fraction of screen height used in portrait. Defaults to `0.4`.
  final double fraction;

  /// Absolute height cap in portrait (logical pixels after scaling).
  /// Defaults to `AppSpacings.scale(500)`.
  final double? maxHeight;

  const HeroCard({
    super.key,
    required this.child,
    this.fraction = 0.48,
    this.maxHeight,
  });

  @override
  Widget build(BuildContext context) {
    final orientation = MediaQuery.of(context).orientation;

    final card = AppCard(
      width: double.infinity,
      child: child,
    );

    if (orientation == Orientation.landscape) {
      return card;
    }

    final screenHeight = MediaQuery.of(context).size.height;
    final cap = maxHeight ?? AppSpacings.scale(500);
    final height = (screenHeight * fraction).clamp(0.0, cap);

    return SizedBox(
      height: height,
      child: card,
    );
  }
}

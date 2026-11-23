import 'dart:math' as math;

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// What a control shows besides its value (docs/display-ui-design-spec.md §7,
/// "Control feedback").
enum ControlState {
  /// The value is the device's value.
  idle,

  /// The new value is sent and not confirmed yet ("Setting").
  pending,

  /// The device never confirmed the value ("Not confirmed", MIXED). A distinct
  /// warning look, never the same as [pending].
  unconfirmed,

  /// The control cannot act: read-only, offline or not supported.
  disabled,
}

/// The colours a control takes from its context (spec §2, "Accents"): the
/// accent outside a domain view, the domain colour inside one.
@immutable
class ControlTint {
  const ControlTint({
    required this.fill,
    required this.text,
    required this.soft,
  });

  /// Filled shapes: the slider's filled track and thumb ring, the switch
  /// track. A domain's fill in light, its bright shade on dark surfaces; the
  /// accent's fill in both themes.
  final Color fill;

  /// Text and icons on a surface, and the selected segment's outline.
  final Color text;

  /// The selected segment's background.
  final Color soft;

  /// The tint for [color]: null or [ThemeColors.primary] is the accent; any
  /// other key is that domain or status colour.
  static ControlTint of(ThemeData theme, [ThemeColors? color]) {
    if (color == null || color == ThemeColors.primary) {
      final accent = theme.accent;

      return ControlTint(
        fill: accent.fill,
        text: accent.text,
        soft: accent.soft,
      );
    }

    final family = ThemeColorFamily.get(theme.brightness, color);
    final isDark = theme.brightness == Brightness.dark;
    // A filled Lights control uses the warning fill (spec §2, "Domains").
    final lightFill =
        color == ThemeColors.lights || color == ThemeColors.warning
        ? theme.status(AppStatus.warning).fill
        : family.base;

    return ControlTint(
      fill: isDark ? family.base : lightFill,
      text: family.base,
      soft: family.soft,
    );
  }
}

/// The dashed ring a thumb wears while [ControlState.pending],
/// [ControlState.unconfirmed] or [ControlState.disabled]; null while idle.
Color? controlDashColor(ThemeData theme, ControlState state) =>
    switch (state) {
      ControlState.idle => null,
      ControlState.pending => theme.neutrals.textSecondary,
      ControlState.unconfirmed => theme.status(AppStatus.warning).text,
      ControlState.disabled => theme.neutrals.textDisabled,
    };

/// Paints a dashed circle of [radius] around [center].
void paintDashedCircle(
  Canvas canvas,
  Offset center,
  double radius,
  Paint paint, {
  int dashes = 12,
}) {
  final sweep = 2 * math.pi / dashes;
  final rect = Rect.fromCircle(center: center, radius: radius);

  for (var i = 0; i < dashes; i++) {
    canvas.drawArc(rect, i * sweep, sweep * 0.55, false, paint);
  }
}

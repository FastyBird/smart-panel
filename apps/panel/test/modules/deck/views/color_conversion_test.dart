import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// =============================================================================
// Tests for HSV to Hex Color Conversion
// =============================================================================
// These tests verify the color conversion logic used in light_role_detail_page.dart
// for converting HSV hue values to hex color strings for backend intents.

/// Helper function that replicates the conversion logic from light_role_detail_page.dart
String hueToHexColor(double hue) {
  final color = HSVColor.fromAHSV(1.0, hue, 1.0, 1.0).toColor();
  final r = (color.r * 255).toInt().toRadixString(16).padLeft(2, '0');
  final g = (color.g * 255).toInt().toRadixString(16).padLeft(2, '0');
  final b = (color.b * 255).toInt().toRadixString(16).padLeft(2, '0');
  return '#$r$g$b'.toUpperCase();
}

/// Helper function to convert RGB to hex for testing
String rgbToHex(int r, int g, int b) {
  return '#${r.toRadixString(16).padLeft(2, '0')}${g.toRadixString(16).padLeft(2, '0')}${b.toRadixString(16).padLeft(2, '0')}'.toUpperCase();
}

void main() {
  group('HSV to Hex Color Conversion', () {
    group('Primary colors at full saturation', () {
      test('hue 0 (red) should produce #FF0000', () {
        final hex = hueToHexColor(0);
        expect(hex, '#FF0000');
      });

      test('hue 120 (green) should produce #00FF00', () {
        final hex = hueToHexColor(120);
        expect(hex, '#00FF00');
      });

      test('hue 240 (blue) should produce #0000FF', () {
        final hex = hueToHexColor(240);
        expect(hex, '#0000FF');
      });
    });

    group('Secondary colors at full saturation', () {
      test('hue 60 (yellow) should produce #FFFF00', () {
        final hex = hueToHexColor(60);
        expect(hex, '#FFFF00');
      });

      test('hue 180 (cyan) should produce #00FFFF', () {
        final hex = hueToHexColor(180);
        expect(hex, '#00FFFF');
      });

      test('hue 300 (magenta) should produce #FF00FF', () {
        final hex = hueToHexColor(300);
        expect(hex, '#FF00FF');
      });
    });

    group('Intermediate colors', () {
      test('hue 30 (orange) should produce reasonable orange color', () {
        final hex = hueToHexColor(30);
        // Orange should have high red, medium green, no blue
        expect(hex.startsWith('#FF'), true,
            reason: 'Orange should have maximum red');
        expect(hex.endsWith('00'), true,
            reason: 'Orange should have no blue');
      });

      test('hue 270 (purple/violet) should produce reasonable purple', () {
        final hex = hueToHexColor(270);
        // Purple should have blue and some red, no green
        expect(hex.substring(3, 5), '00',
            reason: 'Purple should have no green');
      });
    });

    group('Edge cases', () {
      test('hue 360 should wrap to same as hue 0 (red)', () {
        // Note: HSVColor clamps/wraps hue values
        final hex360 = hueToHexColor(360);
        final hex0 = hueToHexColor(0);
        expect(hex360, hex0, reason: '360 degrees should wrap to 0');
      });

      test('hue values near boundaries should produce valid hex', () {
        // Test boundary values
        for (final hue in [0.0, 0.1, 59.9, 60.0, 119.9, 120.0, 180.0, 240.0, 300.0, 359.9]) {
          final hex = hueToHexColor(hue);
          expect(hex.length, 7, reason: 'Hex should be 7 chars (#RRGGBB)');
          expect(hex.startsWith('#'), true);
          expect(hex.substring(1).contains(RegExp(r'^[0-9A-F]+$')), true,
              reason: 'Should contain only hex characters');
        }
      });
    });

    group('Hex format validation', () {
      test('output should always be 7 characters (#RRGGBB)', () {
        for (var hue = 0.0; hue < 360.0; hue += 30.0) {
          final hex = hueToHexColor(hue);
          expect(hex.length, 7,
              reason: 'Hex for hue $hue should be 7 characters');
        }
      });

      test('output should always start with #', () {
        for (var hue = 0.0; hue < 360.0; hue += 30.0) {
          final hex = hueToHexColor(hue);
          expect(hex.startsWith('#'), true,
              reason: 'Hex for hue $hue should start with #');
        }
      });

      test('output should be uppercase', () {
        for (var hue = 0.0; hue < 360.0; hue += 30.0) {
          final hex = hueToHexColor(hue);
          expect(hex, hex.toUpperCase(),
              reason: 'Hex for hue $hue should be uppercase');
        }
      });

      test('output should contain only valid hex digits after #', () {
        for (var hue = 0.0; hue < 360.0; hue += 15.0) {
          final hex = hueToHexColor(hue);
          final hexDigits = hex.substring(1);
          expect(hexDigits.contains(RegExp(r'^[0-9A-F]+$')), true,
              reason: 'Hex digits for hue $hue should be valid: $hexDigits');
        }
      });
    });

    group('RGB to Hex helper', () {
      test('should produce #000000 for black', () {
        expect(rgbToHex(0, 0, 0), '#000000');
      });

      test('should produce #FFFFFF for white', () {
        expect(rgbToHex(255, 255, 255), '#FFFFFF');
      });

      test('should produce #FF0000 for pure red', () {
        expect(rgbToHex(255, 0, 0), '#FF0000');
      });

      test('should produce #00FF00 for pure green', () {
        expect(rgbToHex(0, 255, 0), '#00FF00');
      });

      test('should produce #0000FF for pure blue', () {
        expect(rgbToHex(0, 0, 255), '#0000FF');
      });

      test('should pad single digit values with 0', () {
        expect(rgbToHex(1, 2, 3), '#010203');
        expect(rgbToHex(15, 15, 15), '#0F0F0F');
      });
    });

    group('HSVColor consistency', () {
      test('HSVColor should preserve hue value correctly', () {
        for (var hue = 0.0; hue < 360.0; hue += 30.0) {
          final hsv = HSVColor.fromAHSV(1.0, hue, 1.0, 1.0);
          expect(hsv.hue, hue, reason: 'HSVColor should preserve hue $hue');
        }
      });

      test('HSVColor with full saturation and value should produce vivid colors', () {
        final hsv = HSVColor.fromAHSV(1.0, 0, 1.0, 1.0);
        final color = hsv.toColor();
        // Red at full saturation should have r=255, g=0, b=0
        expect((color.r * 255).round(), 255);
        expect((color.g * 255).round(), 0);
        expect((color.b * 255).round(), 0);
      });

      test('round-trip HSV to Color back to HSV should preserve hue', () {
        for (var originalHue = 0.0; originalHue < 360.0; originalHue += 30.0) {
          final hsv1 = HSVColor.fromAHSV(1.0, originalHue, 1.0, 1.0);
          final color = hsv1.toColor();
          final hsv2 = HSVColor.fromColor(color);

          // Allow floating point error due to RGB quantization (8-bit colors)
          // Color quantization can introduce up to ~1.4 degrees of hue error
          final hueDiff = (hsv2.hue - originalHue).abs();
          expect(hueDiff < 1.5 || hueDiff > 358.5, true,
              reason: 'Hue $originalHue should survive round-trip, got ${hsv2.hue}');
        }
      });
    });
  });
}

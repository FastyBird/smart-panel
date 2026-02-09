import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_landscape_layout.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// =============================================================================
// Tests for DeviceLandscapeLayout
// =============================================================================

void main() {
  group('DeviceLandscapeLayout', () {
    test('should accept null secondaryContent', () {
      // Verify that the widget can be constructed with null secondaryContent
      const layout = DeviceLandscapeLayout(
        mainContent: SizedBox(),
        secondaryContent: null,
      );

      expect(layout.mainContent, isA<SizedBox>());
      expect(layout.secondaryContent, isNull);
    });

    test('should accept all optional parameters', () {
      const layout = DeviceLandscapeLayout(
        mainContent: SizedBox(),
        secondaryContent: Text('Secondary'),
        secondaryColumnLarge: true,
        mainContentScrollable: true,
        secondaryScrollable: false,
      );

      expect(layout.secondaryContent, isA<Text>());
      expect(layout.secondaryColumnLarge, true);
      expect(layout.mainContentScrollable, true);
      expect(layout.secondaryScrollable, false);
    });

    test('should have correct default values', () {
      const layout = DeviceLandscapeLayout(
        mainContent: SizedBox(),
        secondaryContent: Text('Secondary'),
      );

      expect(layout.secondaryColumnLarge, false);
      expect(layout.mainContentScrollable, false);
      expect(layout.mainContentPadding, isNull);
      expect(layout.secondaryScrollable, true);
    });
  });
}

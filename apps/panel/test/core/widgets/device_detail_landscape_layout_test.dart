import 'package:fastybird_smart_panel/core/widgets/device_detail_landscape_layout.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// =============================================================================
// Tests for DeviceDetailLandscapeLayout
// =============================================================================

void main() {
  group('DeviceDetailLandscapeLayout', () {
    test('should accept null secondaryContent', () {
      // Verify that the widget can be constructed with null secondaryContent
      const layout = DeviceDetailLandscapeLayout(
        mainContent: SizedBox(),
        secondaryContent: null,
      );

      expect(layout.mainContent, isA<SizedBox>());
      expect(layout.secondaryContent, isNull);
      expect(layout.modeSelector, isNull);
    });

    test('should accept all optional parameters', () {
      const layout = DeviceDetailLandscapeLayout(
        mainContent: SizedBox(),
        modeSelector: Text('Mode'),
        secondaryContent: Text('Secondary'),
        mainContentPadding: EdgeInsets.all(8),
        modeSelectorPadding: EdgeInsets.all(4),
        secondaryContentPadding: EdgeInsets.all(12),
        largeSecondaryColumn: true,
        showDivider: false,
        secondaryScrollable: false,
      );

      expect(layout.modeSelector, isA<Text>());
      expect(layout.secondaryContent, isA<Text>());
      expect(layout.largeSecondaryColumn, true);
      expect(layout.showDivider, false);
      expect(layout.secondaryScrollable, false);
    });

    test('should have correct default values', () {
      const layout = DeviceDetailLandscapeLayout(
        mainContent: SizedBox(),
        secondaryContent: Text('Secondary'),
      );

      expect(layout.modeSelector, isNull);
      expect(layout.mainContentPadding, isNull);
      expect(layout.modeSelectorPadding, isNull);
      expect(layout.secondaryContentPadding, isNull);
      expect(layout.largeSecondaryColumn, false);
      expect(layout.showDivider, true);
      expect(layout.secondaryScrollable, true);
    });
  });
}

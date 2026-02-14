import 'package:fastybird_smart_panel/modules/deck/utils/intent_mode_status.dart';
import 'package:flutter_test/flutter_test.dart';

// =============================================================================
// Tests for computeIntentModeStatus
// =============================================================================
// Verifies the intent status icon rules for mode selectors used in both
// lighting and shading domain views.

/// Test enum to simulate mode values (e.g. LightingModeUI, CoversMode).
enum TestMode { modeA, modeB, modeC }

void main() {
  group('computeIntentModeStatus', () {
    // -------------------------------------------------------------------------
    // Core rules: selected intent
    // -------------------------------------------------------------------------

    group('selected + matches + fromIntent', () {
      test('should return check on selected mode', () {
        final result = computeIntentModeStatus<TestMode>(
          selectedIntent: TestMode.modeA,
          currentState: TestMode.modeA,
          isCurrentStateFromIntent: true,
          isLocked: false,
        );

        expect(result.checkMode, TestMode.modeA);
        expect(result.syncMode, isNull);
        expect(result.historyMode, isNull);
      });
    });

    group('selected + matches + NOT fromIntent (manual override)', () {
      test('should return history on selected, no sync', () {
        // User applied modeA via intent, then manually changed a role.
        // Backend still detects modeA but isModeFromIntent = false.
        final result = computeIntentModeStatus<TestMode>(
          selectedIntent: TestMode.modeA,
          currentState: TestMode.modeA,
          isCurrentStateFromIntent: false,
          isLocked: false,
        );

        expect(result.checkMode, isNull);
        expect(result.syncMode, isNull); // same mode, no sync on itself
        expect(result.historyMode, TestMode.modeA);
      });
    });

    group('selected + different current state', () {
      test('should return history on selected, sync on current', () {
        final result = computeIntentModeStatus<TestMode>(
          selectedIntent: TestMode.modeA,
          currentState: TestMode.modeB,
          isCurrentStateFromIntent: false,
          isLocked: false,
        );

        expect(result.checkMode, isNull);
        expect(result.syncMode, TestMode.modeB);
        expect(result.historyMode, TestMode.modeA);
      });

      test('should return history + sync even when fromIntent is true', () {
        // Different mode detected, doesn't matter if from intent
        final result = computeIntentModeStatus<TestMode>(
          selectedIntent: TestMode.modeA,
          currentState: TestMode.modeB,
          isCurrentStateFromIntent: true,
          isLocked: false,
        );

        expect(result.checkMode, isNull);
        expect(result.syncMode, TestMode.modeB);
        expect(result.historyMode, TestMode.modeA);
      });
    });

    // -------------------------------------------------------------------------
    // Core rules: non-selected intents
    // -------------------------------------------------------------------------

    group('not selected + matches current state', () {
      test('sync icon via tuple comparison', () {
        // selectedIntent = modeA, currentState = modeB (externally applied).
        // modeB (not selected) gets sync.
        final result = computeIntentModeStatus<TestMode>(
          selectedIntent: TestMode.modeA,
          currentState: TestMode.modeB,
          isCurrentStateFromIntent: false,
          isLocked: false,
        );

        expect(result.syncMode, TestMode.modeB);
      });
    });

    group('not selected + does NOT match', () {
      test('should show no icon for unrelated modes', () {
        final result = computeIntentModeStatus<TestMode>(
          selectedIntent: TestMode.modeA,
          currentState: TestMode.modeB,
          isCurrentStateFromIntent: false,
          isLocked: false,
        );

        // modeC is neither selected nor current — no icon
        expect(result.checkMode, isNot(TestMode.modeC));
        expect(result.syncMode, isNot(TestMode.modeC));
        expect(result.historyMode, isNot(TestMode.modeC));
      });
    });

    // -------------------------------------------------------------------------
    // Optimistic UI (locked state)
    // -------------------------------------------------------------------------

    group('optimistic UI (locked)', () {
      test('should return check on locked value', () {
        final result = computeIntentModeStatus<TestMode>(
          selectedIntent: TestMode.modeA,
          currentState: TestMode.modeA,
          isCurrentStateFromIntent: true,
          isLocked: true,
          lockedValue: TestMode.modeB,
        );

        expect(result.checkMode, TestMode.modeB);
        expect(result.syncMode, isNull);
        expect(result.historyMode, isNull);
      });

      test('locked value takes priority over everything', () {
        final result = computeIntentModeStatus<TestMode>(
          selectedIntent: TestMode.modeA,
          currentState: TestMode.modeC,
          isCurrentStateFromIntent: false,
          isLocked: true,
          lockedValue: TestMode.modeB,
        );

        expect(result.checkMode, TestMode.modeB);
        expect(result.syncMode, isNull);
        expect(result.historyMode, isNull);
      });

      test('locked but no lockedValue falls through to normal logic', () {
        final result = computeIntentModeStatus<TestMode>(
          selectedIntent: TestMode.modeA,
          currentState: TestMode.modeA,
          isCurrentStateFromIntent: true,
          isLocked: true,
          lockedValue: null,
        );

        expect(result.checkMode, TestMode.modeA);
        expect(result.syncMode, isNull);
        expect(result.historyMode, isNull);
      });
    });

    // -------------------------------------------------------------------------
    // Edge cases
    // -------------------------------------------------------------------------

    group('edge cases', () {
      test('no selected intent + current state exists → check on current', () {
        final result = computeIntentModeStatus<TestMode>(
          selectedIntent: null,
          currentState: TestMode.modeB,
          isCurrentStateFromIntent: false,
          isLocked: false,
        );

        expect(result.checkMode, TestMode.modeB);
        expect(result.syncMode, isNull);
        expect(result.historyMode, isNull);
      });

      test('no selected intent + no current state → no icons', () {
        final result = computeIntentModeStatus<TestMode>(
          selectedIntent: null,
          currentState: null,
          isCurrentStateFromIntent: false,
          isLocked: false,
        );

        expect(result.checkMode, isNull);
        expect(result.syncMode, isNull);
        expect(result.historyMode, isNull);
      });

      test('selected intent + no current state → history on selected', () {
        final result = computeIntentModeStatus<TestMode>(
          selectedIntent: TestMode.modeA,
          currentState: null,
          isCurrentStateFromIntent: false,
          isLocked: false,
        );

        expect(result.checkMode, isNull);
        expect(result.syncMode, isNull);
        expect(result.historyMode, TestMode.modeA);
      });

      test('manual change back to selected → check when fromIntent is true', () {
        // User applied modeA, changed something, then state matches again
        // and backend re-detects it as from intent.
        final result = computeIntentModeStatus<TestMode>(
          selectedIntent: TestMode.modeA,
          currentState: TestMode.modeA,
          isCurrentStateFromIntent: true,
          isLocked: false,
        );

        expect(result.checkMode, TestMode.modeA);
        expect(result.syncMode, isNull);
        expect(result.historyMode, isNull);
      });

      test('manual change back to selected → history when NOT fromIntent', () {
        // Devices happen to match the selected mode but not via intent.
        final result = computeIntentModeStatus<TestMode>(
          selectedIntent: TestMode.modeA,
          currentState: TestMode.modeA,
          isCurrentStateFromIntent: false,
          isLocked: false,
        );

        expect(result.checkMode, isNull);
        expect(result.historyMode, TestMode.modeA);
      });
    });

    // -------------------------------------------------------------------------
    // Real-world scenario: shading daylight override
    // -------------------------------------------------------------------------

    group('shading daylight scenario', () {
      test('apply daylight → check', () {
        final result = computeIntentModeStatus<TestMode>(
          selectedIntent: TestMode.modeA, // daylight
          currentState: TestMode.modeA, // detected daylight
          isCurrentStateFromIntent: true,
          isLocked: false,
        );

        expect(result.checkMode, TestMode.modeA);
        expect(result.historyMode, isNull);
      });

      test('manually change role position → history (same detected mode)', () {
        // User changed primary role from 75% to 10%.
        // Backend still detects "daylight" but isModeFromIntent = false.
        final result = computeIntentModeStatus<TestMode>(
          selectedIntent: TestMode.modeA, // daylight
          currentState: TestMode.modeA, // still detected as daylight
          isCurrentStateFromIntent: false, // but not from intent
          isLocked: false,
        );

        expect(result.checkMode, isNull);
        expect(result.historyMode, TestMode.modeA);
        expect(result.syncMode, isNull);
      });

      test('manually change role position → history + sync (different detected mode)', () {
        // User changed enough that backend detects "privacy" instead.
        final result = computeIntentModeStatus<TestMode>(
          selectedIntent: TestMode.modeA, // daylight
          currentState: TestMode.modeB, // detected privacy
          isCurrentStateFromIntent: false,
          isLocked: false,
        );

        expect(result.checkMode, isNull);
        expect(result.historyMode, TestMode.modeA);
        expect(result.syncMode, TestMode.modeB);
      });
    });

    // -------------------------------------------------------------------------
    // toTuple compatibility
    // -------------------------------------------------------------------------

    group('toTuple', () {
      test('maps fields to correct tuple positions', () {
        final result = computeIntentModeStatus<TestMode>(
          selectedIntent: TestMode.modeA,
          currentState: TestMode.modeB,
          isCurrentStateFromIntent: false,
          isLocked: false,
        );

        final tuple = result.toTuple();
        expect(tuple.$1, isNull); // checkMode
        expect(tuple.$2, TestMode.modeB); // syncMode
        expect(tuple.$3, TestMode.modeA); // historyMode
      });

      test('check maps to first position', () {
        final result = computeIntentModeStatus<TestMode>(
          selectedIntent: TestMode.modeA,
          currentState: TestMode.modeA,
          isCurrentStateFromIntent: true,
          isLocked: false,
        );

        final tuple = result.toTuple();
        expect(tuple.$1, TestMode.modeA);
        expect(tuple.$2, isNull);
        expect(tuple.$3, isNull);
      });
    });
  });
}

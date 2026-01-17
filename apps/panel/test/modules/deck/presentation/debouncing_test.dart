import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';

// =============================================================================
// Tests for Debouncing Logic
// =============================================================================
// These tests verify the debouncing pattern used in lights_domain_view.dart
// to prevent rapid mode selection from overwhelming the backend.

/// Simulates the debounce logic used in _setLightingMode
class ModeChangeDebouncer {
  DateTime? _lastModeChangeTime;
  final Duration debounceWindow;
  int _callCount = 0;
  int _blockedCount = 0;

  ModeChangeDebouncer({this.debounceWindow = const Duration(milliseconds: 300)});

  /// Attempt to trigger a mode change
  /// Returns true if the change was allowed, false if debounced
  bool tryModeChange() {
    final now = DateTime.now();
    if (_lastModeChangeTime != null) {
      final elapsed = now.difference(_lastModeChangeTime!);
      if (elapsed < debounceWindow) {
        _blockedCount++;
        return false;
      }
    }
    _lastModeChangeTime = now;
    _callCount++;
    return true;
  }

  /// For testing: allows overriding the "current time"
  bool tryModeChangeAt(DateTime time) {
    if (_lastModeChangeTime != null) {
      final elapsed = time.difference(_lastModeChangeTime!);
      if (elapsed < debounceWindow) {
        _blockedCount++;
        return false;
      }
    }
    _lastModeChangeTime = time;
    _callCount++;
    return true;
  }

  int get callCount => _callCount;
  int get blockedCount => _blockedCount;

  void reset() {
    _lastModeChangeTime = null;
    _callCount = 0;
    _blockedCount = 0;
  }
}

void main() {
  group('Mode Change Debouncing', () {
    late ModeChangeDebouncer debouncer;

    setUp(() {
      debouncer = ModeChangeDebouncer();
    });

    group('Basic debounce behavior', () {
      test('first call should always succeed', () {
        final result = debouncer.tryModeChangeAt(DateTime(2024, 1, 1, 12, 0, 0, 0));
        expect(result, true);
        expect(debouncer.callCount, 1);
        expect(debouncer.blockedCount, 0);
      });

      test('rapid calls within debounce window should be blocked', () {
        final baseTime = DateTime(2024, 1, 1, 12, 0, 0, 0);

        // First call at t=0
        expect(debouncer.tryModeChangeAt(baseTime), true);

        // Second call at t=100ms (within 300ms window)
        expect(debouncer.tryModeChangeAt(baseTime.add(const Duration(milliseconds: 100))), false);

        // Third call at t=200ms (still within window)
        expect(debouncer.tryModeChangeAt(baseTime.add(const Duration(milliseconds: 200))), false);

        expect(debouncer.callCount, 1);
        expect(debouncer.blockedCount, 2);
      });

      test('call after debounce window should succeed', () {
        final baseTime = DateTime(2024, 1, 1, 12, 0, 0, 0);

        // First call at t=0
        expect(debouncer.tryModeChangeAt(baseTime), true);

        // Second call at t=301ms (after 300ms window)
        expect(debouncer.tryModeChangeAt(baseTime.add(const Duration(milliseconds: 301))), true);

        expect(debouncer.callCount, 2);
        expect(debouncer.blockedCount, 0);
      });

      test('call exactly at debounce boundary should succeed', () {
        final baseTime = DateTime(2024, 1, 1, 12, 0, 0, 0);

        // First call at t=0
        expect(debouncer.tryModeChangeAt(baseTime), true);

        // Call at exactly 300ms should succeed (elapsed is NOT < 300ms)
        // The check is: if (elapsed < debounceWindow) block
        // At 300ms, elapsed == 300ms, which is NOT < 300ms, so it passes
        expect(debouncer.tryModeChangeAt(baseTime.add(const Duration(milliseconds: 300))), true);

        expect(debouncer.callCount, 2);
        expect(debouncer.blockedCount, 0);
      });
    });

    group('Multiple rapid sequences', () {
      test('should allow calls after each debounce window expires', () {
        final baseTime = DateTime(2024, 1, 1, 12, 0, 0, 0);

        // First sequence
        expect(debouncer.tryModeChangeAt(baseTime), true);
        expect(debouncer.tryModeChangeAt(baseTime.add(const Duration(milliseconds: 100))), false);

        // Second sequence starts after first window
        expect(debouncer.tryModeChangeAt(baseTime.add(const Duration(milliseconds: 400))), true);
        expect(debouncer.tryModeChangeAt(baseTime.add(const Duration(milliseconds: 500))), false);

        // Third sequence
        expect(debouncer.tryModeChangeAt(baseTime.add(const Duration(milliseconds: 800))), true);

        expect(debouncer.callCount, 3);
        expect(debouncer.blockedCount, 2);
      });

      test('stress test: many rapid calls should only allow one per window', () {
        final baseTime = DateTime(2024, 1, 1, 12, 0, 0, 0);

        // Simulate 50 rapid taps within 100ms
        for (var i = 0; i < 50; i++) {
          debouncer.tryModeChangeAt(baseTime.add(Duration(milliseconds: i * 2)));
        }

        // Only the first should succeed
        expect(debouncer.callCount, 1);
        expect(debouncer.blockedCount, 49);
      });
    });

    group('Debounce window configuration', () {
      test('custom debounce window should be respected', () {
        final customDebouncer = ModeChangeDebouncer(
          debounceWindow: const Duration(milliseconds: 500),
        );

        final baseTime = DateTime(2024, 1, 1, 12, 0, 0, 0);

        // First call
        expect(customDebouncer.tryModeChangeAt(baseTime), true);

        // At 400ms (would pass 300ms default, but not 500ms custom)
        expect(customDebouncer.tryModeChangeAt(baseTime.add(const Duration(milliseconds: 400))), false);

        // At 501ms (after 500ms window)
        expect(customDebouncer.tryModeChangeAt(baseTime.add(const Duration(milliseconds: 501))), true);

        expect(customDebouncer.callCount, 2);
        expect(customDebouncer.blockedCount, 1);
      });

      test('zero debounce should allow all calls', () {
        final noDebouncer = ModeChangeDebouncer(
          debounceWindow: Duration.zero,
        );

        final baseTime = DateTime(2024, 1, 1, 12, 0, 0, 0);

        for (var i = 0; i < 10; i++) {
          expect(noDebouncer.tryModeChangeAt(baseTime.add(Duration(milliseconds: i))), true);
        }

        expect(noDebouncer.callCount, 10);
        expect(noDebouncer.blockedCount, 0);
      });
    });

    group('Real-world scenario simulation', () {
      test('user double-tap should only register once', () {
        final baseTime = DateTime(2024, 1, 1, 12, 0, 0, 0);

        // User double-taps (two taps within ~50ms)
        expect(debouncer.tryModeChangeAt(baseTime), true);
        expect(debouncer.tryModeChangeAt(baseTime.add(const Duration(milliseconds: 50))), false);

        expect(debouncer.callCount, 1, reason: 'Double-tap should register as single tap');
      });

      test('user spam-tapping should be throttled', () {
        final baseTime = DateTime(2024, 1, 1, 12, 0, 0, 0);

        // User taps repeatedly at ~100ms intervals for 2 seconds
        var successCount = 0;
        for (var ms = 0; ms < 2000; ms += 100) {
          if (debouncer.tryModeChangeAt(baseTime.add(Duration(milliseconds: ms)))) {
            successCount++;
          }
        }

        // With 300ms debounce, we expect ~6-7 successful calls in 2 seconds
        expect(successCount, lessThanOrEqualTo(7));
        expect(successCount, greaterThanOrEqualTo(6));
      });

      test('normal usage pattern should work fine', () {
        final baseTime = DateTime(2024, 1, 1, 12, 0, 0, 0);

        // User makes deliberate selections with ~1 second between each
        expect(debouncer.tryModeChangeAt(baseTime), true);
        expect(debouncer.tryModeChangeAt(baseTime.add(const Duration(seconds: 1))), true);
        expect(debouncer.tryModeChangeAt(baseTime.add(const Duration(seconds: 2))), true);
        expect(debouncer.tryModeChangeAt(baseTime.add(const Duration(seconds: 3))), true);

        expect(debouncer.callCount, 4, reason: 'All deliberate selections should succeed');
        expect(debouncer.blockedCount, 0);
      });
    });

    group('Edge cases', () {
      test('reset should clear debounce state', () {
        final baseTime = DateTime(2024, 1, 1, 12, 0, 0, 0);

        // Make a call
        expect(debouncer.tryModeChangeAt(baseTime), true);

        // Verify blocked
        expect(debouncer.tryModeChangeAt(baseTime.add(const Duration(milliseconds: 100))), false);

        // Reset
        debouncer.reset();

        // Should allow immediately after reset
        expect(debouncer.tryModeChangeAt(baseTime.add(const Duration(milliseconds: 100))), true);

        expect(debouncer.callCount, 1); // Only counts after reset
      });

      test('should handle time going backwards gracefully', () {
        final baseTime = DateTime(2024, 1, 1, 12, 0, 0, 0);

        // First call at t=1000ms
        expect(debouncer.tryModeChangeAt(baseTime.add(const Duration(milliseconds: 1000))), true);

        // "Time travel" back to t=500ms (edge case, shouldn't happen in real world)
        // The duration will be negative, which is less than 300ms
        final result = debouncer.tryModeChangeAt(baseTime.add(const Duration(milliseconds: 500)));
        // Negative duration is "less than" debounce window, so it should be blocked
        expect(result, false);
      });
    });
  });

  group('FakeAsync debounce simulation', () {
    test('debouncing with fake_async timer simulation', () {
      fakeAsync((async) {
        var executeCount = 0;
        DateTime? lastExecutionTime;
        const debounceWindow = Duration(milliseconds: 300);

        void tryExecute() {
          final now = async.getClock(DateTime(2024)).now();
          if (lastExecutionTime != null) {
            final elapsed = now.difference(lastExecutionTime!);
            if (elapsed < debounceWindow) {
              return; // Debounced
            }
          }
          lastExecutionTime = now;
          executeCount++;
        }

        // Rapid calls
        tryExecute(); // t=0, should execute
        async.elapse(const Duration(milliseconds: 100));
        tryExecute(); // t=100, should be debounced
        async.elapse(const Duration(milliseconds: 100));
        tryExecute(); // t=200, should be debounced
        async.elapse(const Duration(milliseconds: 200));
        tryExecute(); // t=400, should execute (past 300ms window)

        expect(executeCount, 2);
      });
    });
  });
}

import 'dart:io';

import 'package:fastybird_smart_panel/core/utils/secure_storage.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/system/types/configuration.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Caches UI preferences (language, dark mode, accent) locally so the app
/// can apply them immediately on startup — before the backend config loads.
///
/// The accent is panel-only for now: the backend has no accent field on
/// spaces or displays yet, so this is where the choice lives.
class LocalPreferencesService extends ChangeNotifier {
  static const _languageKey = 'ui_language';
  static const _darkModeKey = 'ui_dark_mode';
  static const _screenPowerOffKey = 'ui_screen_power_off';
  static const _accentKey = 'ui_accent';

  final FlutterSecureStorage? _securedStorage;
  final SecureStorageFallback? _securedStorageFallback;

  Language _language = Language.english;
  bool _darkMode = false;
  bool _screenPowerOff = false;
  AppAccent _accent = AppAccent.blue;

  /// The accent last confirmed in storage; a failed save falls back to it.
  AppAccent _storedAccent = AppAccent.blue;
  int _accentWrites = 0;

  /// Accent saves and the reset's delete run one at a time, in order, so the
  /// last choice is always the one left in storage.
  Future<void> _accentQueue = Future<void>.value();
  bool _loaded = false;

  LocalPreferencesService({
    FlutterSecureStorage? securedStorage,
    SecureStorageFallback? securedStorageFallback,
  })  : _securedStorage = securedStorage,
        _securedStorageFallback = securedStorageFallback;

  Language get language => _language;
  bool get darkMode => _darkMode;
  bool get screenPowerOff => _screenPowerOff;
  AppAccent get accent => _accent;
  bool get isLoaded => _loaded;

  /// Load cached preferences from local storage.
  /// Should be called once during early startup.
  Future<void> load() async {
    try {
      final languageValue = await _read(key: _languageKey);

      if (languageValue != null) {
        _language = Language.fromValue(languageValue) ?? Language.english;
      }

      final darkModeValue = await _read(key: _darkModeKey);

      if (darkModeValue != null) {
        _darkMode = darkModeValue == 'true';
      }

      final screenPowerOffValue = await _read(key: _screenPowerOffKey);

      if (screenPowerOffValue != null) {
        _screenPowerOff = screenPowerOffValue == 'true';
      }

      _accent = AppAccent.fromValue(await _read(key: _accentKey));
      _storedAccent = _accent;
      AppAccents.current = _accent;

      _loaded = true;

      if (kDebugMode) {
        debugPrint(
          '[LOCAL PREFS] Loaded: language=${_language.value}, darkMode=$_darkMode, accent=${_accent.name}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[LOCAL PREFS] Failed to load: $e');
      }
    }
  }

  /// Persist the current language selection.
  Future<void> setLanguage(Language language) async {
    if (_language == language) return;

    _language = language;

    await _write(key: _languageKey, value: language.value);

    notifyListeners();
  }

  /// Persist the current dark mode selection.
  Future<void> setDarkMode(bool darkMode) async {
    if (_darkMode == darkMode) return;

    _darkMode = darkMode;

    await _write(key: _darkModeKey, value: darkMode.toString());

    notifyListeners();
  }

  /// Persist the screen power off preference.
  Future<void> setScreenPowerOff(bool enabled) async {
    if (_screenPowerOff == enabled) return;

    _screenPowerOff = enabled;

    await _write(key: _screenPowerOffKey, value: enabled.toString());

    notifyListeners();
  }

  /// Persist the panel's accent and apply it to new themes.
  ///
  /// Saves run one at a time, in the order they were made. Throws when the
  /// choice cannot be stored; unless a newer choice was made meanwhile, the
  /// accent then falls back to the last one stored, so choosing the same
  /// accent again retries the save.
  Future<void> setAccent(AppAccent accent) {
    if (_accent == accent) return Future<void>.value();

    final write = ++_accentWrites;

    _accent = accent;
    AppAccents.current = accent;

    return _enqueueAccent(() async {
      try {
        await _write(key: _accentKey, value: accent.name, throwOnFailure: true);
      } catch (e) {
        if (write == _accentWrites) {
          _accent = _storedAccent;
          AppAccents.current = _storedAccent;

          notifyListeners();
        }

        if (kDebugMode) {
          debugPrint('[LOCAL PREFS] Failed to store accent: $e');
        }

        rethrow;
      }

      _storedAccent = accent;

      // Only the newest choice updates the app; an older save that completes
      // first must not announce a value that is already replaced.
      if (write == _accentWrites) {
        notifyListeners();
      }
    });
  }

  /// Runs [operation] after every earlier accent save or reset has finished.
  Future<void> _enqueueAccent(Future<void> Function() operation) {
    final result = _accentQueue.then((_) => operation());

    // Keep the queue going after a failure; the caller still gets the error.
    _accentQueue = result.catchError((_) {});

    return result;
  }

  /// Clear all cached preferences (used during factory reset).
  Future<void> clearAll() async {
    _language = Language.english;
    _darkMode = false;
    _screenPowerOff = false;
    _accent = AppAccent.blue;
    AppAccents.current = AppAccent.blue;

    // Pending accent saves must not roll back to, or announce, an older value.
    _accentWrites++;

    // Queued before any await: it runs after saves already pending, and a
    // choice made while the other keys are deleted lands after it. It runs
    // even when another delete fails.
    final accentReset = _enqueueAccent(() async {
      await _delete(key: _accentKey);
      _storedAccent = AppAccent.blue;
    }).catchError((Object e) {
      if (kDebugMode) {
        debugPrint('[LOCAL PREFS] Failed to clear the accent: $e');
      }
    });

    try {
      if (Platform.isAndroid || Platform.isIOS) {
        await _securedStorage?.delete(key: _languageKey);
        await _securedStorage?.delete(key: _darkModeKey);
        await _securedStorage?.delete(key: _screenPowerOffKey);
      } else {
        await _securedStorageFallback?.delete(key: _languageKey);
        await _securedStorageFallback?.delete(key: _darkModeKey);
        await _securedStorageFallback?.delete(key: _screenPowerOffKey);
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[LOCAL PREFS] Failed to clear: $e');
      }
    }

    await accentReset;

    if (kDebugMode) {
      debugPrint('[LOCAL PREFS] All preferences cleared');
    }

    notifyListeners();
  }


  Future<String?> _read({required String key}) async {
    if (Platform.isAndroid || Platform.isIOS) {
      return await _securedStorage?.read(key: key);
    }

    return await _securedStorageFallback?.read(key: key);
  }

  /// Writes [value]. Secure storage throws on failure; the file fallback
  /// only does so with [throwOnFailure].
  Future<void> _write({
    required String key,
    required String value,
    bool throwOnFailure = false,
  }) async {
    if (Platform.isAndroid || Platform.isIOS) {
      await _securedStorage?.write(key: key, value: value);
    } else {
      await _securedStorageFallback?.write(
        key: key,
        value: value,
        throwOnFailure: throwOnFailure,
      );
    }
  }

  Future<void> _delete({required String key}) async {
    if (Platform.isAndroid || Platform.isIOS) {
      await _securedStorage?.delete(key: key);
    } else {
      await _securedStorageFallback?.delete(key: key);
    }
  }
}

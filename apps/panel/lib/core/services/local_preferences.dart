import 'dart:io';

import 'package:fastybird_smart_panel/core/utils/secure_storage.dart';
import 'package:fastybird_smart_panel/modules/system/types/configuration.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Caches UI preferences (language, dark mode) locally so the app
/// can apply them immediately on startup — before the backend config loads.
class LocalPreferencesService extends ChangeNotifier {
  static const _languageKey = 'ui_language';
  static const _darkModeKey = 'ui_dark_mode';
  static const _screenPowerOffKey = 'ui_screen_power_off';

  final FlutterSecureStorage? _securedStorage;
  final SecureStorageFallback? _securedStorageFallback;

  Language _language = Language.english;
  bool _darkMode = false;
  bool _screenPowerOff = false;
  bool _loaded = false;

  LocalPreferencesService({
    FlutterSecureStorage? securedStorage,
    SecureStorageFallback? securedStorageFallback,
  })  : _securedStorage = securedStorage,
        _securedStorageFallback = securedStorageFallback;

  Language get language => _language;
  bool get darkMode => _darkMode;
  bool get screenPowerOff => _screenPowerOff;
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

      _loaded = true;

      if (kDebugMode) {
        debugPrint(
          '[LOCAL PREFS] Loaded: language=${_language.value}, darkMode=$_darkMode',
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
  }

  /// Persist the current dark mode selection.
  Future<void> setDarkMode(bool darkMode) async {
    if (_darkMode == darkMode) return;

    _darkMode = darkMode;

    await _write(key: _darkModeKey, value: darkMode.toString());
  }

  /// Persist the screen power off preference.
  Future<void> setScreenPowerOff(bool enabled) async {
    if (_screenPowerOff == enabled) return;

    _screenPowerOff = enabled;

    await _write(key: _screenPowerOffKey, value: enabled.toString());

    notifyListeners();
  }

  /// Clear all cached preferences (used during factory reset).
  Future<void> clearAll() async {
    _language = Language.english;
    _darkMode = false;
    _screenPowerOff = false;

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

      if (kDebugMode) {
        debugPrint('[LOCAL PREFS] All preferences cleared');
      }

      notifyListeners();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[LOCAL PREFS] Failed to clear: $e');
      }
    }
  }

  Future<String?> _read({required String key}) async {
    if (Platform.isAndroid || Platform.isIOS) {
      return await _securedStorage?.read(key: key);
    }

    return await _securedStorageFallback?.read(key: key);
  }

  Future<void> _write({required String key, required String value}) async {
    if (Platform.isAndroid || Platform.isIOS) {
      await _securedStorage?.write(key: key, value: value);
    } else {
      await _securedStorageFallback?.write(key: key, value: value);
    }
  }
}

import 'dart:convert';
import 'dart:io';

class SecureStorageFallback {
  late final File _storageFile;
  late Map<String, String> _cache;

  /// Stores in `storage.json` under [directory], by default the
  /// `FB_SECURE_STORAGE_PATH` build value or `/var/smart-panel`.
  SecureStorageFallback({String? directory}) {
    final storageDir = Directory(
      directory ??
          const String.fromEnvironment('FB_SECURE_STORAGE_PATH',
              defaultValue: '/var/smart-panel'),
    );

    try {
      if (!storageDir.existsSync()) {
        storageDir.createSync(recursive: true);
      }

      _storageFile = File('${storageDir.path}/storage.json');
      _cache = {};

      if (_storageFile.existsSync()) {
        final content = _storageFile.readAsStringSync();
        final Map<String, dynamic> parsed = jsonDecode(content);
        _cache = parsed.map((k, v) => MapEntry(k, v.toString()));
      }
    } catch (e) {
      stderr.writeln('[SecureStorageFallback] Failed to initialize: $e');
      rethrow;
    }
  }

  /// Stores [value] under [key].
  ///
  /// A failed file write is logged and the value is kept in memory for this
  /// run. With [throwOnFailure], the stored state is left as it was and the
  /// error is rethrown instead, so the caller can report it and retry.
  Future<void> write({
    required String key,
    required String value,
    bool throwOnFailure = false,
  }) async {
    final hadKey = _cache.containsKey(key);
    final previous = _cache[key];

    _cache[key] = value;

    try {
      final data = jsonEncode(_cache);
      await _storageFile.writeAsString(data, flush: true);
    } catch (e) {
      stderr.writeln('[SecureStorageFallback] Failed to write key "$key": $e');

      if (throwOnFailure) {
        if (hadKey) {
          _cache[key] = previous!;
        } else {
          _cache.remove(key);
        }

        rethrow;
      }
    }
  }

  Future<String?> read({required String key}) async {
    try {
      return _cache[key];
    } catch (e) {
      stderr.writeln('[SecureStorageFallback] Failed to read key "$key": $e');
      return null;
    }
  }

  Future<void> delete({required String key}) async {
    try {
      _cache.remove(key);
      final data = jsonEncode(_cache);
      await _storageFile.writeAsString(data, flush: true);
    } catch (e) {
      stderr.writeln('[SecureStorageFallback] Failed to delete key "$key": $e');
    }
  }

  Future<void> clear() async {
    try {
      _cache.clear();
      await _storageFile.writeAsString('{}', flush: true);
    } catch (e) {
      stderr.writeln('[SecureStorageFallback] Failed to clear storage: $e');
    }
  }
}

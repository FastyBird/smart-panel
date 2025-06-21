import 'dart:convert';
import 'dart:io';

class SecureStorageFallback {
  late final File _storageFile;
  late Map<String, String> _cache;

  SecureStorageFallback() {
    final storageDir = Directory(
      String.fromEnvironment('FB_SECURE_STORAGE_PATH',
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

  Future<void> write({required String key, required String value}) async {
    _cache[key] = value;

    try {
      final data = jsonEncode(_cache);
      await _storageFile.writeAsString(data, flush: true);
    } catch (e) {
      stderr.writeln('[SecureStorageFallback] Failed to write key "$key": $e');
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

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/modules/scenes/services/scenes_service.dart';
import 'package:flutter/foundation.dart';

class ScenesModule {
  final Dio _dio;

  late ScenesService _scenesService;

  ScenesModule({
    required Dio dio,
  }) : _dio = dio {
    _scenesService = ScenesService(dio: _dio);

    // Register as singleton if not already registered
    if (!locator.isRegistered<ScenesService>()) {
      locator.registerSingleton(_scenesService);
    }

    if (kDebugMode) {
      debugPrint('[SCENES MODULE] Module initialized');
    }
  }

  ScenesService get scenesService => _scenesService;

  void dispose() {
    _scenesService.clearAllCache();
  }
}

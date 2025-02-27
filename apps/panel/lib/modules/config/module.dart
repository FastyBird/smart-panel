import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/config/constants.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/audio.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/language.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/weather.dart';

class ConfigModuleService {
  final SocketService _socketService;

  late AudioConfigRepository _audioRepository;
  late DisplayConfigRepository _displayRepository;
  late LanguageConfigRepository _languageRepository;
  late WeatherConfigRepository _weatherRepository;

  bool _isLoading = true;

  ConfigModuleService({
    required ApiClient apiClient,
    required SocketService socketService,
  }) : _socketService = socketService {
    _audioRepository = AudioConfigRepository(
      apiClient: apiClient.configurationModule,
    );
    _displayRepository = DisplayConfigRepository(
      apiClient: apiClient.configurationModule,
    );
    _languageRepository = LanguageConfigRepository(
      apiClient: apiClient.configurationModule,
    );
    _weatherRepository = WeatherConfigRepository(
      apiClient: apiClient.configurationModule,
    );

    locator.registerSingleton(_audioRepository);
    locator.registerSingleton(_displayRepository);
    locator.registerSingleton(_languageRepository);
    locator.registerSingleton(_weatherRepository);
  }

  Future<void> initialize() async {
    _isLoading = true;

    await _initializeConfigData();

    _isLoading = false;

    _socketService.registerEventHandler(
      ConfigModuleConstants.configUpdatedEvent,
      _socketEventHandler,
    );
  }

  bool get isLoading => _isLoading;

  void dispose() {
    _socketService.unregisterEventHandler(
      ConfigModuleConstants.configUpdatedEvent,
      _socketEventHandler,
    );
  }

  Future<void> _initializeConfigData() async {
    await _audioRepository.fetchConfiguration();
    await _displayRepository.fetchConfiguration();
    await _languageRepository.fetchConfiguration();
    await _weatherRepository.fetchConfiguration();
  }

  void _socketEventHandler(String event, Map<String, dynamic> payload) {
    if (payload.containsKey('audio') &&
        payload['audio'] is Map<String, dynamic>) {
      _audioRepository.insertConfiguration(payload['audio']);
    }

    if (payload.containsKey('display') &&
        payload['display'] is Map<String, dynamic>) {
      _displayRepository.insertConfiguration(payload['display']);
    }

    if (payload.containsKey('language') &&
        payload['language'] is Map<String, dynamic>) {
      _languageRepository.insertConfiguration(payload['language']);
    }

    if (payload.containsKey('weather') &&
        payload['weather'] is Map<String, dynamic>) {
      _weatherRepository.insertConfiguration(payload['weather']);
    }
  }
}

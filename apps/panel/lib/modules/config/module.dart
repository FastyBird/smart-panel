import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/audio.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/language.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/weather.dart';

class ConfigModuleService {
  late AudioConfigRepository _audioRepository;
  late DisplayConfigRepository _displayRepository;
  late LanguageConfigRepository _languageRepository;
  late WeatherConfigRepository _weatherRepository;

  bool _isLoading = true;

  ConfigModuleService({
    required ApiClient apiClient,
  }) {
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
  }

  bool get isLoading => _isLoading;

  Future<void> _initializeConfigData() async {
    await _audioRepository.fetchConfiguration();
    await _displayRepository.fetchConfiguration();
    await _languageRepository.fetchConfiguration();
    await _weatherRepository.fetchConfiguration();
  }
}

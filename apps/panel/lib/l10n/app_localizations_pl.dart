import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Polish (`pl`).
class AppLocalizationsPl extends AppLocalizations {
  AppLocalizationsPl([String locale = 'pl']) : super(locale);

  @override
  String get value_not_available => 'N/D';

  @override
  String get value_not_set => 'Nie ustawiono';

  @override
  String get value_loading => 'Ładowanie';

  @override
  String get information => 'Informacja';

  @override
  String get warning => 'Ostrzeżenie';

  @override
  String get error => 'Błąd';

  @override
  String get action_failed => 'Nie udało się przetworzyć akcji';

  @override
  String get action_retry => 'Ponów';

  @override
  String domain_data_load_failed(String domain) {
    return 'Nie udało się załadować $domain';
  }

  @override
  String get domain_data_load_failed_description => 'Nie udało się pobrać danych. Sprawdź połączenie i spróbuj ponownie.';

  @override
  String get domain_not_configured_subtitle => 'Nie skonfigurowano';

  @override
  String get services_not_available => 'Usługi niedostępne';

  @override
  String get button_ok => 'OK';

  @override
  String get button_cancel => 'Anuluj';

  @override
  String get button_close => 'Zamknij';

  @override
  String get button_confirm => 'Potwierdź';

  @override
  String get button_done => 'Gotowe';

  @override
  String get unit_system_default => 'Domyślna';

  @override
  String get unit_celsius => 'Celsjusz (°C)';

  @override
  String get unit_fahrenheit => 'Fahrenheit (°F)';

  @override
  String get unit_wind_speed_ms => 'Metry na sekundę (m/s)';

  @override
  String get unit_wind_speed_kmh => 'Kilometry na godzinę (km/h)';

  @override
  String get unit_wind_speed_mph => 'Mile na godzinę (mph)';

  @override
  String get unit_wind_speed_knots => 'Węzły (kn)';

  @override
  String get unit_pressure_hpa => 'Hektopaskal (hPa)';

  @override
  String get unit_pressure_mbar => 'Milibar (mbar)';

  @override
  String get unit_pressure_inhg => 'Cale słupa rtęci (inHg)';

  @override
  String get unit_pressure_mmhg => 'Milimetry słupa rtęci (mmHg)';

  @override
  String get unit_precipitation_mm => 'Milimetry (mm)';

  @override
  String get unit_precipitation_inches => 'Cale (in)';

  @override
  String get unit_distance_km => 'Kilometry (km)';

  @override
  String get unit_distance_miles => 'Mile (mi)';

  @override
  String get unit_distance_meters => 'Metry (m)';

  @override
  String get unit_distance_feet => 'Stopy (ft)';

  @override
  String get time_format_12h => '12-godzinny';

  @override
  String get time_format_24h => '24-godzinny';

  @override
  String get day_monday => 'Poniedziałek';

  @override
  String get day_tuesday => 'Wtorek';

  @override
  String get day_wednesday => 'Środa';

  @override
  String get day_thursday => 'Czwartek';

  @override
  String get day_friday => 'Piątek';

  @override
  String get day_saturday => 'Sobota';

  @override
  String get day_sunday => 'Niedziela';

  @override
  String get day_monday_short => 'Pn';

  @override
  String get day_tuesday_short => 'Wt';

  @override
  String get day_wednesday_short => 'Śr';

  @override
  String get day_thursday_short => 'Cz';

  @override
  String get day_friday_short => 'Pt';

  @override
  String get day_saturday_short => 'So';

  @override
  String get day_sunday_short => 'Nd';

  @override
  String get message_error_tiles_not_configured_title => 'Brak skonfigurowanych kafelków!';

  @override
  String get message_error_tiles_not_configured_description => 'Skonfiguruj co najmniej jeden kafelek na ekranie.';

  @override
  String get message_error_cards_not_configured_title => 'Brak skonfigurowanych kart!';

  @override
  String get message_error_cards_not_configured_description => 'Skonfiguruj co najmniej jedną kartę na ekranie.';

  @override
  String get message_error_device_not_found_title => 'Nie znaleziono urządzenia!';

  @override
  String get message_error_device_not_found_description => 'Żądane urządzenie nie zostało znalezione w aplikacji.';

  @override
  String get message_error_no_device_detail_title => 'Brak szczegółów urządzenia!';

  @override
  String get message_error_no_device_detail_description => 'Dla wybranego urządzenia nie jest dostępna strona szczegółów.';

  @override
  String get message_error_no_device_detail_preparing_title => 'Szczegóły urządzenia nie są gotowe!';

  @override
  String get message_error_no_device_detail_preparing_description => 'Strona szczegółów wybranego urządzenia nie jest jeszcze gotowa.';

  @override
  String get device_status_offline => 'Offline';

  @override
  String get device_offline_message => 'Urządzenie jest offline';

  @override
  String get device_offline_title => 'Urządzenie offline';

  @override
  String get device_offline_description => 'Nie można komunikować się z tym urządzeniem. Sprawdź, czy urządzenie jest włączone i połączone z siecią.';

  @override
  String get device_offline_retry => 'Ponów połączenie';

  @override
  String device_offline_last_seen(String time) {
    return 'Ostatnio widziano $time';
  }

  @override
  String devices_offline_skipped(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Pominięto $count urządzeń offline',
      many: 'Pominięto $count urządzeń offline',
      few: 'Pominięto $count urządzenia offline',
      one: 'Pominięto 1 urządzenie offline',
    );
    return '$_temp0';
  }

  @override
  String get all_devices_offline => 'Wszystkie urządzenia są offline';

  @override
  String get time_ago_just_now => 'właśnie teraz';

  @override
  String time_ago_minutes(int count) {
    return '$count min temu';
  }

  @override
  String time_ago_hours(int count) {
    return '$count godz. temu';
  }

  @override
  String time_ago_days(int count) {
    return '$count dn. temu';
  }

  @override
  String time_ago_medium_minutes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count minut temu',
      many: '$count minut temu',
      few: '$count minuty temu',
      one: '1 minutę temu',
    );
    return '$_temp0';
  }

  @override
  String time_ago_medium_hours(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count godzin temu',
      many: '$count godzin temu',
      few: '$count godziny temu',
      one: '1 godzinę temu',
    );
    return '$_temp0';
  }

  @override
  String time_ago_medium_days(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count dni temu',
      many: '$count dni temu',
      few: '$count dni temu',
      one: '1 dzień temu',
    );
    return '$_temp0';
  }

  @override
  String time_ago_full_minutes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count minut temu',
      many: '$count minut temu',
      few: '$count minuty temu',
      one: '1 minutę temu',
    );
    return '$_temp0';
  }

  @override
  String time_ago_full_hours_minutes(int hours, int minutes) {
    String _temp0 = intl.Intl.pluralLogic(
      hours,
      locale: localeName,
      other: '$hours godzin',
      many: '$hours godzin',
      few: '$hours godziny',
      one: '1 godzinę',
    );
    String _temp1 = intl.Intl.pluralLogic(
      minutes,
      locale: localeName,
      other: '$minutes minut',
      many: '$minutes minut',
      few: '$minutes minuty',
      one: '1 minutę',
    );
    return '$_temp0 $_temp1 temu';
  }

  @override
  String time_ago_full_hours(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count godzin temu',
      many: '$count godzin temu',
      few: '$count godziny temu',
      one: '1 godzinę temu',
    );
    return '$_temp0';
  }

  @override
  String time_ago_full_days_hours(int days, int hours) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days dni',
      many: '$days dni',
      few: '$days dni',
      one: '1 dzień',
    );
    String _temp1 = intl.Intl.pluralLogic(
      hours,
      locale: localeName,
      other: '$hours godzin',
      many: '$hours godzin',
      few: '$hours godziny',
      one: '1 godzinę',
    );
    return '$_temp0 $_temp1 temu';
  }

  @override
  String time_ago_full_days(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count dni temu',
      many: '$count dni temu',
      few: '$count dni temu',
      one: '1 dzień temu',
    );
    return '$_temp0';
  }

  @override
  String get device_config_issue => 'Problem z konfiguracją';

  @override
  String get device_details => 'Szczegóły urządzenia';

  @override
  String get message_error_page_not_found_title => 'Nie znaleziono strony!';

  @override
  String get message_error_page_not_found_description => 'Żądana strona nie została znaleziona w aplikacji.';

  @override
  String get electrical_energy_consumption_title => 'Zużycie energii';

  @override
  String get electrical_energy_consumption_description => 'Całkowite zużycie energii w czasie.';

  @override
  String get electrical_energy_average_power_title => 'Średnia moc';

  @override
  String get electrical_energy_average_power_description => 'Średni pobór mocy w ostatnim okresie raportowania.';

  @override
  String get electrical_generation_production_title => 'Produkcja energii';

  @override
  String get electrical_generation_production_description => 'Całkowita energia wyprodukowana przez źródło.';

  @override
  String get electrical_generation_power_title => 'Moc produkcji';

  @override
  String get electrical_generation_power_description => 'Bieżąca moc wyjściowa ze źródła produkcji.';

  @override
  String get electrical_power_current_title => 'Natężenie';

  @override
  String get electrical_power_current_description => 'Ile prądu płynie.';

  @override
  String get electrical_power_voltage_title => 'Napięcie';

  @override
  String get electrical_power_voltage_description => 'Siła prądu elektrycznego.';

  @override
  String get electrical_power_power_title => 'Moc';

  @override
  String get electrical_power_power_description => 'Ile energii jest aktualnie zużywane.';

  @override
  String get electrical_power_frequency_title => 'Częstotliwość';

  @override
  String get electrical_power_frequency_description => 'Jak stabilny jest prąd.';

  @override
  String get electrical_power_over_current_title => 'Przeciążenie prądowe';

  @override
  String get electrical_power_over_current_description => 'Ostrzeżenie: Zbyt duży przepływ prądu.';

  @override
  String get electrical_power_over_voltage_title => 'Przepięcie';

  @override
  String get electrical_power_over_voltage_description => 'Ostrzeżenie: Napięcie jest zbyt wysokie.';

  @override
  String get electrical_power_over_power_title => 'Przeciążenie mocy';

  @override
  String get electrical_power_over_power_description => 'Ostrzeżenie: Zużycie mocy jest zbyt wysokie.';

  @override
  String get light_state_on => 'Wł.';

  @override
  String get light_state_on_description => 'Światło jest włączone';

  @override
  String get light_state_off => 'Wył.';

  @override
  String get light_state_failed => 'Błąd';

  @override
  String get light_state_off_description => 'Światło jest wyłączone';

  @override
  String get light_state_brightness_description => 'Bieżąca jasność.';

  @override
  String get light_state_mixed_description => 'Urządzenia mają różne wartości.';

  @override
  String get light_state_syncing_description => 'Synchronizacja urządzeń...';

  @override
  String get light_state_not_synced_description => 'Urządzenia nie są zsynchronizowane';

  @override
  String get light_role_main => 'Główne';

  @override
  String get light_role_task => 'Robocze';

  @override
  String get light_role_ambient => 'Nastrojowe';

  @override
  String get light_role_accent => 'Akcentowe';

  @override
  String get light_role_night => 'Nocne';

  @override
  String get light_role_other => 'Inne';

  @override
  String get light_role_hidden => 'Ukryte';

  @override
  String get light_role_on_description => 'Światła są włączone';

  @override
  String get light_role_off_description => 'Światła są wyłączone';

  @override
  String get light_role_not_synced_description => 'Synchronizacja nie powiodła się';

  @override
  String get light_role_syncing_description => 'Trwa synchronizacja';

  @override
  String get light_role_mixed_description => 'Światła mają różne wartości';

  @override
  String get light_state_out_of_sync => 'Niezsynchronizowane';

  @override
  String get light_mode_off => 'Wył';

  @override
  String get light_mode_on => 'Wł';

  @override
  String get light_mode_brightness => 'Jasność';

  @override
  String get light_mode_color => 'Kolor';

  @override
  String get light_mode_temperature => 'Temperatura';

  @override
  String get light_mode_saturation => 'Nasycenie';

  @override
  String get light_mode_white => 'Biały';

  @override
  String get light_mode_swatches => 'Palety';

  @override
  String get lights_more_scenes => 'Więcej scen';

  @override
  String get thermostat_state_title => 'Stan termostatu';

  @override
  String get thermostat_state_configured_temperature_description => 'Ustawiona temperatura.';

  @override
  String get thermostat_state_current_temperature_description => 'Aktualna temperatura pomieszczenia.';

  @override
  String get thermostat_state_current_humidity_description => 'Aktualna wilgotność pomieszczenia.';

  @override
  String get thermostat_child_lock_title => 'Blokada rodzicielska';

  @override
  String get thermostat_openings_state_title => 'Okno jest otwarte.';

  @override
  String get thermostat_openings_state_description => 'Termostat jest wyłączony.';

  @override
  String get contact_sensor_window => 'Okno';

  @override
  String get contact_sensor_open => 'Otwarte';

  @override
  String get contact_sensor_closed => 'Zamknięte';

  @override
  String get leak_sensor_water => 'Wyciek wody';

  @override
  String get leak_sensor_detected => 'Wykryto';

  @override
  String get leak_sensor_dry => 'Sucho';

  @override
  String get thermostat_lock_locked => 'Zablokowane';

  @override
  String get thermostat_lock_unlocked => 'Odblokowane';

  @override
  String get thermostat_mode_label => 'Tryb';

  @override
  String get thermostat_mode_off => 'Wył';

  @override
  String get thermostat_mode_heat => 'Grzanie';

  @override
  String get thermostat_mode_cool => 'Chłodzenie';

  @override
  String get thermostat_mode_auto => 'Auto';

  @override
  String get thermostat_mode_manual => 'Ręczny';

  @override
  String get thermostat_min => 'min';

  @override
  String get thermostat_max => 'maks';

  @override
  String get thermostat_target_label => 'Docelowa';

  @override
  String get thermostat_state_off => 'Wył';

  @override
  String get thermostat_state_heating => 'Grzanie';

  @override
  String thermostat_state_heating_to(String temperature) {
    return 'Grzanie do $temperature';
  }

  @override
  String get thermostat_state_cooling => 'Chłodzenie';

  @override
  String thermostat_state_cooling_to(String temperature) {
    return 'Chłodzenie do $temperature';
  }

  @override
  String get thermostat_state_idling => 'Bezczynny';

  @override
  String thermostat_state_idle_at(String temperature) {
    return 'Bezczynny przy $temperature';
  }

  @override
  String get thermostat_with_invalid_configuration => 'To urządzenie termostatu jest nieprawidłowo skonfigurowane.';

  @override
  String get on_state_on => 'Wł';

  @override
  String get on_state_off => 'Wył';

  @override
  String get power_hint_tap_to_turn_on => 'Dotknij, aby włączyć';

  @override
  String get power_hint_tap_to_turn_off => 'Dotknij, aby wyłączyć';

  @override
  String get message_info_app_reboot_title => 'Ponowne uruchamianie urządzenia!';

  @override
  String get message_info_app_reboot_description => 'Poczekaj, aż urządzenie się zrestartuje. Ten proces może chwilę potrwać.';

  @override
  String get message_info_app_power_off_title => 'Wyłączanie urządzenia!';

  @override
  String get message_info_app_power_off_description => 'Urządzenie się wyłącza. Aby ponownie je włączyć, użyj przycisku zasilania.';

  @override
  String get message_info_factory_reset_title => 'Resetowanie urządzenia!';

  @override
  String get message_info_factory_reset_description => 'Wszystkie ustawienia i dane zostaną usunięte, a urządzenie zostanie przywrócone do ustawień fabrycznych. Nie wyłączaj urządzenia podczas procesu resetowania.';

  @override
  String get settings_general_settings_title => 'Ustawienia ogólne';

  @override
  String get settings_general_settings_button_display_settings => 'Ustawienia wyświetlacza';

  @override
  String get settings_general_settings_button_language_settings => 'Ustawienia języka';

  @override
  String get settings_general_settings_button_audio_settings => 'Ustawienia dźwięku';

  @override
  String get settings_general_settings_button_weather_settings => 'Ustawienia pogody';

  @override
  String get settings_general_settings_button_about => 'O aplikacji';

  @override
  String get settings_general_settings_button_maintenance => 'Konserwacja';

  @override
  String get settings_general_settings_button_voice_activation => 'Aktywacja głosowa';

  @override
  String get settings_voice_activation_settings_title => 'Ustawienia aktywacji głosowej';

  @override
  String get settings_voice_activation_section_detection => 'Wykrywanie aktywacji głosowej';

  @override
  String get settings_voice_activation_enable_label => 'Włącz aktywację głosową';

  @override
  String settings_voice_activation_enable_description(String wakeWord) {
    return 'Powiedz \"$wakeWord\", aby aktywować polecenia głosowe bez dotykania panelu.';
  }

  @override
  String get settings_voice_activation_microphone_unavailable => 'Mikrofon nie jest dostępny lub jest wyłączony na tym wyświetlaczu.';

  @override
  String get settings_voice_activation_section_sensitivity => 'Czułość';

  @override
  String get settings_voice_activation_sensitivity_label => 'Czułość wykrywania';

  @override
  String get settings_voice_activation_sensitivity_description => 'Wyższa czułość wykrywa cichszą mowę, ale może reagować na szum otoczenia.';

  @override
  String get settings_voice_activation_section_status => 'Status';

  @override
  String get settings_voice_activation_status_label => 'Status silnika';

  @override
  String get settings_voice_activation_status_stopped => 'Zatrzymano';

  @override
  String get settings_voice_activation_status_listening => 'Nasłuchiwanie aktywacji głosowej...';

  @override
  String get settings_voice_activation_status_recording => 'Nagrywanie mowy...';

  @override
  String get settings_voice_activation_status_processing => 'Przetwarzanie dźwięku...';

  @override
  String get settings_weather_settings_title => 'Ustawienia pogody';

  @override
  String get settings_weather_settings_temperature_unit_title => 'Jednostka temperatury';

  @override
  String get settings_weather_settings_temperature_unit_description => 'Ustaw preferowaną jednostkę temperatury do wyświetlania pogody.';

  @override
  String get settings_weather_settings_temperature_location_title => 'Lokalizacja pogody';

  @override
  String get settings_weather_settings_temperature_location_description => 'Wybierz źródło danych pogodowych.';

  @override
  String get settings_weather_settings_temperature_location_single => 'Dostępna jest tylko jedna lokalizacja.';

  @override
  String get settings_maintenance_title => 'Konserwacja';

  @override
  String get settings_maintenance_restart_title => 'Restart';

  @override
  String get settings_maintenance_restart_description => 'Uruchom ponownie urządzenie, aby zastosować zmiany.';

  @override
  String get settings_maintenance_restart_confirm_title => 'Restart urządzenia';

  @override
  String get settings_maintenance_restart_confirm_description => 'Czy na pewno chcesz zrestartować urządzenie? Ta akcja tymczasowo przerwie działanie.';

  @override
  String get settings_maintenance_power_off_title => 'Wyłączenie';

  @override
  String get settings_maintenance_power_off_description => 'Całkowite wyłączenie urządzenia.';

  @override
  String get settings_maintenance_power_off_confirm_title => 'Wyłącz urządzenie';

  @override
  String get settings_maintenance_power_off_confirm_description => 'Czy na pewno chcesz wyłączyć urządzenie? Będzie trzeba je ręcznie ponownie włączyć.';

  @override
  String get settings_maintenance_factory_reset_title => 'Ustawienia fabryczne';

  @override
  String get settings_maintenance_factory_reset_description => 'Przywróć urządzenie do oryginalnych ustawień fabrycznych.';

  @override
  String get settings_maintenance_factory_reset_confirm_title => 'Przywracanie ustawień fabrycznych';

  @override
  String get settings_maintenance_factory_reset_confirm_description => 'Czy na pewno chcesz usunąć wszystkie dane i przywrócić ustawienia fabryczne urządzenia? Ta akcja jest nieodwracalna.';

  @override
  String get settings_maintenance_system_heading => 'System';

  @override
  String get settings_maintenance_danger_heading => 'Strefa niebezpieczna';

  @override
  String get settings_maintenance_restart_display_description => 'Uruchom ponownie ten wyświetlacz, aby zastosować zmiany.';

  @override
  String get settings_maintenance_restart_display_confirm_title => 'Restart wyświetlacza';

  @override
  String get settings_maintenance_restart_display_confirm_description => 'Czy na pewno chcesz zrestartować ten wyświetlacz? Bramka i inne wyświetlacze nie zostaną naruszone.';

  @override
  String get settings_maintenance_power_off_display_description => 'Całkowite wyłączenie tego wyświetlacza.';

  @override
  String get settings_maintenance_power_off_display_confirm_title => 'Wyłącz wyświetlacz';

  @override
  String get settings_maintenance_power_off_display_confirm_description => 'Czy na pewno chcesz wyłączyć ten wyświetlacz? Będzie trzeba go ponownie ręcznie włączyć. Bramka nie zostanie naruszona.';

  @override
  String get settings_maintenance_factory_reset_display_description => 'Usuń ten wyświetlacz z bramki i przywróć ustawienia fabryczne.';

  @override
  String get settings_maintenance_factory_reset_display_confirm_title => 'Ustawienia fabryczne wyświetlacza';

  @override
  String get settings_maintenance_factory_reset_display_confirm_description => 'Czy na pewno chcesz przywrócić ustawienia fabryczne tego wyświetlacza? Zostanie usunięty z bramki, a wszystkie lokalne dane zostaną skasowane. Ta akcja jest nieodwracalna.';

  @override
  String get settings_language_settings_title => 'Ustawienia języka';

  @override
  String get settings_language_settings_language_title => 'Język';

  @override
  String get settings_language_settings_language_description => 'Wybierz preferowany język.';

  @override
  String get settings_language_settings_timezone_title => 'Strefa czasowa';

  @override
  String get settings_language_settings_timezone_description => 'Lokalna strefa czasowa.';

  @override
  String get settings_language_settings_time_format_title => 'Format czasu';

  @override
  String get settings_language_settings_time_format_description => 'Format 12-godzinny lub 24-godzinny.';

  @override
  String get settings_language_settings_number_format_title => 'Number Format';

  @override
  String get settings_language_settings_number_format_description => 'How numbers are displayed (thousands and decimal separators).';

  @override
  String get number_format_comma_dot => '1,234.56';

  @override
  String get number_format_dot_comma => '1.234,56';

  @override
  String get number_format_space_comma => '1 234,56';

  @override
  String get number_format_none => '1234.56';

  @override
  String get settings_display_settings_title => 'Ustawienia wyświetlacza';

  @override
  String get settings_display_settings_theme_mode_title => 'Tryb motywu';

  @override
  String get settings_display_settings_theme_mode_description => 'Przełączanie między jasnym a ciemnym motywem.';

  @override
  String get settings_display_settings_brightness_title => 'Jasność';

  @override
  String get settings_display_settings_brightness_description => 'Dostosuj poziom jasności ekranu.';

  @override
  String get settings_display_settings_screen_lock_title => 'Blokada ekranu';

  @override
  String get settings_display_settings_screen_lock_description => 'Automatyczna blokada po bezczynności.';

  @override
  String get settings_display_settings_screen_saver_title => 'Wygaszacz ekranu';

  @override
  String get settings_display_settings_screen_saver_description => 'Pokaż wygaszacz ekranu podczas bezczynności.';

  @override
  String get settings_display_settings_unit_overrides_section => 'Nadpisanie jednostek';

  @override
  String get settings_display_settings_temperature_unit_title => 'Jednostka temperatury';

  @override
  String get settings_display_settings_temperature_unit_description => 'Nadpisz systemową jednostkę temperatury dla tego wyświetlacza.';

  @override
  String get settings_display_settings_wind_speed_unit_title => 'Jednostka prędkości wiatru';

  @override
  String get settings_display_settings_wind_speed_unit_description => 'Nadpisz systemową jednostkę prędkości wiatru dla tego wyświetlacza.';

  @override
  String get settings_display_settings_pressure_unit_title => 'Jednostka ciśnienia';

  @override
  String get settings_display_settings_pressure_unit_description => 'Nadpisz systemową jednostkę ciśnienia dla tego wyświetlacza.';

  @override
  String get settings_display_settings_precipitation_unit_title => 'Jednostka opadów';

  @override
  String get settings_display_settings_precipitation_unit_description => 'Nadpisz systemową jednostkę opadów dla tego wyświetlacza.';

  @override
  String get settings_display_settings_distance_unit_title => 'Jednostka odległości';

  @override
  String get settings_display_settings_distance_unit_description => 'Nadpisz systemową jednostkę odległości dla tego wyświetlacza.';

  @override
  String get settings_audio_settings_title => 'Ustawienia dźwięku';

  @override
  String get settings_audio_settings_speaker_title => 'Głośnik';

  @override
  String get settings_audio_settings_speaker_description => 'Włącz lub wyłącz głośnik.';

  @override
  String get settings_audio_settings_speaker_volume_title => 'Głośność głośnika';

  @override
  String get settings_audio_settings_speaker_volume_description => 'Dostosuj poziom głośności wyjścia.';

  @override
  String get settings_audio_settings_microphone_title => 'Mikrofon';

  @override
  String get settings_audio_settings_microphone_description => 'Włącz lub wyłącz mikrofon.';

  @override
  String get settings_audio_settings_microphone_volume_title => 'Głośność mikrofonu';

  @override
  String get settings_audio_settings_microphone_volume_description => 'Dostosuj czułość wejścia.';

  @override
  String get settings_audio_settings_no_support => 'Ten wyświetlacz nie obsługuje wejścia ani wyjścia dźwięku.';

  @override
  String get settings_about_title => 'O aplikacji';

  @override
  String get settings_about_about_heading => 'O aplikacji';

  @override
  String get settings_about_about_info => 'FastyBird Smart Panel to aplikacja do automatyki domowej, która umożliwia bezproblemową integrację z inteligentnymi urządzeniami, oferując zaawansowane sterowanie i monitorowanie.';

  @override
  String get settings_about_developed_by_heading => 'Twórca';

  @override
  String get settings_about_license_heading => 'Licencja';

  @override
  String get settings_about_device_information_heading => 'Informacje o urządzeniu';

  @override
  String get settings_about_show_license_button => 'Pokaż licencję';

  @override
  String get settings_about_ip_address_title => 'Adres IP';

  @override
  String get settings_about_mac_address_title => 'Adres MAC';

  @override
  String get settings_about_cpu_usage_title => 'Użycie CPU';

  @override
  String get settings_about_memory_usage_title => 'Użycie pamięci';

  @override
  String get weather_forecast_title => 'Prognoza pogody';

  @override
  String get weather_forecast_feels_like => 'Odczuwalna:';

  @override
  String get weather_forecast_humidity => 'Wilgotność:';

  @override
  String get weather_detail_rain => 'Deszcz';

  @override
  String get weather_detail_snow => 'Śnieg';

  @override
  String get weather_detail_sunrise => 'Wschód słońca';

  @override
  String get weather_detail_sunset => 'Zachód słońca';

  @override
  String get weather_detail_forecast => 'Prognoza';

  @override
  String get weather_detail_not_configured => 'Pogoda nie jest skonfigurowana';

  @override
  String get weather_detail_today => 'Dziś';

  @override
  String get weather_detail_hourly_forecast => 'Prognoza godzinowa';

  @override
  String get weather_condition_thunderstorm_with_light_rain => 'Burza z lekkim deszczem';

  @override
  String get weather_condition_thunderstorm_with_rain => 'Burza z deszczem';

  @override
  String get weather_condition_thunderstorm_with_heavy_rain => 'Burza z ulewnym deszczem';

  @override
  String get weather_condition_light_thunderstorm => 'Lekka burza';

  @override
  String get weather_condition_thunderstorm => 'Burza';

  @override
  String get weather_condition_heavy_thunderstorm => 'Silna burza';

  @override
  String get weather_condition_ragged_thunderstorm => 'Nieregularna burza';

  @override
  String get weather_condition_thunderstorm_with_light_drizzle => 'Burza z lekką mżawką';

  @override
  String get weather_condition_thunderstorm_with_drizzle => 'Burza z mżawką';

  @override
  String get weather_condition_thunderstorm_with_heavy_drizzle => 'Burza z gęstą mżawką';

  @override
  String get weather_condition_light_intensity_drizzle => 'Lekka mżawka';

  @override
  String get weather_condition_drizzle => 'Mżawka';

  @override
  String get weather_condition_heavy_intensity_drizzle => 'Gęsta mżawka';

  @override
  String get weather_condition_light_intensity_drizzle_rain => 'Lekka mżawka przechodząca w deszcz';

  @override
  String get weather_condition_drizzle_rain => 'Mżawka z deszczem';

  @override
  String get weather_condition_heavy_intensity_drizzle_rain => 'Gęsta mżawka przechodząca w deszcz';

  @override
  String get weather_condition_shower_rain_and_drizzle => 'Przelotny deszcz z mżawką';

  @override
  String get weather_condition_heavy_shower_rain_and_drizzle => 'Silne opady przelotne z mżawką';

  @override
  String get weather_condition_shower_drizzle => 'Przelotna mżawka';

  @override
  String get weather_condition_light_rain => 'Lekki deszcz';

  @override
  String get weather_condition_moderate_rain => 'Umiarkowany deszcz';

  @override
  String get weather_condition_heavy_intensity_rain => 'Silny deszcz';

  @override
  String get weather_condition_very_heavy_rain => 'Bardzo silny deszcz';

  @override
  String get weather_condition_extreme_rain => 'Ekstremalny deszcz';

  @override
  String get weather_condition_freezing_rain => 'Marznący deszcz';

  @override
  String get weather_condition_light_intensity_shower_rain => 'Lekki deszcz przelotny';

  @override
  String get weather_condition_shower_rain => 'Deszcz przelotny';

  @override
  String get weather_condition_heavy_intensity_shower_rain => 'Silny deszcz przelotny';

  @override
  String get weather_condition_ragged_shower_rain => 'Nieregularny deszcz przelotny';

  @override
  String get weather_condition_light_snow => 'Lekki śnieg';

  @override
  String get weather_condition_snow => 'Śnieg';

  @override
  String get weather_condition_heavy_snow => 'Obfity śnieg';

  @override
  String get weather_condition_sleet => 'Deszcz ze śniegiem';

  @override
  String get weather_condition_light_shower_sleet => 'Lekki przelotny deszcz ze śniegiem';

  @override
  String get weather_condition_shower_sleet => 'Przelotny deszcz ze śniegiem';

  @override
  String get weather_condition_light_rain_and_snow => 'Lekki deszcz ze śniegiem';

  @override
  String get weather_condition_rain_and_snow => 'Deszcz ze śniegiem';

  @override
  String get weather_condition_light_shower_snow => 'Lekkie przelotne opady śniegu';

  @override
  String get weather_condition_shower_snow => 'Przelotne opady śniegu';

  @override
  String get weather_condition_heavy_shower_snow => 'Silne przelotne opady śniegu';

  @override
  String get weather_condition_mist => 'Mgła';

  @override
  String get weather_condition_smoke => 'Dym';

  @override
  String get weather_condition_haze => 'Zamglenie';

  @override
  String get weather_condition_fog => 'Gęsta mgła';

  @override
  String get weather_condition_sand => 'Piasek';

  @override
  String get weather_condition_dust => 'Kurz';

  @override
  String get weather_condition_volcanic_ash => 'Popiół wulkaniczny';

  @override
  String get weather_condition_squalls => 'Szkwały';

  @override
  String get weather_condition_tornado => 'Tornado';

  @override
  String get weather_condition_clear_sky => 'Bezchmurne niebo';

  @override
  String get weather_condition_few_clouds => 'Lekkie zachmurzenie';

  @override
  String get weather_condition_scattered_clouds => 'Rozproszone chmury';

  @override
  String get weather_condition_broken_clouds => 'Częściowe zachmurzenie';

  @override
  String get weather_condition_overcast_clouds => 'Pochmurno';

  @override
  String get weather_condition_unknown => 'Nieznane';

  @override
  String get discovery_searching_title => 'Wyszukiwanie bramek';

  @override
  String get discovery_searching_description => 'Szukam bramek FastyBird Smart Panel w Twojej sieci...';

  @override
  String discovery_found_count(int count) {
    return 'Znaleziono $count bramek...';
  }

  @override
  String get discovery_select_title => 'Wybierz bramkę';

  @override
  String discovery_select_description(int count) {
    return 'Znaleziono $count bramek w Twojej sieci:';
  }

  @override
  String get discovery_not_found_title => 'Nie znaleziono bramki';

  @override
  String get discovery_not_found_description => 'Nie udało się znaleźć żadnej bramki FastyBird Smart Panel w Twojej sieci.\n\nUpewnij się, że bramka jest uruchomiona i podłączona do tej samej sieci co to urządzenie.';

  @override
  String get discovery_error_title => 'Błąd wyszukiwania';

  @override
  String get discovery_error_description => 'Podczas wyszukiwania bramek wystąpił błąd.\n\nSprawdź połączenie sieciowe i spróbuj ponownie.';

  @override
  String discovery_error_failed(String error) {
    return 'Wyszukiwanie nie powiodło się: $error';
  }

  @override
  String get discovery_connecting_title => 'Łączenie z bramką';

  @override
  String discovery_connecting_description(String address) {
    return 'Kontaktowanie z $address...';
  }

  @override
  String get discovery_connecting_fallback => 'bramkę';

  @override
  String get discovery_manual_entry_title => 'Wprowadź adres bramki';

  @override
  String get discovery_manual_entry_hint => '192.168.1.100:3000';

  @override
  String get discovery_manual_entry_label => 'Adres bramki';

  @override
  String get discovery_manual_entry_help => 'Wprowadź adres IP lub nazwę hosta z opcjonalnym portem.\nPrzykłady: 192.168.1.100:3000, gateway.local, 10.0.0.5';

  @override
  String get discovery_validation_empty => 'Proszę wprowadzić adres bramki';

  @override
  String get discovery_validation_invalid => 'Nieprawidłowy adres. Wprowadź prawidłowy adres IP lub nazwę hosta.';

  @override
  String get discovery_button_back => 'Wstecz';

  @override
  String get discovery_button_connect => 'Połącz';

  @override
  String get discovery_button_connect_selected => 'Połącz z wybraną bramką';

  @override
  String get discovery_button_rescan => 'Skanuj ponownie';

  @override
  String get discovery_button_try_again => 'Spróbuj ponownie';

  @override
  String get discovery_button_manual => 'Wprowadź ręcznie';

  @override
  String get discovery_button_cancel => 'Anuluj';

  @override
  String get room_selection_title => 'Wybierz pokój';

  @override
  String room_selection_description(int count) {
    return 'Wybierz, do którego pokoju należy ten wyświetlacz ($count dostępnych):';
  }

  @override
  String get room_selection_button_confirm => 'Przypisz do tego pokoju';

  @override
  String get room_selection_saving => 'Przypisywanie pokoju...';

  @override
  String get room_selection_error => 'Nie udało się przypisać pokoju. Spróbuj ponownie.';

  @override
  String get room_selection_empty_title => 'Brak dostępnych pokoi';

  @override
  String get room_selection_empty_description => 'Nie utworzono jeszcze żadnych pokoi. Otwórz administrację i dodaj co najmniej jeden pokój.';

  @override
  String get action_success => 'Akcja zakończona pomyślnie';

  @override
  String get space_lighting_controls_title => 'Sterowanie oświetleniem';

  @override
  String get space_lighting_mode_off => 'Wył';

  @override
  String get space_lighting_mode_work => 'Praca';

  @override
  String get space_lighting_mode_relax => 'Relaks';

  @override
  String get space_lighting_mode_night => 'Noc';

  @override
  String get space_devices_title => 'Urządzenia';

  @override
  String get space_devices_placeholder => 'Urządzenia w tym pomieszczeniu pojawią się tutaj';

  @override
  String get space_climate_controls_title => 'Klimatyzacja';

  @override
  String get space_climate_current_label => 'Aktualna';

  @override
  String get space_climate_target_label => 'Docelowa';

  @override
  String get climate_role_auxiliary => 'Pomocnicze';

  @override
  String get climate_tap_for_details => 'Dotknij, aby zobaczyć szczegóły';

  @override
  String get climate_role_ventilation => 'Wentylacja';

  @override
  String get climate_role_humidity => 'Sterowanie wilgotnością';

  @override
  String get climate_role_other => 'Inne urządzenia';

  @override
  String get space_suggestion_applied => 'Sugestia zastosowana';

  @override
  String get space_suggestion_dismissed => 'Sugestia odrzucona';

  @override
  String get space_undo_success => 'Akcja cofnięta';

  @override
  String get space_undo_button => 'Cofnij';

  @override
  String get space_empty_state_title => 'Wyświetlacz jest gotowy';

  @override
  String space_empty_state_description(String spaceName) {
    return 'Aby dodać urządzenia i elementy sterujące, skonfiguruj \"$spaceName\" w administracji.';
  }

  @override
  String get space_sensors_only_title => 'Tylko czujniki';

  @override
  String get space_sensors_only_description => 'To pomieszczenie ma tylko czujniki — brak urządzeń do sterowania';

  @override
  String get house_overview_no_spaces_title => 'Brak skonfigurowanych pomieszczeń';

  @override
  String get house_overview_no_spaces_description => 'Utwórz pomieszczenia w administracji, aby pojawiły się tutaj';

  @override
  String get house_overview_no_space_page => 'Dla tego pomieszczenia nie skonfigurowano strony';

  @override
  String get house_overview_tap_to_view => 'Dotknij, aby wyświetlić';

  @override
  String get house_modes_home => 'Dom';

  @override
  String get house_modes_home_description => 'Normalny tryb domowy';

  @override
  String get house_modes_away => 'Poza domem';

  @override
  String get house_modes_away_description => 'Poza domem';

  @override
  String get house_modes_night => 'Noc';

  @override
  String get house_modes_night_description => 'Ustawienia nocne';

  @override
  String get house_modes_changed_success => 'Tryb domu został pomyślnie zmieniony';

  @override
  String get house_modes_changed_error => 'Nie udało się zmienić trybu domu';

  @override
  String get house_modes_confirm_title => 'Potwierdź zmianę trybu';

  @override
  String get house_modes_confirm_away_description => 'Czy na pewno chcesz ustawić dom w tryb Poza domem? To może wpłynąć na reguły automatyzacji i ustawienia bezpieczeństwa.';

  @override
  String get space_scenes_title => 'Szybkie sceny';

  @override
  String get space_scene_triggered => 'Scena aktywowana';

  @override
  String get space_scene_partial_success => 'Scena częściowo aktywowana';

  @override
  String get window_covering_status_open => 'Otwarte';

  @override
  String get window_covering_status_closed => 'Zamknięte';

  @override
  String get window_covering_status_opening => 'Otwieranie';

  @override
  String get window_covering_status_closing => 'Zamykanie';

  @override
  String get window_covering_status_stopped => 'Zatrzymane';

  @override
  String get window_covering_type_curtain => 'Zasłona';

  @override
  String get window_covering_type_blind => 'Żaluzja';

  @override
  String get window_covering_type_roller => 'Roleta';

  @override
  String get window_covering_type_outdoor_blind => 'Żaluzja zewnętrzna';

  @override
  String get window_covering_type_venetian_blind => 'Żaluzja wenecka';

  @override
  String get window_covering_type_vertical_blind => 'Żaluzja pionowa';

  @override
  String get window_covering_type_shutter => 'Okiennica';

  @override
  String get window_covering_type_awning => 'Markiza';

  @override
  String get window_covering_command_open => 'Otwórz';

  @override
  String get window_covering_command_close => 'Zamknij';

  @override
  String get window_covering_command_stop => 'Zatrzymaj';

  @override
  String get window_covering_position_label => 'Pozycja';

  @override
  String get window_covering_position_description => 'Aktualna pozycja';

  @override
  String get window_covering_tilt_label => 'Nachylenie';

  @override
  String get window_covering_tilt_description => 'Regulacja kąta lameli';

  @override
  String get window_covering_obstruction_warning => 'Wykryto przeszkodę';

  @override
  String get window_covering_fault_warning => 'Wykryto usterkę';

  @override
  String get window_covering_preset_morning => 'Rano';

  @override
  String get window_covering_preset_day => 'Dzień';

  @override
  String get window_covering_preset_evening => 'Wieczór';

  @override
  String get window_covering_preset_night => 'Noc';

  @override
  String get window_covering_preset_privacy => 'Prywatność';

  @override
  String get window_covering_preset_away => 'Poza domem';

  @override
  String get window_covering_presets_label => 'Ustawienia wstępne';

  @override
  String get window_covering_channels_label => 'Żaluzje';

  @override
  String get window_covering_info_status => 'Status';

  @override
  String get window_covering_info_obstruction => 'Przeszkoda';

  @override
  String get window_covering_obstruction_detected => 'Wykryto';

  @override
  String get window_covering_obstruction_clear => 'Brak';

  @override
  String window_covering_position_open_percent(int position) {
    return '$position% Otwarte';
  }

  @override
  String get battery_title => 'Bateria';

  @override
  String get connection_lost_title => 'Utracono połączenie';

  @override
  String get connection_lost_message => 'Nie można połączyć się z bramką. Sprawdź połączenie sieciowe i spróbuj ponownie.';

  @override
  String get connection_lost_button_reconnect => 'Połącz ponownie';

  @override
  String get connection_lost_button_change_gateway => 'Zmień bramkę';

  @override
  String get button_retry => 'Ponów';

  @override
  String get button_sync_all => 'Synchronizuj wszystko';

  @override
  String get system_view_room => 'Pokój';

  @override
  String get system_view_master => 'Dom';

  @override
  String get deck_nav_more => 'Więcej';

  @override
  String get deck_all_pages => 'Wszystkie strony';

  @override
  String get system_view_entry => 'Wejście';

  @override
  String get domain_lights => 'Światła';

  @override
  String get domain_lights_other => 'Inne światła';

  @override
  String get domain_lights_empty_title => 'Oświetlenie nie skonfigurowane';

  @override
  String get domain_lights_empty_description => 'Role oświetlenia nie zostały ustawione dla tego pokoju. Skonfiguruj role w administracji.';

  @override
  String domain_lights_count_on(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count świateł włączonych',
      many: '$count świateł włączonych',
      few: '$count światła włączone',
      one: '1 światło włączone',
    );
    return '$_temp0';
  }

  @override
  String get domain_lights_all_off => 'wszystkie wyłączone';

  @override
  String get domain_lights_all_on => 'wszystkie włączone';

  @override
  String get domain_lights_button_all_off => 'Wyłącz wszystkie';

  @override
  String get domain_lights_button_all_on => 'Włącz wszystkie';

  @override
  String get domain_lights_syncing => 'synchronizacja';

  @override
  String get domain_lights_unsynced => 'niezsynchronizowane';

  @override
  String get domain_lights_mixed => 'różne wartości';

  @override
  String get domain_climate => 'Klimat';

  @override
  String get domain_climate_empty_title => 'Klimat nie skonfigurowany';

  @override
  String get domain_climate_empty_description => 'W tym pokoju nie ustawiono żadnych termostatów ani klimatyzatorów. Dodaj urządzenia klimatyczne w administracji.';

  @override
  String get domain_media => 'Multimedia';

  @override
  String media_devices_summary(Object count) {
    return '$count urządzeń';
  }

  @override
  String media_devices_summary_on(Object count, Object on) {
    return '$count urządzeń • $on włączonych';
  }

  @override
  String get media_modes_title => 'Tryby';

  @override
  String get media_action_power_on => 'Włącz';

  @override
  String get media_action_power_off => 'Wyłącz';

  @override
  String get media_action_mute => 'Wycisz';

  @override
  String get media_action_unmute => 'Wyłącz wyciszenie';

  @override
  String get media_mode_off => 'Wył';

  @override
  String get media_mode_background => 'Tło';

  @override
  String get media_mode_focused => 'Skupienie';

  @override
  String get media_mode_party => 'Impreza';

  @override
  String get media_roles_title => 'Role';

  @override
  String media_role_summary(Object on, Object total) {
    return '$on z $total włączonych';
  }

  @override
  String get media_roles_unassigned => 'Nieprzypisane urządzenia';

  @override
  String get media_role_primary => 'Główne';

  @override
  String get media_role_secondary => 'Dodatkowe';

  @override
  String get media_role_background => 'Tło';

  @override
  String get media_role_gaming => 'Gry';

  @override
  String get media_role_hidden => 'Ukryte';

  @override
  String get media_targets_title => 'Urządzenia';

  @override
  String get media_capability_power => 'Zasilanie';

  @override
  String get media_capability_volume => 'Głośność';

  @override
  String get media_capability_mute => 'Wyciszenie';

  @override
  String get media_capability_none => 'Brak możliwości';

  @override
  String get media_no_endpoints_title => 'Brak urządzeń multimedialnych';

  @override
  String get media_no_endpoints_description => 'Ten pokój nie ma urządzeń multimedialnych. Dodaj telewizor, głośnik lub streamer.';

  @override
  String get media_no_bindings_description => 'Aktywności multimedialne są konfigurowane. Pociągnij, aby odświeżyć.';

  @override
  String get media_ws_offline_title => 'Utracono połączenie';

  @override
  String get media_ws_offline_description => 'Sterowanie multimediami wymaga aktywnego połączenia. Łączenie...';

  @override
  String get domain_sensors => 'Czujniki';

  @override
  String get domain_energy => 'Energia';

  @override
  String get energy_consumption => 'Zużycie';

  @override
  String get energy_production => 'Produkcja';

  @override
  String get energy_net => 'Netto';

  @override
  String get energy_range_today => 'Dziś';

  @override
  String get energy_range_week => 'Tydzień';

  @override
  String get energy_range_month => 'Miesiąc';

  @override
  String get energy_top_consumers => 'Najwięksi konsumenci';

  @override
  String get energy_chart_title => 'Zużycie w czasie';

  @override
  String get energy_summary_title => 'Podsumowanie';

  @override
  String get energy_unit_kwh => 'kWh';

  @override
  String get energy_empty_title => 'Brak danych o energii';

  @override
  String get energy_empty_description => 'W tym pomieszczeniu nie znaleziono urządzeń monitorujących energię';

  @override
  String get energy_load_failed => 'Nie udało się załadować danych o energii';

  @override
  String get energy_consumed_today => 'Całkowite zużycie energii dziś';

  @override
  String get energy_consumed_week => 'Całkowite zużycie energii w tym tygodniu';

  @override
  String get energy_consumed_month => 'Całkowite zużycie energii w tym miesiącu';

  @override
  String get energy_comparison_vs_yesterday => 'w porównaniu z wczoraj';

  @override
  String get energy_comparison_vs_last_week => 'w porównaniu z zeszłym tygodniem';

  @override
  String get energy_comparison_vs_last_month => 'w porównaniu z zeszłym miesiącem';

  @override
  String energy_comparison_same(String period) {
    return 'Tyle samo co $period';
  }

  @override
  String get energy_period_yesterday => 'wczoraj';

  @override
  String get energy_period_last_week => 'zeszły tydzień';

  @override
  String get energy_period_last_month => 'zeszły miesiąc';

  @override
  String energy_device_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count urządzeń',
      many: '$count urządzeń',
      few: '$count urządzenia',
      one: '1 urządzenie',
    );
    return '$_temp0';
  }

  @override
  String get device_category_lighting => 'Oświetlenie';

  @override
  String get device_category_climate => 'Klimat';

  @override
  String get device_category_sensors => 'Czujniki';

  @override
  String get device_category_media => 'Multimedia';

  @override
  String get master_rooms => 'Pokoje';

  @override
  String get master_devices => 'Urządzenia';

  @override
  String get master_scenes => 'Sceny';

  @override
  String get master_quick_actions => 'Szybkie akcje';

  @override
  String get entry_mode_activated => 'Tryb aktywowany';

  @override
  String get entry_house_modes => 'Tryby domu';

  @override
  String get entry_mode_home => 'Dom';

  @override
  String get entry_mode_away => 'Poza domem';

  @override
  String get entry_mode_night => 'Noc';

  @override
  String get entry_mode_movie => 'Film';

  @override
  String get entry_security => 'Bezpieczeństwo';

  @override
  String get entry_no_security_devices => 'Brak skonfigurowanych urządzeń bezpieczeństwa';

  @override
  String get entry_locks => 'Zamki';

  @override
  String get entry_alarm => 'Alarm';

  @override
  String get entry_cameras => 'Kamery';

  @override
  String get air_quality_level_excellent => 'Doskonała';

  @override
  String get air_quality_level_good => 'Dobra';

  @override
  String get air_quality_level_fair => 'Akceptowalna';

  @override
  String get air_quality_level_inferior => 'Gorsza';

  @override
  String get air_quality_level_poor => 'Zła';

  @override
  String get air_quality_level_unknown => 'Nieznana';

  @override
  String get aqi_label_good => 'Dobra';

  @override
  String get aqi_label_moderate => 'Umiarkowana';

  @override
  String get aqi_label_unhealthy_sensitive => 'Niezdrowa (wrażliwi)';

  @override
  String get aqi_label_unhealthy => 'Niezdrowa';

  @override
  String get aqi_label_very_unhealthy => 'Bardzo niezdrowa';

  @override
  String get aqi_label_hazardous => 'Niebezpieczna';

  @override
  String get particulate_label_pm1 => 'PM1';

  @override
  String get particulate_label_pm25 => 'PM2.5';

  @override
  String get particulate_label_pm10 => 'PM10';

  @override
  String get sensor_enum_voc_level_low => 'Niski';

  @override
  String get sensor_enum_voc_level_low_long => 'Niski poziom VOC';

  @override
  String get sensor_enum_voc_level_medium => 'Śr.';

  @override
  String get sensor_enum_voc_level_medium_long => 'Średni poziom VOC';

  @override
  String get sensor_enum_voc_level_high => 'Wys.';

  @override
  String get sensor_enum_voc_level_high_long => 'Wysoki poziom VOC';

  @override
  String get fan_mode_auto => 'Auto';

  @override
  String get fan_mode_manual => 'Ręczny';

  @override
  String get fan_mode_eco => 'Eko';

  @override
  String get fan_mode_sleep => 'Sen';

  @override
  String get fan_mode_natural => 'Naturalny';

  @override
  String get fan_mode_turbo => 'Turbo';

  @override
  String get fan_speed_off => 'Wył';

  @override
  String get fan_speed_low => 'Niskie';

  @override
  String get fan_speed_medium => 'Średnie';

  @override
  String get fan_speed_high => 'Wysokie';

  @override
  String get fan_speed_turbo => 'Turbo';

  @override
  String get fan_speed_auto => 'Auto';

  @override
  String get fan_timer_off => 'Wył';

  @override
  String get fan_timer_30m => '30m';

  @override
  String get fan_timer_1h => '1h';

  @override
  String get fan_timer_2h => '2h';

  @override
  String get fan_timer_4h => '4h';

  @override
  String get fan_timer_8h => '8h';

  @override
  String get fan_timer_12h => '12h';

  @override
  String get fan_direction_clockwise => 'Zgodnie z zegarem';

  @override
  String get fan_direction_counter_clockwise => 'Przeciwnie do zegara';

  @override
  String get filter_status_good => 'Dobry';

  @override
  String get filter_status_replace_soon => 'Wkrótce';

  @override
  String get filter_status_replace_now => 'Wymień';

  @override
  String get filter_status_unknown => 'Nieznany';

  @override
  String get dehumidifier_mode_auto => 'Auto';

  @override
  String get dehumidifier_mode_manual => 'Ręczny';

  @override
  String get dehumidifier_mode_continuous => 'Ciągły';

  @override
  String get dehumidifier_mode_laundry => 'Suszenie prania';

  @override
  String get dehumidifier_mode_quiet => 'Cichy';

  @override
  String get dehumidifier_status_idle => 'Bezczynny';

  @override
  String get dehumidifier_status_dehumidifying => 'Osuszanie';

  @override
  String get dehumidifier_status_defrosting => 'Odmrażanie';

  @override
  String get dehumidifier_timer_off => 'Wył';

  @override
  String get dehumidifier_timer_30m => '30 min';

  @override
  String get dehumidifier_timer_1h => '1 godzina';

  @override
  String get dehumidifier_timer_2h => '2 godziny';

  @override
  String get dehumidifier_timer_4h => '4 godziny';

  @override
  String get dehumidifier_timer_8h => '8 godzin';

  @override
  String get dehumidifier_timer_12h => '12 godzin';

  @override
  String get dehumidifier_water_tank => 'Zbiornik wody';

  @override
  String get dehumidifier_defrost => 'Odmrażanie';

  @override
  String get dehumidifier_defrost_active => 'Odmrażanie';

  @override
  String get humidifier_mode_auto => 'Auto';

  @override
  String get humidifier_mode_manual => 'Ręczny';

  @override
  String get humidifier_mode_sleep => 'Sen';

  @override
  String get humidifier_mode_baby => 'Dziecięcy';

  @override
  String get humidifier_status_idle => 'Bezczynny';

  @override
  String get humidifier_status_humidifying => 'Nawilżanie';

  @override
  String get humidifier_mist_level => 'Poziom mgły';

  @override
  String get humidifier_mist_level_off => 'Wył';

  @override
  String get humidifier_mist_level_low => 'Niski';

  @override
  String get humidifier_mist_level_medium => 'Średni';

  @override
  String get humidifier_mist_level_high => 'Wysoki';

  @override
  String get humidifier_timer_off => 'Wył';

  @override
  String get humidifier_timer_30m => '30 min';

  @override
  String get humidifier_timer_1h => '1 godzina';

  @override
  String get humidifier_timer_2h => '2 godziny';

  @override
  String get humidifier_timer_4h => '4 godziny';

  @override
  String get humidifier_timer_8h => '8 godzin';

  @override
  String get humidifier_timer_12h => '12 godzin';

  @override
  String get humidifier_water_tank => 'Zbiornik wody';

  @override
  String get humidifier_warm_mist => 'Ciepła para';

  @override
  String get device_current_humidity => 'Aktualna';

  @override
  String get device_current_temperature => 'Temperatura';

  @override
  String get device_fan_speed => 'Prędkość';

  @override
  String get device_fan_mode => 'Tryb wentylatora';

  @override
  String get device_timer => 'Czasomierz';

  @override
  String get device_child_lock => 'Blokada rodzicielska';

  @override
  String get device_oscillation => 'Oscylacja';

  @override
  String get device_direction => 'Kierunek';

  @override
  String get device_natural_breeze => 'Naturalny powiew';

  @override
  String get device_auto_off_timer => 'Automatyczne wyłączenie';

  @override
  String get device_filter_life => 'Żywotność filtra';

  @override
  String get device_filter_status => 'Filtr';

  @override
  String get device_voc => 'VOC';

  @override
  String get device_co2 => 'CO₂';

  @override
  String get device_co => 'CO';

  @override
  String get device_no2 => 'NO₂';

  @override
  String get device_o3 => 'O₃';

  @override
  String get device_so2 => 'SO₂';

  @override
  String get device_pressure => 'Ciśnienie';

  @override
  String get air_quality_healthy => 'Zdrowe';

  @override
  String get air_quality_unhealthy => 'Niezdrowe';

  @override
  String get gas_detected => 'Wykryto';

  @override
  String get gas_clear => 'Brak';

  @override
  String get gas_level_low => 'Niski';

  @override
  String get gas_level_medium => 'Średni';

  @override
  String get gas_level_high => 'Wysoki';

  @override
  String get device_humidity => 'Wilgotność';

  @override
  String get device_air_quality_index => 'Indeks jakości powietrza';

  @override
  String get device_temperature => 'Temp';

  @override
  String get device_sensors => 'Czujniki';

  @override
  String get device_controls => 'Sterowanie';

  @override
  String get device_settings => 'Ustawienia';

  @override
  String duration_format_hours_minutes(int hours, int minutes) {
    return '${hours}h ${minutes}m';
  }

  @override
  String duration_format_hours(int hours) {
    return '${hours}h';
  }

  @override
  String duration_format_minutes(int minutes) {
    return '${minutes}m';
  }

  @override
  String get media_playing => 'Odtwarzanie';

  @override
  String get media_idle => 'Bezczynny';

  @override
  String get media_standby => 'Gotowość';

  @override
  String get media_volume => 'Głośność';

  @override
  String get media_source => 'Źródło';

  @override
  String get media_queue => 'Kolejka';

  @override
  String get media_up_next => 'Następne';

  @override
  String get media_other_devices => 'Inne urządzenia';

  @override
  String get device_status_standby => 'Gotowość';

  @override
  String get device_status_active => 'Aktywne';

  @override
  String get device_status_inactive => 'Nieaktywne';

  @override
  String get climate_devices_section => 'Urządzenia klimatyczne';

  @override
  String get climate_more_sensors => 'Więcej czujników';

  @override
  String get domain_shading => 'Rolety';

  @override
  String get domain_shading_empty_title => 'Rolety nie skonfigurowane';

  @override
  String get domain_shading_empty_description => 'Role rolet nie zostały ustawione dla tego pokoju. Skonfiguruj role w administracji.';

  @override
  String get shading_modes_title => 'Tryby';

  @override
  String get shading_devices_title => 'Urządzenia';

  @override
  String shading_devices_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count urządzeń',
      many: '$count urządzeń',
      few: '$count urządzenia',
      one: '1 urządzenie',
    );
    return '$_temp0';
  }

  @override
  String get shading_action_open => 'Otwórz';

  @override
  String get shading_action_close => 'Zamk.';

  @override
  String get shading_action_stop => 'Zatrzymaj';

  @override
  String get shading_state_open => 'Otwarte';

  @override
  String get shading_state_closed => 'Zamknięte';

  @override
  String shading_state_partial(int position) {
    return '$position% otwarte';
  }

  @override
  String get shading_position => 'Pozycja';

  @override
  String get shading_tap_for_controls => 'Dotknij, aby sterować';

  @override
  String get shading_hide_controls => 'Ukryj sterowanie';

  @override
  String get covers_mode_open => 'Otwarte';

  @override
  String get covers_mode_closed => 'Zamknięte';

  @override
  String get covers_mode_privacy => 'Prywatność';

  @override
  String get covers_mode_daylight => 'Światło dzienne';

  @override
  String get domain_mode_custom => 'Własny';

  @override
  String get covers_role_primary => 'Główne';

  @override
  String get covers_role_blackout => 'Zaciemniające';

  @override
  String get covers_role_sheer => 'Firanki';

  @override
  String get covers_role_outdoor => 'Zewnętrzne';

  @override
  String get covers_role_hidden => 'Ukryte';

  @override
  String get cover_type_curtain => 'Zasłona';

  @override
  String get cover_type_blind => 'Żaluzja';

  @override
  String get cover_type_roller => 'Roleta';

  @override
  String get cover_type_outdoor_blind => 'Żaluzja zewnętrzna';

  @override
  String get cover_type_cover => 'Osłona';

  @override
  String get light_preset_candle => 'Świeca';

  @override
  String get light_preset_warm => 'Ciepła';

  @override
  String get light_preset_daylight => 'Światło dzienne';

  @override
  String get light_preset_cool => 'Zimna';

  @override
  String get light_preset_warm_white => 'Ciepła biała';

  @override
  String get light_preset_neutral => 'Neutralna';

  @override
  String get light_preset_cool_white => 'Zimna biała';

  @override
  String get light_color_red => 'Czerwony';

  @override
  String get light_color_orange => 'Pomarańczowy';

  @override
  String get light_color_yellow => 'Żółty';

  @override
  String get light_color_green => 'Zielony';

  @override
  String get light_color_cyan => 'Turkusowy';

  @override
  String get light_color_blue => 'Niebieski';

  @override
  String get light_color_purple => 'Fioletowy';

  @override
  String get light_color_pink => 'Różowy';

  @override
  String get light_color_violet => 'Fioletowy';

  @override
  String get light_color_white => 'Biały';

  @override
  String get light_cap_brightness => 'Jasność';

  @override
  String get light_cap_color_temp => 'Temp';

  @override
  String get light_cap_hue => 'Odcień';

  @override
  String get light_cap_saturation => 'Nasyc.';

  @override
  String get light_cap_white => 'Biały';

  @override
  String light_header_mode_count(String mode, int count) {
    return '$mode • $count wł.';
  }

  @override
  String light_header_count_of_total(int count, int total) {
    return '$count z $total wł.';
  }

  @override
  String get popup_label_mode => 'Tryb';

  @override
  String get connection_banner_reconnecting => 'Łączenie...';

  @override
  String get connection_banner_retry => 'Ponów';

  @override
  String get connection_overlay_title_reconnecting => 'Łączenie';

  @override
  String get connection_overlay_message_reconnecting => 'Próba ponownego połączenia...';

  @override
  String get connection_overlay_message_still_trying => 'Wciąż próbujemy się połączyć...';

  @override
  String get connection_overlay_retry => 'Ponów teraz';

  @override
  String get connection_overlay_retrying => 'Łączenie...';

  @override
  String get connection_recovery_connected => 'Połączono';

  @override
  String get connection_auth_error_title => 'Sesja wygasła';

  @override
  String get connection_auth_error_message => 'Twoja sesja wygasła lub została unieważniona. Zresetuj urządzenie, aby ponownie się połączyć.';

  @override
  String get connection_auth_error_button_reset => 'Resetuj urządzenie';

  @override
  String get connection_network_error_title => 'Sieć niedostępna';

  @override
  String get connection_network_error_message => 'Nie można połączyć się z serwerem. Sprawdź połączenie sieciowe.';

  @override
  String get connection_network_error_button_retry => 'Spróbuj ponownie';

  @override
  String get connection_server_error_title => 'Serwer niedostępny';

  @override
  String get connection_server_error_message => 'Serwer jest tymczasowo niedostępny. Spróbuj ponownie później.';

  @override
  String get connection_server_error_button_retry => 'Spróbuj ponownie';

  @override
  String get sensor_enum_illuminance_bright => 'Jasno';

  @override
  String get sensor_enum_illuminance_bright_long => 'Jasno';

  @override
  String get sensor_enum_illuminance_moderate => 'Umiarkowanie';

  @override
  String get sensor_enum_illuminance_moderate_long => 'Umiarkowane oświetlenie';

  @override
  String get sensor_enum_illuminance_dusky => 'Półmrok';

  @override
  String get sensor_enum_illuminance_dusky_long => 'Półmrok';

  @override
  String get sensor_enum_illuminance_dark => 'Ciemno';

  @override
  String get sensor_enum_illuminance_dark_long => 'Ciemno';

  @override
  String get sensor_enum_gas_status_normal => 'OK';

  @override
  String get sensor_enum_gas_status_normal_long => 'Normalny';

  @override
  String get sensor_enum_gas_status_warning => 'Ostrz.';

  @override
  String get sensor_enum_gas_status_warning_long => 'Ostrzeżenie';

  @override
  String get sensor_enum_gas_status_alarm => 'Alarm';

  @override
  String get sensor_enum_gas_status_alarm_long => 'Alarm gazowy';

  @override
  String get sensor_enum_leak_level_low => 'Niski';

  @override
  String get sensor_enum_leak_level_low_long => 'Mały wyciek';

  @override
  String get sensor_enum_leak_level_medium => 'Śr.';

  @override
  String get sensor_enum_leak_level_medium_long => 'Średni wyciek';

  @override
  String get sensor_enum_leak_level_high => 'Wys.';

  @override
  String get sensor_enum_leak_level_high_long => 'Poważny wyciek';

  @override
  String get sensor_enum_battery_level_critical => 'Kryt.';

  @override
  String get sensor_enum_battery_level_critical_long => 'Krytyczny';

  @override
  String get sensor_enum_battery_level_low => 'Niski';

  @override
  String get sensor_enum_battery_level_low_long => 'Niski';

  @override
  String get sensor_enum_battery_level_medium => 'Śr.';

  @override
  String get sensor_enum_battery_level_medium_long => 'Średni';

  @override
  String get sensor_enum_battery_level_high => 'Wys.';

  @override
  String get sensor_enum_battery_level_high_long => 'Wysoki';

  @override
  String get sensor_enum_battery_level_full => 'Pełny';

  @override
  String get sensor_enum_battery_level_full_long => 'Pełny';

  @override
  String get sensor_enum_battery_status_ok => 'OK';

  @override
  String get sensor_enum_battery_status_ok_long => 'Bateria OK';

  @override
  String get sensor_enum_battery_status_low => 'Niska';

  @override
  String get sensor_enum_battery_status_low_long => 'Niska bateria';

  @override
  String get sensor_enum_battery_status_charging => 'Ład.';

  @override
  String get sensor_enum_battery_status_charging_long => 'Ładowanie';

  @override
  String get sensor_enum_alarm_alarm_idle => 'Spokój';

  @override
  String get sensor_enum_alarm_alarm_idle_long => 'Alarm w spoczynku';

  @override
  String get sensor_enum_alarm_alarm_pending => 'Oczek.';

  @override
  String get sensor_enum_alarm_alarm_pending_long => 'Alarm oczekuje';

  @override
  String get sensor_enum_alarm_alarm_triggered => 'Wyzw.';

  @override
  String get sensor_enum_alarm_alarm_triggered_long => 'Alarm wyzwolony';

  @override
  String get sensor_enum_alarm_alarm_silenced => 'Wycisz.';

  @override
  String get sensor_enum_alarm_alarm_silenced_long => 'Alarm wyciszony';

  @override
  String get sensor_enum_alarm_disarmed => 'Wył.';

  @override
  String get sensor_enum_alarm_disarmed_long => 'Wyłączony';

  @override
  String get sensor_enum_alarm_armed_home => 'Dom';

  @override
  String get sensor_enum_alarm_armed_home_long => 'Uzbrojony dom';

  @override
  String get sensor_enum_alarm_armed_away => 'Poza';

  @override
  String get sensor_enum_alarm_armed_away_long => 'Uzbrojony poza domem';

  @override
  String get sensor_enum_alarm_armed_night => 'Noc';

  @override
  String get sensor_enum_alarm_armed_night_long => 'Uzbrojony noc';

  @override
  String get sensor_enum_filter_good => 'Dobry';

  @override
  String get sensor_enum_filter_good_long => 'Filtr dobry';

  @override
  String get sensor_enum_filter_replace_soon => 'Wkrótce';

  @override
  String get sensor_enum_filter_replace_soon_long => 'Wkrótce wymienić';

  @override
  String get sensor_enum_filter_replace_now => 'Teraz!';

  @override
  String get sensor_enum_filter_replace_now_long => 'Wymień teraz';

  @override
  String get sensor_enum_door_opened => 'Otw.';

  @override
  String get sensor_enum_door_opened_long => 'Drzwi otwarte';

  @override
  String get sensor_enum_door_closed => 'Zamk.';

  @override
  String get sensor_enum_door_closed_long => 'Drzwi zamknięte';

  @override
  String get sensor_enum_door_opening => 'Otw.';

  @override
  String get sensor_enum_door_opening_long => 'Drzwi się otwierają';

  @override
  String get sensor_enum_door_closing => 'Zamyk.';

  @override
  String get sensor_enum_door_closing_long => 'Drzwi się zamykają';

  @override
  String get sensor_enum_door_stopped => 'Stop';

  @override
  String get sensor_enum_door_stopped_long => 'Drzwi zatrzymane';

  @override
  String get sensor_enum_lock_locked => 'Zamk.';

  @override
  String get sensor_enum_lock_locked_long => 'Zamknięte';

  @override
  String get sensor_enum_lock_unlocked => 'Otw.';

  @override
  String get sensor_enum_lock_unlocked_long => 'Odblokowane';

  @override
  String get sensor_enum_camera_available => 'Wł.';

  @override
  String get sensor_enum_camera_available_long => 'Kamera dostępna';

  @override
  String get sensor_enum_camera_in_use => 'Uż.';

  @override
  String get sensor_enum_camera_in_use_long => 'Kamera w użyciu';

  @override
  String get sensor_enum_camera_unavailable => 'N/D';

  @override
  String get sensor_enum_camera_unavailable_long => 'Kamera niedostępna';

  @override
  String get sensor_enum_camera_offline => 'Wył.';

  @override
  String get sensor_enum_camera_offline_long => 'Kamera offline';

  @override
  String get sensor_enum_camera_initializing => 'Init';

  @override
  String get sensor_enum_camera_initializing_long => 'Kamera się inicjalizuje';

  @override
  String get sensor_enum_camera_error => 'Błąd';

  @override
  String get sensor_enum_camera_error_long => 'Błąd kamery';

  @override
  String get sensor_enum_device_info_connected => 'Wł.';

  @override
  String get sensor_enum_device_info_connected_long => 'Połączono';

  @override
  String get sensor_enum_device_info_disconnected => 'Wył.';

  @override
  String get sensor_enum_device_info_disconnected_long => 'Rozłączono';

  @override
  String get sensor_enum_device_info_init => 'Init';

  @override
  String get sensor_enum_device_info_init_long => 'Inicjalizacja';

  @override
  String get sensor_enum_device_info_ready => 'Got.';

  @override
  String get sensor_enum_device_info_ready_long => 'Gotowe';

  @override
  String get sensor_enum_device_info_running => 'Działa';

  @override
  String get sensor_enum_device_info_running_long => 'Działa';

  @override
  String get sensor_enum_device_info_sleeping => 'Uśp.';

  @override
  String get sensor_enum_device_info_sleeping_long => 'Uśpione';

  @override
  String get sensor_enum_device_info_stopped => 'Stop';

  @override
  String get sensor_enum_device_info_stopped_long => 'Zatrzymano';

  @override
  String get sensor_enum_device_info_lost => 'Utr.';

  @override
  String get sensor_enum_device_info_lost_long => 'Utracono połączenie';

  @override
  String get sensor_enum_device_info_alert => 'Alert';

  @override
  String get sensor_enum_device_info_alert_long => 'Alert';

  @override
  String get sensor_enum_device_info_unknown => 'N/D';

  @override
  String get sensor_enum_device_info_unknown_long => 'Nieznany';

  @override
  String get sensor_freshness_live => 'Na żywo';

  @override
  String get sensor_freshness_stale => 'Nieaktualne';

  @override
  String get sensor_freshness_offline => 'Offline';

  @override
  String get media_input_hdmi1 => 'HDMI 1';

  @override
  String get media_input_hdmi2 => 'HDMI 2';

  @override
  String get media_input_hdmi3 => 'HDMI 3';

  @override
  String get media_input_hdmi4 => 'HDMI 4';

  @override
  String get media_input_hdmi5 => 'HDMI 5';

  @override
  String get media_input_hdmi6 => 'HDMI 6';

  @override
  String get media_input_arc => 'ARC';

  @override
  String get media_input_earc => 'eARC';

  @override
  String get media_input_tv => 'TV';

  @override
  String get media_input_cable => 'Kablówka';

  @override
  String get media_input_satellite => 'Satelita';

  @override
  String get media_input_antenna => 'Antena';

  @override
  String get media_input_av1 => 'AV 1';

  @override
  String get media_input_av2 => 'AV 2';

  @override
  String get media_input_component => 'Komponentowe';

  @override
  String get media_input_vga => 'VGA';

  @override
  String get media_input_dvi => 'DVI';

  @override
  String get media_input_usb => 'USB';

  @override
  String get media_input_bluetooth => 'Bluetooth';

  @override
  String get media_input_wifi => 'Wi-Fi';

  @override
  String get media_input_airplay => 'AirPlay';

  @override
  String get media_input_cast => 'Chromecast';

  @override
  String get media_input_dlna => 'DLNA';

  @override
  String get media_input_miracast => 'Miracast';

  @override
  String get media_input_app_netflix => 'Netflix';

  @override
  String get media_input_app_youtube => 'YouTube';

  @override
  String get media_input_app_spotify => 'Spotify';

  @override
  String get media_input_app_prime_video => 'Prime Video';

  @override
  String get media_input_app_disney_plus => 'Disney+';

  @override
  String get media_input_app_hbo_max => 'HBO Max';

  @override
  String get media_input_app_apple_tv => 'Apple TV';

  @override
  String get media_input_app_plex => 'Plex';

  @override
  String get media_input_app_kodi => 'Kodi';

  @override
  String get media_input_other => 'Inne';

  @override
  String get media_off_title => 'Multimedia wyłączone';

  @override
  String get media_off_subtitle => 'Wybierz aktywność, aby rozpocząć';

  @override
  String get media_not_configured_title => 'Multimedia nie skonfigurowane';

  @override
  String get media_not_configured_description => 'Aktywności multimedialne nie zostały ustawione dla tego pokoju. Skonfiguruj powiązania aktywności w administracji.';

  @override
  String media_starting_activity(String activityName) {
    return 'Uruchamianie $activityName...';
  }

  @override
  String media_activity_failed(String activityName) {
    return '$activityName nie powiodło się';
  }

  @override
  String get media_activity_failed_description => 'Nie udało się zastosować aktywności. Sprawdź połączenie urządzeń.';

  @override
  String get media_activity_retry => 'Ponów';

  @override
  String get media_activity_turn_off => 'Wyłącz';

  @override
  String get media_warning_audio_offline => 'Wyjście audio offline — używane głośniki wyświetlacza';

  @override
  String get media_warning_some_devices_offline => 'Niektóre urządzenia są offline';

  @override
  String media_warning_steps_failed(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'ostrzeżeń',
      many: 'ostrzeżeń',
      few: 'ostrzeżenia',
      one: 'ostrzeżenie',
    );
    return 'Niektóre kroki nie powiodły się ($count $_temp0)';
  }

  @override
  String get media_warning_steps_had_issues => 'Niektóre kroki miały problemy';

  @override
  String get media_remote => 'Pilot';

  @override
  String get media_remote_control => 'Pilot zdalny';

  @override
  String media_volume_percent(int volume) {
    return '$volume%';
  }

  @override
  String get media_failure_details_title => 'Szczegóły aktywacji';

  @override
  String get media_failure_summary_total => 'Razem';

  @override
  String get media_failure_summary_ok => 'OK';

  @override
  String get media_failure_summary_errors => 'Błędy';

  @override
  String get media_failure_summary_warnings => 'Ostrzeżenia';

  @override
  String get media_failure_errors_critical => 'Błędy (krytyczne)';

  @override
  String get media_failure_warnings_non_critical => 'Ostrzeżenia (niekrytyczne)';

  @override
  String get media_failure_warnings_label => 'Ostrzeżenia';

  @override
  String get media_failure_retry_activity => 'Ponów aktywność';

  @override
  String get media_failure_deactivate => 'Dezaktywuj';

  @override
  String media_failure_device_label(String deviceId) {
    return 'Urządzenie: $deviceId';
  }

  @override
  String media_failure_inline(int errors, int warnings) {
    String _temp0 = intl.Intl.pluralLogic(
      errors,
      locale: localeName,
      other: 'błędów',
      many: 'błędów',
      few: 'błędy',
      one: 'błąd',
    );
    String _temp1 = intl.Intl.pluralLogic(
      warnings,
      locale: localeName,
      other: 'ostrzeżeń',
      many: 'ostrzeżeń',
      few: 'ostrzeżenia',
      one: 'ostrzeżenie',
    );
    return 'Nie udało się zastosować aktywności ($errors $_temp0, $warnings $_temp1)';
  }

  @override
  String get media_activity_watch => 'Oglądaj';

  @override
  String get media_activity_listen => 'Słuchaj';

  @override
  String get media_activity_gaming => 'Gry';

  @override
  String get media_activity_background => 'Tło';

  @override
  String get media_activity_off => 'Wył';

  @override
  String media_activity_active(String activityName) {
    return '$activityName aktywne';
  }

  @override
  String get media_status_standby => 'Gotowość';

  @override
  String get media_status_activating => 'Aktywacja...';

  @override
  String get media_status_failed => 'Błąd';

  @override
  String get media_status_stopping => 'Zatrzymywanie...';

  @override
  String get media_status_active_with_issues => 'Aktywne z problemami';

  @override
  String get media_status_active => 'Aktywne';

  @override
  String get media_status_ready => 'Gotowe';

  @override
  String get media_remote_up => 'Góra';

  @override
  String get media_remote_down => 'Dół';

  @override
  String get media_remote_left => 'Lewo';

  @override
  String get media_remote_right => 'Prawo';

  @override
  String get media_remote_ok => 'OK';

  @override
  String get media_remote_back => 'Wstecz';

  @override
  String get media_remote_exit => 'Wyjście';

  @override
  String get media_remote_info => 'Info';

  @override
  String get media_remote_rewind => 'Przewiń';

  @override
  String get media_remote_fast_forward => 'Do przodu';

  @override
  String get media_remote_play => 'Odtwórz';

  @override
  String get media_remote_pause => 'Pauza';

  @override
  String get media_remote_next => 'Następny';

  @override
  String get media_remote_prev => 'Poprz.';

  @override
  String get media_detail_connection_lost => 'Utracono połączenie';

  @override
  String get media_detail_connection_lost_description => 'Sterowanie multimediami wymaga aktywnego połączenia WebSocket.';

  @override
  String get media_detail_go_back => 'Wróć';

  @override
  String get media_detail_section_display => 'Wyświetlacz';

  @override
  String get media_detail_section_audio => 'Audio';

  @override
  String get media_detail_section_source => 'Źródło';

  @override
  String get media_detail_section_remote => 'Pilot';

  @override
  String get media_detail_input => 'Wejście';

  @override
  String get media_detail_select => 'Wybierz';

  @override
  String get media_detail_now_playing => 'Teraz odtwarzane';

  @override
  String get media_detail_no_track_info => 'Brak informacji o utworze';

  @override
  String get media_detail_home => 'Strona główna';

  @override
  String get media_detail_menu => 'Menu';

  @override
  String get media_playback => 'Odtwarzanie';

  @override
  String get filter_all => 'Wszystko';

  @override
  String sensor_alert_high_title(String name) {
    return 'Wysoka wartość $name';
  }

  @override
  String sensor_alert_exceeded_threshold(String name) {
    return '$name przekroczyło próg';
  }

  @override
  String get sensor_state_detected => 'Wykryto';

  @override
  String get sensor_state_not_detected => 'Nie wykryto';

  @override
  String get sensor_state_clear => 'W porządku';

  @override
  String get sensor_state_open => 'Otwarte';

  @override
  String get sensor_state_closed => 'Zamknięte';

  @override
  String get sensor_state_active => 'Aktywne';

  @override
  String get sensor_state_inactive => 'Nieaktywne';

  @override
  String get sensor_state_occupied => 'Zajęte';

  @override
  String get sensor_state_unoccupied => 'Wolne';

  @override
  String get sensor_state_smoke_detected => 'Wykryto dym';

  @override
  String get sensor_state_gas_detected => 'Wykryto gaz';

  @override
  String get sensor_state_leak_detected => 'Wykryto wyciek';

  @override
  String get sensor_state_co_detected => 'Wykryto CO';

  @override
  String get sensor_label_temperature => 'Temperatura';

  @override
  String get sensor_label_humidity => 'Wilgotność';

  @override
  String get sensor_label_pressure => 'Ciśnienie';

  @override
  String get sensor_label_illuminance => 'Oświetlenie';

  @override
  String get sensor_label_carbon_dioxide => 'Dwutlenek węgla';

  @override
  String get sensor_label_carbon_monoxide => 'Tlenek węgla';

  @override
  String get sensor_label_ozone => 'Ozon';

  @override
  String get sensor_label_nitrogen_dioxide => 'Dwutlenek azotu';

  @override
  String get sensor_label_sulphur_dioxide => 'Dwutlenek siarki';

  @override
  String get sensor_label_voc => 'VOC';

  @override
  String get sensor_label_particulate_matter => 'Pyły zawieszone';

  @override
  String get sensor_label_motion => 'Ruch';

  @override
  String get sensor_label_occupancy => 'Obecność';

  @override
  String get sensor_label_contact => 'Kontakt';

  @override
  String get sensor_label_leak => 'Wyciek';

  @override
  String get sensor_label_smoke => 'Dym';

  @override
  String get sensor_label_battery => 'Bateria';

  @override
  String get sensor_label_alarm => 'Alarm';

  @override
  String get sensor_label_door => 'Drzwi';

  @override
  String get sensor_label_lock => 'Zamek';

  @override
  String get sensor_label_camera => 'Kamera';

  @override
  String get sensor_label_filter => 'Filtr';

  @override
  String get sensor_label_device_info => 'Info o urządzeniu';

  @override
  String get sensor_label_gas => 'Gaz';

  @override
  String get sensor_label_electrical_energy => 'Energia';

  @override
  String get sensor_label_electrical_generation => 'Produkcja';

  @override
  String get sensor_label_electrical_power => 'Moc';

  @override
  String get sensor_alert_high_level => 'Wysoki poziom';

  @override
  String get sensor_alert_low_battery => 'Słaba bateria';

  @override
  String get sensor_alert_charging => 'Ładowanie';

  @override
  String get sensor_category_temperature => 'Temperatura';

  @override
  String get sensor_category_humidity => 'Wilgotność';

  @override
  String get sensor_category_air_quality => 'Jakość powietrza';

  @override
  String get sensor_category_motion => 'Ruch';

  @override
  String get sensor_category_safety => 'Bezpieczeństwo';

  @override
  String get sensor_category_light => 'Światło';

  @override
  String get sensor_category_energy => 'Energia';

  @override
  String get sensor_ui_event_log => 'Dziennik zdarzeń';

  @override
  String get sensor_ui_history => 'Historia';

  @override
  String get sensor_ui_current => 'Aktualne';

  @override
  String sensor_ui_current_value(String name) {
    return 'Aktualna wartość $name';
  }

  @override
  String get sensor_ui_min => 'Min';

  @override
  String get sensor_ui_max => 'Maks';

  @override
  String get sensor_ui_avg => 'Śr';

  @override
  String sensor_ui_period_min(String period) {
    return '$period Min';
  }

  @override
  String sensor_ui_period_max(String period) {
    return '$period Maks';
  }

  @override
  String sensor_ui_period_avg(String period) {
    return '$period Śr';
  }

  @override
  String get sensor_ui_online => 'Online';

  @override
  String get sensor_ui_offline => 'Offline';

  @override
  String get sensor_ui_period_1h => '1H';

  @override
  String get sensor_ui_period_24h => '24H';

  @override
  String get sensor_ui_period_7d => '7D';

  @override
  String get sensor_ui_period_30d => '30D';

  @override
  String get sensor_empty_no_events => 'Brak zarejestrowanych zdarzeń';

  @override
  String get sensor_empty_no_state_changes => 'Brak zmian stanu';

  @override
  String get sensor_empty_no_history => 'Brak danych historycznych';

  @override
  String get sensor_empty_no_data => 'Brak danych';

  @override
  String get sensor_status_loading => 'Ładowanie danych...';

  @override
  String get sensor_status_failed => 'Nie udało się załadować danych';

  @override
  String get sensor_status_retry => 'Ponów';

  @override
  String get sensors_domain_title => 'Czujniki';

  @override
  String get sensors_domain_empty_title => 'Czujniki nie skonfigurowane';

  @override
  String get sensors_domain_empty_description => 'Role czujników nie zostały ustawione dla tego pokoju. Skonfiguruj przypisania czujników w administracji.';

  @override
  String sensors_domain_alerts_active(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Aktywnych alertów',
      many: 'Aktywnych alertów',
      few: 'Aktywne alerty',
      one: 'Aktywny alert',
    );
    return '$_temp0';
  }

  @override
  String get sensors_domain_no_summary => 'Brak danych o środowisku';

  @override
  String get sensors_domain_no_sensors => 'Brak skonfigurowanych czujników';

  @override
  String sensors_domain_health_stale(int count) {
    return '$count nieaktualnych';
  }

  @override
  String sensors_domain_health_offline(int count) {
    return '$count offline';
  }

  @override
  String get sensors_domain_health_normal => 'Wszystko w porządku';

  @override
  String get sensors_domain_avg_temperature => 'Średnia temperatura';

  @override
  String get sensors_domain_avg_humidity => 'Średnia wilgotność';

  @override
  String get sensors_domain_all_sensors => 'Wszystkie czujniki';

  @override
  String sensors_domain_sensor_count(int count) {
    return '$count czujników';
  }

  @override
  String get domain_security => 'Bezpieczeństwo';

  @override
  String get security_tab_entry_points => 'Punkty wejścia';

  @override
  String get security_tab_alerts => 'Alerty';

  @override
  String get security_tab_events => 'Zdarzenia';

  @override
  String get security_header_recent_events => 'Ostatnie zdarzenia';

  @override
  String get security_status_triggered => 'Wyzwolony';

  @override
  String get security_status_warning => 'Ostrzeżenie';

  @override
  String get security_status_secure => 'Zabezpieczony';

  @override
  String get security_armed_disarmed => 'Rozbrojony';

  @override
  String get security_armed_home => 'Uzbrojony dom';

  @override
  String get security_armed_away => 'Uzbrojony poza domem';

  @override
  String get security_armed_night => 'Uzbrojony noc';

  @override
  String get security_armed_unknown => 'Nieznany';

  @override
  String get security_alarm_idle => 'Bezczynny';

  @override
  String get security_alarm_pending => 'Oczekujący';

  @override
  String get security_alarm_triggered => 'Wyzwolony';

  @override
  String get security_alarm_silenced => 'Wyciszony';

  @override
  String get security_alarm_unknown => 'Nieznany';

  @override
  String security_entry_open_count(int count) {
    return '$count otwartych';
  }

  @override
  String get security_entry_all_secure => 'Wszystko zabezpieczone';

  @override
  String get security_entry_status_breach => 'Włamanie';

  @override
  String get security_entry_status_open => 'Otwarte';

  @override
  String get security_entry_status_unknown => 'Nieznany';

  @override
  String get security_entry_status_closed => 'Zamknięte';

  @override
  String security_summary_all_clear(int count) {
    return 'Wszystko w porządku · $count punktów wejścia zabezpieczonych';
  }

  @override
  String security_summary_alerts(int count) {
    return '$count alertów';
  }

  @override
  String get security_summary_alerts_label => 'Alerty';

  @override
  String security_summary_entry_points_open(int count) {
    return '$count punktów wejścia otwartych';
  }

  @override
  String get security_summary_open_label => 'Otwarte';

  @override
  String get security_no_active_alerts => 'Brak aktywnych alertów';

  @override
  String get security_ack_all => 'Potwierdź wszystkie';

  @override
  String get security_no_recent_events => 'Brak ostatnich zdarzeń';

  @override
  String get security_events_load_failed => 'Nie udało się załadować zdarzeń';

  @override
  String get security_retry => 'Ponów';

  @override
  String get security_alert_type_intrusion => 'Wykryto włamanie';

  @override
  String get security_alert_type_entry_open => 'Wejście otwarte';

  @override
  String get security_alert_type_smoke => 'Wykryto dym';

  @override
  String get security_alert_type_co => 'Wykryto CO';

  @override
  String get security_alert_type_water_leak => 'Wyciek wody';

  @override
  String get security_alert_type_gas => 'Wykryto gaz';

  @override
  String get security_alert_type_tamper => 'Wykryto manipulację';

  @override
  String get security_alert_type_fault => 'Awaria systemu';

  @override
  String get security_alert_type_device_offline => 'Urządzenie offline';

  @override
  String get security_alert_type_unknown => 'Nieznany';

  @override
  String get security_event_alert_raised => 'Alert wywołany';

  @override
  String get security_event_alert_resolved => 'Alert rozwiązany';

  @override
  String get security_event_alert_acknowledged => 'Alert potwierdzony';

  @override
  String get security_event_alarm_state_changed => 'Stan alarmu zmieniony';

  @override
  String get security_event_arming_mode_changed => 'Tryb uzbrojenia zmieniony';

  @override
  String security_event_title_alert_raised(String alertType) {
    return 'Alert wywołany: $alertType';
  }

  @override
  String security_event_title_alert_resolved(String alertType) {
    return 'Alert rozwiązany: $alertType';
  }

  @override
  String security_event_title_alert_acknowledged(String alertType) {
    return 'Alert potwierdzony: $alertType';
  }

  @override
  String security_event_title_alarm_state_changed(String from, String to) {
    return 'Stan alarmu zmieniony: $from → $to';
  }

  @override
  String security_event_title_arming_mode_changed(String from, String to) {
    return 'Tryb uzbrojenia zmieniony: $from → $to';
  }

  @override
  String security_state_transition(String from, String to) {
    return '$from → $to';
  }

  @override
  String get security_state_unknown => 'nieznany';

  @override
  String get security_overlay_alarm_triggered => 'Alarm wyzwolony';

  @override
  String get security_overlay_default_title => 'Alert bezpieczeństwa';

  @override
  String get security_overlay_acknowledge => 'Potwierdź';

  @override
  String get security_overlay_open_security => 'Otwórz bezpieczeństwo';

  @override
  String security_overlay_more_alerts(int count) {
    return '+$count więcej alertów';
  }

  @override
  String get room_overview_no_room => 'Do tego wyświetlacza nie przypisano pokoju';

  @override
  String get room_overview_display_not_configured => 'Wyświetlacz nie jest skonfigurowany';

  @override
  String get room_overview_load_failed => 'Nie udało się załadować danych pokoju';

  @override
  String room_overview_lights_active(int lightsOn, int totalLights) {
    return '$lightsOn z $totalLights aktywnych';
  }

  @override
  String room_overview_light_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count świateł',
      many: '$count świateł',
      few: '$count światła',
      one: '1 światło',
    );
    return '$_temp0';
  }

  @override
  String room_overview_device_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count urządzeń',
      many: '$count urządzeń',
      few: '$count urządzenia',
      one: '1 urządzenie',
    );
    return '$_temp0';
  }

  @override
  String room_overview_reading_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count odczytów',
      many: '$count odczytów',
      few: '$count odczyty',
      one: '1 odczyt',
    );
    return '$_temp0';
  }

  @override
  String get room_overview_action_failed => 'Akcja nie powiodła się';

  @override
  String get suggested_action_turn_off_lights => 'Wyłącz światła';

  @override
  String get suggested_action_movie_mode => 'Tryb filmowy';

  @override
  String get suggested_action_night_mode => 'Tryb nocny';

  @override
  String get shading_fully_closed => 'Całkowicie zamknięte';

  @override
  String get shading_fully_open => 'Całkowicie otwarte';

  @override
  String get sensor_label_light => 'Światło';

  @override
  String get settings_save_failed => 'Nie udało się zapisać ustawień.';

  @override
  String get settings_about_version_loading => 'Ładowanie...';

  @override
  String get app_error_failed_to_start => 'Nie udało się uruchomić aplikacji';

  @override
  String get app_error_failed_to_start_short => 'Błąd uruchomienia';

  @override
  String get app_error_unexpected => 'Podczas uruchamiania aplikacji wystąpił nieoczekiwany błąd.';

  @override
  String get app_error_see_details => 'Wystąpił błąd. Szczegóły poniżej.';

  @override
  String get app_error_restart_button => 'Uruchom ponownie aplikację';

  @override
  String get app_error_permit_join_hint => 'Poproś administratora o aktywację \"Permit Join\" w administracji, a następnie uruchom ponownie aplikację.';

  @override
  String get app_error_connection_failed_stored => 'Nie udało się połączyć z zapisanym serwerem.';

  @override
  String app_error_connection_failed_backend(String name, String address) {
    return 'Nie udało się połączyć z $name pod adresem $address';
  }

  @override
  String get app_error_initialization_failed => 'Nie udało się zainicjalizować połączenia z serwerem.';

  @override
  String app_error_connection_failed_url(String url) {
    return 'Nie udało się połączyć z $url';
  }

  @override
  String get deck_empty_title => 'Brak skonfigurowanych stron';

  @override
  String get deck_empty_description => 'Skonfiguruj pulpit w administracji.';

  @override
  String get alert_banner_view_button => 'Wyświetl';

  @override
  String get sensor_chart_label_now => 'Teraz';

  @override
  String get room_name_fallback => 'Pokój';

  @override
  String get weather_tile_not_configured => 'Nie skonfigurowano';

  @override
  String get entry_error_load_security_data => 'Nie udało się załadować danych bezpieczeństwa';

  @override
  String get entry_locks_all_locked => 'Wszystko zamknięte';

  @override
  String entry_locks_status_partial(int locked, int total) {
    return '$locked/$total zamkniętych';
  }

  @override
  String get entry_alarm_armed => 'Uzbrojony';

  @override
  String get entry_alarm_disarmed => 'Rozbrojony';

  @override
  String entry_cameras_status_active(int count) {
    return '$count aktywnych';
  }

  @override
  String get master_error_load_house_data => 'Nie udało się załadować danych domu';

  @override
  String master_room_device_count(int online, int total) {
    return '$online/$total urządzeń';
  }

  @override
  String get buddy_dismiss => 'Zamknij';

  @override
  String get buddy_apply => 'Zastosuj';

  @override
  String get buddy_got_it => 'Rozumiem';

  @override
  String get buddy_empty_state_message => 'Zapytaj mnie o cokolwiek dotyczącego Twojego domu!';

  @override
  String get buddy_init_failed_message => 'Nie udało się rozpocząć rozmowy';

  @override
  String get buddy_provider_not_configured_title => 'Dostawca AI nie jest skonfigurowany';

  @override
  String get buddy_provider_not_configured_description => 'Skonfiguruj dostawcę AI w administracji, aby włączyć czat.';

  @override
  String get buddy_thinking => 'Myślę...';

  @override
  String get buddy_hint_init_failed => 'Nie udało się rozpocząć rozmowy';

  @override
  String get buddy_hint_starting_conversation => 'Rozpoczynam rozmowę...';

  @override
  String get buddy_hint_default => 'Zapytaj o swój dom...';

  @override
  String get buddy_error_load_conversations => 'Nie udało się załadować rozmów';

  @override
  String get buddy_error_create_conversation => 'Nie udało się utworzyć rozmowy';

  @override
  String get buddy_error_load_messages => 'Nie udało się załadować wiadomości';

  @override
  String get buddy_error_send_message => 'Nie udało się wysłać wiadomości';

  @override
  String get buddy_error_provider_not_configured => 'Dostawca AI nie jest skonfigurowany';

  @override
  String get buddy_error_request_timeout => 'Upłynął limit czasu żądania. Spróbuj ponownie.';

  @override
  String get buddy_error_connection_error => 'Błąd połączenia. Sprawdź sieć.';

  @override
  String get buddy_error_generic => 'Coś poszło nie tak. Spróbuj ponownie.';

  @override
  String get buddy_hint_recording => 'Nagrywanie dźwięku...';

  @override
  String buddy_recording_progress(int seconds, int maxSeconds) {
    return 'Nagrywanie... ${seconds}s / ${maxSeconds}s';
  }

  @override
  String get buddy_recording_cancel => 'Anuluj';

  @override
  String get buddy_recording_too_short => 'Nagranie jest zbyt krótkie. Przytrzymaj dłużej.';

  @override
  String get buddy_recording_permission_error => 'Nie można rozpocząć nagrywania. Sprawdź uprawnienia mikrofonu.';

  @override
  String get buddy_voice_listening => 'Nasłuchuję...';

  @override
  String buddy_voice_recording_timer(int seconds, int maxSeconds) {
    return '${seconds}s / ${maxSeconds}s';
  }

  @override
  String buddy_voice_recording_progress(int seconds, int maxSeconds) {
    return 'Nagrywanie ${seconds}s / ${maxSeconds}s';
  }

  @override
  String get buddy_voice_processing => 'Przetwarzam...';

  @override
  String get buddy_voice_transcribing => 'Transkrybuję dźwięk...';

  @override
  String get security_events_error_unexpected_response => 'Nieoczekiwana odpowiedź';

  @override
  String media_activation_step_fallback(int index) {
    return 'Krok $index';
  }

  @override
  String get intent_error_deck_not_initialized => 'Deck nie jest zainicjalizowany';

  @override
  String get intent_error_deck_item_not_found => 'Nie znaleziono elementu decku';

  @override
  String get intent_error_no_home_item => 'Element strony głównej niedostępny';

  @override
  String get intent_error_scenes_not_available => 'Usługa scen niedostępna';

  @override
  String get intent_error_scene_activation_failed => 'Nie udało się aktywować sceny';

  @override
  String get intent_error_scene_activation_error => 'Błąd podczas aktywacji sceny';

  @override
  String get intent_error_device_repo_not_available => 'Repozytorium właściwości urządzeń niedostępne';

  @override
  String get intent_error_set_property_failed => 'Nie udało się ustawić wartości właściwości';

  @override
  String get intent_error_set_property_error => 'Błąd podczas ustawiania wartości właściwości';

  @override
  String get intent_error_toggle_device_failed => 'Nie udało się przełączyć urządzenia';

  @override
  String get intent_error_toggle_device_error => 'Błąd podczas przełączania urządzenia';

  @override
  String get settings_display_screen_lock_never => 'Nigdy';
}

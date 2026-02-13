import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Czech (`cs`).
class AppLocalizationsCs extends AppLocalizations {
  AppLocalizationsCs([String locale = 'cs']) : super(locale);

  @override
  String get value_not_available => 'N/A';

  @override
  String get value_not_set => 'Nenastaveno';

  @override
  String get value_loading => 'Načítání';

  @override
  String get information => 'Informace';

  @override
  String get warning => 'Varování';

  @override
  String get error => 'Chyba';

  @override
  String get action_failed => 'Akci se nepodařilo zpracovat';

  @override
  String get action_retry => 'Retry';

  @override
  String domain_data_load_failed(String domain) {
    return 'Failed to load $domain';
  }

  @override
  String get domain_data_load_failed_description => 'Unable to retrieve data. Please check your connection and try again.';

  @override
  String get services_not_available => 'Služby nejsou k dispozici';

  @override
  String get button_ok => 'OK';

  @override
  String get button_cancel => 'Zrušit';

  @override
  String get button_close => 'Zavřít';

  @override
  String get button_confirm => 'Potvrdit';

  @override
  String get button_done => 'Hotovo';

  @override
  String get unit_celsius => 'Celsia';

  @override
  String get unit_fahrenheit => 'Fahrenheit';

  @override
  String get time_format_12h => '12 hodinový';

  @override
  String get time_format_24h => '24 hodinový';

  @override
  String get day_monday => 'Pondělí';

  @override
  String get day_tuesday => 'Úterý';

  @override
  String get day_wednesday => 'Středa';

  @override
  String get day_thursday => 'Čtvrtek';

  @override
  String get day_friday => 'Pátek';

  @override
  String get day_saturday => 'Sobota';

  @override
  String get day_sunday => 'Neděle';

  @override
  String get day_monday_short => 'Po';

  @override
  String get day_tuesday_short => 'Út';

  @override
  String get day_wednesday_short => 'St';

  @override
  String get day_thursday_short => 'Čt';

  @override
  String get day_friday_short => 'Pá';

  @override
  String get day_saturday_short => 'So';

  @override
  String get day_sunday_short => 'Ne';

  @override
  String get message_error_tiles_not_configured_title => 'Žádné dlaždice nejsou nakonfigurovány!';

  @override
  String get message_error_tiles_not_configured_description => 'Nakonfigurujte alespoň jednu dlaždici na obrazovce.';

  @override
  String get message_error_cards_not_configured_title => 'Žádné karty nejsou nakonfigurovány!';

  @override
  String get message_error_cards_not_configured_description => 'Nakonfigurujte alespoň jednu kartu na obrazovce.';

  @override
  String get message_error_device_not_found_title => 'Zařízení nenalezeno!';

  @override
  String get message_error_device_not_found_description => 'Požadované zařízení nebylo nalezeno v aplikaci.';

  @override
  String get message_error_no_device_detail_title => 'Žádné podrobnosti o zařízení!';

  @override
  String get message_error_no_device_detail_description => 'Pro vybrané zařízení není k dispozici stránka s podrobnostmi.';

  @override
  String get message_error_no_device_detail_preparing_title => 'Podrobnosti o zařízení nejsou připraveny!';

  @override
  String get message_error_no_device_detail_preparing_description => 'Pro vybrané zařízení stránka s podrobnostmi ještě není připravena.';

  @override
  String get device_status_offline => 'Offline';

  @override
  String get device_offline_message => 'Zařízení je offline';

  @override
  String get device_offline_title => 'Zařízení je offline';

  @override
  String get device_offline_description => 'Nelze komunikovat s tímto zařízením. Zkontrolujte, zda je zařízení zapnuté a připojené k síti.';

  @override
  String get device_offline_retry => 'Zkusit znovu';

  @override
  String device_offline_last_seen(String time) {
    return 'Naposledy viděno $time';
  }

  @override
  String devices_offline_skipped(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Přeskočeno $count offline zařízení',
      few: 'Přeskočena $count offline zařízení',
      one: 'Přeskočeno 1 offline zařízení',
    );
    return '$_temp0';
  }

  @override
  String get all_devices_offline => 'Všechna zařízení jsou offline';

  @override
  String get time_ago_just_now => 'právě teď';

  @override
  String time_ago_minutes(int count) {
    return 'před $count min';
  }

  @override
  String time_ago_hours(int count) {
    return 'před $count h';
  }

  @override
  String time_ago_days(int count) {
    return 'před $count d';
  }

  @override
  String time_ago_medium_minutes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'před $count minutami',
      few: 'před $count minutami',
      one: 'před 1 minutou',
    );
    return '$_temp0';
  }

  @override
  String time_ago_medium_hours(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'před $count hodinami',
      few: 'před $count hodinami',
      one: 'před 1 hodinou',
    );
    return '$_temp0';
  }

  @override
  String time_ago_medium_days(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'před $count dny',
      few: 'před $count dny',
      one: 'před 1 dnem',
    );
    return '$_temp0';
  }

  @override
  String time_ago_full_minutes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'před $count minutami',
      few: 'před $count minutami',
      one: 'před 1 minutou',
    );
    return '$_temp0';
  }

  @override
  String time_ago_full_hours_minutes(int hours, int minutes) {
    String _temp0 = intl.Intl.pluralLogic(
      hours,
      locale: localeName,
      other: '$hours hodinami',
      few: '$hours hodinami',
      one: '1 hodinou',
    );
    String _temp1 = intl.Intl.pluralLogic(
      minutes,
      locale: localeName,
      other: '$minutes minutami',
      few: '$minutes minutami',
      one: '1 minutou',
    );
    return 'před $_temp0 $_temp1';
  }

  @override
  String time_ago_full_hours(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'před $count hodinami',
      few: 'před $count hodinami',
      one: 'před 1 hodinou',
    );
    return '$_temp0';
  }

  @override
  String time_ago_full_days_hours(int days, int hours) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days dny',
      few: '$days dny',
      one: '1 dnem',
    );
    String _temp1 = intl.Intl.pluralLogic(
      hours,
      locale: localeName,
      other: '$hours hodinami',
      few: '$hours hodinami',
      one: '1 hodinou',
    );
    return 'před $_temp0 $_temp1';
  }

  @override
  String time_ago_full_days(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'před $count dny',
      few: 'před $count dny',
      one: 'před 1 dnem',
    );
    return '$_temp0';
  }

  @override
  String get device_config_issue => 'Problém s konfigurací';

  @override
  String get device_details => 'Podrobnosti zařízení';

  @override
  String get message_error_page_not_found_title => 'Stránka nenalezena!';

  @override
  String get message_error_page_not_found_description => 'Požadovaná stránka nebyla nalezena v aplikaci.';

  @override
  String get electrical_energy_consumption_title => 'Spotřeba energie';

  @override
  String get electrical_energy_consumption_description => 'Celková spotřeba energie v průběhu času.';

  @override
  String get electrical_energy_average_power_title => 'Průměrný výkon';

  @override
  String get electrical_energy_average_power_description => 'Průměrný odběr výkonu za poslední interval hlášení.';

  @override
  String get electrical_generation_production_title => 'Výroba energie';

  @override
  String get electrical_generation_production_description => 'Celková energie vyrobená zdrojem výroby.';

  @override
  String get electrical_generation_power_title => 'Výkon výroby';

  @override
  String get electrical_generation_power_description => 'Aktuální výkon ze zdroje výroby.';

  @override
  String get electrical_power_current_title => 'Proud';

  @override
  String get electrical_power_current_description => 'Kolik elektřiny teče.';

  @override
  String get electrical_power_voltage_title => 'Napětí';

  @override
  String get electrical_power_voltage_description => 'Síla elektřiny.';

  @override
  String get electrical_power_power_title => 'Výkon';

  @override
  String get electrical_power_power_description => 'Kolik energie se právě spotřebovává.';

  @override
  String get electrical_power_frequency_title => 'Frekvence';

  @override
  String get electrical_power_frequency_description => 'Jak stabilní je elektřina.';

  @override
  String get electrical_power_over_current_title => 'Přetížení proudu';

  @override
  String get electrical_power_over_current_description => 'Varování: Příliš velký proud.';

  @override
  String get electrical_power_over_voltage_title => 'Přepětí';

  @override
  String get electrical_power_over_voltage_description => 'Varování: Elektřina je příliš silná.';

  @override
  String get electrical_power_over_power_title => 'Přetížení výkonu';

  @override
  String get electrical_power_over_power_description => 'Varování: Spotřeba energie je příliš vysoká.';

  @override
  String get light_state_on => 'Zapnuto';

  @override
  String get light_state_on_description => 'Světlo svítí';

  @override
  String get light_state_off => 'Vypnuto';

  @override
  String get light_state_failed => 'Selhalo';

  @override
  String get light_state_off_description => 'Světlo nesvítí';

  @override
  String get light_state_brightness_description => 'Aktuální jas.';

  @override
  String get light_state_mixed_description => 'Zařízení mají různé hodnoty.';

  @override
  String get light_state_syncing_description => 'Synchronizace zařízení...';

  @override
  String get light_state_not_synced_description => 'Zařízení nejsou synchronizována';

  @override
  String get light_role_main => 'Hlavní';

  @override
  String get light_role_task => 'Pracovní';

  @override
  String get light_role_ambient => 'Okolní';

  @override
  String get light_role_accent => 'Akcentové';

  @override
  String get light_role_night => 'Noční';

  @override
  String get light_role_other => 'Ostatní';

  @override
  String get light_role_hidden => 'Skryté';

  @override
  String get light_role_on_description => 'Světla svítí';

  @override
  String get light_role_off_description => 'Světla nesvítí';

  @override
  String get light_role_not_synced_description => 'Synchronizace selhala';

  @override
  String get light_role_syncing_description => 'Probíhá synchronizace';

  @override
  String get light_role_mixed_description => 'Světla mají různé hodnoty';

  @override
  String get light_state_out_of_sync => 'Nesynchronizováno';

  @override
  String get light_mode_off => 'Vypnuto';

  @override
  String get light_mode_on => 'Zapnuto';

  @override
  String get light_mode_brightness => 'Jas';

  @override
  String get light_mode_color => 'Barva';

  @override
  String get light_mode_temperature => 'Teplota';

  @override
  String get light_mode_white => 'Bílé';

  @override
  String get light_mode_swatches => 'Palety';

  @override
  String get lights_more_scenes => 'Více scén';

  @override
  String get thermostat_state_title => 'Stav termostatu';

  @override
  String get thermostat_state_configured_temperature_description => 'Nastavená teplota.';

  @override
  String get thermostat_state_current_temperature_description => 'Aktuální teplota místnosti.';

  @override
  String get thermostat_state_current_humidity_description => 'Aktuální vlhkost místnosti.';

  @override
  String get thermostat_child_lock_title => 'Dětský zámek';

  @override
  String get thermostat_openings_state_title => 'Okno je otevřené.';

  @override
  String get thermostat_openings_state_description => 'Termostat je vypnutý.';

  @override
  String get contact_sensor_window => 'Okno';

  @override
  String get contact_sensor_open => 'Otevřeno';

  @override
  String get contact_sensor_closed => 'Zavřeno';

  @override
  String get leak_sensor_water => 'Únik vody';

  @override
  String get leak_sensor_detected => 'Detekován';

  @override
  String get leak_sensor_dry => 'Sucho';

  @override
  String get thermostat_lock_locked => 'Uzamčeno';

  @override
  String get thermostat_lock_unlocked => 'Odemčeno';

  @override
  String get thermostat_mode_off => 'Vypnuto';

  @override
  String get thermostat_mode_heat => 'Topení';

  @override
  String get thermostat_mode_cool => 'Chlazení';

  @override
  String get thermostat_mode_auto => 'Automaticky';

  @override
  String get thermostat_mode_manual => 'Ruční';

  @override
  String get thermostat_min => 'min';

  @override
  String get thermostat_max => 'max';

  @override
  String get thermostat_target_label => 'Cíl';

  @override
  String get thermostat_state_off => 'Vypnuto';

  @override
  String get thermostat_state_heating => 'Topení';

  @override
  String thermostat_state_heating_to(String temperature) {
    return 'Topení na $temperature';
  }

  @override
  String get thermostat_state_cooling => 'Chlazení';

  @override
  String thermostat_state_cooling_to(String temperature) {
    return 'Chlazení na $temperature';
  }

  @override
  String get thermostat_state_idling => 'V klidu';

  @override
  String thermostat_state_idle_at(String temperature) {
    return 'V klidu na $temperature';
  }

  @override
  String get thermostat_with_invalid_configuration => 'Zařízení termostatu je nesprávně nakonfigurováno.';

  @override
  String get on_state_on => 'Zapnuto';

  @override
  String get on_state_off => 'Vypnuto';

  @override
  String get power_hint_tap_to_turn_on => 'Klepnutím zapnete';

  @override
  String get power_hint_tap_to_turn_off => 'Klepnutím vypnete';

  @override
  String get message_info_app_reboot_title => 'Restartování zařízení!';

  @override
  String get message_info_app_reboot_description => 'Počkejte, než se zařízení restartuje. Tento proces může chvíli trvat.';

  @override
  String get message_info_app_power_off_title => 'Vypnutí zařízení!';

  @override
  String get message_info_app_power_off_description => 'Zařízení se vypíná. Pro opětovné zapnutí použijte tlačítko napájení.';

  @override
  String get message_info_factory_reset_title => 'Reset zařízení!';

  @override
  String get message_info_factory_reset_description => 'Všechna nastavení a data budou vymazána. Zařízení bude obnoveno na tovární nastavení.';

  @override
  String get settings_general_settings_title => 'Obecné nastavení';

  @override
  String get settings_general_settings_button_display_settings => 'Nastavení displeje';

  @override
  String get settings_general_settings_button_language_settings => 'Nastavení jazyka';

  @override
  String get settings_general_settings_button_audio_settings => 'Nastavení zvuku';

  @override
  String get settings_general_settings_button_weather_settings => 'Nastavení počasí';

  @override
  String get settings_general_settings_button_about => 'O aplikaci';

  @override
  String get settings_general_settings_button_maintenance => 'Údržba';

  @override
  String get settings_weather_settings_title => 'Nastavení počasí';

  @override
  String get settings_weather_settings_temperature_unit_title => 'Jednotka teploty';

  @override
  String get settings_weather_settings_temperature_unit_description => 'Nastavte preferovanou jednotku teploty pro zobrazení počasí.';

  @override
  String get settings_weather_settings_temperature_location_title => 'Poloha počasí';

  @override
  String get settings_weather_settings_temperature_location_description => 'Vyberte z dostupných poloh nastavených v administrátorské aplikaci.';

  @override
  String get settings_weather_settings_temperature_location_single => 'Poloha je nastavena v administrátorské aplikaci.';

  @override
  String get settings_maintenance_title => 'Údržba';

  @override
  String get settings_maintenance_restart_title => 'Restart';

  @override
  String get settings_maintenance_restart_description => 'Restartujte zařízení pro aplikování změn nebo řešení problémů.';

  @override
  String get settings_maintenance_restart_confirm_title => 'Restart zařízení';

  @override
  String get settings_maintenance_restart_confirm_description => 'Opravdu chcete restartovat zařízení? Tato akce dočasně přeruší funkčnost.';

  @override
  String get settings_maintenance_power_off_title => 'Vypnutí';

  @override
  String get settings_maintenance_power_off_description => 'Úplně vypněte zařízení.';

  @override
  String get settings_maintenance_power_off_confirm_title => 'Vypnout zařízení';

  @override
  String get settings_maintenance_power_off_confirm_description => 'Opravdu chcete zařízení vypnout? Bude nutné ho ručně znovu zapnout.';

  @override
  String get settings_maintenance_factory_reset_title => 'Tovární nastavení';

  @override
  String get settings_maintenance_factory_reset_description => 'Obnovte zařízení do původního továrního nastavení.';

  @override
  String get settings_maintenance_factory_reset_confirm_title => 'Obnovení továrního nastavení';

  @override
  String get settings_maintenance_factory_reset_confirm_description => 'Opravdu chcete vymazat všechna data a obnovit tovární nastavení zařízení? Tato akce je nevratná.';

  @override
  String get settings_language_settings_title => 'Nastavení jazyka';

  @override
  String get settings_language_settings_language_title => 'Jazyk';

  @override
  String get settings_language_settings_language_description => 'Vyberte svůj preferovaný jazyk.';

  @override
  String get settings_language_settings_timezone_title => 'Časové pásmo';

  @override
  String get settings_language_settings_timezone_description => 'Vyberte své časové pásmo.';

  @override
  String get settings_language_settings_time_format_title => 'Formát času';

  @override
  String get settings_language_settings_time_format_description => 'Vyberte svůj preferovaný formát času.';

  @override
  String get settings_display_settings_title => 'Nastavení displeje';

  @override
  String get settings_display_settings_theme_mode_title => 'Režim motivu';

  @override
  String get settings_display_settings_theme_mode_description => 'Vyberte mezi světlým a tmavým režimem.';

  @override
  String get settings_display_settings_brightness_title => 'Jas';

  @override
  String get settings_display_settings_screen_lock_title => 'Zamknutí obrazovky';

  @override
  String get settings_display_settings_screen_lock_description => 'Nastavte prodlevu zamknutí obrazovky.';

  @override
  String get settings_display_settings_screen_saver_title => 'Spořič obrazovky';

  @override
  String get settings_display_settings_screen_saver_description => 'Povolit nebo zakázat spořič obrazovky.';

  @override
  String get settings_audio_settings_title => 'Nastavení zvuku';

  @override
  String get settings_audio_settings_speaker_title => 'Reproduktor';

  @override
  String get settings_audio_settings_speaker_description => 'Povolit nebo zakázat reproduktor.';

  @override
  String get settings_audio_settings_speaker_volume_title => 'Hlasitost reproduktoru';

  @override
  String get settings_audio_settings_microphone_title => 'Mikrofon';

  @override
  String get settings_audio_settings_microphone_description => 'Povolit nebo zakázat mikrofon.';

  @override
  String get settings_audio_settings_microphone_volume_title => 'Hlasitost mikrofonu';

  @override
  String get settings_audio_settings_no_support => 'Tento displej nepodporuje zvukový vstup ani výstup.';

  @override
  String get settings_about_title => 'O aplikaci';

  @override
  String get settings_about_about_heading => 'O aplikaci';

  @override
  String get settings_about_about_info => 'FastyBird Smart Panel je aplikace pro chytrou domácnost, která umožňuje bezproblémovou integraci s vašimi chytrými zařízeními a nabízí lepší ovládání a monitorování.';

  @override
  String get settings_about_developed_by_heading => 'Vyvinuto';

  @override
  String get settings_about_license_heading => 'Licence';

  @override
  String get settings_about_device_information_heading => 'Informace o zařízení';

  @override
  String get settings_about_show_license_button => 'Zobrazit licenci';

  @override
  String get settings_about_ip_address_title => 'IP adresa';

  @override
  String get settings_about_mac_address_title => 'MAC adresa';

  @override
  String get settings_about_cpu_usage_title => 'Využití CPU';

  @override
  String get settings_about_memory_usage_title => 'Využití paměti';

  @override
  String get weather_forecast_title => 'Předpověď počasí';

  @override
  String get weather_forecast_feels_like => 'Pocitová teplota:';

  @override
  String get weather_forecast_humidity => 'Vlhkost:';

  @override
  String get weather_condition_thunderstorm_with_light_rain => 'Bouřka s lehkým deštěm';

  @override
  String get weather_condition_thunderstorm_with_rain => 'Bouřka s deštěm';

  @override
  String get weather_condition_thunderstorm_with_heavy_rain => 'Bouřka s prudkým deštěm';

  @override
  String get weather_condition_light_thunderstorm => 'Lehká bouřka';

  @override
  String get weather_condition_thunderstorm => 'Bouřka';

  @override
  String get weather_condition_heavy_thunderstorm => 'Silná bouřka';

  @override
  String get weather_condition_ragged_thunderstorm => 'Nepravidelná bouřka';

  @override
  String get weather_condition_thunderstorm_with_light_drizzle => 'Bouřka s lehkým mrholením';

  @override
  String get weather_condition_thunderstorm_with_drizzle => 'Bouřka s mrholením';

  @override
  String get weather_condition_thunderstorm_with_heavy_drizzle => 'Bouřka s hustým mrholením';

  @override
  String get weather_condition_light_intensity_drizzle => 'Lehké mrholení';

  @override
  String get weather_condition_drizzle => 'Mrholení';

  @override
  String get weather_condition_heavy_intensity_drizzle => 'Husté mrholení';

  @override
  String get weather_condition_light_intensity_drizzle_rain => 'Lehké mrholení přecházející v déšť';

  @override
  String get weather_condition_drizzle_rain => 'Mrholení s deštěm';

  @override
  String get weather_condition_heavy_intensity_drizzle_rain => 'Husté mrholení přecházející v déšť';

  @override
  String get weather_condition_shower_rain_and_drizzle => 'Přeháňky s mrholením';

  @override
  String get weather_condition_heavy_shower_rain_and_drizzle => 'Silné přeháňky s mrholením';

  @override
  String get weather_condition_shower_drizzle => 'Přeháňkové mrholení';

  @override
  String get weather_condition_light_rain => 'Lehký déšť';

  @override
  String get weather_condition_moderate_rain => 'Mírný déšť';

  @override
  String get weather_condition_heavy_intensity_rain => 'Silný déšť';

  @override
  String get weather_condition_very_heavy_rain => 'Velmi silný déšť';

  @override
  String get weather_condition_extreme_rain => 'Extrémní déšť';

  @override
  String get weather_condition_freezing_rain => 'Mrznoucí déšť';

  @override
  String get weather_condition_light_intensity_shower_rain => 'Lehké dešťové přeháňky';

  @override
  String get weather_condition_shower_rain => 'Dešťové přeháňky';

  @override
  String get weather_condition_heavy_intensity_shower_rain => 'Silné dešťové přeháňky';

  @override
  String get weather_condition_ragged_shower_rain => 'Nepravidelné dešťové přeháňky';

  @override
  String get weather_condition_light_snow => 'Lehký sníh';

  @override
  String get weather_condition_snow => 'Sníh';

  @override
  String get weather_condition_heavy_snow => 'Silný sníh';

  @override
  String get weather_condition_sleet => 'Sněhová krupice';

  @override
  String get weather_condition_light_shower_sleet => 'Lehké přeháňky se sněhovou krupicí';

  @override
  String get weather_condition_shower_sleet => 'Přeháňky se sněhovou krupicí';

  @override
  String get weather_condition_light_rain_and_snow => 'Lehký déšť se sněhem';

  @override
  String get weather_condition_rain_and_snow => 'Déšť se sněhem';

  @override
  String get weather_condition_light_shower_snow => 'Lehké sněhové přeháňky';

  @override
  String get weather_condition_shower_snow => 'Sněhové přeháňky';

  @override
  String get weather_condition_heavy_shower_snow => 'Silné sněhové přeháňky';

  @override
  String get weather_condition_mist => 'Mlha';

  @override
  String get weather_condition_smoke => 'Kouř';

  @override
  String get weather_condition_haze => 'Zákal';

  @override
  String get weather_condition_fog => 'Hustá mlha';

  @override
  String get weather_condition_sand => 'Písek';

  @override
  String get weather_condition_dust => 'Prach';

  @override
  String get weather_condition_volcanic_ash => 'Sopečný popel';

  @override
  String get weather_condition_squalls => 'Nárazový vítr';

  @override
  String get weather_condition_tornado => 'Tornádo';

  @override
  String get weather_condition_clear_sky => 'Jasná obloha';

  @override
  String get weather_condition_few_clouds => 'Málo oblačnosti';

  @override
  String get weather_condition_scattered_clouds => 'Rozptýlená oblačnost';

  @override
  String get weather_condition_broken_clouds => 'Polojasno';

  @override
  String get weather_condition_overcast_clouds => 'Zataženo';

  @override
  String get weather_condition_unknown => 'Neznámé';

  @override
  String get discovery_searching_title => 'Hledání bran';

  @override
  String get discovery_searching_description => 'Hledám brány FastyBird Smart Panel ve vaší síti...';

  @override
  String discovery_found_count(int count) {
    return 'Nalezeno $count bran...';
  }

  @override
  String get discovery_select_title => 'Vyberte bránu';

  @override
  String discovery_select_description(int count) {
    return 'Nalezeno $count bran ve vaší síti:';
  }

  @override
  String get discovery_not_found_title => 'Brána nenalezena';

  @override
  String get discovery_not_found_description => 'Nepodařilo se najít žádnou bránu FastyBird Smart Panel ve vaší síti.\n\nUjistěte se, že brána běží a je připojena ke stejné síti jako toto zařízení.';

  @override
  String get discovery_error_title => 'Chyba vyhledávání';

  @override
  String get discovery_error_description => 'Při hledání bran došlo k chybě.\n\nZkontrolujte připojení k síti a zkuste to znovu.';

  @override
  String discovery_error_failed(String error) {
    return 'Vyhledávání selhalo: $error';
  }

  @override
  String get discovery_connecting_title => 'Připojování k bráně';

  @override
  String discovery_connecting_description(String address) {
    return 'Kontaktuji $address...';
  }

  @override
  String get discovery_connecting_fallback => 'bránu';

  @override
  String get discovery_manual_entry_title => 'Zadejte adresu brány';

  @override
  String get discovery_manual_entry_hint => '192.168.1.100:3000';

  @override
  String get discovery_manual_entry_label => 'Adresa brány';

  @override
  String get discovery_manual_entry_help => 'Zadejte IP adresu nebo hostname s volitelným portem.\nPříklady: 192.168.1.100:3000, gateway.local, 10.0.0.5';

  @override
  String get discovery_validation_empty => 'Prosím zadejte adresu brány';

  @override
  String get discovery_validation_invalid => 'Neplatná adresa. Zadejte platnou IP adresu nebo hostname.';

  @override
  String get discovery_button_back => 'Zpět';

  @override
  String get discovery_button_connect => 'Připojit';

  @override
  String get discovery_button_connect_selected => 'Připojit k vybrané bráně';

  @override
  String get discovery_button_rescan => 'Znovu vyhledat';

  @override
  String get discovery_button_try_again => 'Zkusit znovu';

  @override
  String get discovery_button_manual => 'Zadat ručně';

  @override
  String get discovery_button_cancel => 'Zrušit';

  @override
  String get action_success => 'Akce byla úspěšně dokončena';

  @override
  String get space_lighting_controls_title => 'Ovládání osvětlení';

  @override
  String get space_lighting_mode_off => 'Vyp';

  @override
  String get space_lighting_mode_work => 'Práce';

  @override
  String get space_lighting_mode_relax => 'Relax';

  @override
  String get space_lighting_mode_night => 'Noc';

  @override
  String get space_devices_title => 'Zařízení';

  @override
  String get space_devices_placeholder => 'Zařízení v této místnosti se zobrazí zde';

  @override
  String get space_climate_controls_title => 'Klimatizace';

  @override
  String get space_climate_current_label => 'Aktuální';

  @override
  String get space_climate_target_label => 'Cílová';

  @override
  String get climate_role_auxiliary => 'Pomocné';

  @override
  String get climate_tap_for_details => 'Klepněte pro detaily';

  @override
  String get climate_role_ventilation => 'Větrání';

  @override
  String get climate_role_humidity => 'Ovládání vlhkosti';

  @override
  String get climate_role_other => 'Ostatní zařízení';

  @override
  String get space_suggestion_applied => 'Návrh byl aplikován';

  @override
  String get space_suggestion_dismissed => 'Návrh byl zamítnut';

  @override
  String get space_undo_success => 'Akce byla vrácena';

  @override
  String get space_undo_button => 'Zpět';

  @override
  String get space_empty_state_title => 'Žádná ovládání nejsou k dispozici';

  @override
  String get space_empty_state_description => 'Tato místnost nemá nakonfigurovaná žádná ovladatelná zařízení';

  @override
  String get space_sensors_only_title => 'Pouze senzory';

  @override
  String get space_sensors_only_description => 'Tato místnost má pouze senzory — žádná ovladatelná zařízení';

  @override
  String get house_overview_no_spaces_title => 'Žádné místnosti nejsou nakonfigurovány';

  @override
  String get house_overview_no_spaces_description => 'Vytvořte místnosti v administrační aplikaci';

  @override
  String get house_overview_no_space_page => 'Pro tuto místnost není nakonfigurována stránka';

  @override
  String get house_overview_tap_to_view => 'Klepnutím zobrazíte';

  @override
  String get house_modes_home => 'Doma';

  @override
  String get house_modes_home_description => 'Normální provoz doma';

  @override
  String get house_modes_away => 'Pryč';

  @override
  String get house_modes_away_description => 'Mimo domov';

  @override
  String get house_modes_night => 'Noc';

  @override
  String get house_modes_night_description => 'Noční nastavení';

  @override
  String get house_modes_changed_success => 'Režim domu byl úspěšně změněn';

  @override
  String get house_modes_changed_error => 'Změna režimu domu se nezdařila';

  @override
  String get house_modes_confirm_title => 'Potvrdit změnu režimu';

  @override
  String get house_modes_confirm_away_description => 'Opravdu chcete nastavit dům do režimu Pryč? To může ovlivnit pravidla automatizace a nastavení zabezpečení.';

  @override
  String get space_scenes_title => 'Rychlé scény';

  @override
  String get space_scene_triggered => 'Scéna aktivována';

  @override
  String get space_scene_partial_success => 'Scéna částečně aktivována';

  @override
  String get window_covering_status_open => 'Otevřeno';

  @override
  String get window_covering_status_closed => 'Zavřeno';

  @override
  String get window_covering_status_opening => 'Otevírání';

  @override
  String get window_covering_status_closing => 'Zavírání';

  @override
  String get window_covering_status_stopped => 'Zastaveno';

  @override
  String get window_covering_type_curtain => 'Záclona';

  @override
  String get window_covering_type_blind => 'Žaluzie';

  @override
  String get window_covering_type_roller => 'Roleta';

  @override
  String get window_covering_type_outdoor_blind => 'Venkovní žaluzie';

  @override
  String get window_covering_type_venetian_blind => 'Benátské žaluzie';

  @override
  String get window_covering_type_vertical_blind => 'Vertikální žaluzie';

  @override
  String get window_covering_type_shutter => 'Okenice';

  @override
  String get window_covering_type_awning => 'Markýza';

  @override
  String get window_covering_command_open => 'Otevřít';

  @override
  String get window_covering_command_close => 'Zavřít';

  @override
  String get window_covering_command_stop => 'Zastavit';

  @override
  String get window_covering_position_label => 'Pozice';

  @override
  String get window_covering_position_description => 'Aktuální pozice';

  @override
  String get window_covering_tilt_label => 'Náklon';

  @override
  String get window_covering_tilt_description => 'Úprava úhlu lamel';

  @override
  String get window_covering_obstruction_warning => 'Zjištěna překážka';

  @override
  String get window_covering_fault_warning => 'Zjištěna závada';

  @override
  String get window_covering_preset_morning => 'Ráno';

  @override
  String get window_covering_preset_day => 'Den';

  @override
  String get window_covering_preset_evening => 'Večer';

  @override
  String get window_covering_preset_night => 'Noc';

  @override
  String get window_covering_preset_privacy => 'Soukromí';

  @override
  String get window_covering_preset_away => 'Pryč';

  @override
  String get window_covering_presets_label => 'Předvolby';

  @override
  String get window_covering_channels_label => 'Žaluzie';

  @override
  String get window_covering_info_status => 'Stav';

  @override
  String get window_covering_info_obstruction => 'Překážka';

  @override
  String get window_covering_obstruction_detected => 'Zjištěna';

  @override
  String get window_covering_obstruction_clear => 'Volno';

  @override
  String window_covering_position_open_percent(int position) {
    return '$position% Otevřeno';
  }

  @override
  String get battery_title => 'Baterie';

  @override
  String get config_error_title => 'Vyžadována konfigurace';

  @override
  String get config_error_hint_prefix => 'Nakonfigurujte tento displej v';

  @override
  String get config_error_hint_path => 'Správci > Displeje';

  @override
  String get connection_lost_title => 'Spojení ztraceno';

  @override
  String get connection_lost_message => 'Nelze se připojit k bráně. Zkontrolujte síťové připojení a zkuste to znovu.';

  @override
  String get connection_lost_button_reconnect => 'Znovu připojit';

  @override
  String get connection_lost_button_change_gateway => 'Změnit bránu';

  @override
  String get button_retry => 'Opakovat';

  @override
  String get button_sync_all => 'Synchronizovat vše';

  @override
  String get system_view_room => 'Místnost';

  @override
  String get system_view_master => 'Domov';

  @override
  String get deck_nav_more => 'Více';

  @override
  String get deck_all_pages => 'Všechny stránky';

  @override
  String get system_view_entry => 'Vstup';

  @override
  String get domain_lights => 'Světla';

  @override
  String get domain_lights_other => 'Ostatní světla';

  @override
  String get domain_lights_empty_title => 'Žádná světla';

  @override
  String get domain_lights_empty_description => 'V této místnosti nebyla nalezena žádná světla';

  @override
  String domain_lights_count_on(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count světel zapnuto',
      few: '$count světla zapnuta',
      one: '1 světlo zapnuto',
    );
    return '$_temp0';
  }

  @override
  String get domain_lights_all_off => 'vše vypnuto';

  @override
  String get domain_lights_all_on => 'vše zapnuto';

  @override
  String get domain_lights_button_all_off => 'Vše vypnout';

  @override
  String get domain_lights_button_all_on => 'Vše zapnout';

  @override
  String get domain_lights_syncing => 'synchronizuji';

  @override
  String get domain_lights_unsynced => 'nesynchronizováno';

  @override
  String get domain_lights_mixed => 'různé hodnoty';

  @override
  String get domain_climate => 'Klima';

  @override
  String get domain_media => 'Média';

  @override
  String media_devices_summary(Object count) {
    return '$count zařízení';
  }

  @override
  String media_devices_summary_on(Object count, Object on) {
    return '$count zařízení • $on zapnuto';
  }

  @override
  String get media_modes_title => 'Režimy';

  @override
  String get media_action_power_on => 'Zapnout';

  @override
  String get media_action_power_off => 'Vypnout';

  @override
  String get media_action_mute => 'Ztlumit';

  @override
  String get media_action_unmute => 'Zrušit ztlumení';

  @override
  String get media_mode_off => 'Vypnuto';

  @override
  String get media_mode_background => 'Pozadí';

  @override
  String get media_mode_focused => 'Soustředění';

  @override
  String get media_mode_party => 'Párty';

  @override
  String get media_roles_title => 'Role';

  @override
  String media_role_summary(Object on, Object total) {
    return '$on z $total zapnuto';
  }

  @override
  String get media_roles_unassigned => 'Nepřiřazená zařízení';

  @override
  String get media_role_primary => 'Primární';

  @override
  String get media_role_secondary => 'Sekundární';

  @override
  String get media_role_background => 'Pozadí';

  @override
  String get media_role_gaming => 'Hraní';

  @override
  String get media_role_hidden => 'Skryté';

  @override
  String get media_targets_title => 'Zařízení';

  @override
  String get media_capability_power => 'Napájení';

  @override
  String get media_capability_volume => 'Hlasitost';

  @override
  String get media_capability_mute => 'Ztlumení';

  @override
  String get media_capability_none => 'Bez schopností';

  @override
  String get media_no_endpoints_title => 'Žádná mediální zařízení';

  @override
  String get media_no_endpoints_description => 'Tato místnost nemá žádná mediální zařízení. Přidejte TV, reproduktor nebo streamer.';

  @override
  String get media_no_bindings_description => 'Mediální aktivity se konfigurují. Potáhněte pro obnovení.';

  @override
  String get media_ws_offline_title => 'Spojení ztraceno';

  @override
  String get media_ws_offline_description => 'Mediální ovládání vyžaduje aktivní připojení. Připojování...';

  @override
  String get domain_sensors => 'Senzory';

  @override
  String get domain_energy => 'Energie';

  @override
  String get energy_consumption => 'Spotřeba';

  @override
  String get energy_production => 'Výroba';

  @override
  String get energy_net => 'Čistá';

  @override
  String get energy_range_today => 'Dnes';

  @override
  String get energy_range_week => 'Týden';

  @override
  String get energy_range_month => 'Měsíc';

  @override
  String get energy_top_consumers => 'Největší spotřebitelé';

  @override
  String get energy_chart_title => 'Spotřeba v čase';

  @override
  String get energy_summary_title => 'Přehled';

  @override
  String get energy_unit_kwh => 'kWh';

  @override
  String get energy_empty_title => 'Žádná data o energii';

  @override
  String get energy_empty_description => 'V tomto prostoru nejsou žádná zařízení pro monitoring energie';

  @override
  String get energy_load_failed => 'Nepodařilo se načíst data o energii';

  @override
  String energy_device_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count zařízení',
      few: '$count zařízení',
      one: '1 zařízení',
    );
    return '$_temp0';
  }

  @override
  String get device_category_lighting => 'Osvětlení';

  @override
  String get device_category_climate => 'Klima';

  @override
  String get device_category_sensors => 'Senzory';

  @override
  String get device_category_media => 'Média';

  @override
  String get master_rooms => 'Místnosti';

  @override
  String get master_devices => 'Zařízení';

  @override
  String get master_scenes => 'Scény';

  @override
  String get master_quick_actions => 'Rychlé akce';

  @override
  String get entry_mode_activated => 'Režim aktivován';

  @override
  String get entry_house_modes => 'Režimy domu';

  @override
  String get entry_mode_home => 'Doma';

  @override
  String get entry_mode_away => 'Pryč';

  @override
  String get entry_mode_night => 'Noc';

  @override
  String get entry_mode_movie => 'Film';

  @override
  String get entry_security => 'Zabezpečení';

  @override
  String get entry_no_security_devices => 'Žádná bezpečnostní zařízení nejsou nakonfigurována';

  @override
  String get entry_locks => 'Zámky';

  @override
  String get entry_alarm => 'Alarm';

  @override
  String get entry_cameras => 'Kamery';

  @override
  String get air_quality_level_excellent => 'Vynikající';

  @override
  String get air_quality_level_good => 'Dobrá';

  @override
  String get air_quality_level_fair => 'Přijatelná';

  @override
  String get air_quality_level_inferior => 'Horší';

  @override
  String get air_quality_level_poor => 'Špatná';

  @override
  String get air_quality_level_unknown => 'Neznámá';

  @override
  String get aqi_label_good => 'Dobrá';

  @override
  String get aqi_label_moderate => 'Střední';

  @override
  String get aqi_label_unhealthy_sensitive => 'Nezdravá (citliví)';

  @override
  String get aqi_label_unhealthy => 'Nezdravá';

  @override
  String get aqi_label_very_unhealthy => 'Velmi nezdravá';

  @override
  String get aqi_label_hazardous => 'Nebezpečná';

  @override
  String get particulate_label_pm1 => 'PM1';

  @override
  String get particulate_label_pm25 => 'PM2.5';

  @override
  String get particulate_label_pm10 => 'PM10';

  @override
  String get sensor_enum_voc_level_low => 'Nízká';

  @override
  String get sensor_enum_voc_level_low_long => 'Nízká úroveň VOC';

  @override
  String get sensor_enum_voc_level_medium => 'Stř.';

  @override
  String get sensor_enum_voc_level_medium_long => 'Střední úroveň VOC';

  @override
  String get sensor_enum_voc_level_high => 'Vys.';

  @override
  String get sensor_enum_voc_level_high_long => 'Vysoká úroveň VOC';

  @override
  String get fan_mode_auto => 'Automatický';

  @override
  String get fan_mode_manual => 'Ruční';

  @override
  String get fan_mode_eco => 'Eko';

  @override
  String get fan_mode_sleep => 'Spánek';

  @override
  String get fan_mode_natural => 'Přirozený';

  @override
  String get fan_mode_turbo => 'Turbo';

  @override
  String get fan_speed_off => 'Vypnuto';

  @override
  String get fan_speed_low => 'Nízké';

  @override
  String get fan_speed_medium => 'Střední';

  @override
  String get fan_speed_high => 'Vysoké';

  @override
  String get fan_speed_turbo => 'Turbo';

  @override
  String get fan_speed_auto => 'Automaticky';

  @override
  String get fan_timer_off => 'Vypnuto';

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
  String get fan_direction_clockwise => 'Po směru';

  @override
  String get fan_direction_counter_clockwise => 'Proti směru';

  @override
  String get filter_status_good => 'Dobrý';

  @override
  String get filter_status_replace_soon => 'Brzy';

  @override
  String get filter_status_replace_now => 'Vyměnit';

  @override
  String get filter_status_unknown => 'Neznámý';

  @override
  String get dehumidifier_mode_auto => 'Automatický';

  @override
  String get dehumidifier_mode_manual => 'Ruční';

  @override
  String get dehumidifier_mode_continuous => 'Kontinuální';

  @override
  String get dehumidifier_mode_laundry => 'Sušení prádla';

  @override
  String get dehumidifier_mode_quiet => 'Tichý';

  @override
  String get dehumidifier_status_idle => 'Nečinný';

  @override
  String get dehumidifier_status_dehumidifying => 'Odvlhčuje';

  @override
  String get dehumidifier_status_defrosting => 'Odmrazuje';

  @override
  String get dehumidifier_timer_off => 'Vypnuto';

  @override
  String get dehumidifier_timer_30m => '30 min';

  @override
  String get dehumidifier_timer_1h => '1 hodina';

  @override
  String get dehumidifier_timer_2h => '2 hodiny';

  @override
  String get dehumidifier_timer_4h => '4 hodiny';

  @override
  String get dehumidifier_timer_8h => '8 hodin';

  @override
  String get dehumidifier_timer_12h => '12 hodin';

  @override
  String get dehumidifier_water_tank => 'Nádržka';

  @override
  String get dehumidifier_defrost => 'Odmrazování';

  @override
  String get dehumidifier_defrost_active => 'Odmrazuje';

  @override
  String get humidifier_mode_auto => 'Automatický';

  @override
  String get humidifier_mode_manual => 'Ruční';

  @override
  String get humidifier_mode_sleep => 'Spánek';

  @override
  String get humidifier_mode_baby => 'Dětský';

  @override
  String get humidifier_status_idle => 'Nečinný';

  @override
  String get humidifier_status_humidifying => 'Zvlhčuje';

  @override
  String get humidifier_mist_level => 'Úroveň mlhy';

  @override
  String get humidifier_mist_level_off => 'Vypnuto';

  @override
  String get humidifier_mist_level_low => 'Nízká';

  @override
  String get humidifier_mist_level_medium => 'Střední';

  @override
  String get humidifier_mist_level_high => 'Vysoká';

  @override
  String get humidifier_timer_off => 'Vypnuto';

  @override
  String get humidifier_timer_30m => '30 min';

  @override
  String get humidifier_timer_1h => '1 hodina';

  @override
  String get humidifier_timer_2h => '2 hodiny';

  @override
  String get humidifier_timer_4h => '4 hodiny';

  @override
  String get humidifier_timer_8h => '8 hodin';

  @override
  String get humidifier_timer_12h => '12 hodin';

  @override
  String get humidifier_water_tank => 'Nádržka';

  @override
  String get humidifier_warm_mist => 'Teplá pára';

  @override
  String get device_current_humidity => 'Aktuální';

  @override
  String get device_current_temperature => 'Teplota';

  @override
  String get device_fan_speed => 'Rychlost';

  @override
  String get device_fan_mode => 'Režim ventilátoru';

  @override
  String get device_timer => 'Časovač';

  @override
  String get device_child_lock => 'Dětský zámek';

  @override
  String get device_oscillation => 'Oscilace';

  @override
  String get device_direction => 'Směr';

  @override
  String get device_natural_breeze => 'Přírodní vánek';

  @override
  String get device_auto_off_timer => 'Automatické vypnutí';

  @override
  String get device_filter_life => 'Životnost filtru';

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
  String get device_pressure => 'Tlak';

  @override
  String get air_quality_healthy => 'Zdravý';

  @override
  String get air_quality_unhealthy => 'Nezdravý';

  @override
  String get gas_detected => 'Detekováno';

  @override
  String get gas_clear => 'Čistý';

  @override
  String get gas_level_low => 'Nízký';

  @override
  String get gas_level_medium => 'Střední';

  @override
  String get gas_level_high => 'Vysoký';

  @override
  String get device_humidity => 'Vlhkost';

  @override
  String get device_air_quality_index => 'Index kvality vzduchu';

  @override
  String get device_temperature => 'Teplota';

  @override
  String get device_sensors => 'Senzory';

  @override
  String get device_controls => 'Ovládání';

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
  String get media_playing => 'Přehrává';

  @override
  String get media_idle => 'Nečinný';

  @override
  String get media_standby => 'Pohotovost';

  @override
  String get media_volume => 'Hlasitost';

  @override
  String get media_source => 'Zdroj';

  @override
  String get media_queue => 'Fronta';

  @override
  String get media_up_next => 'Další';

  @override
  String get media_other_devices => 'Ostatní zařízení';

  @override
  String get device_status_standby => 'Pohotovost';

  @override
  String get device_status_active => 'Aktivní';

  @override
  String get device_status_inactive => 'Neaktivní';

  @override
  String get climate_devices_section => 'Klimatizační zařízení';

  @override
  String get climate_more_sensors => 'Více senzorů';

  @override
  String get domain_shading => 'Stínění';

  @override
  String get domain_shading_empty_title => 'Žádné stínění';

  @override
  String get domain_shading_empty_description => 'V této místnosti nebylo nalezeno žádné stínění';

  @override
  String get shading_modes_title => 'Režimy';

  @override
  String get shading_devices_title => 'Zařízení';

  @override
  String shading_devices_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count zařízení',
      few: '$count zařízení',
      one: '1 zařízení',
    );
    return '$_temp0';
  }

  @override
  String get shading_action_open => 'Otevřít';

  @override
  String get shading_action_close => 'Zavřít';

  @override
  String get shading_action_stop => 'Zastavit';

  @override
  String get shading_state_open => 'Otevřeno';

  @override
  String get shading_state_closed => 'Zavřeno';

  @override
  String shading_state_partial(int position) {
    return '$position% otevřeno';
  }

  @override
  String get shading_position => 'Pozice';

  @override
  String get shading_tap_for_controls => 'Klepněte pro ovládání';

  @override
  String get shading_hide_controls => 'Skrýt ovládání';

  @override
  String get covers_mode_open => 'Otevřeno';

  @override
  String get covers_mode_closed => 'Zavřeno';

  @override
  String get covers_mode_privacy => 'Soukromí';

  @override
  String get covers_mode_daylight => 'Denní světlo';

  @override
  String get covers_role_primary => 'Hlavní';

  @override
  String get covers_role_blackout => 'Zatemnění';

  @override
  String get covers_role_sheer => 'Záclony';

  @override
  String get covers_role_outdoor => 'Venkovní';

  @override
  String get covers_role_hidden => 'Skryté';

  @override
  String get cover_type_curtain => 'Záclona';

  @override
  String get cover_type_blind => 'Žaluzie';

  @override
  String get cover_type_roller => 'Roleta';

  @override
  String get cover_type_outdoor_blind => 'Venkovní žaluzie';

  @override
  String get cover_type_cover => 'Krytina';

  @override
  String get light_preset_candle => 'Svíčka';

  @override
  String get light_preset_warm => 'Teplá';

  @override
  String get light_preset_daylight => 'Denní světlo';

  @override
  String get light_preset_cool => 'Studená';

  @override
  String get light_color_red => 'Červená';

  @override
  String get light_color_orange => 'Oranžová';

  @override
  String get light_color_yellow => 'Žlutá';

  @override
  String get light_color_green => 'Zelená';

  @override
  String get light_color_cyan => 'Azurová';

  @override
  String get light_color_blue => 'Modrá';

  @override
  String get light_color_purple => 'Fialová';

  @override
  String get light_color_pink => 'Růžová';

  @override
  String get connection_banner_reconnecting => 'Připojování...';

  @override
  String get connection_banner_retry => 'Zkusit znovu';

  @override
  String get connection_overlay_title_reconnecting => 'Připojování';

  @override
  String get connection_overlay_message_reconnecting => 'Pokus o opětovné připojení...';

  @override
  String get connection_overlay_message_still_trying => 'Stále se pokoušíme připojit...';

  @override
  String get connection_overlay_retry => 'Zkusit znovu';

  @override
  String get connection_overlay_retrying => 'Připojování...';

  @override
  String get connection_recovery_connected => 'Připojeno';

  @override
  String get connection_auth_error_title => 'Relace vypršela';

  @override
  String get connection_auth_error_message => 'Vaše relace vypršela nebo byla zrušena. Resetujte prosím zařízení pro opětovné připojení.';

  @override
  String get connection_auth_error_button_reset => 'Resetovat zařízení';

  @override
  String get connection_network_error_title => 'Síť nedostupná';

  @override
  String get connection_network_error_message => 'Nelze se připojit k serveru. Zkontrolujte prosím síťové připojení.';

  @override
  String get connection_network_error_button_retry => 'Zkusit znovu';

  @override
  String get connection_server_error_title => 'Server nedostupný';

  @override
  String get connection_server_error_message => 'Server je dočasně nedostupný. Zkuste to prosím později.';

  @override
  String get connection_server_error_button_retry => 'Zkusit znovu';

  @override
  String get sensor_enum_illuminance_bright => 'Jasno';

  @override
  String get sensor_enum_illuminance_bright_long => 'Jasno';

  @override
  String get sensor_enum_illuminance_moderate => 'Střední';

  @override
  String get sensor_enum_illuminance_moderate_long => 'Střední osvětlení';

  @override
  String get sensor_enum_illuminance_dusky => 'Šero';

  @override
  String get sensor_enum_illuminance_dusky_long => 'Šero';

  @override
  String get sensor_enum_illuminance_dark => 'Tma';

  @override
  String get sensor_enum_illuminance_dark_long => 'Tma';

  @override
  String get sensor_enum_gas_status_normal => 'OK';

  @override
  String get sensor_enum_gas_status_normal_long => 'Normální';

  @override
  String get sensor_enum_gas_status_warning => 'Var.';

  @override
  String get sensor_enum_gas_status_warning_long => 'Varování';

  @override
  String get sensor_enum_gas_status_alarm => 'Alarm';

  @override
  String get sensor_enum_gas_status_alarm_long => 'Alarm plynu';

  @override
  String get sensor_enum_leak_level_low => 'Nízký';

  @override
  String get sensor_enum_leak_level_low_long => 'Nízký únik';

  @override
  String get sensor_enum_leak_level_medium => 'Stř.';

  @override
  String get sensor_enum_leak_level_medium_long => 'Střední únik';

  @override
  String get sensor_enum_leak_level_high => 'Vys.';

  @override
  String get sensor_enum_leak_level_high_long => 'Závažný únik';

  @override
  String get sensor_enum_battery_level_critical => 'Krit.';

  @override
  String get sensor_enum_battery_level_critical_long => 'Kritická';

  @override
  String get sensor_enum_battery_level_low => 'Nízká';

  @override
  String get sensor_enum_battery_level_low_long => 'Nízká';

  @override
  String get sensor_enum_battery_level_medium => 'Stř.';

  @override
  String get sensor_enum_battery_level_medium_long => 'Střední';

  @override
  String get sensor_enum_battery_level_high => 'Vys.';

  @override
  String get sensor_enum_battery_level_high_long => 'Vysoká';

  @override
  String get sensor_enum_battery_level_full => 'Plná';

  @override
  String get sensor_enum_battery_level_full_long => 'Plná';

  @override
  String get sensor_enum_battery_status_ok => 'OK';

  @override
  String get sensor_enum_battery_status_ok_long => 'Baterie OK';

  @override
  String get sensor_enum_battery_status_low => 'Nízká';

  @override
  String get sensor_enum_battery_status_low_long => 'Nízká baterie';

  @override
  String get sensor_enum_battery_status_charging => 'Nabíjí';

  @override
  String get sensor_enum_battery_status_charging_long => 'Nabíjení';

  @override
  String get sensor_enum_alarm_alarm_idle => 'Klid';

  @override
  String get sensor_enum_alarm_alarm_idle_long => 'Alarm v klidu';

  @override
  String get sensor_enum_alarm_alarm_pending => 'Čeká';

  @override
  String get sensor_enum_alarm_alarm_pending_long => 'Alarm čeká';

  @override
  String get sensor_enum_alarm_alarm_triggered => 'Spuš.';

  @override
  String get sensor_enum_alarm_alarm_triggered_long => 'Alarm spuštěn';

  @override
  String get sensor_enum_alarm_alarm_silenced => 'Ticho';

  @override
  String get sensor_enum_alarm_alarm_silenced_long => 'Alarm ztišen';

  @override
  String get sensor_enum_alarm_disarmed => 'Vyp.';

  @override
  String get sensor_enum_alarm_disarmed_long => 'Deaktivován';

  @override
  String get sensor_enum_alarm_armed_home => 'Doma';

  @override
  String get sensor_enum_alarm_armed_home_long => 'Aktivní doma';

  @override
  String get sensor_enum_alarm_armed_away => 'Pryč';

  @override
  String get sensor_enum_alarm_armed_away_long => 'Aktivní pryč';

  @override
  String get sensor_enum_alarm_armed_night => 'Noc';

  @override
  String get sensor_enum_alarm_armed_night_long => 'Aktivní noc';

  @override
  String get sensor_enum_filter_good => 'Dobrý';

  @override
  String get sensor_enum_filter_good_long => 'Filtr dobrý';

  @override
  String get sensor_enum_filter_replace_soon => 'Brzy';

  @override
  String get sensor_enum_filter_replace_soon_long => 'Brzy vyměnit';

  @override
  String get sensor_enum_filter_replace_now => 'Teď!';

  @override
  String get sensor_enum_filter_replace_now_long => 'Vyměnit nyní';

  @override
  String get sensor_enum_door_opened => 'Otev.';

  @override
  String get sensor_enum_door_opened_long => 'Dveře otevřeny';

  @override
  String get sensor_enum_door_closed => 'Zavř.';

  @override
  String get sensor_enum_door_closed_long => 'Dveře zavřeny';

  @override
  String get sensor_enum_door_opening => 'Otev.';

  @override
  String get sensor_enum_door_opening_long => 'Dveře se otevírají';

  @override
  String get sensor_enum_door_closing => 'Zavír.';

  @override
  String get sensor_enum_door_closing_long => 'Dveře se zavírají';

  @override
  String get sensor_enum_door_stopped => 'Stop';

  @override
  String get sensor_enum_door_stopped_long => 'Dveře zastaveny';

  @override
  String get sensor_enum_lock_locked => 'Zamč.';

  @override
  String get sensor_enum_lock_locked_long => 'Zamčeno';

  @override
  String get sensor_enum_lock_unlocked => 'Otev.';

  @override
  String get sensor_enum_lock_unlocked_long => 'Odemčeno';

  @override
  String get sensor_enum_camera_available => 'Zap.';

  @override
  String get sensor_enum_camera_available_long => 'Kamera dostupná';

  @override
  String get sensor_enum_camera_in_use => 'Použ.';

  @override
  String get sensor_enum_camera_in_use_long => 'Kamera používána';

  @override
  String get sensor_enum_camera_unavailable => 'N/A';

  @override
  String get sensor_enum_camera_unavailable_long => 'Kamera nedostupná';

  @override
  String get sensor_enum_camera_offline => 'Vyp.';

  @override
  String get sensor_enum_camera_offline_long => 'Kamera offline';

  @override
  String get sensor_enum_camera_initializing => 'Init';

  @override
  String get sensor_enum_camera_initializing_long => 'Kamera se inicializuje';

  @override
  String get sensor_enum_camera_error => 'Chyba';

  @override
  String get sensor_enum_camera_error_long => 'Chyba kamery';

  @override
  String get sensor_enum_device_info_connected => 'Zap.';

  @override
  String get sensor_enum_device_info_connected_long => 'Připojeno';

  @override
  String get sensor_enum_device_info_disconnected => 'Vyp.';

  @override
  String get sensor_enum_device_info_disconnected_long => 'Odpojeno';

  @override
  String get sensor_enum_device_info_init => 'Init';

  @override
  String get sensor_enum_device_info_init_long => 'Inicializace';

  @override
  String get sensor_enum_device_info_ready => 'Připr.';

  @override
  String get sensor_enum_device_info_ready_long => 'Připraveno';

  @override
  String get sensor_enum_device_info_running => 'Běží';

  @override
  String get sensor_enum_device_info_running_long => 'Běží';

  @override
  String get sensor_enum_device_info_sleeping => 'Spí';

  @override
  String get sensor_enum_device_info_sleeping_long => 'Spí';

  @override
  String get sensor_enum_device_info_stopped => 'Stop';

  @override
  String get sensor_enum_device_info_stopped_long => 'Zastaveno';

  @override
  String get sensor_enum_device_info_lost => 'Ztr.';

  @override
  String get sensor_enum_device_info_lost_long => 'Spojení ztraceno';

  @override
  String get sensor_enum_device_info_alert => 'Alert';

  @override
  String get sensor_enum_device_info_alert_long => 'Alert';

  @override
  String get sensor_enum_device_info_unknown => 'N/A';

  @override
  String get sensor_enum_device_info_unknown_long => 'Neznámý';

  @override
  String get sensor_freshness_live => 'Živě';

  @override
  String get sensor_freshness_stale => 'Zastaralé';

  @override
  String get sensor_freshness_offline => 'Offline';

  @override
  String get media_input_select_title => 'Vybrat vstup';

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
  String get media_input_cable => 'Kabel';

  @override
  String get media_input_satellite => 'Satelit';

  @override
  String get media_input_antenna => 'Anténa';

  @override
  String get media_input_av1 => 'AV 1';

  @override
  String get media_input_av2 => 'AV 2';

  @override
  String get media_input_component => 'Komponentní';

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
  String get media_input_other => 'Ostatní';

  @override
  String get media_off_title => 'Média vypnuta';

  @override
  String get media_off_subtitle => 'Vyberte aktivitu pro zahájení';

  @override
  String media_starting_activity(String activityName) {
    return 'Spouštění $activityName...';
  }

  @override
  String media_activity_failed(String activityName) {
    return '$activityName selhalo';
  }

  @override
  String get media_activity_failed_description => 'Aktivitu se nepodařilo aplikovat. Zkontrolujte připojení zařízení.';

  @override
  String get media_activity_retry => 'Opakovat';

  @override
  String get media_activity_turn_off => 'Vypnout';

  @override
  String get media_warning_audio_offline => 'Audio výstup offline – používají se reproduktory displeje';

  @override
  String get media_warning_some_devices_offline => 'Některá zařízení jsou offline';

  @override
  String media_warning_steps_failed(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'varování',
      few: 'varování',
      one: 'varování',
    );
    return 'Některé kroky selhaly ($count $_temp0)';
  }

  @override
  String get media_warning_steps_had_issues => 'Některé kroky měly problémy';

  @override
  String get media_remote => 'Ovládání';

  @override
  String get media_remote_control => 'Dálkové ovládání';

  @override
  String media_volume_percent(int volume) {
    return '$volume%';
  }

  @override
  String get media_failure_details_title => 'Podrobnosti aktivace';

  @override
  String get media_failure_summary_total => 'Celkem';

  @override
  String get media_failure_summary_ok => 'OK';

  @override
  String get media_failure_summary_errors => 'Chyby';

  @override
  String get media_failure_summary_warnings => 'Varování';

  @override
  String get media_failure_errors_critical => 'Chyby (kritické)';

  @override
  String get media_failure_warnings_non_critical => 'Varování (nekritická)';

  @override
  String get media_failure_warnings_label => 'Varování';

  @override
  String get media_failure_retry_activity => 'Opakovat aktivitu';

  @override
  String get media_failure_deactivate => 'Deaktivovat';

  @override
  String media_failure_device_label(String deviceId) {
    return 'Zařízení: $deviceId';
  }

  @override
  String media_failure_inline(int errors, int warnings) {
    String _temp0 = intl.Intl.pluralLogic(
      errors,
      locale: localeName,
      other: 'chyb',
      few: 'chyby',
      one: 'chyba',
    );
    String _temp1 = intl.Intl.pluralLogic(
      warnings,
      locale: localeName,
      other: 'varování',
      few: 'varování',
      one: 'varování',
    );
    return 'Aktivitu se nepodařilo aplikovat ($errors $_temp0, $warnings $_temp1)';
  }

  @override
  String get media_activity_watch => 'Sledovat';

  @override
  String get media_activity_listen => 'Poslouchat';

  @override
  String get media_activity_gaming => 'Hraní';

  @override
  String get media_activity_background => 'Pozadí';

  @override
  String get media_activity_off => 'Vyp';

  @override
  String media_activity_active(String activityName) {
    return '$activityName aktivní';
  }

  @override
  String get media_status_standby => 'Pohotovost';

  @override
  String get media_status_activating => 'Aktivace...';

  @override
  String get media_status_failed => 'Selhalo';

  @override
  String get media_status_stopping => 'Zastavování...';

  @override
  String get media_status_active_with_issues => 'Aktivní s problémy';

  @override
  String get media_status_active => 'Aktivní';

  @override
  String get media_status_ready => 'Připraveno';

  @override
  String get media_remote_up => 'Nahoru';

  @override
  String get media_remote_down => 'Dolů';

  @override
  String get media_remote_left => 'Vlevo';

  @override
  String get media_remote_right => 'Vpravo';

  @override
  String get media_remote_ok => 'OK';

  @override
  String get media_remote_back => 'Zpět';

  @override
  String get media_remote_exit => 'Konec';

  @override
  String get media_remote_info => 'Info';

  @override
  String get media_remote_rewind => 'Zpětně';

  @override
  String get media_remote_fast_forward => 'Vpřed';

  @override
  String get media_remote_play => 'Přehrát';

  @override
  String get media_remote_pause => 'Pauza';

  @override
  String get media_remote_next => 'Další';

  @override
  String get media_remote_prev => 'Předch.';

  @override
  String get media_detail_connection_lost => 'Spojení ztraceno';

  @override
  String get media_detail_connection_lost_description => 'Ovládání médií vyžaduje aktivní WebSocket připojení.';

  @override
  String get media_detail_go_back => 'Zpět';

  @override
  String get media_detail_section_display => 'Displej';

  @override
  String get media_detail_section_audio => 'Audio';

  @override
  String get media_detail_section_source => 'Zdroj';

  @override
  String get media_detail_section_remote => 'Dálkové ovládání';

  @override
  String get media_detail_input => 'Vstup';

  @override
  String get media_detail_select => 'Vybrat';

  @override
  String get media_detail_now_playing => 'Právě hraje';

  @override
  String get media_detail_no_track_info => 'Informace o skladbě nejsou k dispozici';

  @override
  String get media_detail_home => 'Domů';

  @override
  String get media_detail_menu => 'Menu';

  @override
  String get media_playback => 'Přehrávání';

  @override
  String get filter_all => 'Vše';

  @override
  String sensor_alert_high_title(String name) {
    return 'Výstraha: vysoká hodnota $name';
  }

  @override
  String sensor_alert_exceeded_threshold(String name) {
    return '$name překročil prahovou hodnotu';
  }

  @override
  String get sensor_state_detected => 'Detekováno';

  @override
  String get sensor_state_not_detected => 'Nedetekováno';

  @override
  String get sensor_state_clear => 'V pořádku';

  @override
  String get sensor_state_open => 'Otevřeno';

  @override
  String get sensor_state_closed => 'Zavřeno';

  @override
  String get sensor_state_active => 'Aktivní';

  @override
  String get sensor_state_inactive => 'Neaktivní';

  @override
  String get sensor_state_occupied => 'Obsazeno';

  @override
  String get sensor_state_unoccupied => 'Neobsazeno';

  @override
  String get sensor_state_smoke_detected => 'Detekován kouř';

  @override
  String get sensor_state_gas_detected => 'Detekován plyn';

  @override
  String get sensor_state_leak_detected => 'Detekován únik';

  @override
  String get sensor_state_co_detected => 'Detekován CO';

  @override
  String get sensor_label_temperature => 'Teplota';

  @override
  String get sensor_label_humidity => 'Vlhkost';

  @override
  String get sensor_label_pressure => 'Tlak';

  @override
  String get sensor_label_illuminance => 'Osvětlení';

  @override
  String get sensor_label_carbon_dioxide => 'Oxid uhličitý';

  @override
  String get sensor_label_carbon_monoxide => 'Oxid uhelnatý';

  @override
  String get sensor_label_ozone => 'Ozón';

  @override
  String get sensor_label_nitrogen_dioxide => 'Oxid dusičitý';

  @override
  String get sensor_label_sulphur_dioxide => 'Oxid siřičitý';

  @override
  String get sensor_label_voc => 'VOC';

  @override
  String get sensor_label_particulate_matter => 'Pevné částice';

  @override
  String get sensor_label_motion => 'Pohyb';

  @override
  String get sensor_label_occupancy => 'Přítomnost';

  @override
  String get sensor_label_contact => 'Kontakt';

  @override
  String get sensor_label_leak => 'Únik';

  @override
  String get sensor_label_smoke => 'Kouř';

  @override
  String get sensor_label_battery => 'Baterie';

  @override
  String get sensor_label_alarm => 'Alarm';

  @override
  String get sensor_label_door => 'Dveře';

  @override
  String get sensor_label_lock => 'Zámek';

  @override
  String get sensor_label_camera => 'Kamera';

  @override
  String get sensor_label_filter => 'Filtr';

  @override
  String get sensor_label_device_info => 'Info o zařízení';

  @override
  String get sensor_label_gas => 'Plyn';

  @override
  String get sensor_label_electrical_energy => 'Energie';

  @override
  String get sensor_label_electrical_generation => 'Výroba';

  @override
  String get sensor_label_electrical_power => 'Výkon';

  @override
  String get sensor_alert_high_level => 'Vysoká úroveň';

  @override
  String get sensor_alert_low_battery => 'Slabá baterie';

  @override
  String get sensor_alert_charging => 'Nabíjení';

  @override
  String get sensor_category_temperature => 'Teplota';

  @override
  String get sensor_category_humidity => 'Vlhkost';

  @override
  String get sensor_category_air_quality => 'Kvalita vzduchu';

  @override
  String get sensor_category_motion => 'Pohyb';

  @override
  String get sensor_category_safety => 'Bezpečnost';

  @override
  String get sensor_category_light => 'Světlo';

  @override
  String get sensor_category_energy => 'Energie';

  @override
  String get sensor_ui_event_log => 'Historie událostí';

  @override
  String get sensor_ui_history => 'Historie';

  @override
  String get sensor_ui_current => 'Aktuální';

  @override
  String sensor_ui_current_value(String name) {
    return 'Aktuální $name';
  }

  @override
  String get sensor_ui_min => 'Min';

  @override
  String get sensor_ui_max => 'Max';

  @override
  String get sensor_ui_avg => 'Prům';

  @override
  String sensor_ui_period_min(String period) {
    return '$period Min';
  }

  @override
  String sensor_ui_period_max(String period) {
    return '$period Max';
  }

  @override
  String sensor_ui_period_avg(String period) {
    return '$period Prům';
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
  String get sensor_empty_no_events => 'Žádné zaznamenané události';

  @override
  String get sensor_empty_no_state_changes => 'Žádné změny stavu';

  @override
  String get sensor_empty_no_history => 'Žádná historická data';

  @override
  String get sensor_empty_no_data => 'Žádná data';

  @override
  String get sensor_status_loading => 'Načítání dat...';

  @override
  String get sensor_status_failed => 'Načítání dat selhalo';

  @override
  String get sensor_status_retry => 'Opakovat';

  @override
  String get sensors_domain_title => 'Senzory';

  @override
  String get sensors_domain_empty_title => 'Žádné senzory';

  @override
  String get sensors_domain_empty_description => 'V této místnosti zatím nejsou přiřazeny žádné senzory.';

  @override
  String sensors_domain_alerts_active(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Aktivních výstrah',
      few: 'Aktivní výstrahy',
      one: 'Aktivní výstraha',
    );
    return '$_temp0';
  }

  @override
  String get sensors_domain_no_sensors => 'Žádné senzory';

  @override
  String sensors_domain_health_stale(int count) {
    return '$count zastaralých';
  }

  @override
  String sensors_domain_health_offline(int count) {
    return '$count offline';
  }

  @override
  String get sensors_domain_health_normal => 'Vše v pořádku';

  @override
  String get sensors_domain_avg_temperature => 'Prům. teplota';

  @override
  String get sensors_domain_avg_humidity => 'Prům. vlhkost';

  @override
  String get sensors_domain_all_sensors => 'Všechny senzory';

  @override
  String sensors_domain_sensor_count(int count) {
    return '$count senzorů';
  }

  @override
  String get security_tab_entry_points => 'Vstupní body';

  @override
  String get security_tab_alerts => 'Upozornění';

  @override
  String get security_tab_events => 'Události';

  @override
  String get security_header_recent_events => 'Nedávné události';

  @override
  String get security_status_triggered => 'Spuštěno';

  @override
  String get security_status_warning => 'Varování';

  @override
  String get security_status_secure => 'Zabezpečeno';

  @override
  String get security_armed_disarmed => 'Deaktivováno';

  @override
  String get security_armed_home => 'Aktivní doma';

  @override
  String get security_armed_away => 'Aktivní pryč';

  @override
  String get security_armed_night => 'Aktivní noc';

  @override
  String get security_armed_unknown => 'Neznámý';

  @override
  String get security_alarm_idle => 'Klidový';

  @override
  String get security_alarm_pending => 'Čekající';

  @override
  String get security_alarm_triggered => 'Spuštěno';

  @override
  String get security_alarm_silenced => 'Ztlumeno';

  @override
  String get security_alarm_unknown => 'Neznámý';

  @override
  String security_entry_open_count(int count) {
    return '$count otevřeno';
  }

  @override
  String get security_entry_all_secure => 'Vše zabezpečeno';

  @override
  String get security_entry_status_breach => 'Průnik';

  @override
  String get security_entry_status_open => 'Otevřeno';

  @override
  String get security_entry_status_unknown => 'Neznámý';

  @override
  String get security_entry_status_closed => 'Zavřeno';

  @override
  String security_summary_all_clear(int count) {
    return 'Vše v pořádku · $count vstupních bodů zabezpečeno';
  }

  @override
  String security_summary_alerts(int count) {
    return '$count upozornění';
  }

  @override
  String security_summary_entry_points_open(int count) {
    return '$count vstupních bodů otevřeno';
  }

  @override
  String get security_no_active_alerts => 'Žádná aktivní upozornění';

  @override
  String get security_ack_all => 'Potvrdit vše';

  @override
  String get security_no_recent_events => 'Žádné nedávné události';

  @override
  String get security_events_load_failed => 'Nepodařilo se načíst události';

  @override
  String get security_retry => 'Opakovat';

  @override
  String get security_alert_type_intrusion => 'Detekován průnik';

  @override
  String get security_alert_type_entry_open => 'Vstup otevřen';

  @override
  String get security_alert_type_smoke => 'Detekován kouř';

  @override
  String get security_alert_type_co => 'Detekován CO';

  @override
  String get security_alert_type_water_leak => 'Únik vody';

  @override
  String get security_alert_type_gas => 'Detekován plyn';

  @override
  String get security_alert_type_tamper => 'Detekována manipulace';

  @override
  String get security_alert_type_fault => 'Chyba systému';

  @override
  String get security_alert_type_device_offline => 'Zařízení offline';

  @override
  String get security_alert_type_unknown => 'Neznámý';

  @override
  String get security_event_alert_raised => 'Upozornění vyvoláno';

  @override
  String get security_event_alert_resolved => 'Upozornění vyřešeno';

  @override
  String get security_event_alert_acknowledged => 'Upozornění potvrzeno';

  @override
  String get security_event_alarm_state_changed => 'Stav alarmu změněn';

  @override
  String get security_event_arming_mode_changed => 'Režim zabezpečení změněn';

  @override
  String security_event_title_alert_raised(String alertType) {
    return 'Upozornění vyvoláno: $alertType';
  }

  @override
  String security_event_title_alert_resolved(String alertType) {
    return 'Upozornění vyřešeno: $alertType';
  }

  @override
  String security_event_title_alert_acknowledged(String alertType) {
    return 'Upozornění potvrzeno: $alertType';
  }

  @override
  String security_event_title_alarm_state_changed(String from, String to) {
    return 'Stav alarmu změněn: $from → $to';
  }

  @override
  String security_event_title_arming_mode_changed(String from, String to) {
    return 'Režim zabezpečení změněn: $from → $to';
  }

  @override
  String security_state_transition(String from, String to) {
    return '$from → $to';
  }

  @override
  String get security_state_unknown => 'neznámý';

  @override
  String get security_overlay_alarm_triggered => 'Alarm spuštěn';

  @override
  String get security_overlay_default_title => 'Bezpečnostní upozornění';
}

import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Slovak (`sk`).
class AppLocalizationsSk extends AppLocalizations {
  AppLocalizationsSk([String locale = 'sk']) : super(locale);

  @override
  String get value_not_available => 'N/A';

  @override
  String get value_not_set => 'Nenastavené';

  @override
  String get value_loading => 'Načítanie';

  @override
  String get information => 'Informácia';

  @override
  String get warning => 'Varovanie';

  @override
  String get error => 'Chyba';

  @override
  String get action_failed => 'Akciu sa nepodarilo spracovať';

  @override
  String get action_retry => 'Opakovať';

  @override
  String domain_data_load_failed(String domain) {
    return 'Nepodarilo sa načítať $domain';
  }

  @override
  String get domain_data_load_failed_description => 'Nepodarilo sa načítať dáta. Skontrolujte pripojenie a skúste to znova.';

  @override
  String get domain_not_configured_subtitle => 'Nenakonfigurované';

  @override
  String get services_not_available => 'Služby nie sú k dispozícii';

  @override
  String get button_ok => 'OK';

  @override
  String get button_cancel => 'Zrušiť';

  @override
  String get button_close => 'Zavrieť';

  @override
  String get button_confirm => 'Potvrdiť';

  @override
  String get button_done => 'Hotovo';

  @override
  String get unit_system_default => 'Predvolené';

  @override
  String get unit_celsius => 'Celzia (°C)';

  @override
  String get unit_fahrenheit => 'Fahrenheit (°F)';

  @override
  String get unit_wind_speed_ms => 'Metre za sekundu (m/s)';

  @override
  String get unit_wind_speed_kmh => 'Kilometre za hodinu (km/h)';

  @override
  String get unit_wind_speed_mph => 'Míle za hodinu (mph)';

  @override
  String get unit_wind_speed_knots => 'Uzly (kn)';

  @override
  String get unit_pressure_hpa => 'Hektopascal (hPa)';

  @override
  String get unit_pressure_mbar => 'Milibar (mbar)';

  @override
  String get unit_pressure_inhg => 'Palce ortuti (inHg)';

  @override
  String get unit_pressure_mmhg => 'Milimetre ortuti (mmHg)';

  @override
  String get unit_precipitation_mm => 'Milimetre (mm)';

  @override
  String get unit_precipitation_inches => 'Palce (in)';

  @override
  String get unit_distance_km => 'Kilometre (km)';

  @override
  String get unit_distance_miles => 'Míle (mi)';

  @override
  String get unit_distance_meters => 'Metre (m)';

  @override
  String get unit_distance_feet => 'Stopy (ft)';

  @override
  String get time_format_12h => '12 hodinový';

  @override
  String get time_format_24h => '24 hodinový';

  @override
  String get day_monday => 'Pondelok';

  @override
  String get day_tuesday => 'Utorok';

  @override
  String get day_wednesday => 'Streda';

  @override
  String get day_thursday => 'Štvrtok';

  @override
  String get day_friday => 'Piatok';

  @override
  String get day_saturday => 'Sobota';

  @override
  String get day_sunday => 'Nedeľa';

  @override
  String get day_monday_short => 'Po';

  @override
  String get day_tuesday_short => 'Ut';

  @override
  String get day_wednesday_short => 'St';

  @override
  String get day_thursday_short => 'Št';

  @override
  String get day_friday_short => 'Pi';

  @override
  String get day_saturday_short => 'So';

  @override
  String get day_sunday_short => 'Ne';

  @override
  String get message_error_tiles_not_configured_title => 'Žiadne dlaždice nie sú nakonfigurované!';

  @override
  String get message_error_tiles_not_configured_description => 'Nakonfigurujte aspoň jednu dlaždicu na obrazovke.';

  @override
  String get message_error_cards_not_configured_title => 'Žiadne karty nie sú nakonfigurované!';

  @override
  String get message_error_cards_not_configured_description => 'Nakonfigurujte aspoň jednu kartu na obrazovke.';

  @override
  String get message_error_device_not_found_title => 'Zariadenie nenájdené!';

  @override
  String get message_error_device_not_found_description => 'Požadované zariadenie sa nenašlo v aplikácii.';

  @override
  String get message_error_no_device_detail_title => 'Žiadne podrobnosti o zariadení!';

  @override
  String get message_error_no_device_detail_description => 'Pre vybrané zariadenie nie je k dispozícii stránka s podrobnosťami.';

  @override
  String get message_error_no_device_detail_preparing_title => 'Podrobnosti o zariadení nie sú pripravené!';

  @override
  String get message_error_no_device_detail_preparing_description => 'Pre vybrané zariadenie stránka s podrobnosťami ešte nie je pripravená.';

  @override
  String get device_status_offline => 'Offline';

  @override
  String get device_offline_message => 'Zariadenie je offline';

  @override
  String get device_offline_title => 'Zariadenie je offline';

  @override
  String get device_offline_description => 'Nie je možné komunikovať s týmto zariadením. Skontrolujte, či je zariadenie zapnuté a pripojené k sieti.';

  @override
  String get device_offline_retry => 'Skúsiť znova';

  @override
  String device_offline_last_seen(String time) {
    return 'Naposledy videné $time';
  }

  @override
  String devices_offline_skipped(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Preskočených $count offline zariadení',
      few: 'Preskočené $count offline zariadenia',
      one: 'Preskočené 1 offline zariadenie',
    );
    return '$_temp0';
  }

  @override
  String get all_devices_offline => 'Všetky zariadenia sú offline';

  @override
  String get time_ago_just_now => 'práve teraz';

  @override
  String time_ago_minutes(int count) {
    return 'pred $count min';
  }

  @override
  String time_ago_hours(int count) {
    return 'pred $count h';
  }

  @override
  String time_ago_days(int count) {
    return 'pred $count d';
  }

  @override
  String time_ago_medium_minutes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'pred $count minútami',
      few: 'pred $count minútami',
      one: 'pred 1 minútou',
    );
    return '$_temp0';
  }

  @override
  String time_ago_medium_hours(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'pred $count hodinami',
      few: 'pred $count hodinami',
      one: 'pred 1 hodinou',
    );
    return '$_temp0';
  }

  @override
  String time_ago_medium_days(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'pred $count dňami',
      few: 'pred $count dňami',
      one: 'pred 1 dňom',
    );
    return '$_temp0';
  }

  @override
  String time_ago_full_minutes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'pred $count minútami',
      few: 'pred $count minútami',
      one: 'pred 1 minútou',
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
      other: '$minutes minútami',
      few: '$minutes minútami',
      one: '1 minútou',
    );
    return 'pred $_temp0 $_temp1';
  }

  @override
  String time_ago_full_hours(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'pred $count hodinami',
      few: 'pred $count hodinami',
      one: 'pred 1 hodinou',
    );
    return '$_temp0';
  }

  @override
  String time_ago_full_days_hours(int days, int hours) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days dňami',
      few: '$days dňami',
      one: '1 dňom',
    );
    String _temp1 = intl.Intl.pluralLogic(
      hours,
      locale: localeName,
      other: '$hours hodinami',
      few: '$hours hodinami',
      one: '1 hodinou',
    );
    return 'pred $_temp0 $_temp1';
  }

  @override
  String time_ago_full_days(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'pred $count dňami',
      few: 'pred $count dňami',
      one: 'pred 1 dňom',
    );
    return '$_temp0';
  }

  @override
  String get device_config_issue => 'Problém s konfiguráciou';

  @override
  String get device_details => 'Podrobnosti zariadenia';

  @override
  String get message_error_page_not_found_title => 'Stránka nenájdená!';

  @override
  String get message_error_page_not_found_description => 'Požadovaná stránka sa nenašla v aplikácii.';

  @override
  String get electrical_energy_consumption_title => 'Spotreba energie';

  @override
  String get electrical_energy_consumption_description => 'Celková spotreba energie v priebehu času.';

  @override
  String get electrical_energy_average_power_title => 'Priemerný výkon';

  @override
  String get electrical_energy_average_power_description => 'Priemerný odber výkonu za posledný interval hlásenia.';

  @override
  String get electrical_generation_production_title => 'Výroba energie';

  @override
  String get electrical_generation_production_description => 'Celková energia vyrobená zdrojom výroby.';

  @override
  String get electrical_generation_power_title => 'Výkon výroby';

  @override
  String get electrical_generation_power_description => 'Aktuálny výkon zo zdroja výroby.';

  @override
  String get electrical_power_current_title => 'Prúd';

  @override
  String get electrical_power_current_description => 'Koľko elektriny preteká.';

  @override
  String get electrical_power_voltage_title => 'Napätie';

  @override
  String get electrical_power_voltage_description => 'Sila elektriny.';

  @override
  String get electrical_power_power_title => 'Výkon';

  @override
  String get electrical_power_power_description => 'Koľko energie sa práve spotrebúva.';

  @override
  String get electrical_power_frequency_title => 'Frekvencia';

  @override
  String get electrical_power_frequency_description => 'Ako stabilná je elektrina.';

  @override
  String get electrical_power_over_current_title => 'Preťaženie prúdu';

  @override
  String get electrical_power_over_current_description => 'Varovanie: Príliš veľký prúd.';

  @override
  String get electrical_power_over_voltage_title => 'Prepätie';

  @override
  String get electrical_power_over_voltage_description => 'Varovanie: Elektrina je príliš silná.';

  @override
  String get electrical_power_over_power_title => 'Preťaženie výkonu';

  @override
  String get electrical_power_over_power_description => 'Varovanie: Spotreba energie je príliš vysoká.';

  @override
  String get light_state_on => 'Zapnuté';

  @override
  String get light_state_on_description => 'Svetlo svieti';

  @override
  String get light_state_off => 'Vypnuté';

  @override
  String get light_state_failed => 'Zlyhalo';

  @override
  String get light_state_off_description => 'Svetlo nesvieti';

  @override
  String get light_state_brightness_description => 'Aktuálny jas.';

  @override
  String get light_state_mixed_description => 'Zariadenia majú rôzne hodnoty.';

  @override
  String get light_state_syncing_description => 'Synchronizácia zariadení...';

  @override
  String get light_state_not_synced_description => 'Zariadenia nie sú synchronizované';

  @override
  String get light_role_main => 'Hlavné';

  @override
  String get light_role_task => 'Pracovné';

  @override
  String get light_role_ambient => 'Okolitné';

  @override
  String get light_role_accent => 'Akcentové';

  @override
  String get light_role_night => 'Nočné';

  @override
  String get light_role_other => 'Ostatné';

  @override
  String get light_role_hidden => 'Skryté';

  @override
  String get light_role_on_description => 'Svetlá svietia';

  @override
  String get light_role_off_description => 'Svetlá nesvietia';

  @override
  String get light_role_not_synced_description => 'Synchronizácia zlyhala';

  @override
  String get light_role_syncing_description => 'Prebieha synchronizácia';

  @override
  String get light_role_mixed_description => 'Svetlá majú rôzne hodnoty';

  @override
  String get light_state_out_of_sync => 'Nesynchronizované';

  @override
  String get light_mode_off => 'Vypnuté';

  @override
  String get light_mode_on => 'Zapnuté';

  @override
  String get light_mode_brightness => 'Jas';

  @override
  String get light_mode_color => 'Farba';

  @override
  String get light_mode_temperature => 'Teplota';

  @override
  String get light_mode_saturation => 'Sýtosť';

  @override
  String get light_mode_white => 'Biele';

  @override
  String get light_mode_swatches => 'Palety';

  @override
  String get lights_more_scenes => 'Viac scén';

  @override
  String get thermostat_state_title => 'Stav termostatu';

  @override
  String get thermostat_state_configured_temperature_description => 'Nastavená teplota.';

  @override
  String get thermostat_state_current_temperature_description => 'Aktuálna teplota miestnosti.';

  @override
  String get thermostat_state_current_humidity_description => 'Aktuálna vlhkosť miestnosti.';

  @override
  String get thermostat_child_lock_title => 'Detská poistka';

  @override
  String get thermostat_openings_state_title => 'Okno je otvorené.';

  @override
  String get thermostat_openings_state_description => 'Termostat je vypnutý.';

  @override
  String get contact_sensor_window => 'Okno';

  @override
  String get contact_sensor_open => 'Otvorené';

  @override
  String get contact_sensor_closed => 'Zatvorené';

  @override
  String get leak_sensor_water => 'Únik vody';

  @override
  String get leak_sensor_detected => 'Detekovaný';

  @override
  String get leak_sensor_dry => 'Sucho';

  @override
  String get thermostat_lock_locked => 'Zamknuté';

  @override
  String get thermostat_lock_unlocked => 'Odomknuté';

  @override
  String get thermostat_mode_label => 'Režim';

  @override
  String get thermostat_mode_off => 'Vypnuté';

  @override
  String get thermostat_mode_heat => 'Kúrenie';

  @override
  String get thermostat_mode_cool => 'Chladenie';

  @override
  String get thermostat_mode_auto => 'Automaticky';

  @override
  String get thermostat_mode_manual => 'Ručne';

  @override
  String get thermostat_min => 'min';

  @override
  String get thermostat_max => 'max';

  @override
  String get thermostat_target_label => 'Cieľ';

  @override
  String get thermostat_state_off => 'Vypnuté';

  @override
  String get thermostat_state_heating => 'Kúrenie';

  @override
  String thermostat_state_heating_to(String temperature) {
    return 'Kúrenie na $temperature';
  }

  @override
  String get thermostat_state_cooling => 'Chladenie';

  @override
  String thermostat_state_cooling_to(String temperature) {
    return 'Chladenie na $temperature';
  }

  @override
  String get thermostat_state_idling => 'V pokoji';

  @override
  String thermostat_state_idle_at(String temperature) {
    return 'V pokoji na $temperature';
  }

  @override
  String get thermostat_with_invalid_configuration => 'Zariadenie termostatu je nesprávne nakonfigurované.';

  @override
  String get on_state_on => 'Zapnuté';

  @override
  String get on_state_off => 'Vypnuté';

  @override
  String get power_hint_tap_to_turn_on => 'Klepnutím zapnete';

  @override
  String get power_hint_tap_to_turn_off => 'Klepnutím vypnete';

  @override
  String get message_info_app_reboot_title => 'Reštartovanie zariadenia!';

  @override
  String get message_info_app_reboot_description => 'Počkajte, kým sa zariadenie reštartuje. Tento proces môže chvíľu trvať.';

  @override
  String get message_info_app_power_off_title => 'Vypínanie zariadenia!';

  @override
  String get message_info_app_power_off_description => 'Zariadenie sa vypína. Pre opätovné zapnutie použite tlačidlo napájania.';

  @override
  String get message_info_factory_reset_title => 'Reset zariadenia!';

  @override
  String get message_info_factory_reset_description => 'Všetky nastavenia a dáta budú vymazané. Zariadenie bude obnovené na továrenské nastavenia.';

  @override
  String get settings_general_settings_title => 'Všeobecné nastavenia';

  @override
  String get settings_general_settings_button_display_settings => 'Nastavenia displeja';

  @override
  String get settings_general_settings_button_language_settings => 'Nastavenia jazyka';

  @override
  String get settings_general_settings_button_audio_settings => 'Nastavenia zvuku';

  @override
  String get settings_general_settings_button_weather_settings => 'Nastavenia počasia';

  @override
  String get settings_general_settings_button_about => 'O aplikácii';

  @override
  String get settings_general_settings_button_maintenance => 'Údržba';

  @override
  String get settings_general_settings_button_voice_activation => 'Hlasová aktivácia';

  @override
  String get settings_voice_activation_settings_title => 'Nastavenia hlasovej aktivácie';

  @override
  String get settings_voice_activation_section_detection => 'Detekcia hlasovej aktivácie';

  @override
  String get settings_voice_activation_enable_label => 'Povoliť hlasovú aktiváciu';

  @override
  String settings_voice_activation_enable_description(String wakeWord) {
    return 'Povedzte \"$wakeWord\" na aktiváciu hlasových príkazov bez dotyku panela.';
  }

  @override
  String get settings_voice_activation_microphone_unavailable => 'Mikrofón nie je na tomto displeji dostupný alebo je vypnutý.';

  @override
  String get settings_voice_activation_section_sensitivity => 'Citlivosť';

  @override
  String get settings_voice_activation_sensitivity_label => 'Citlivosť detekcie';

  @override
  String get settings_voice_activation_sensitivity_description => 'Vyššia citlivosť detekuje tichšiu reč, ale môže reagovať na okolný hluk.';

  @override
  String get settings_voice_activation_section_status => 'Stav';

  @override
  String get settings_voice_activation_status_label => 'Stav enginu';

  @override
  String get settings_voice_activation_status_stopped => 'Zastavené';

  @override
  String get settings_voice_activation_status_listening => 'Počúvanie hlasovej aktivácie...';

  @override
  String get settings_voice_activation_status_recording => 'Nahrávanie reči...';

  @override
  String get settings_voice_activation_status_processing => 'Spracovanie zvuku...';

  @override
  String get settings_weather_settings_title => 'Nastavenia počasia';

  @override
  String get settings_weather_settings_temperature_unit_title => 'Jednotka teploty';

  @override
  String get settings_weather_settings_temperature_unit_description => 'Nastavte preferovanú jednotku teploty pre zobrazenie počasia.';

  @override
  String get settings_weather_settings_temperature_location_title => 'Poloha počasia';

  @override
  String get settings_weather_settings_temperature_location_description => 'Vyberte zdroj meteorologických dát.';

  @override
  String get settings_weather_settings_temperature_location_single => 'K dispozícii je iba jedna poloha.';

  @override
  String get settings_maintenance_title => 'Údržba';

  @override
  String get settings_maintenance_restart_title => 'Reštart';

  @override
  String get settings_maintenance_restart_description => 'Reštartujte zariadenie pre použitie zmien.';

  @override
  String get settings_maintenance_restart_confirm_title => 'Reštart zariadenia';

  @override
  String get settings_maintenance_restart_confirm_description => 'Naozaj chcete reštartovať zariadenie? Táto akcia dočasne preruší funkčnosť.';

  @override
  String get settings_maintenance_power_off_title => 'Vypnutie';

  @override
  String get settings_maintenance_power_off_description => 'Úplne vypnite zariadenie.';

  @override
  String get settings_maintenance_power_off_confirm_title => 'Vypnúť zariadenie';

  @override
  String get settings_maintenance_power_off_confirm_description => 'Naozaj chcete zariadenie vypnúť? Bude potrebné ho ručne znova zapnúť.';

  @override
  String get settings_maintenance_factory_reset_title => 'Továrenské nastavenia';

  @override
  String get settings_maintenance_factory_reset_description => 'Obnovte zariadenie do pôvodných továrenských nastavení.';

  @override
  String get settings_maintenance_factory_reset_confirm_title => 'Obnovenie továrenských nastavení';

  @override
  String get settings_maintenance_factory_reset_confirm_description => 'Naozaj chcete vymazať všetky dáta a obnoviť továrenské nastavenia zariadenia? Táto akcia je nevratná.';

  @override
  String get settings_maintenance_system_heading => 'Systém';

  @override
  String get settings_maintenance_danger_heading => 'Nebezpečná zóna';

  @override
  String get settings_maintenance_restart_display_description => 'Reštartujte tento displej pre aplikovanie zmien.';

  @override
  String get settings_maintenance_restart_display_confirm_title => 'Reštartovať displej';

  @override
  String get settings_maintenance_restart_display_confirm_description => 'Naozaj chcete reštartovať tento displej? Brána a ostatné displeje nebudú ovplyvnené.';

  @override
  String get settings_maintenance_power_off_display_description => 'Vypnite tento displej úplne.';

  @override
  String get settings_maintenance_power_off_display_confirm_title => 'Vypnúť displej';

  @override
  String get settings_maintenance_power_off_display_confirm_description => 'Naozaj chcete vypnúť tento displej? Bude potrebné ho znova ručne zapnúť. Brána nebude ovplyvnená.';

  @override
  String get settings_maintenance_factory_reset_display_description => 'Odoberte tento displej z brány a obnovte továrenské nastavenia.';

  @override
  String get settings_maintenance_factory_reset_display_confirm_title => 'Továrenské nastavenia displeja';

  @override
  String get settings_maintenance_factory_reset_display_confirm_description => 'Naozaj chcete obnoviť továrenské nastavenia tohto displeja? Bude odobraný z brány a všetky lokálne dáta budú vymazané. Táto akcia je nevratná.';

  @override
  String get settings_language_settings_title => 'Nastavenia jazyka';

  @override
  String get settings_language_settings_language_title => 'Jazyk';

  @override
  String get settings_language_settings_language_description => 'Vyberte si preferovaný jazyk.';

  @override
  String get settings_language_settings_timezone_title => 'Časové pásmo';

  @override
  String get settings_language_settings_timezone_description => 'Miestne časové pásmo.';

  @override
  String get settings_language_settings_time_format_title => 'Formát času';

  @override
  String get settings_language_settings_time_format_description => '12-hodinový alebo 24-hodinový formát.';

  @override
  String get settings_display_settings_title => 'Nastavenia displeja';

  @override
  String get settings_display_settings_theme_mode_title => 'Režim motívu';

  @override
  String get settings_display_settings_theme_mode_description => 'Prepnúť medzi svetlým a tmavým motívom.';

  @override
  String get settings_display_settings_brightness_title => 'Jas';

  @override
  String get settings_display_settings_brightness_description => 'Nastavenie úrovne jasu obrazovky.';

  @override
  String get settings_display_settings_screen_lock_title => 'Zamknutie obrazovky';

  @override
  String get settings_display_settings_screen_lock_description => 'Automatické zamknutie pri nečinnosti.';

  @override
  String get settings_display_settings_screen_saver_title => 'Šetrič obrazovky';

  @override
  String get settings_display_settings_screen_saver_description => 'Zobraziť šetrič pri nečinnosti.';

  @override
  String get settings_display_settings_unit_overrides_section => 'Prepísanie jednotiek';

  @override
  String get settings_display_settings_temperature_unit_title => 'Jednotka teploty';

  @override
  String get settings_display_settings_temperature_unit_description => 'Prepísať systémovú jednotku teploty pre tento displej.';

  @override
  String get settings_display_settings_wind_speed_unit_title => 'Jednotka rýchlosti vetra';

  @override
  String get settings_display_settings_wind_speed_unit_description => 'Prepísať systémovú jednotku rýchlosti vetra pre tento displej.';

  @override
  String get settings_display_settings_pressure_unit_title => 'Jednotka tlaku';

  @override
  String get settings_display_settings_pressure_unit_description => 'Prepísať systémovú jednotku tlaku pre tento displej.';

  @override
  String get settings_display_settings_precipitation_unit_title => 'Jednotka zrážok';

  @override
  String get settings_display_settings_precipitation_unit_description => 'Prepísať systémovú jednotku zrážok pre tento displej.';

  @override
  String get settings_display_settings_distance_unit_title => 'Jednotka vzdialenosti';

  @override
  String get settings_display_settings_distance_unit_description => 'Prepísať systémovú jednotku vzdialenosti pre tento displej.';

  @override
  String get settings_audio_settings_title => 'Nastavenia zvuku';

  @override
  String get settings_audio_settings_speaker_title => 'Reproduktor';

  @override
  String get settings_audio_settings_speaker_description => 'Povoliť alebo zakázať reproduktor.';

  @override
  String get settings_audio_settings_speaker_volume_title => 'Hlasitosť reproduktora';

  @override
  String get settings_audio_settings_speaker_volume_description => 'Nastavenie hlasitosti výstupu.';

  @override
  String get settings_audio_settings_microphone_title => 'Mikrofón';

  @override
  String get settings_audio_settings_microphone_description => 'Povoliť alebo zakázať mikrofón.';

  @override
  String get settings_audio_settings_microphone_volume_title => 'Hlasitosť mikrofónu';

  @override
  String get settings_audio_settings_microphone_volume_description => 'Nastavenie citlivosti vstupu.';

  @override
  String get settings_audio_settings_no_support => 'Tento displej nepodporuje zvukový vstup ani výstup.';

  @override
  String get settings_about_title => 'O aplikácii';

  @override
  String get settings_about_about_heading => 'O aplikácii';

  @override
  String get settings_about_about_info => 'FastyBird Smart Panel je aplikácia pre inteligentnú domácnosť, ktorá umožňuje bezproblémovú integráciu s vašimi inteligentnými zariadeniami a ponúka lepšie ovládanie a monitorovanie.';

  @override
  String get settings_about_developed_by_heading => 'Vyvinuté';

  @override
  String get settings_about_license_heading => 'Licencia';

  @override
  String get settings_about_device_information_heading => 'Informácie o zariadení';

  @override
  String get settings_about_show_license_button => 'Zobraziť licenciu';

  @override
  String get settings_about_ip_address_title => 'IP adresa';

  @override
  String get settings_about_mac_address_title => 'MAC adresa';

  @override
  String get settings_about_cpu_usage_title => 'Využitie CPU';

  @override
  String get settings_about_memory_usage_title => 'Využitie pamäte';

  @override
  String get weather_forecast_title => 'Predpoveď počasia';

  @override
  String get weather_forecast_feels_like => 'Pocitová teplota:';

  @override
  String get weather_forecast_humidity => 'Vlhkosť:';

  @override
  String get weather_detail_rain => 'Dážď';

  @override
  String get weather_detail_snow => 'Sneh';

  @override
  String get weather_detail_sunrise => 'Východ slnka';

  @override
  String get weather_detail_sunset => 'Západ slnka';

  @override
  String get weather_detail_forecast => 'Predpoveď';

  @override
  String get weather_detail_not_configured => 'Počasie nie je nakonfigurované';

  @override
  String get weather_detail_today => 'Dnes';

  @override
  String get weather_detail_hourly_forecast => 'Hodinová predpoveď';

  @override
  String get weather_condition_thunderstorm_with_light_rain => 'Búrka s ľahkým dažďom';

  @override
  String get weather_condition_thunderstorm_with_rain => 'Búrka s dažďom';

  @override
  String get weather_condition_thunderstorm_with_heavy_rain => 'Búrka s prudkým dažďom';

  @override
  String get weather_condition_light_thunderstorm => 'Slabá búrka';

  @override
  String get weather_condition_thunderstorm => 'Búrka';

  @override
  String get weather_condition_heavy_thunderstorm => 'Silná búrka';

  @override
  String get weather_condition_ragged_thunderstorm => 'Nepravidelná búrka';

  @override
  String get weather_condition_thunderstorm_with_light_drizzle => 'Búrka s ľahkým mrholením';

  @override
  String get weather_condition_thunderstorm_with_drizzle => 'Búrka s mrholením';

  @override
  String get weather_condition_thunderstorm_with_heavy_drizzle => 'Búrka s hustým mrholením';

  @override
  String get weather_condition_light_intensity_drizzle => 'Ľahké mrholenie';

  @override
  String get weather_condition_drizzle => 'Mrholenie';

  @override
  String get weather_condition_heavy_intensity_drizzle => 'Husté mrholenie';

  @override
  String get weather_condition_light_intensity_drizzle_rain => 'Ľahké mrholenie prechádzajúce do dažďa';

  @override
  String get weather_condition_drizzle_rain => 'Mrholenie s dažďom';

  @override
  String get weather_condition_heavy_intensity_drizzle_rain => 'Husté mrholenie prechádzajúce do dažďa';

  @override
  String get weather_condition_shower_rain_and_drizzle => 'Prehánky s mrholením';

  @override
  String get weather_condition_heavy_shower_rain_and_drizzle => 'Silné prehánky s mrholením';

  @override
  String get weather_condition_shower_drizzle => 'Prehánkové mrholenie';

  @override
  String get weather_condition_light_rain => 'Ľahký dážď';

  @override
  String get weather_condition_moderate_rain => 'Mierny dážď';

  @override
  String get weather_condition_heavy_intensity_rain => 'Silný dážď';

  @override
  String get weather_condition_very_heavy_rain => 'Veľmi silný dážď';

  @override
  String get weather_condition_extreme_rain => 'Extrémny dážď';

  @override
  String get weather_condition_freezing_rain => 'Mrznúci dážď';

  @override
  String get weather_condition_light_intensity_shower_rain => 'Ľahké dažďové prehánky';

  @override
  String get weather_condition_shower_rain => 'Dažďové prehánky';

  @override
  String get weather_condition_heavy_intensity_shower_rain => 'Silné dažďové prehánky';

  @override
  String get weather_condition_ragged_shower_rain => 'Nepravidelné dažďové prehánky';

  @override
  String get weather_condition_light_snow => 'Ľahký sneh';

  @override
  String get weather_condition_snow => 'Sneh';

  @override
  String get weather_condition_heavy_snow => 'Silný sneh';

  @override
  String get weather_condition_sleet => 'Snehová krúpava';

  @override
  String get weather_condition_light_shower_sleet => 'Ľahké prehánky so snehovou krúpavou';

  @override
  String get weather_condition_shower_sleet => 'Prehánky so snehovou krúpavou';

  @override
  String get weather_condition_light_rain_and_snow => 'Ľahký dážď so snehom';

  @override
  String get weather_condition_rain_and_snow => 'Dážď so snehom';

  @override
  String get weather_condition_light_shower_snow => 'Ľahké snehové prehánky';

  @override
  String get weather_condition_shower_snow => 'Snehové prehánky';

  @override
  String get weather_condition_heavy_shower_snow => 'Silné snehové prehánky';

  @override
  String get weather_condition_mist => 'Hmla';

  @override
  String get weather_condition_smoke => 'Dym';

  @override
  String get weather_condition_haze => 'Opar';

  @override
  String get weather_condition_fog => 'Hustá hmla';

  @override
  String get weather_condition_sand => 'Piesok';

  @override
  String get weather_condition_dust => 'Prach';

  @override
  String get weather_condition_volcanic_ash => 'Sopečný popol';

  @override
  String get weather_condition_squalls => 'Nárazový vietor';

  @override
  String get weather_condition_tornado => 'Tornádo';

  @override
  String get weather_condition_clear_sky => 'Jasná obloha';

  @override
  String get weather_condition_few_clouds => 'Málo oblačnosti';

  @override
  String get weather_condition_scattered_clouds => 'Rozptýlená oblačnosť';

  @override
  String get weather_condition_broken_clouds => 'Polojasno';

  @override
  String get weather_condition_overcast_clouds => 'Zamračené';

  @override
  String get weather_condition_unknown => 'Neznáme';

  @override
  String get discovery_searching_title => 'Hľadanie brán';

  @override
  String get discovery_searching_description => 'Hľadám brány FastyBird Smart Panel vo vašej sieti...';

  @override
  String discovery_found_count(int count) {
    return 'Nájdených $count brán...';
  }

  @override
  String get discovery_select_title => 'Vyberte bránu';

  @override
  String discovery_select_description(int count) {
    return 'Nájdených $count brán vo vašej sieti:';
  }

  @override
  String get discovery_not_found_title => 'Brána nenájdená';

  @override
  String get discovery_not_found_description => 'Nepodarilo sa nájsť žiadnu bránu FastyBird Smart Panel vo vašej sieti.\n\nUistite sa, že brána beží a je pripojená k rovnakej sieti ako toto zariadenie.';

  @override
  String get discovery_error_title => 'Chyba vyhľadávania';

  @override
  String get discovery_error_description => 'Pri hľadaní brán došlo k chybe.\n\nSkontrolujte pripojenie k sieti a skúste to znova.';

  @override
  String discovery_error_failed(String error) {
    return 'Vyhľadávanie zlyhalo: $error';
  }

  @override
  String get discovery_connecting_title => 'Pripájanie k bráne';

  @override
  String discovery_connecting_description(String address) {
    return 'Kontaktujem $address...';
  }

  @override
  String get discovery_connecting_fallback => 'bránu';

  @override
  String get discovery_manual_entry_title => 'Zadajte adresu brány';

  @override
  String get discovery_manual_entry_hint => '192.168.1.100:3000';

  @override
  String get discovery_manual_entry_label => 'Adresa brány';

  @override
  String get discovery_manual_entry_help => 'Zadajte IP adresu alebo hostname s voliteľným portom.\nPríklady: 192.168.1.100:3000, gateway.local, 10.0.0.5';

  @override
  String get discovery_validation_empty => 'Prosím zadajte adresu brány';

  @override
  String get discovery_validation_invalid => 'Neplatná adresa. Zadajte platnú IP adresu alebo hostname.';

  @override
  String get discovery_button_back => 'Späť';

  @override
  String get discovery_button_connect => 'Pripojiť';

  @override
  String get discovery_button_connect_selected => 'Pripojiť k vybranej bráne';

  @override
  String get discovery_button_rescan => 'Znova vyhľadať';

  @override
  String get discovery_button_try_again => 'Skúsiť znova';

  @override
  String get discovery_button_manual => 'Zadať ručne';

  @override
  String get discovery_button_cancel => 'Zrušiť';

  @override
  String get room_selection_title => 'Vyberte miestnosť';

  @override
  String room_selection_description(int count) {
    return 'Zvoľte, ku ktorej miestnosti tento displej patrí ($count k dispozícii):';
  }

  @override
  String get room_selection_button_confirm => 'Priradiť k tejto miestnosti';

  @override
  String get room_selection_saving => 'Priraďovanie miestnosti...';

  @override
  String get room_selection_error => 'Priradenie miestnosti sa nepodarilo. Skúste to znova.';

  @override
  String get room_selection_empty_title => 'Žiadne miestnosti';

  @override
  String get room_selection_empty_description => 'Zatiaľ neboli vytvorené žiadne miestnosti. Otvorte administráciu a pridajte aspoň jednu miestnosť.';

  @override
  String get action_success => 'Akcia bola úspešne dokončená';

  @override
  String get space_lighting_controls_title => 'Ovládanie osvetlenia';

  @override
  String get space_lighting_mode_off => 'Vyp';

  @override
  String get space_lighting_mode_work => 'Práca';

  @override
  String get space_lighting_mode_relax => 'Relax';

  @override
  String get space_lighting_mode_night => 'Noc';

  @override
  String get space_devices_title => 'Zariadenia';

  @override
  String get space_devices_placeholder => 'Zariadenia v tejto miestnosti sa zobrazia tu';

  @override
  String get space_climate_controls_title => 'Klimatizácia';

  @override
  String get space_climate_current_label => 'Aktuálna';

  @override
  String get space_climate_target_label => 'Cieľová';

  @override
  String get climate_role_auxiliary => 'Pomocné';

  @override
  String get climate_tap_for_details => 'Klepnite pre detaily';

  @override
  String get climate_role_ventilation => 'Vetranie';

  @override
  String get climate_role_humidity => 'Ovládanie vlhkosti';

  @override
  String get climate_role_other => 'Ostatné zariadenia';

  @override
  String get space_suggestion_applied => 'Návrh bol aplikovaný';

  @override
  String get space_suggestion_dismissed => 'Návrh bol zamietnutý';

  @override
  String get space_undo_success => 'Akcia bola vrátená';

  @override
  String get space_undo_button => 'Späť';

  @override
  String get space_empty_state_title => 'Displej je pripravený';

  @override
  String space_empty_state_description(String spaceName) {
    return 'Pre pridanie zariadení a ovládacích prvkov nastavte \"$spaceName\" cez administráciu.';
  }

  @override
  String get space_sensors_only_title => 'Iba senzory';

  @override
  String get space_sensors_only_description => 'Táto miestnosť má iba senzory — žiadne ovládateľné zariadenia';

  @override
  String get house_overview_no_spaces_title => 'Žiadne miestnosti nie sú nakonfigurované';

  @override
  String get house_overview_no_spaces_description => 'Vytvorte miestnosti cez administráciu, aby sa tu zobrazili';

  @override
  String get house_overview_no_space_page => 'Pre túto miestnosť nie je nakonfigurovaná stránka';

  @override
  String get house_overview_tap_to_view => 'Klepnutím zobrazíte';

  @override
  String get house_modes_home => 'Doma';

  @override
  String get house_modes_home_description => 'Normálna prevádzka doma';

  @override
  String get house_modes_away => 'Preč';

  @override
  String get house_modes_away_description => 'Mimo domova';

  @override
  String get house_modes_night => 'Noc';

  @override
  String get house_modes_night_description => 'Nočné nastavenia';

  @override
  String get house_modes_changed_success => 'Režim domu bol úspešne zmenený';

  @override
  String get house_modes_changed_error => 'Zmena režimu domu sa nepodarila';

  @override
  String get house_modes_confirm_title => 'Potvrdiť zmenu režimu';

  @override
  String get house_modes_confirm_away_description => 'Naozaj chcete nastaviť dom do režimu Preč? To môže ovplyvniť pravidlá automatizácie a nastavenia zabezpečenia.';

  @override
  String get space_scenes_title => 'Rýchle scény';

  @override
  String get space_scene_triggered => 'Scéna aktivovaná';

  @override
  String get space_scene_partial_success => 'Scéna čiastočne aktivovaná';

  @override
  String get window_covering_status_open => 'Otvorené';

  @override
  String get window_covering_status_closed => 'Zatvorené';

  @override
  String get window_covering_status_opening => 'Otváranie';

  @override
  String get window_covering_status_closing => 'Zatváranie';

  @override
  String get window_covering_status_stopped => 'Zastavené';

  @override
  String get window_covering_type_curtain => 'Záclona';

  @override
  String get window_covering_type_blind => 'Žalúzia';

  @override
  String get window_covering_type_roller => 'Roleta';

  @override
  String get window_covering_type_outdoor_blind => 'Vonkajšia žalúzia';

  @override
  String get window_covering_type_venetian_blind => 'Benátska žalúzia';

  @override
  String get window_covering_type_vertical_blind => 'Vertikálna žalúzia';

  @override
  String get window_covering_type_shutter => 'Okenica';

  @override
  String get window_covering_type_awning => 'Markíza';

  @override
  String get window_covering_command_open => 'Otvoriť';

  @override
  String get window_covering_command_close => 'Zatvoriť';

  @override
  String get window_covering_command_stop => 'Zastaviť';

  @override
  String get window_covering_position_label => 'Pozícia';

  @override
  String get window_covering_position_description => 'Aktuálna pozícia';

  @override
  String get window_covering_tilt_label => 'Náklon';

  @override
  String get window_covering_tilt_description => 'Úprava uhla lamiel';

  @override
  String get window_covering_obstruction_warning => 'Zistená prekážka';

  @override
  String get window_covering_fault_warning => 'Zistená porucha';

  @override
  String get window_covering_preset_morning => 'Ráno';

  @override
  String get window_covering_preset_day => 'Deň';

  @override
  String get window_covering_preset_evening => 'Večer';

  @override
  String get window_covering_preset_night => 'Noc';

  @override
  String get window_covering_preset_privacy => 'Súkromie';

  @override
  String get window_covering_preset_away => 'Preč';

  @override
  String get window_covering_presets_label => 'Predvoľby';

  @override
  String get window_covering_channels_label => 'Žalúzie';

  @override
  String get window_covering_info_status => 'Stav';

  @override
  String get window_covering_info_obstruction => 'Prekážka';

  @override
  String get window_covering_obstruction_detected => 'Zistená';

  @override
  String get window_covering_obstruction_clear => 'Voľno';

  @override
  String window_covering_position_open_percent(int position) {
    return '$position% Otvorené';
  }

  @override
  String get battery_title => 'Batéria';

  @override
  String get connection_lost_title => 'Spojenie stratené';

  @override
  String get connection_lost_message => 'Nie je možné sa pripojiť k bráne. Skontrolujte sieťové pripojenie a skúste to znova.';

  @override
  String get connection_lost_button_reconnect => 'Znova pripojiť';

  @override
  String get connection_lost_button_change_gateway => 'Zmeniť bránu';

  @override
  String get button_retry => 'Opakovať';

  @override
  String get button_sync_all => 'Synchronizovať všetko';

  @override
  String get system_view_room => 'Miestnosť';

  @override
  String get system_view_master => 'Domov';

  @override
  String get deck_nav_more => 'Viac';

  @override
  String get deck_all_pages => 'Všetky stránky';

  @override
  String get system_view_entry => 'Vstup';

  @override
  String get domain_lights => 'Svetlá';

  @override
  String get domain_lights_other => 'Ostatné svetlá';

  @override
  String get domain_lights_empty_title => 'Osvetlenie nenastavené';

  @override
  String get domain_lights_empty_description => 'Roly osvetlenia neboli pre túto miestnosť nastavené. Nakonfigurujte roly v administrácii.';

  @override
  String domain_lights_count_on(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count svetiel zapnutých',
      few: '$count svetlá zapnuté',
      one: '1 svetlo zapnuté',
    );
    return '$_temp0';
  }

  @override
  String get domain_lights_all_off => 'všetko vypnuté';

  @override
  String get domain_lights_all_on => 'všetko zapnuté';

  @override
  String get domain_lights_button_all_off => 'Všetko vypnúť';

  @override
  String get domain_lights_button_all_on => 'Všetko zapnúť';

  @override
  String get domain_lights_syncing => 'synchronizujem';

  @override
  String get domain_lights_unsynced => 'nesynchronizované';

  @override
  String get domain_lights_mixed => 'rôzne hodnoty';

  @override
  String get domain_climate => 'Klíma';

  @override
  String get domain_climate_empty_title => 'Klíma nenastavená';

  @override
  String get domain_climate_empty_description => 'V tejto miestnosti nie sú nastavené žiadne termostaty ani klimatizácie. Pridajte klimatické zariadenia v administrácii.';

  @override
  String get domain_media => 'Médiá';

  @override
  String media_devices_summary(Object count) {
    return '$count zariadení';
  }

  @override
  String media_devices_summary_on(Object count, Object on) {
    return '$count zariadení • $on zapnutých';
  }

  @override
  String get media_modes_title => 'Režimy';

  @override
  String get media_action_power_on => 'Zapnúť';

  @override
  String get media_action_power_off => 'Vypnúť';

  @override
  String get media_action_mute => 'Stlmiť';

  @override
  String get media_action_unmute => 'Zrušiť stlmenie';

  @override
  String get media_mode_off => 'Vypnuté';

  @override
  String get media_mode_background => 'Pozadie';

  @override
  String get media_mode_focused => 'Sústredenie';

  @override
  String get media_mode_party => 'Párty';

  @override
  String get media_roles_title => 'Roly';

  @override
  String media_role_summary(Object on, Object total) {
    return '$on z $total zapnutých';
  }

  @override
  String get media_roles_unassigned => 'Nepriradené zariadenia';

  @override
  String get media_role_primary => 'Primárne';

  @override
  String get media_role_secondary => 'Sekundárne';

  @override
  String get media_role_background => 'Pozadie';

  @override
  String get media_role_gaming => 'Hranie';

  @override
  String get media_role_hidden => 'Skryté';

  @override
  String get media_targets_title => 'Zariadenia';

  @override
  String get media_capability_power => 'Napájanie';

  @override
  String get media_capability_volume => 'Hlasitosť';

  @override
  String get media_capability_mute => 'Stlmenie';

  @override
  String get media_capability_none => 'Bez schopností';

  @override
  String get media_no_endpoints_title => 'Žiadne mediálne zariadenia';

  @override
  String get media_no_endpoints_description => 'Táto miestnosť nemá žiadne mediálne zariadenia. Pridajte TV, reproduktor alebo streamer.';

  @override
  String get media_no_bindings_description => 'Mediálne aktivity sa konfigurujú. Potiahnite pre obnovenie.';

  @override
  String get media_ws_offline_title => 'Spojenie stratené';

  @override
  String get media_ws_offline_description => 'Mediálne ovládanie vyžaduje aktívne pripojenie. Pripájanie...';

  @override
  String get domain_sensors => 'Senzory';

  @override
  String get domain_energy => 'Energia';

  @override
  String get energy_consumption => 'Spotreba';

  @override
  String get energy_production => 'Výroba';

  @override
  String get energy_net => 'Čistá';

  @override
  String get energy_range_today => 'Dnes';

  @override
  String get energy_range_week => 'Týždeň';

  @override
  String get energy_range_month => 'Mesiac';

  @override
  String get energy_top_consumers => 'Najväčší spotrebitelia';

  @override
  String get energy_chart_title => 'Spotreba v čase';

  @override
  String get energy_summary_title => 'Prehľad';

  @override
  String get energy_unit_kwh => 'kWh';

  @override
  String get energy_empty_title => 'Žiadne dáta o energii';

  @override
  String get energy_empty_description => 'V tomto priestore nie sú žiadne zariadenia pre monitoring energie';

  @override
  String get energy_load_failed => 'Nepodarilo sa načítať dáta o energii';

  @override
  String get energy_consumed_today => 'Celková spotreba energie dnes';

  @override
  String get energy_consumed_week => 'Celková spotreba energie tento týždeň';

  @override
  String get energy_consumed_month => 'Celková spotreba energie tento mesiac';

  @override
  String get energy_comparison_vs_yesterday => 'oproti včerajšku';

  @override
  String get energy_comparison_vs_last_week => 'oproti minulému týždňu';

  @override
  String get energy_comparison_vs_last_month => 'oproti minulému mesiacu';

  @override
  String energy_comparison_same(String period) {
    return 'Rovnako ako $period';
  }

  @override
  String get energy_period_yesterday => 'včera';

  @override
  String get energy_period_last_week => 'minulý týždeň';

  @override
  String get energy_period_last_month => 'minulý mesiac';

  @override
  String energy_device_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count zariadení',
      few: '$count zariadenia',
      one: '1 zariadenie',
    );
    return '$_temp0';
  }

  @override
  String get device_category_lighting => 'Osvetlenie';

  @override
  String get device_category_climate => 'Klíma';

  @override
  String get device_category_sensors => 'Senzory';

  @override
  String get device_category_media => 'Médiá';

  @override
  String get master_rooms => 'Miestnosti';

  @override
  String get master_devices => 'Zariadenia';

  @override
  String get master_scenes => 'Scény';

  @override
  String get master_quick_actions => 'Rýchle akcie';

  @override
  String get entry_mode_activated => 'Režim aktivovaný';

  @override
  String get entry_house_modes => 'Režimy domu';

  @override
  String get entry_mode_home => 'Doma';

  @override
  String get entry_mode_away => 'Preč';

  @override
  String get entry_mode_night => 'Noc';

  @override
  String get entry_mode_movie => 'Film';

  @override
  String get entry_security => 'Zabezpečenie';

  @override
  String get entry_no_security_devices => 'Žiadne bezpečnostné zariadenia nie sú nakonfigurované';

  @override
  String get entry_locks => 'Zámky';

  @override
  String get entry_alarm => 'Alarm';

  @override
  String get entry_cameras => 'Kamery';

  @override
  String get air_quality_level_excellent => 'Vynikajúca';

  @override
  String get air_quality_level_good => 'Dobrá';

  @override
  String get air_quality_level_fair => 'Prijateľná';

  @override
  String get air_quality_level_inferior => 'Horšia';

  @override
  String get air_quality_level_poor => 'Zlá';

  @override
  String get air_quality_level_unknown => 'Neznáma';

  @override
  String get aqi_label_good => 'Dobrá';

  @override
  String get aqi_label_moderate => 'Stredná';

  @override
  String get aqi_label_unhealthy_sensitive => 'Nezdravá (citliví)';

  @override
  String get aqi_label_unhealthy => 'Nezdravá';

  @override
  String get aqi_label_very_unhealthy => 'Veľmi nezdravá';

  @override
  String get aqi_label_hazardous => 'Nebezpečná';

  @override
  String get particulate_label_pm1 => 'PM1';

  @override
  String get particulate_label_pm25 => 'PM2.5';

  @override
  String get particulate_label_pm10 => 'PM10';

  @override
  String get sensor_enum_voc_level_low => 'Nízka';

  @override
  String get sensor_enum_voc_level_low_long => 'Nízka úroveň VOC';

  @override
  String get sensor_enum_voc_level_medium => 'Str.';

  @override
  String get sensor_enum_voc_level_medium_long => 'Stredná úroveň VOC';

  @override
  String get sensor_enum_voc_level_high => 'Vys.';

  @override
  String get sensor_enum_voc_level_high_long => 'Vysoká úroveň VOC';

  @override
  String get fan_mode_auto => 'Automatický';

  @override
  String get fan_mode_manual => 'Ručný';

  @override
  String get fan_mode_eco => 'Eko';

  @override
  String get fan_mode_sleep => 'Spánok';

  @override
  String get fan_mode_natural => 'Prirodzený';

  @override
  String get fan_mode_turbo => 'Turbo';

  @override
  String get fan_speed_off => 'Vypnuté';

  @override
  String get fan_speed_low => 'Nízke';

  @override
  String get fan_speed_medium => 'Stredné';

  @override
  String get fan_speed_high => 'Vysoké';

  @override
  String get fan_speed_turbo => 'Turbo';

  @override
  String get fan_speed_auto => 'Automaticky';

  @override
  String get fan_timer_off => 'Vypnuté';

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
  String get fan_direction_clockwise => 'V smere';

  @override
  String get fan_direction_counter_clockwise => 'Proti smeru';

  @override
  String get filter_status_good => 'Dobrý';

  @override
  String get filter_status_replace_soon => 'Čoskoro';

  @override
  String get filter_status_replace_now => 'Vymeniť';

  @override
  String get filter_status_unknown => 'Neznámy';

  @override
  String get dehumidifier_mode_auto => 'Automatický';

  @override
  String get dehumidifier_mode_manual => 'Ručný';

  @override
  String get dehumidifier_mode_continuous => 'Kontinuálny';

  @override
  String get dehumidifier_mode_laundry => 'Sušenie bielizne';

  @override
  String get dehumidifier_mode_quiet => 'Tichý';

  @override
  String get dehumidifier_status_idle => 'Nečinný';

  @override
  String get dehumidifier_status_dehumidifying => 'Odvlhčuje';

  @override
  String get dehumidifier_status_defrosting => 'Odmrazuje';

  @override
  String get dehumidifier_timer_off => 'Vypnuté';

  @override
  String get dehumidifier_timer_30m => '30 min';

  @override
  String get dehumidifier_timer_1h => '1 hodina';

  @override
  String get dehumidifier_timer_2h => '2 hodiny';

  @override
  String get dehumidifier_timer_4h => '4 hodiny';

  @override
  String get dehumidifier_timer_8h => '8 hodín';

  @override
  String get dehumidifier_timer_12h => '12 hodín';

  @override
  String get dehumidifier_water_tank => 'Nádrž';

  @override
  String get dehumidifier_defrost => 'Odmrazovanie';

  @override
  String get dehumidifier_defrost_active => 'Odmrazuje';

  @override
  String get humidifier_mode_auto => 'Automatický';

  @override
  String get humidifier_mode_manual => 'Ručný';

  @override
  String get humidifier_mode_sleep => 'Spánok';

  @override
  String get humidifier_mode_baby => 'Detský';

  @override
  String get humidifier_status_idle => 'Nečinný';

  @override
  String get humidifier_status_humidifying => 'Zvlhčuje';

  @override
  String get humidifier_mist_level => 'Úroveň hmly';

  @override
  String get humidifier_mist_level_off => 'Vypnuté';

  @override
  String get humidifier_mist_level_low => 'Nízka';

  @override
  String get humidifier_mist_level_medium => 'Stredná';

  @override
  String get humidifier_mist_level_high => 'Vysoká';

  @override
  String get humidifier_timer_off => 'Vypnuté';

  @override
  String get humidifier_timer_30m => '30 min';

  @override
  String get humidifier_timer_1h => '1 hodina';

  @override
  String get humidifier_timer_2h => '2 hodiny';

  @override
  String get humidifier_timer_4h => '4 hodiny';

  @override
  String get humidifier_timer_8h => '8 hodín';

  @override
  String get humidifier_timer_12h => '12 hodín';

  @override
  String get humidifier_water_tank => 'Nádrž';

  @override
  String get humidifier_warm_mist => 'Teplá para';

  @override
  String get device_current_humidity => 'Aktuálna';

  @override
  String get device_current_temperature => 'Teplota';

  @override
  String get device_fan_speed => 'Rýchlosť';

  @override
  String get device_fan_mode => 'Režim ventilátora';

  @override
  String get device_timer => 'Časovač';

  @override
  String get device_child_lock => 'Detská poistka';

  @override
  String get device_oscillation => 'Oscilácia';

  @override
  String get device_direction => 'Smer';

  @override
  String get device_natural_breeze => 'Prírodný vánok';

  @override
  String get device_auto_off_timer => 'Automatické vypnutie';

  @override
  String get device_filter_life => 'Životnosť filtra';

  @override
  String get device_filter_status => 'Filter';

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
  String get gas_detected => 'Detekovaný';

  @override
  String get gas_clear => 'Čistý';

  @override
  String get gas_level_low => 'Nízky';

  @override
  String get gas_level_medium => 'Stredný';

  @override
  String get gas_level_high => 'Vysoký';

  @override
  String get device_humidity => 'Vlhkosť';

  @override
  String get device_air_quality_index => 'Index kvality vzduchu';

  @override
  String get device_temperature => 'Teplota';

  @override
  String get device_sensors => 'Senzory';

  @override
  String get device_controls => 'Ovládanie';

  @override
  String get device_settings => 'Nastavenia';

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
  String get media_playing => 'Prehráva';

  @override
  String get media_idle => 'Nečinný';

  @override
  String get media_standby => 'Pohotovosť';

  @override
  String get media_volume => 'Hlasitosť';

  @override
  String get media_source => 'Zdroj';

  @override
  String get media_queue => 'Fronta';

  @override
  String get media_up_next => 'Ďalší';

  @override
  String get media_other_devices => 'Ostatné zariadenia';

  @override
  String get device_status_standby => 'Pohotovosť';

  @override
  String get device_status_active => 'Aktívny';

  @override
  String get device_status_inactive => 'Neaktívny';

  @override
  String get climate_devices_section => 'Klimatizačné zariadenia';

  @override
  String get climate_more_sensors => 'Viac senzorov';

  @override
  String get domain_shading => 'Tienenie';

  @override
  String get domain_shading_empty_title => 'Tienenie nenastavené';

  @override
  String get domain_shading_empty_description => 'Roly tienenia neboli pre túto miestnosť nastavené. Nakonfigurujte roly v administrácii.';

  @override
  String get shading_modes_title => 'Režimy';

  @override
  String get shading_devices_title => 'Zariadenia';

  @override
  String shading_devices_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count zariadení',
      few: '$count zariadenia',
      one: '1 zariadenie',
    );
    return '$_temp0';
  }

  @override
  String get shading_action_open => 'Otvoriť';

  @override
  String get shading_action_close => 'Zatvoriť';

  @override
  String get shading_action_stop => 'Zastaviť';

  @override
  String get shading_state_open => 'Otvorené';

  @override
  String get shading_state_closed => 'Zatvorené';

  @override
  String shading_state_partial(int position) {
    return '$position% otvorené';
  }

  @override
  String get shading_position => 'Pozícia';

  @override
  String get shading_tap_for_controls => 'Klepnite pre ovládanie';

  @override
  String get shading_hide_controls => 'Skryť ovládanie';

  @override
  String get covers_mode_open => 'Otvorené';

  @override
  String get covers_mode_closed => 'Zatvorené';

  @override
  String get covers_mode_privacy => 'Súkromie';

  @override
  String get covers_mode_daylight => 'Denné svetlo';

  @override
  String get domain_mode_custom => 'Vlastné';

  @override
  String get covers_role_primary => 'Hlavné';

  @override
  String get covers_role_blackout => 'Zatemnenie';

  @override
  String get covers_role_sheer => 'Záclony';

  @override
  String get covers_role_outdoor => 'Vonkajšie';

  @override
  String get covers_role_hidden => 'Skryté';

  @override
  String get cover_type_curtain => 'Záclona';

  @override
  String get cover_type_blind => 'Žalúzia';

  @override
  String get cover_type_roller => 'Roleta';

  @override
  String get cover_type_outdoor_blind => 'Vonkajšia žalúzia';

  @override
  String get cover_type_cover => 'Krytina';

  @override
  String get light_preset_candle => 'Sviečka';

  @override
  String get light_preset_warm => 'Teplá';

  @override
  String get light_preset_daylight => 'Denné svetlo';

  @override
  String get light_preset_cool => 'Studená';

  @override
  String get light_preset_warm_white => 'Teplá biela';

  @override
  String get light_preset_neutral => 'Neutrálna';

  @override
  String get light_preset_cool_white => 'Studená biela';

  @override
  String get light_color_red => 'Červená';

  @override
  String get light_color_orange => 'Oranžová';

  @override
  String get light_color_yellow => 'Žltá';

  @override
  String get light_color_green => 'Zelená';

  @override
  String get light_color_cyan => 'Azúrová';

  @override
  String get light_color_blue => 'Modrá';

  @override
  String get light_color_purple => 'Fialová';

  @override
  String get light_color_pink => 'Ružová';

  @override
  String get light_color_violet => 'Fialová';

  @override
  String get light_color_white => 'Biela';

  @override
  String get light_cap_brightness => 'Jas';

  @override
  String get light_cap_color_temp => 'Teplota';

  @override
  String get light_cap_hue => 'Odtieň';

  @override
  String get light_cap_saturation => 'Sýtosť';

  @override
  String get light_cap_white => 'Biela';

  @override
  String light_header_mode_count(String mode, int count) {
    return '$mode • $count zap.';
  }

  @override
  String light_header_count_of_total(int count, int total) {
    return '$count z $total zap.';
  }

  @override
  String get popup_label_mode => 'Režim';

  @override
  String get connection_banner_reconnecting => 'Pripájanie...';

  @override
  String get connection_banner_retry => 'Skúsiť znova';

  @override
  String get connection_overlay_title_reconnecting => 'Pripájanie';

  @override
  String get connection_overlay_message_reconnecting => 'Pokus o opätovné pripojenie...';

  @override
  String get connection_overlay_message_still_trying => 'Stále sa pokúšame pripojiť...';

  @override
  String get connection_overlay_retry => 'Skúsiť znova';

  @override
  String get connection_overlay_retrying => 'Pripájanie...';

  @override
  String get connection_recovery_connected => 'Pripojené';

  @override
  String get connection_auth_error_title => 'Relácia vypršala';

  @override
  String get connection_auth_error_message => 'Vaša relácia vypršala alebo bola zrušená. Resetujte prosím zariadenie pre opätovné pripojenie.';

  @override
  String get connection_auth_error_button_reset => 'Resetovať zariadenie';

  @override
  String get connection_network_error_title => 'Sieť nedostupná';

  @override
  String get connection_network_error_message => 'Nie je možné sa pripojiť k serveru. Skontrolujte prosím sieťové pripojenie.';

  @override
  String get connection_network_error_button_retry => 'Skúsiť znova';

  @override
  String get connection_server_error_title => 'Server nedostupný';

  @override
  String get connection_server_error_message => 'Server je dočasne nedostupný. Skúste to prosím neskôr.';

  @override
  String get connection_server_error_button_retry => 'Skúsiť znova';

  @override
  String get sensor_enum_illuminance_bright => 'Jasno';

  @override
  String get sensor_enum_illuminance_bright_long => 'Jasno';

  @override
  String get sensor_enum_illuminance_moderate => 'Stredné';

  @override
  String get sensor_enum_illuminance_moderate_long => 'Stredné osvetlenie';

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
  String get sensor_enum_gas_status_normal_long => 'Normálny';

  @override
  String get sensor_enum_gas_status_warning => 'Var.';

  @override
  String get sensor_enum_gas_status_warning_long => 'Varovanie';

  @override
  String get sensor_enum_gas_status_alarm => 'Alarm';

  @override
  String get sensor_enum_gas_status_alarm_long => 'Alarm plynu';

  @override
  String get sensor_enum_leak_level_low => 'Nízky';

  @override
  String get sensor_enum_leak_level_low_long => 'Nízky únik';

  @override
  String get sensor_enum_leak_level_medium => 'Str.';

  @override
  String get sensor_enum_leak_level_medium_long => 'Stredný únik';

  @override
  String get sensor_enum_leak_level_high => 'Vys.';

  @override
  String get sensor_enum_leak_level_high_long => 'Závažný únik';

  @override
  String get sensor_enum_battery_level_critical => 'Krit.';

  @override
  String get sensor_enum_battery_level_critical_long => 'Kritická';

  @override
  String get sensor_enum_battery_level_low => 'Nízka';

  @override
  String get sensor_enum_battery_level_low_long => 'Nízka';

  @override
  String get sensor_enum_battery_level_medium => 'Str.';

  @override
  String get sensor_enum_battery_level_medium_long => 'Stredná';

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
  String get sensor_enum_battery_status_ok_long => 'Batéria OK';

  @override
  String get sensor_enum_battery_status_low => 'Nízka';

  @override
  String get sensor_enum_battery_status_low_long => 'Nízka batéria';

  @override
  String get sensor_enum_battery_status_charging => 'Nabíja';

  @override
  String get sensor_enum_battery_status_charging_long => 'Nabíjanie';

  @override
  String get sensor_enum_alarm_alarm_idle => 'Pokoj';

  @override
  String get sensor_enum_alarm_alarm_idle_long => 'Alarm v pokoji';

  @override
  String get sensor_enum_alarm_alarm_pending => 'Čaká';

  @override
  String get sensor_enum_alarm_alarm_pending_long => 'Alarm čaká';

  @override
  String get sensor_enum_alarm_alarm_triggered => 'Spuš.';

  @override
  String get sensor_enum_alarm_alarm_triggered_long => 'Alarm spustený';

  @override
  String get sensor_enum_alarm_alarm_silenced => 'Ticho';

  @override
  String get sensor_enum_alarm_alarm_silenced_long => 'Alarm stíšený';

  @override
  String get sensor_enum_alarm_disarmed => 'Vyp.';

  @override
  String get sensor_enum_alarm_disarmed_long => 'Deaktivovaný';

  @override
  String get sensor_enum_alarm_armed_home => 'Doma';

  @override
  String get sensor_enum_alarm_armed_home_long => 'Aktívny doma';

  @override
  String get sensor_enum_alarm_armed_away => 'Preč';

  @override
  String get sensor_enum_alarm_armed_away_long => 'Aktívny preč';

  @override
  String get sensor_enum_alarm_armed_night => 'Noc';

  @override
  String get sensor_enum_alarm_armed_night_long => 'Aktívny noc';

  @override
  String get sensor_enum_filter_good => 'Dobrý';

  @override
  String get sensor_enum_filter_good_long => 'Filter dobrý';

  @override
  String get sensor_enum_filter_replace_soon => 'Čoskoro';

  @override
  String get sensor_enum_filter_replace_soon_long => 'Čoskoro vymeniť';

  @override
  String get sensor_enum_filter_replace_now => 'Teraz!';

  @override
  String get sensor_enum_filter_replace_now_long => 'Vymeniť teraz';

  @override
  String get sensor_enum_door_opened => 'Otv.';

  @override
  String get sensor_enum_door_opened_long => 'Dvere otvorené';

  @override
  String get sensor_enum_door_closed => 'Zatv.';

  @override
  String get sensor_enum_door_closed_long => 'Dvere zatvorené';

  @override
  String get sensor_enum_door_opening => 'Otv.';

  @override
  String get sensor_enum_door_opening_long => 'Dvere sa otvárajú';

  @override
  String get sensor_enum_door_closing => 'Zatv.';

  @override
  String get sensor_enum_door_closing_long => 'Dvere sa zatvárajú';

  @override
  String get sensor_enum_door_stopped => 'Stop';

  @override
  String get sensor_enum_door_stopped_long => 'Dvere zastavené';

  @override
  String get sensor_enum_lock_locked => 'Zamk.';

  @override
  String get sensor_enum_lock_locked_long => 'Zamknuté';

  @override
  String get sensor_enum_lock_unlocked => 'Otv.';

  @override
  String get sensor_enum_lock_unlocked_long => 'Odomknuté';

  @override
  String get sensor_enum_camera_available => 'Zap.';

  @override
  String get sensor_enum_camera_available_long => 'Kamera dostupná';

  @override
  String get sensor_enum_camera_in_use => 'Použ.';

  @override
  String get sensor_enum_camera_in_use_long => 'Kamera používaná';

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
  String get sensor_enum_camera_initializing_long => 'Kamera sa inicializuje';

  @override
  String get sensor_enum_camera_error => 'Chyba';

  @override
  String get sensor_enum_camera_error_long => 'Chyba kamery';

  @override
  String get sensor_enum_device_info_connected => 'Zap.';

  @override
  String get sensor_enum_device_info_connected_long => 'Pripojené';

  @override
  String get sensor_enum_device_info_disconnected => 'Vyp.';

  @override
  String get sensor_enum_device_info_disconnected_long => 'Odpojené';

  @override
  String get sensor_enum_device_info_init => 'Init';

  @override
  String get sensor_enum_device_info_init_long => 'Inicializácia';

  @override
  String get sensor_enum_device_info_ready => 'Pripr.';

  @override
  String get sensor_enum_device_info_ready_long => 'Pripravené';

  @override
  String get sensor_enum_device_info_running => 'Beží';

  @override
  String get sensor_enum_device_info_running_long => 'Beží';

  @override
  String get sensor_enum_device_info_sleeping => 'Spí';

  @override
  String get sensor_enum_device_info_sleeping_long => 'Spí';

  @override
  String get sensor_enum_device_info_stopped => 'Stop';

  @override
  String get sensor_enum_device_info_stopped_long => 'Zastavené';

  @override
  String get sensor_enum_device_info_lost => 'Str.';

  @override
  String get sensor_enum_device_info_lost_long => 'Spojenie stratené';

  @override
  String get sensor_enum_device_info_alert => 'Alert';

  @override
  String get sensor_enum_device_info_alert_long => 'Alert';

  @override
  String get sensor_enum_device_info_unknown => 'N/A';

  @override
  String get sensor_enum_device_info_unknown_long => 'Neznámy';

  @override
  String get sensor_freshness_live => 'Naživo';

  @override
  String get sensor_freshness_stale => 'Zastarané';

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
  String get media_input_cable => 'Kábel';

  @override
  String get media_input_satellite => 'Satelit';

  @override
  String get media_input_antenna => 'Anténa';

  @override
  String get media_input_av1 => 'AV 1';

  @override
  String get media_input_av2 => 'AV 2';

  @override
  String get media_input_component => 'Komponentný';

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
  String get media_input_other => 'Ostatné';

  @override
  String get media_off_title => 'Médiá vypnuté';

  @override
  String get media_off_subtitle => 'Vyberte aktivitu pre začatie';

  @override
  String get media_not_configured_title => 'Médiá nenastavené';

  @override
  String get media_not_configured_description => 'Mediálne aktivity neboli pre túto miestnosť nastavené. Nakonfigurujte väzby aktivít v administrácii.';

  @override
  String media_starting_activity(String activityName) {
    return 'Spúšťanie $activityName...';
  }

  @override
  String media_activity_failed(String activityName) {
    return '$activityName zlyhalo';
  }

  @override
  String get media_activity_failed_description => 'Aktivitu sa nepodarilo aplikovať. Skontrolujte pripojenie zariadení.';

  @override
  String get media_activity_retry => 'Opakovať';

  @override
  String get media_activity_turn_off => 'Vypnúť';

  @override
  String get media_warning_audio_offline => 'Audio výstup offline – používajú sa reproduktory displeja';

  @override
  String get media_warning_some_devices_offline => 'Niektoré zariadenia sú offline';

  @override
  String media_warning_steps_failed(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'varovaní',
      few: 'varovania',
      one: 'varovanie',
    );
    return 'Niektoré kroky zlyhali ($count $_temp0)';
  }

  @override
  String get media_warning_steps_had_issues => 'Niektoré kroky mali problémy';

  @override
  String get media_remote => 'Ovládanie';

  @override
  String get media_remote_control => 'Diaľkové ovládanie';

  @override
  String media_volume_percent(int volume) {
    return '$volume%';
  }

  @override
  String get media_failure_details_title => 'Podrobnosti aktivácie';

  @override
  String get media_failure_summary_total => 'Celkom';

  @override
  String get media_failure_summary_ok => 'OK';

  @override
  String get media_failure_summary_errors => 'Chyby';

  @override
  String get media_failure_summary_warnings => 'Varovania';

  @override
  String get media_failure_errors_critical => 'Chyby (kritické)';

  @override
  String get media_failure_warnings_non_critical => 'Varovania (nekritické)';

  @override
  String get media_failure_warnings_label => 'Varovania';

  @override
  String get media_failure_retry_activity => 'Opakovať aktivitu';

  @override
  String get media_failure_deactivate => 'Deaktivovať';

  @override
  String media_failure_device_label(String deviceId) {
    return 'Zariadenie: $deviceId';
  }

  @override
  String media_failure_inline(int errors, int warnings) {
    String _temp0 = intl.Intl.pluralLogic(
      errors,
      locale: localeName,
      other: 'chýb',
      few: 'chyby',
      one: 'chyba',
    );
    String _temp1 = intl.Intl.pluralLogic(
      warnings,
      locale: localeName,
      other: 'varovaní',
      few: 'varovania',
      one: 'varovanie',
    );
    return 'Aktivitu sa nepodarilo aplikovať ($errors $_temp0, $warnings $_temp1)';
  }

  @override
  String get media_activity_watch => 'Sledovať';

  @override
  String get media_activity_listen => 'Počúvať';

  @override
  String get media_activity_gaming => 'Hranie';

  @override
  String get media_activity_background => 'Pozadie';

  @override
  String get media_activity_off => 'Vyp';

  @override
  String media_activity_active(String activityName) {
    return '$activityName aktívne';
  }

  @override
  String get media_status_standby => 'Pohotovosť';

  @override
  String get media_status_activating => 'Aktivácia...';

  @override
  String get media_status_failed => 'Zlyhalo';

  @override
  String get media_status_stopping => 'Zastavovanie...';

  @override
  String get media_status_active_with_issues => 'Aktívne s problémami';

  @override
  String get media_status_active => 'Aktívne';

  @override
  String get media_status_ready => 'Pripravené';

  @override
  String get media_remote_up => 'Hore';

  @override
  String get media_remote_down => 'Dole';

  @override
  String get media_remote_left => 'Vľavo';

  @override
  String get media_remote_right => 'Vpravo';

  @override
  String get media_remote_ok => 'OK';

  @override
  String get media_remote_back => 'Späť';

  @override
  String get media_remote_exit => 'Koniec';

  @override
  String get media_remote_info => 'Info';

  @override
  String get media_remote_rewind => 'Spätne';

  @override
  String get media_remote_fast_forward => 'Vpred';

  @override
  String get media_remote_play => 'Prehrať';

  @override
  String get media_remote_pause => 'Pauza';

  @override
  String get media_remote_next => 'Ďalší';

  @override
  String get media_remote_prev => 'Predch.';

  @override
  String get media_detail_connection_lost => 'Spojenie stratené';

  @override
  String get media_detail_connection_lost_description => 'Ovládanie médií vyžaduje aktívne WebSocket pripojenie.';

  @override
  String get media_detail_go_back => 'Späť';

  @override
  String get media_detail_section_display => 'Displej';

  @override
  String get media_detail_section_audio => 'Audio';

  @override
  String get media_detail_section_source => 'Zdroj';

  @override
  String get media_detail_section_remote => 'Diaľkové ovládanie';

  @override
  String get media_detail_input => 'Vstup';

  @override
  String get media_detail_select => 'Vybrať';

  @override
  String get media_detail_now_playing => 'Práve hrá';

  @override
  String get media_detail_no_track_info => 'Informácie o skladbe nie sú k dispozícii';

  @override
  String get media_detail_home => 'Domov';

  @override
  String get media_detail_menu => 'Menu';

  @override
  String get media_playback => 'Prehrávanie';

  @override
  String get filter_all => 'Všetko';

  @override
  String sensor_alert_high_title(String name) {
    return 'Výstraha: vysoká hodnota $name';
  }

  @override
  String sensor_alert_exceeded_threshold(String name) {
    return '$name prekročil prahovú hodnotu';
  }

  @override
  String get sensor_state_detected => 'Detekované';

  @override
  String get sensor_state_not_detected => 'Nedetekované';

  @override
  String get sensor_state_clear => 'V poriadku';

  @override
  String get sensor_state_open => 'Otvorené';

  @override
  String get sensor_state_closed => 'Zatvorené';

  @override
  String get sensor_state_active => 'Aktívne';

  @override
  String get sensor_state_inactive => 'Neaktívne';

  @override
  String get sensor_state_occupied => 'Obsadené';

  @override
  String get sensor_state_unoccupied => 'Neobsadené';

  @override
  String get sensor_state_smoke_detected => 'Detekovaný dym';

  @override
  String get sensor_state_gas_detected => 'Detekovaný plyn';

  @override
  String get sensor_state_leak_detected => 'Detekovaný únik';

  @override
  String get sensor_state_co_detected => 'Detekovaný CO';

  @override
  String get sensor_label_temperature => 'Teplota';

  @override
  String get sensor_label_humidity => 'Vlhkosť';

  @override
  String get sensor_label_pressure => 'Tlak';

  @override
  String get sensor_label_illuminance => 'Osvetlenie';

  @override
  String get sensor_label_carbon_dioxide => 'Oxid uhličitý';

  @override
  String get sensor_label_carbon_monoxide => 'Oxid uhoľnatý';

  @override
  String get sensor_label_ozone => 'Ozón';

  @override
  String get sensor_label_nitrogen_dioxide => 'Oxid dusičitý';

  @override
  String get sensor_label_sulphur_dioxide => 'Oxid siričitý';

  @override
  String get sensor_label_voc => 'VOC';

  @override
  String get sensor_label_particulate_matter => 'Pevné častice';

  @override
  String get sensor_label_motion => 'Pohyb';

  @override
  String get sensor_label_occupancy => 'Prítomnosť';

  @override
  String get sensor_label_contact => 'Kontakt';

  @override
  String get sensor_label_leak => 'Únik';

  @override
  String get sensor_label_smoke => 'Dym';

  @override
  String get sensor_label_battery => 'Batéria';

  @override
  String get sensor_label_alarm => 'Alarm';

  @override
  String get sensor_label_door => 'Dvere';

  @override
  String get sensor_label_lock => 'Zámok';

  @override
  String get sensor_label_camera => 'Kamera';

  @override
  String get sensor_label_filter => 'Filter';

  @override
  String get sensor_label_device_info => 'Info o zariadení';

  @override
  String get sensor_label_gas => 'Plyn';

  @override
  String get sensor_label_electrical_energy => 'Energia';

  @override
  String get sensor_label_electrical_generation => 'Výroba';

  @override
  String get sensor_label_electrical_power => 'Výkon';

  @override
  String get sensor_alert_high_level => 'Vysoká úroveň';

  @override
  String get sensor_alert_low_battery => 'Slabá batéria';

  @override
  String get sensor_alert_charging => 'Nabíjanie';

  @override
  String get sensor_category_temperature => 'Teplota';

  @override
  String get sensor_category_humidity => 'Vlhkosť';

  @override
  String get sensor_category_air_quality => 'Kvalita vzduchu';

  @override
  String get sensor_category_motion => 'Pohyb';

  @override
  String get sensor_category_safety => 'Bezpečnosť';

  @override
  String get sensor_category_light => 'Svetlo';

  @override
  String get sensor_category_energy => 'Energia';

  @override
  String get sensor_ui_event_log => 'História udalostí';

  @override
  String get sensor_ui_history => 'História';

  @override
  String get sensor_ui_current => 'Aktuálna';

  @override
  String sensor_ui_current_value(String name) {
    return 'Aktuálna $name';
  }

  @override
  String get sensor_ui_min => 'Min';

  @override
  String get sensor_ui_max => 'Max';

  @override
  String get sensor_ui_avg => 'Priem';

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
    return '$period Priem';
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
  String get sensor_empty_no_events => 'Žiadne zaznamenané udalosti';

  @override
  String get sensor_empty_no_state_changes => 'Žiadne zmeny stavu';

  @override
  String get sensor_empty_no_history => 'Žiadne historické dáta';

  @override
  String get sensor_empty_no_data => 'Žiadne dáta';

  @override
  String get sensor_status_loading => 'Načítanie dát...';

  @override
  String get sensor_status_failed => 'Načítanie dát zlyhalo';

  @override
  String get sensor_status_retry => 'Opakovať';

  @override
  String get sensors_domain_title => 'Senzory';

  @override
  String get sensors_domain_empty_title => 'Senzory nenastavené';

  @override
  String get sensors_domain_empty_description => 'Roly senzorov neboli pre túto miestnosť nastavené. Nakonfigurujte priradenie senzorov v administrácii.';

  @override
  String sensors_domain_alerts_active(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Aktívnych výstrah',
      few: 'Aktívne výstrahy',
      one: 'Aktívna výstraha',
    );
    return '$_temp0';
  }

  @override
  String get sensors_domain_no_summary => 'Žiadne dáta o prostredí';

  @override
  String get sensors_domain_no_sensors => 'Žiadne senzory';

  @override
  String sensors_domain_health_stale(int count) {
    return '$count zastaraných';
  }

  @override
  String sensors_domain_health_offline(int count) {
    return '$count offline';
  }

  @override
  String get sensors_domain_health_normal => 'Všetko v poriadku';

  @override
  String get sensors_domain_avg_temperature => 'Priem. teplota';

  @override
  String get sensors_domain_avg_humidity => 'Priem. vlhkosť';

  @override
  String get sensors_domain_all_sensors => 'Všetky senzory';

  @override
  String sensors_domain_sensor_count(int count) {
    return '$count senzorov';
  }

  @override
  String get domain_security => 'Zabezpečenie';

  @override
  String get security_tab_entry_points => 'Vstupné body';

  @override
  String get security_tab_alerts => 'Upozornenia';

  @override
  String get security_tab_events => 'Udalosti';

  @override
  String get security_header_recent_events => 'Nedávne udalosti';

  @override
  String get security_status_triggered => 'Spustené';

  @override
  String get security_status_warning => 'Varovanie';

  @override
  String get security_status_secure => 'Zabezpečené';

  @override
  String get security_armed_disarmed => 'Deaktivované';

  @override
  String get security_armed_home => 'Aktívne doma';

  @override
  String get security_armed_away => 'Aktívne preč';

  @override
  String get security_armed_night => 'Aktívne noc';

  @override
  String get security_armed_unknown => 'Neznámy';

  @override
  String get security_alarm_idle => 'Pokojový';

  @override
  String get security_alarm_pending => 'Čakajúci';

  @override
  String get security_alarm_triggered => 'Spustené';

  @override
  String get security_alarm_silenced => 'Stíšené';

  @override
  String get security_alarm_unknown => 'Neznámy';

  @override
  String security_entry_open_count(int count) {
    return '$count otvorených';
  }

  @override
  String get security_entry_all_secure => 'Všetko zabezpečené';

  @override
  String get security_entry_status_breach => 'Prienik';

  @override
  String get security_entry_status_open => 'Otvorené';

  @override
  String get security_entry_status_unknown => 'Neznámy';

  @override
  String get security_entry_status_closed => 'Zatvorené';

  @override
  String security_summary_all_clear(int count) {
    return 'Všetko v poriadku · $count vstupných bodov zabezpečených';
  }

  @override
  String security_summary_alerts(int count) {
    return '$count upozornení';
  }

  @override
  String get security_summary_alerts_label => 'Upozornenia';

  @override
  String security_summary_entry_points_open(int count) {
    return '$count vstupných bodov otvorených';
  }

  @override
  String get security_summary_open_label => 'Otvorené';

  @override
  String get security_no_active_alerts => 'Žiadne aktívne upozornenia';

  @override
  String get security_ack_all => 'Potvrdiť všetko';

  @override
  String get security_no_recent_events => 'Žiadne nedávne udalosti';

  @override
  String get security_events_load_failed => 'Nepodarilo sa načítať udalosti';

  @override
  String get security_retry => 'Opakovať';

  @override
  String get security_alert_type_intrusion => 'Detekovaný prienik';

  @override
  String get security_alert_type_entry_open => 'Vstup otvorený';

  @override
  String get security_alert_type_smoke => 'Detekovaný dym';

  @override
  String get security_alert_type_co => 'Detekovaný CO';

  @override
  String get security_alert_type_water_leak => 'Únik vody';

  @override
  String get security_alert_type_gas => 'Detekovaný plyn';

  @override
  String get security_alert_type_tamper => 'Detekovaná manipulácia';

  @override
  String get security_alert_type_fault => 'Chyba systému';

  @override
  String get security_alert_type_device_offline => 'Zariadenie offline';

  @override
  String get security_alert_type_unknown => 'Neznámy';

  @override
  String get security_event_alert_raised => 'Upozornenie vyvolané';

  @override
  String get security_event_alert_resolved => 'Upozornenie vyriešené';

  @override
  String get security_event_alert_acknowledged => 'Upozornenie potvrdené';

  @override
  String get security_event_alarm_state_changed => 'Stav alarmu zmenený';

  @override
  String get security_event_arming_mode_changed => 'Režim zabezpečenia zmenený';

  @override
  String security_event_title_alert_raised(String alertType) {
    return 'Upozornenie vyvolané: $alertType';
  }

  @override
  String security_event_title_alert_resolved(String alertType) {
    return 'Upozornenie vyriešené: $alertType';
  }

  @override
  String security_event_title_alert_acknowledged(String alertType) {
    return 'Upozornenie potvrdené: $alertType';
  }

  @override
  String security_event_title_alarm_state_changed(String from, String to) {
    return 'Stav alarmu zmenený: $from → $to';
  }

  @override
  String security_event_title_arming_mode_changed(String from, String to) {
    return 'Režim zabezpečenia zmenený: $from → $to';
  }

  @override
  String security_state_transition(String from, String to) {
    return '$from → $to';
  }

  @override
  String get security_state_unknown => 'neznámy';

  @override
  String get security_overlay_alarm_triggered => 'Alarm spustený';

  @override
  String get security_overlay_default_title => 'Bezpečnostné upozornenie';

  @override
  String get security_overlay_acknowledge => 'Potvrdiť';

  @override
  String get security_overlay_open_security => 'Otvoriť zabezpečenie';

  @override
  String security_overlay_more_alerts(int count) {
    return '+$count ďalších upozornení';
  }

  @override
  String get room_overview_no_room => 'K tomuto displeju nie je priradená žiadna miestnosť';

  @override
  String get room_overview_display_not_configured => 'Displej nie je nakonfigurovaný';

  @override
  String get room_overview_load_failed => 'Nepodarilo sa načítať dáta miestnosti';

  @override
  String room_overview_lights_active(int lightsOn, int totalLights) {
    return '$lightsOn z $totalLights aktívnych';
  }

  @override
  String room_overview_light_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count svetiel',
      few: '$count svetlá',
      one: '1 svetlo',
    );
    return '$_temp0';
  }

  @override
  String room_overview_device_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count zariadení',
      few: '$count zariadenia',
      one: '1 zariadenie',
    );
    return '$_temp0';
  }

  @override
  String room_overview_reading_count(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count meraní',
      few: '$count merania',
      one: '1 meranie',
    );
    return '$_temp0';
  }

  @override
  String get room_overview_action_failed => 'Akcia zlyhala';

  @override
  String get suggested_action_turn_off_lights => 'Vypnúť svetlá';

  @override
  String get suggested_action_movie_mode => 'Režim filmu';

  @override
  String get suggested_action_night_mode => 'Nočný režim';

  @override
  String get shading_fully_closed => 'Úplne zatvorené';

  @override
  String get shading_fully_open => 'Úplne otvorené';

  @override
  String get sensor_label_light => 'Svetlo';

  @override
  String get settings_save_failed => 'Uloženie nastavení zlyhalo.';

  @override
  String get settings_about_version_loading => 'Načítanie...';

  @override
  String get app_error_failed_to_start => 'Aplikáciu sa nepodarilo spustiť';

  @override
  String get app_error_failed_to_start_short => 'Spustenie zlyhalo';

  @override
  String get app_error_unexpected => 'Pri spúšťaní aplikácie došlo k neočakávanej chybe.';

  @override
  String get app_error_see_details => 'Došlo k chybe. Podrobnosti nižšie.';

  @override
  String get app_error_restart_button => 'Reštartovať aplikáciu';

  @override
  String get app_error_permit_join_hint => 'Požiadajte administrátora o aktiváciu \"Permit Join\" v administrácii a potom reštartujte aplikáciu.';

  @override
  String get app_error_connection_failed_stored => 'Nepodarilo sa pripojiť k uloženému serveru.';

  @override
  String app_error_connection_failed_backend(String name, String address) {
    return 'Nepodarilo sa pripojiť k $name na $address';
  }

  @override
  String get app_error_initialization_failed => 'Inicializácia pripojenia k serveru zlyhala.';

  @override
  String app_error_connection_failed_url(String url) {
    return 'Nepodarilo sa pripojiť k $url';
  }

  @override
  String get deck_empty_title => 'Žiadne stránky nie sú nakonfigurované';

  @override
  String get deck_empty_description => 'Nakonfigurujte si dashboard v administrácii.';

  @override
  String get alert_banner_view_button => 'Zobraziť';

  @override
  String get sensor_chart_label_now => 'Teraz';

  @override
  String get room_name_fallback => 'Miestnosť';

  @override
  String get weather_tile_not_configured => 'Nie je nakonfigurované';

  @override
  String get entry_error_load_security_data => 'Nepodarilo sa načítať bezpečnostné dáta';

  @override
  String get entry_locks_all_locked => 'Všetko zamknuté';

  @override
  String entry_locks_status_partial(int locked, int total) {
    return '$locked/$total zamknutých';
  }

  @override
  String get entry_alarm_armed => 'Aktívny';

  @override
  String get entry_alarm_disarmed => 'Neaktívny';

  @override
  String entry_cameras_status_active(int count) {
    return '$count aktívnych';
  }

  @override
  String get master_error_load_house_data => 'Nepodarilo sa načítať dáta domu';

  @override
  String master_room_device_count(int online, int total) {
    return '$online/$total zariadení';
  }

  @override
  String get buddy_dismiss => 'Zavrieť';

  @override
  String get buddy_apply => 'Použiť';

  @override
  String get buddy_got_it => 'Rozumiem';

  @override
  String get buddy_empty_state_message => 'Spýtajte sa ma na čokoľvek o vašom dome!';

  @override
  String get buddy_init_failed_message => 'Nepodarilo sa zahájiť konverzáciu';

  @override
  String get buddy_provider_not_configured_title => 'AI poskytovateľ nie je nakonfigurovaný';

  @override
  String get buddy_provider_not_configured_description => 'Nakonfigurujte AI poskytovateľa v administrácii pre aktiváciu chatu.';

  @override
  String get buddy_thinking => 'Premýšľam...';

  @override
  String get buddy_hint_init_failed => 'Nepodarilo sa zahájiť konverzáciu';

  @override
  String get buddy_hint_starting_conversation => 'Začínam konverzáciu...';

  @override
  String get buddy_hint_default => 'Spýtajte sa na svoj domov...';

  @override
  String get buddy_error_load_conversations => 'Nepodarilo sa načítať konverzácie';

  @override
  String get buddy_error_create_conversation => 'Nepodarilo sa vytvoriť konverzáciu';

  @override
  String get buddy_error_load_messages => 'Nepodarilo sa načítať správy';

  @override
  String get buddy_error_send_message => 'Nepodarilo sa odoslať správu';

  @override
  String get buddy_error_provider_not_configured => 'AI poskytovateľ nie je nakonfigurovaný';

  @override
  String get buddy_error_request_timeout => 'Požiadavka vypršala. Skúste to prosím znova.';

  @override
  String get buddy_error_connection_error => 'Chyba pripojenia. Skontrolujte prosím sieť.';

  @override
  String get buddy_error_generic => 'Niečo sa pokazilo. Skúste to prosím znova.';

  @override
  String get buddy_hint_recording => 'Nahrávanie zvuku...';

  @override
  String buddy_recording_progress(int seconds, int maxSeconds) {
    return 'Nahrávanie... ${seconds}s / ${maxSeconds}s';
  }

  @override
  String get buddy_recording_cancel => 'Zrušiť';

  @override
  String get buddy_recording_too_short => 'Nahrávka je príliš krátka. Podržte dlhšie.';

  @override
  String get buddy_recording_permission_error => 'Nie je možné spustiť nahrávanie. Skontrolujte oprávnenia mikrofónu.';

  @override
  String get buddy_voice_listening => 'Počúvam...';

  @override
  String buddy_voice_recording_timer(int seconds, int maxSeconds) {
    return '${seconds}s / ${maxSeconds}s';
  }

  @override
  String buddy_voice_recording_progress(int seconds, int maxSeconds) {
    return 'Nahrávanie ${seconds}s / ${maxSeconds}s';
  }

  @override
  String get buddy_voice_processing => 'Spracúvam...';

  @override
  String get buddy_voice_transcribing => 'Prepisujem zvuk...';

  @override
  String get security_events_error_unexpected_response => 'Neočakávaná odpoveď';

  @override
  String media_activation_step_fallback(int index) {
    return 'Krok $index';
  }

  @override
  String get intent_error_deck_not_initialized => 'Deck nie je inicializovaný';

  @override
  String get intent_error_deck_item_not_found => 'Položka decku nenájdená';

  @override
  String get intent_error_no_home_item => 'Domovská položka nie je dostupná';

  @override
  String get intent_error_scenes_not_available => 'Služba scén nie je dostupná';

  @override
  String get intent_error_scene_activation_failed => 'Nepodarilo sa aktivovať scénu';

  @override
  String get intent_error_scene_activation_error => 'Chyba pri aktivácii scény';

  @override
  String get intent_error_device_repo_not_available => 'Repozitár vlastností zariadení nie je dostupný';

  @override
  String get intent_error_set_property_failed => 'Nepodarilo sa nastaviť hodnotu vlastnosti';

  @override
  String get intent_error_set_property_error => 'Chyba pri nastavení hodnoty vlastnosti';

  @override
  String get intent_error_toggle_device_failed => 'Nepodarilo sa prepnúť zariadenie';

  @override
  String get intent_error_toggle_device_error => 'Chyba pri prepínaní zariadenia';

  @override
  String get settings_display_screen_lock_never => 'Nikdy';
}

// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'system_system_info.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

SystemSystemInfo _$SystemSystemInfoFromJson(Map<String, dynamic> json) {
  return _SystemSystemInfo.fromJson(json);
}

/// @nodoc
mixin _$SystemSystemInfo {
  /// Current CPU load percentage (0-100%).
  @JsonKey(name: 'cpu_load')
  double get cpuLoad => throw _privateConstructorUsedError;
  SystemMemoryInfo get memory => throw _privateConstructorUsedError;

  /// List of available storage devices and their usage details.
  List<SystemStorageInfo> get storage => throw _privateConstructorUsedError;
  SystemTemperatureInfo get temperature => throw _privateConstructorUsedError;

  /// Operating system name and version.
  SystemOperatingSystemInfo get os => throw _privateConstructorUsedError;

  /// List of network interfaces with statistics.
  List<SystemNetworkStats> get network => throw _privateConstructorUsedError;
  @JsonKey(name: 'default_network')
  SystemDefaultNetwork get defaultNetwork => throw _privateConstructorUsedError;
  SystemDisplayInfo get display => throw _privateConstructorUsedError;

  /// Serializes this SystemSystemInfo to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SystemSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SystemSystemInfoCopyWith<SystemSystemInfo> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SystemSystemInfoCopyWith<$Res> {
  factory $SystemSystemInfoCopyWith(
          SystemSystemInfo value, $Res Function(SystemSystemInfo) then) =
      _$SystemSystemInfoCopyWithImpl<$Res, SystemSystemInfo>;
  @useResult
  $Res call(
      {@JsonKey(name: 'cpu_load') double cpuLoad,
      SystemMemoryInfo memory,
      List<SystemStorageInfo> storage,
      SystemTemperatureInfo temperature,
      SystemOperatingSystemInfo os,
      List<SystemNetworkStats> network,
      @JsonKey(name: 'default_network') SystemDefaultNetwork defaultNetwork,
      SystemDisplayInfo display});

  $SystemMemoryInfoCopyWith<$Res> get memory;
  $SystemTemperatureInfoCopyWith<$Res> get temperature;
  $SystemOperatingSystemInfoCopyWith<$Res> get os;
  $SystemDefaultNetworkCopyWith<$Res> get defaultNetwork;
  $SystemDisplayInfoCopyWith<$Res> get display;
}

/// @nodoc
class _$SystemSystemInfoCopyWithImpl<$Res, $Val extends SystemSystemInfo>
    implements $SystemSystemInfoCopyWith<$Res> {
  _$SystemSystemInfoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SystemSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? cpuLoad = null,
    Object? memory = null,
    Object? storage = null,
    Object? temperature = null,
    Object? os = null,
    Object? network = null,
    Object? defaultNetwork = null,
    Object? display = null,
  }) {
    return _then(_value.copyWith(
      cpuLoad: null == cpuLoad
          ? _value.cpuLoad
          : cpuLoad // ignore: cast_nullable_to_non_nullable
              as double,
      memory: null == memory
          ? _value.memory
          : memory // ignore: cast_nullable_to_non_nullable
              as SystemMemoryInfo,
      storage: null == storage
          ? _value.storage
          : storage // ignore: cast_nullable_to_non_nullable
              as List<SystemStorageInfo>,
      temperature: null == temperature
          ? _value.temperature
          : temperature // ignore: cast_nullable_to_non_nullable
              as SystemTemperatureInfo,
      os: null == os
          ? _value.os
          : os // ignore: cast_nullable_to_non_nullable
              as SystemOperatingSystemInfo,
      network: null == network
          ? _value.network
          : network // ignore: cast_nullable_to_non_nullable
              as List<SystemNetworkStats>,
      defaultNetwork: null == defaultNetwork
          ? _value.defaultNetwork
          : defaultNetwork // ignore: cast_nullable_to_non_nullable
              as SystemDefaultNetwork,
      display: null == display
          ? _value.display
          : display // ignore: cast_nullable_to_non_nullable
              as SystemDisplayInfo,
    ) as $Val);
  }

  /// Create a copy of SystemSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $SystemMemoryInfoCopyWith<$Res> get memory {
    return $SystemMemoryInfoCopyWith<$Res>(_value.memory, (value) {
      return _then(_value.copyWith(memory: value) as $Val);
    });
  }

  /// Create a copy of SystemSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $SystemTemperatureInfoCopyWith<$Res> get temperature {
    return $SystemTemperatureInfoCopyWith<$Res>(_value.temperature, (value) {
      return _then(_value.copyWith(temperature: value) as $Val);
    });
  }

  /// Create a copy of SystemSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $SystemOperatingSystemInfoCopyWith<$Res> get os {
    return $SystemOperatingSystemInfoCopyWith<$Res>(_value.os, (value) {
      return _then(_value.copyWith(os: value) as $Val);
    });
  }

  /// Create a copy of SystemSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $SystemDefaultNetworkCopyWith<$Res> get defaultNetwork {
    return $SystemDefaultNetworkCopyWith<$Res>(_value.defaultNetwork, (value) {
      return _then(_value.copyWith(defaultNetwork: value) as $Val);
    });
  }

  /// Create a copy of SystemSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $SystemDisplayInfoCopyWith<$Res> get display {
    return $SystemDisplayInfoCopyWith<$Res>(_value.display, (value) {
      return _then(_value.copyWith(display: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$SystemSystemInfoImplCopyWith<$Res>
    implements $SystemSystemInfoCopyWith<$Res> {
  factory _$$SystemSystemInfoImplCopyWith(_$SystemSystemInfoImpl value,
          $Res Function(_$SystemSystemInfoImpl) then) =
      __$$SystemSystemInfoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: 'cpu_load') double cpuLoad,
      SystemMemoryInfo memory,
      List<SystemStorageInfo> storage,
      SystemTemperatureInfo temperature,
      SystemOperatingSystemInfo os,
      List<SystemNetworkStats> network,
      @JsonKey(name: 'default_network') SystemDefaultNetwork defaultNetwork,
      SystemDisplayInfo display});

  @override
  $SystemMemoryInfoCopyWith<$Res> get memory;
  @override
  $SystemTemperatureInfoCopyWith<$Res> get temperature;
  @override
  $SystemOperatingSystemInfoCopyWith<$Res> get os;
  @override
  $SystemDefaultNetworkCopyWith<$Res> get defaultNetwork;
  @override
  $SystemDisplayInfoCopyWith<$Res> get display;
}

/// @nodoc
class __$$SystemSystemInfoImplCopyWithImpl<$Res>
    extends _$SystemSystemInfoCopyWithImpl<$Res, _$SystemSystemInfoImpl>
    implements _$$SystemSystemInfoImplCopyWith<$Res> {
  __$$SystemSystemInfoImplCopyWithImpl(_$SystemSystemInfoImpl _value,
      $Res Function(_$SystemSystemInfoImpl) _then)
      : super(_value, _then);

  /// Create a copy of SystemSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? cpuLoad = null,
    Object? memory = null,
    Object? storage = null,
    Object? temperature = null,
    Object? os = null,
    Object? network = null,
    Object? defaultNetwork = null,
    Object? display = null,
  }) {
    return _then(_$SystemSystemInfoImpl(
      cpuLoad: null == cpuLoad
          ? _value.cpuLoad
          : cpuLoad // ignore: cast_nullable_to_non_nullable
              as double,
      memory: null == memory
          ? _value.memory
          : memory // ignore: cast_nullable_to_non_nullable
              as SystemMemoryInfo,
      storage: null == storage
          ? _value._storage
          : storage // ignore: cast_nullable_to_non_nullable
              as List<SystemStorageInfo>,
      temperature: null == temperature
          ? _value.temperature
          : temperature // ignore: cast_nullable_to_non_nullable
              as SystemTemperatureInfo,
      os: null == os
          ? _value.os
          : os // ignore: cast_nullable_to_non_nullable
              as SystemOperatingSystemInfo,
      network: null == network
          ? _value._network
          : network // ignore: cast_nullable_to_non_nullable
              as List<SystemNetworkStats>,
      defaultNetwork: null == defaultNetwork
          ? _value.defaultNetwork
          : defaultNetwork // ignore: cast_nullable_to_non_nullable
              as SystemDefaultNetwork,
      display: null == display
          ? _value.display
          : display // ignore: cast_nullable_to_non_nullable
              as SystemDisplayInfo,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SystemSystemInfoImpl implements _SystemSystemInfo {
  const _$SystemSystemInfoImpl(
      {@JsonKey(name: 'cpu_load') required this.cpuLoad,
      required this.memory,
      required final List<SystemStorageInfo> storage,
      required this.temperature,
      required this.os,
      required final List<SystemNetworkStats> network,
      @JsonKey(name: 'default_network') required this.defaultNetwork,
      required this.display})
      : _storage = storage,
        _network = network;

  factory _$SystemSystemInfoImpl.fromJson(Map<String, dynamic> json) =>
      _$$SystemSystemInfoImplFromJson(json);

  /// Current CPU load percentage (0-100%).
  @override
  @JsonKey(name: 'cpu_load')
  final double cpuLoad;
  @override
  final SystemMemoryInfo memory;

  /// List of available storage devices and their usage details.
  final List<SystemStorageInfo> _storage;

  /// List of available storage devices and their usage details.
  @override
  List<SystemStorageInfo> get storage {
    if (_storage is EqualUnmodifiableListView) return _storage;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_storage);
  }

  @override
  final SystemTemperatureInfo temperature;

  /// Operating system name and version.
  @override
  final SystemOperatingSystemInfo os;

  /// List of network interfaces with statistics.
  final List<SystemNetworkStats> _network;

  /// List of network interfaces with statistics.
  @override
  List<SystemNetworkStats> get network {
    if (_network is EqualUnmodifiableListView) return _network;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_network);
  }

  @override
  @JsonKey(name: 'default_network')
  final SystemDefaultNetwork defaultNetwork;
  @override
  final SystemDisplayInfo display;

  @override
  String toString() {
    return 'SystemSystemInfo(cpuLoad: $cpuLoad, memory: $memory, storage: $storage, temperature: $temperature, os: $os, network: $network, defaultNetwork: $defaultNetwork, display: $display)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SystemSystemInfoImpl &&
            (identical(other.cpuLoad, cpuLoad) || other.cpuLoad == cpuLoad) &&
            (identical(other.memory, memory) || other.memory == memory) &&
            const DeepCollectionEquality().equals(other._storage, _storage) &&
            (identical(other.temperature, temperature) ||
                other.temperature == temperature) &&
            (identical(other.os, os) || other.os == os) &&
            const DeepCollectionEquality().equals(other._network, _network) &&
            (identical(other.defaultNetwork, defaultNetwork) ||
                other.defaultNetwork == defaultNetwork) &&
            (identical(other.display, display) || other.display == display));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      cpuLoad,
      memory,
      const DeepCollectionEquality().hash(_storage),
      temperature,
      os,
      const DeepCollectionEquality().hash(_network),
      defaultNetwork,
      display);

  /// Create a copy of SystemSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SystemSystemInfoImplCopyWith<_$SystemSystemInfoImpl> get copyWith =>
      __$$SystemSystemInfoImplCopyWithImpl<_$SystemSystemInfoImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SystemSystemInfoImplToJson(
      this,
    );
  }
}

abstract class _SystemSystemInfo implements SystemSystemInfo {
  const factory _SystemSystemInfo(
      {@JsonKey(name: 'cpu_load') required final double cpuLoad,
      required final SystemMemoryInfo memory,
      required final List<SystemStorageInfo> storage,
      required final SystemTemperatureInfo temperature,
      required final SystemOperatingSystemInfo os,
      required final List<SystemNetworkStats> network,
      @JsonKey(name: 'default_network')
      required final SystemDefaultNetwork defaultNetwork,
      required final SystemDisplayInfo display}) = _$SystemSystemInfoImpl;

  factory _SystemSystemInfo.fromJson(Map<String, dynamic> json) =
      _$SystemSystemInfoImpl.fromJson;

  /// Current CPU load percentage (0-100%).
  @override
  @JsonKey(name: 'cpu_load')
  double get cpuLoad;
  @override
  SystemMemoryInfo get memory;

  /// List of available storage devices and their usage details.
  @override
  List<SystemStorageInfo> get storage;
  @override
  SystemTemperatureInfo get temperature;

  /// Operating system name and version.
  @override
  SystemOperatingSystemInfo get os;

  /// List of network interfaces with statistics.
  @override
  List<SystemNetworkStats> get network;
  @override
  @JsonKey(name: 'default_network')
  SystemDefaultNetwork get defaultNetwork;
  @override
  SystemDisplayInfo get display;

  /// Create a copy of SystemSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SystemSystemInfoImplCopyWith<_$SystemSystemInfoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

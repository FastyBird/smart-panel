// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'system_module_system_info.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

SystemModuleSystemInfo _$SystemModuleSystemInfoFromJson(
    Map<String, dynamic> json) {
  return _SystemModuleSystemInfo.fromJson(json);
}

/// @nodoc
mixin _$SystemModuleSystemInfo {
  /// Current CPU load percentage (0-100%).
  @JsonKey(name: 'cpu_load')
  double get cpuLoad => throw _privateConstructorUsedError;
  SystemModuleMemoryInfo get memory => throw _privateConstructorUsedError;

  /// List of available storage devices and their usage details.
  List<SystemModuleStorageInfo> get storage =>
      throw _privateConstructorUsedError;
  SystemModuleTemperatureInfo get temperature =>
      throw _privateConstructorUsedError;

  /// Operating system name and version.
  SystemModuleOperatingSystemInfo get os => throw _privateConstructorUsedError;

  /// List of network interfaces with statistics.
  List<SystemModuleNetworkStats> get network =>
      throw _privateConstructorUsedError;
  @JsonKey(name: 'default_network')
  SystemModuleDefaultNetwork get defaultNetwork =>
      throw _privateConstructorUsedError;
  SystemModuleDisplayInfo get display => throw _privateConstructorUsedError;

  /// Serializes this SystemModuleSystemInfo to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SystemModuleSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SystemModuleSystemInfoCopyWith<SystemModuleSystemInfo> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SystemModuleSystemInfoCopyWith<$Res> {
  factory $SystemModuleSystemInfoCopyWith(SystemModuleSystemInfo value,
          $Res Function(SystemModuleSystemInfo) then) =
      _$SystemModuleSystemInfoCopyWithImpl<$Res, SystemModuleSystemInfo>;
  @useResult
  $Res call(
      {@JsonKey(name: 'cpu_load') double cpuLoad,
      SystemModuleMemoryInfo memory,
      List<SystemModuleStorageInfo> storage,
      SystemModuleTemperatureInfo temperature,
      SystemModuleOperatingSystemInfo os,
      List<SystemModuleNetworkStats> network,
      @JsonKey(name: 'default_network')
      SystemModuleDefaultNetwork defaultNetwork,
      SystemModuleDisplayInfo display});

  $SystemModuleMemoryInfoCopyWith<$Res> get memory;
  $SystemModuleTemperatureInfoCopyWith<$Res> get temperature;
  $SystemModuleOperatingSystemInfoCopyWith<$Res> get os;
  $SystemModuleDefaultNetworkCopyWith<$Res> get defaultNetwork;
  $SystemModuleDisplayInfoCopyWith<$Res> get display;
}

/// @nodoc
class _$SystemModuleSystemInfoCopyWithImpl<$Res,
        $Val extends SystemModuleSystemInfo>
    implements $SystemModuleSystemInfoCopyWith<$Res> {
  _$SystemModuleSystemInfoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SystemModuleSystemInfo
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
              as SystemModuleMemoryInfo,
      storage: null == storage
          ? _value.storage
          : storage // ignore: cast_nullable_to_non_nullable
              as List<SystemModuleStorageInfo>,
      temperature: null == temperature
          ? _value.temperature
          : temperature // ignore: cast_nullable_to_non_nullable
              as SystemModuleTemperatureInfo,
      os: null == os
          ? _value.os
          : os // ignore: cast_nullable_to_non_nullable
              as SystemModuleOperatingSystemInfo,
      network: null == network
          ? _value.network
          : network // ignore: cast_nullable_to_non_nullable
              as List<SystemModuleNetworkStats>,
      defaultNetwork: null == defaultNetwork
          ? _value.defaultNetwork
          : defaultNetwork // ignore: cast_nullable_to_non_nullable
              as SystemModuleDefaultNetwork,
      display: null == display
          ? _value.display
          : display // ignore: cast_nullable_to_non_nullable
              as SystemModuleDisplayInfo,
    ) as $Val);
  }

  /// Create a copy of SystemModuleSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $SystemModuleMemoryInfoCopyWith<$Res> get memory {
    return $SystemModuleMemoryInfoCopyWith<$Res>(_value.memory, (value) {
      return _then(_value.copyWith(memory: value) as $Val);
    });
  }

  /// Create a copy of SystemModuleSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $SystemModuleTemperatureInfoCopyWith<$Res> get temperature {
    return $SystemModuleTemperatureInfoCopyWith<$Res>(_value.temperature,
        (value) {
      return _then(_value.copyWith(temperature: value) as $Val);
    });
  }

  /// Create a copy of SystemModuleSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $SystemModuleOperatingSystemInfoCopyWith<$Res> get os {
    return $SystemModuleOperatingSystemInfoCopyWith<$Res>(_value.os, (value) {
      return _then(_value.copyWith(os: value) as $Val);
    });
  }

  /// Create a copy of SystemModuleSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $SystemModuleDefaultNetworkCopyWith<$Res> get defaultNetwork {
    return $SystemModuleDefaultNetworkCopyWith<$Res>(_value.defaultNetwork,
        (value) {
      return _then(_value.copyWith(defaultNetwork: value) as $Val);
    });
  }

  /// Create a copy of SystemModuleSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $SystemModuleDisplayInfoCopyWith<$Res> get display {
    return $SystemModuleDisplayInfoCopyWith<$Res>(_value.display, (value) {
      return _then(_value.copyWith(display: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$SystemModuleSystemInfoImplCopyWith<$Res>
    implements $SystemModuleSystemInfoCopyWith<$Res> {
  factory _$$SystemModuleSystemInfoImplCopyWith(
          _$SystemModuleSystemInfoImpl value,
          $Res Function(_$SystemModuleSystemInfoImpl) then) =
      __$$SystemModuleSystemInfoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: 'cpu_load') double cpuLoad,
      SystemModuleMemoryInfo memory,
      List<SystemModuleStorageInfo> storage,
      SystemModuleTemperatureInfo temperature,
      SystemModuleOperatingSystemInfo os,
      List<SystemModuleNetworkStats> network,
      @JsonKey(name: 'default_network')
      SystemModuleDefaultNetwork defaultNetwork,
      SystemModuleDisplayInfo display});

  @override
  $SystemModuleMemoryInfoCopyWith<$Res> get memory;
  @override
  $SystemModuleTemperatureInfoCopyWith<$Res> get temperature;
  @override
  $SystemModuleOperatingSystemInfoCopyWith<$Res> get os;
  @override
  $SystemModuleDefaultNetworkCopyWith<$Res> get defaultNetwork;
  @override
  $SystemModuleDisplayInfoCopyWith<$Res> get display;
}

/// @nodoc
class __$$SystemModuleSystemInfoImplCopyWithImpl<$Res>
    extends _$SystemModuleSystemInfoCopyWithImpl<$Res,
        _$SystemModuleSystemInfoImpl>
    implements _$$SystemModuleSystemInfoImplCopyWith<$Res> {
  __$$SystemModuleSystemInfoImplCopyWithImpl(
      _$SystemModuleSystemInfoImpl _value,
      $Res Function(_$SystemModuleSystemInfoImpl) _then)
      : super(_value, _then);

  /// Create a copy of SystemModuleSystemInfo
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
    return _then(_$SystemModuleSystemInfoImpl(
      cpuLoad: null == cpuLoad
          ? _value.cpuLoad
          : cpuLoad // ignore: cast_nullable_to_non_nullable
              as double,
      memory: null == memory
          ? _value.memory
          : memory // ignore: cast_nullable_to_non_nullable
              as SystemModuleMemoryInfo,
      storage: null == storage
          ? _value._storage
          : storage // ignore: cast_nullable_to_non_nullable
              as List<SystemModuleStorageInfo>,
      temperature: null == temperature
          ? _value.temperature
          : temperature // ignore: cast_nullable_to_non_nullable
              as SystemModuleTemperatureInfo,
      os: null == os
          ? _value.os
          : os // ignore: cast_nullable_to_non_nullable
              as SystemModuleOperatingSystemInfo,
      network: null == network
          ? _value._network
          : network // ignore: cast_nullable_to_non_nullable
              as List<SystemModuleNetworkStats>,
      defaultNetwork: null == defaultNetwork
          ? _value.defaultNetwork
          : defaultNetwork // ignore: cast_nullable_to_non_nullable
              as SystemModuleDefaultNetwork,
      display: null == display
          ? _value.display
          : display // ignore: cast_nullable_to_non_nullable
              as SystemModuleDisplayInfo,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SystemModuleSystemInfoImpl implements _SystemModuleSystemInfo {
  const _$SystemModuleSystemInfoImpl(
      {@JsonKey(name: 'cpu_load') required this.cpuLoad,
      required this.memory,
      required final List<SystemModuleStorageInfo> storage,
      required this.temperature,
      required this.os,
      required final List<SystemModuleNetworkStats> network,
      @JsonKey(name: 'default_network') required this.defaultNetwork,
      required this.display})
      : _storage = storage,
        _network = network;

  factory _$SystemModuleSystemInfoImpl.fromJson(Map<String, dynamic> json) =>
      _$$SystemModuleSystemInfoImplFromJson(json);

  /// Current CPU load percentage (0-100%).
  @override
  @JsonKey(name: 'cpu_load')
  final double cpuLoad;
  @override
  final SystemModuleMemoryInfo memory;

  /// List of available storage devices and their usage details.
  final List<SystemModuleStorageInfo> _storage;

  /// List of available storage devices and their usage details.
  @override
  List<SystemModuleStorageInfo> get storage {
    if (_storage is EqualUnmodifiableListView) return _storage;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_storage);
  }

  @override
  final SystemModuleTemperatureInfo temperature;

  /// Operating system name and version.
  @override
  final SystemModuleOperatingSystemInfo os;

  /// List of network interfaces with statistics.
  final List<SystemModuleNetworkStats> _network;

  /// List of network interfaces with statistics.
  @override
  List<SystemModuleNetworkStats> get network {
    if (_network is EqualUnmodifiableListView) return _network;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_network);
  }

  @override
  @JsonKey(name: 'default_network')
  final SystemModuleDefaultNetwork defaultNetwork;
  @override
  final SystemModuleDisplayInfo display;

  @override
  String toString() {
    return 'SystemModuleSystemInfo(cpuLoad: $cpuLoad, memory: $memory, storage: $storage, temperature: $temperature, os: $os, network: $network, defaultNetwork: $defaultNetwork, display: $display)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SystemModuleSystemInfoImpl &&
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

  /// Create a copy of SystemModuleSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SystemModuleSystemInfoImplCopyWith<_$SystemModuleSystemInfoImpl>
      get copyWith => __$$SystemModuleSystemInfoImplCopyWithImpl<
          _$SystemModuleSystemInfoImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SystemModuleSystemInfoImplToJson(
      this,
    );
  }
}

abstract class _SystemModuleSystemInfo implements SystemModuleSystemInfo {
  const factory _SystemModuleSystemInfo(
          {@JsonKey(name: 'cpu_load') required final double cpuLoad,
          required final SystemModuleMemoryInfo memory,
          required final List<SystemModuleStorageInfo> storage,
          required final SystemModuleTemperatureInfo temperature,
          required final SystemModuleOperatingSystemInfo os,
          required final List<SystemModuleNetworkStats> network,
          @JsonKey(name: 'default_network')
          required final SystemModuleDefaultNetwork defaultNetwork,
          required final SystemModuleDisplayInfo display}) =
      _$SystemModuleSystemInfoImpl;

  factory _SystemModuleSystemInfo.fromJson(Map<String, dynamic> json) =
      _$SystemModuleSystemInfoImpl.fromJson;

  /// Current CPU load percentage (0-100%).
  @override
  @JsonKey(name: 'cpu_load')
  double get cpuLoad;
  @override
  SystemModuleMemoryInfo get memory;

  /// List of available storage devices and their usage details.
  @override
  List<SystemModuleStorageInfo> get storage;
  @override
  SystemModuleTemperatureInfo get temperature;

  /// Operating system name and version.
  @override
  SystemModuleOperatingSystemInfo get os;

  /// List of network interfaces with statistics.
  @override
  List<SystemModuleNetworkStats> get network;
  @override
  @JsonKey(name: 'default_network')
  SystemModuleDefaultNetwork get defaultNetwork;
  @override
  SystemModuleDisplayInfo get display;

  /// Create a copy of SystemModuleSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SystemModuleSystemInfoImplCopyWith<_$SystemModuleSystemInfoImpl>
      get copyWith => throw _privateConstructorUsedError;
}

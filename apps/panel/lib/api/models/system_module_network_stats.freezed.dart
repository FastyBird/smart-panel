// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'system_module_network_stats.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

SystemModuleNetworkStats _$SystemModuleNetworkStatsFromJson(
    Map<String, dynamic> json) {
  return _SystemModuleNetworkStats.fromJson(json);
}

/// @nodoc
mixin _$SystemModuleNetworkStats {
  /// Network interface name.
  /// The name has been replaced because it contains a keyword. Original name: `interface`.
  @JsonKey(name: 'interface')
  String get interfaceValue => throw _privateConstructorUsedError;

  /// Total received bytes.
  @JsonKey(name: 'rx_bytes')
  int get rxBytes => throw _privateConstructorUsedError;

  /// Total transmitted bytes.
  @JsonKey(name: 'tx_bytes')
  int get txBytes => throw _privateConstructorUsedError;

  /// Serializes this SystemModuleNetworkStats to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SystemModuleNetworkStats
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SystemModuleNetworkStatsCopyWith<SystemModuleNetworkStats> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SystemModuleNetworkStatsCopyWith<$Res> {
  factory $SystemModuleNetworkStatsCopyWith(SystemModuleNetworkStats value,
          $Res Function(SystemModuleNetworkStats) then) =
      _$SystemModuleNetworkStatsCopyWithImpl<$Res, SystemModuleNetworkStats>;
  @useResult
  $Res call(
      {@JsonKey(name: 'interface') String interfaceValue,
      @JsonKey(name: 'rx_bytes') int rxBytes,
      @JsonKey(name: 'tx_bytes') int txBytes});
}

/// @nodoc
class _$SystemModuleNetworkStatsCopyWithImpl<$Res,
        $Val extends SystemModuleNetworkStats>
    implements $SystemModuleNetworkStatsCopyWith<$Res> {
  _$SystemModuleNetworkStatsCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SystemModuleNetworkStats
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? interfaceValue = null,
    Object? rxBytes = null,
    Object? txBytes = null,
  }) {
    return _then(_value.copyWith(
      interfaceValue: null == interfaceValue
          ? _value.interfaceValue
          : interfaceValue // ignore: cast_nullable_to_non_nullable
              as String,
      rxBytes: null == rxBytes
          ? _value.rxBytes
          : rxBytes // ignore: cast_nullable_to_non_nullable
              as int,
      txBytes: null == txBytes
          ? _value.txBytes
          : txBytes // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SystemModuleNetworkStatsImplCopyWith<$Res>
    implements $SystemModuleNetworkStatsCopyWith<$Res> {
  factory _$$SystemModuleNetworkStatsImplCopyWith(
          _$SystemModuleNetworkStatsImpl value,
          $Res Function(_$SystemModuleNetworkStatsImpl) then) =
      __$$SystemModuleNetworkStatsImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: 'interface') String interfaceValue,
      @JsonKey(name: 'rx_bytes') int rxBytes,
      @JsonKey(name: 'tx_bytes') int txBytes});
}

/// @nodoc
class __$$SystemModuleNetworkStatsImplCopyWithImpl<$Res>
    extends _$SystemModuleNetworkStatsCopyWithImpl<$Res,
        _$SystemModuleNetworkStatsImpl>
    implements _$$SystemModuleNetworkStatsImplCopyWith<$Res> {
  __$$SystemModuleNetworkStatsImplCopyWithImpl(
      _$SystemModuleNetworkStatsImpl _value,
      $Res Function(_$SystemModuleNetworkStatsImpl) _then)
      : super(_value, _then);

  /// Create a copy of SystemModuleNetworkStats
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? interfaceValue = null,
    Object? rxBytes = null,
    Object? txBytes = null,
  }) {
    return _then(_$SystemModuleNetworkStatsImpl(
      interfaceValue: null == interfaceValue
          ? _value.interfaceValue
          : interfaceValue // ignore: cast_nullable_to_non_nullable
              as String,
      rxBytes: null == rxBytes
          ? _value.rxBytes
          : rxBytes // ignore: cast_nullable_to_non_nullable
              as int,
      txBytes: null == txBytes
          ? _value.txBytes
          : txBytes // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SystemModuleNetworkStatsImpl implements _SystemModuleNetworkStats {
  const _$SystemModuleNetworkStatsImpl(
      {@JsonKey(name: 'interface') required this.interfaceValue,
      @JsonKey(name: 'rx_bytes') required this.rxBytes,
      @JsonKey(name: 'tx_bytes') required this.txBytes});

  factory _$SystemModuleNetworkStatsImpl.fromJson(Map<String, dynamic> json) =>
      _$$SystemModuleNetworkStatsImplFromJson(json);

  /// Network interface name.
  /// The name has been replaced because it contains a keyword. Original name: `interface`.
  @override
  @JsonKey(name: 'interface')
  final String interfaceValue;

  /// Total received bytes.
  @override
  @JsonKey(name: 'rx_bytes')
  final int rxBytes;

  /// Total transmitted bytes.
  @override
  @JsonKey(name: 'tx_bytes')
  final int txBytes;

  @override
  String toString() {
    return 'SystemModuleNetworkStats(interfaceValue: $interfaceValue, rxBytes: $rxBytes, txBytes: $txBytes)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SystemModuleNetworkStatsImpl &&
            (identical(other.interfaceValue, interfaceValue) ||
                other.interfaceValue == interfaceValue) &&
            (identical(other.rxBytes, rxBytes) || other.rxBytes == rxBytes) &&
            (identical(other.txBytes, txBytes) || other.txBytes == txBytes));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, interfaceValue, rxBytes, txBytes);

  /// Create a copy of SystemModuleNetworkStats
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SystemModuleNetworkStatsImplCopyWith<_$SystemModuleNetworkStatsImpl>
      get copyWith => __$$SystemModuleNetworkStatsImplCopyWithImpl<
          _$SystemModuleNetworkStatsImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SystemModuleNetworkStatsImplToJson(
      this,
    );
  }
}

abstract class _SystemModuleNetworkStats implements SystemModuleNetworkStats {
  const factory _SystemModuleNetworkStats(
          {@JsonKey(name: 'interface') required final String interfaceValue,
          @JsonKey(name: 'rx_bytes') required final int rxBytes,
          @JsonKey(name: 'tx_bytes') required final int txBytes}) =
      _$SystemModuleNetworkStatsImpl;

  factory _SystemModuleNetworkStats.fromJson(Map<String, dynamic> json) =
      _$SystemModuleNetworkStatsImpl.fromJson;

  /// Network interface name.
  /// The name has been replaced because it contains a keyword. Original name: `interface`.
  @override
  @JsonKey(name: 'interface')
  String get interfaceValue;

  /// Total received bytes.
  @override
  @JsonKey(name: 'rx_bytes')
  int get rxBytes;

  /// Total transmitted bytes.
  @override
  @JsonKey(name: 'tx_bytes')
  int get txBytes;

  /// Create a copy of SystemModuleNetworkStats
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SystemModuleNetworkStatsImplCopyWith<_$SystemModuleNetworkStatsImpl>
      get copyWith => throw _privateConstructorUsedError;
}

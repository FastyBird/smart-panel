// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'system_default_network.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

SystemDefaultNetwork _$SystemDefaultNetworkFromJson(Map<String, dynamic> json) {
  return _SystemDefaultNetwork.fromJson(json);
}

/// @nodoc
mixin _$SystemDefaultNetwork {
  /// Network interface name.
  /// The name has been replaced because it contains a keyword. Original name: `interface`.
  @JsonKey(name: 'interface')
  String get interfaceValue => throw _privateConstructorUsedError;

  /// IPv4 address.
  String get ip4 => throw _privateConstructorUsedError;

  /// IPv6 address.
  String get ip6 => throw _privateConstructorUsedError;

  /// Default network interface physical address.
  String get mac => throw _privateConstructorUsedError;

  /// Serializes this SystemDefaultNetwork to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SystemDefaultNetwork
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SystemDefaultNetworkCopyWith<SystemDefaultNetwork> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SystemDefaultNetworkCopyWith<$Res> {
  factory $SystemDefaultNetworkCopyWith(SystemDefaultNetwork value,
          $Res Function(SystemDefaultNetwork) then) =
      _$SystemDefaultNetworkCopyWithImpl<$Res, SystemDefaultNetwork>;
  @useResult
  $Res call(
      {@JsonKey(name: 'interface') String interfaceValue,
      String ip4,
      String ip6,
      String mac});
}

/// @nodoc
class _$SystemDefaultNetworkCopyWithImpl<$Res,
        $Val extends SystemDefaultNetwork>
    implements $SystemDefaultNetworkCopyWith<$Res> {
  _$SystemDefaultNetworkCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SystemDefaultNetwork
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? interfaceValue = null,
    Object? ip4 = null,
    Object? ip6 = null,
    Object? mac = null,
  }) {
    return _then(_value.copyWith(
      interfaceValue: null == interfaceValue
          ? _value.interfaceValue
          : interfaceValue // ignore: cast_nullable_to_non_nullable
              as String,
      ip4: null == ip4
          ? _value.ip4
          : ip4 // ignore: cast_nullable_to_non_nullable
              as String,
      ip6: null == ip6
          ? _value.ip6
          : ip6 // ignore: cast_nullable_to_non_nullable
              as String,
      mac: null == mac
          ? _value.mac
          : mac // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SystemDefaultNetworkImplCopyWith<$Res>
    implements $SystemDefaultNetworkCopyWith<$Res> {
  factory _$$SystemDefaultNetworkImplCopyWith(_$SystemDefaultNetworkImpl value,
          $Res Function(_$SystemDefaultNetworkImpl) then) =
      __$$SystemDefaultNetworkImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: 'interface') String interfaceValue,
      String ip4,
      String ip6,
      String mac});
}

/// @nodoc
class __$$SystemDefaultNetworkImplCopyWithImpl<$Res>
    extends _$SystemDefaultNetworkCopyWithImpl<$Res, _$SystemDefaultNetworkImpl>
    implements _$$SystemDefaultNetworkImplCopyWith<$Res> {
  __$$SystemDefaultNetworkImplCopyWithImpl(_$SystemDefaultNetworkImpl _value,
      $Res Function(_$SystemDefaultNetworkImpl) _then)
      : super(_value, _then);

  /// Create a copy of SystemDefaultNetwork
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? interfaceValue = null,
    Object? ip4 = null,
    Object? ip6 = null,
    Object? mac = null,
  }) {
    return _then(_$SystemDefaultNetworkImpl(
      interfaceValue: null == interfaceValue
          ? _value.interfaceValue
          : interfaceValue // ignore: cast_nullable_to_non_nullable
              as String,
      ip4: null == ip4
          ? _value.ip4
          : ip4 // ignore: cast_nullable_to_non_nullable
              as String,
      ip6: null == ip6
          ? _value.ip6
          : ip6 // ignore: cast_nullable_to_non_nullable
              as String,
      mac: null == mac
          ? _value.mac
          : mac // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SystemDefaultNetworkImpl implements _SystemDefaultNetwork {
  const _$SystemDefaultNetworkImpl(
      {@JsonKey(name: 'interface') required this.interfaceValue,
      required this.ip4,
      required this.ip6,
      required this.mac});

  factory _$SystemDefaultNetworkImpl.fromJson(Map<String, dynamic> json) =>
      _$$SystemDefaultNetworkImplFromJson(json);

  /// Network interface name.
  /// The name has been replaced because it contains a keyword. Original name: `interface`.
  @override
  @JsonKey(name: 'interface')
  final String interfaceValue;

  /// IPv4 address.
  @override
  final String ip4;

  /// IPv6 address.
  @override
  final String ip6;

  /// Default network interface physical address.
  @override
  final String mac;

  @override
  String toString() {
    return 'SystemDefaultNetwork(interfaceValue: $interfaceValue, ip4: $ip4, ip6: $ip6, mac: $mac)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SystemDefaultNetworkImpl &&
            (identical(other.interfaceValue, interfaceValue) ||
                other.interfaceValue == interfaceValue) &&
            (identical(other.ip4, ip4) || other.ip4 == ip4) &&
            (identical(other.ip6, ip6) || other.ip6 == ip6) &&
            (identical(other.mac, mac) || other.mac == mac));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, interfaceValue, ip4, ip6, mac);

  /// Create a copy of SystemDefaultNetwork
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SystemDefaultNetworkImplCopyWith<_$SystemDefaultNetworkImpl>
      get copyWith =>
          __$$SystemDefaultNetworkImplCopyWithImpl<_$SystemDefaultNetworkImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SystemDefaultNetworkImplToJson(
      this,
    );
  }
}

abstract class _SystemDefaultNetwork implements SystemDefaultNetwork {
  const factory _SystemDefaultNetwork(
      {@JsonKey(name: 'interface') required final String interfaceValue,
      required final String ip4,
      required final String ip6,
      required final String mac}) = _$SystemDefaultNetworkImpl;

  factory _SystemDefaultNetwork.fromJson(Map<String, dynamic> json) =
      _$SystemDefaultNetworkImpl.fromJson;

  /// Network interface name.
  /// The name has been replaced because it contains a keyword. Original name: `interface`.
  @override
  @JsonKey(name: 'interface')
  String get interfaceValue;

  /// IPv4 address.
  @override
  String get ip4;

  /// IPv6 address.
  @override
  String get ip6;

  /// Default network interface physical address.
  @override
  String get mac;

  /// Create a copy of SystemDefaultNetwork
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SystemDefaultNetworkImplCopyWith<_$SystemDefaultNetworkImpl>
      get copyWith => throw _privateConstructorUsedError;
}

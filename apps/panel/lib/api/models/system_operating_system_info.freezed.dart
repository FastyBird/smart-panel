// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'system_operating_system_info.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

SystemOperatingSystemInfo _$SystemOperatingSystemInfoFromJson(
    Map<String, dynamic> json) {
  return _SystemOperatingSystemInfo.fromJson(json);
}

/// @nodoc
mixin _$SystemOperatingSystemInfo {
  /// Operating system platform.
  String get platform => throw _privateConstructorUsedError;

  /// Operating system distribution.
  String get distro => throw _privateConstructorUsedError;

  /// Operating system release version.
  String get release => throw _privateConstructorUsedError;

  /// System uptime in seconds.
  int get uptime => throw _privateConstructorUsedError;

  /// Serializes this SystemOperatingSystemInfo to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SystemOperatingSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SystemOperatingSystemInfoCopyWith<SystemOperatingSystemInfo> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SystemOperatingSystemInfoCopyWith<$Res> {
  factory $SystemOperatingSystemInfoCopyWith(SystemOperatingSystemInfo value,
          $Res Function(SystemOperatingSystemInfo) then) =
      _$SystemOperatingSystemInfoCopyWithImpl<$Res, SystemOperatingSystemInfo>;
  @useResult
  $Res call({String platform, String distro, String release, int uptime});
}

/// @nodoc
class _$SystemOperatingSystemInfoCopyWithImpl<$Res,
        $Val extends SystemOperatingSystemInfo>
    implements $SystemOperatingSystemInfoCopyWith<$Res> {
  _$SystemOperatingSystemInfoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SystemOperatingSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? platform = null,
    Object? distro = null,
    Object? release = null,
    Object? uptime = null,
  }) {
    return _then(_value.copyWith(
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      distro: null == distro
          ? _value.distro
          : distro // ignore: cast_nullable_to_non_nullable
              as String,
      release: null == release
          ? _value.release
          : release // ignore: cast_nullable_to_non_nullable
              as String,
      uptime: null == uptime
          ? _value.uptime
          : uptime // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SystemOperatingSystemInfoImplCopyWith<$Res>
    implements $SystemOperatingSystemInfoCopyWith<$Res> {
  factory _$$SystemOperatingSystemInfoImplCopyWith(
          _$SystemOperatingSystemInfoImpl value,
          $Res Function(_$SystemOperatingSystemInfoImpl) then) =
      __$$SystemOperatingSystemInfoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String platform, String distro, String release, int uptime});
}

/// @nodoc
class __$$SystemOperatingSystemInfoImplCopyWithImpl<$Res>
    extends _$SystemOperatingSystemInfoCopyWithImpl<$Res,
        _$SystemOperatingSystemInfoImpl>
    implements _$$SystemOperatingSystemInfoImplCopyWith<$Res> {
  __$$SystemOperatingSystemInfoImplCopyWithImpl(
      _$SystemOperatingSystemInfoImpl _value,
      $Res Function(_$SystemOperatingSystemInfoImpl) _then)
      : super(_value, _then);

  /// Create a copy of SystemOperatingSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? platform = null,
    Object? distro = null,
    Object? release = null,
    Object? uptime = null,
  }) {
    return _then(_$SystemOperatingSystemInfoImpl(
      platform: null == platform
          ? _value.platform
          : platform // ignore: cast_nullable_to_non_nullable
              as String,
      distro: null == distro
          ? _value.distro
          : distro // ignore: cast_nullable_to_non_nullable
              as String,
      release: null == release
          ? _value.release
          : release // ignore: cast_nullable_to_non_nullable
              as String,
      uptime: null == uptime
          ? _value.uptime
          : uptime // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SystemOperatingSystemInfoImpl implements _SystemOperatingSystemInfo {
  const _$SystemOperatingSystemInfoImpl(
      {required this.platform,
      required this.distro,
      required this.release,
      required this.uptime});

  factory _$SystemOperatingSystemInfoImpl.fromJson(Map<String, dynamic> json) =>
      _$$SystemOperatingSystemInfoImplFromJson(json);

  /// Operating system platform.
  @override
  final String platform;

  /// Operating system distribution.
  @override
  final String distro;

  /// Operating system release version.
  @override
  final String release;

  /// System uptime in seconds.
  @override
  final int uptime;

  @override
  String toString() {
    return 'SystemOperatingSystemInfo(platform: $platform, distro: $distro, release: $release, uptime: $uptime)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SystemOperatingSystemInfoImpl &&
            (identical(other.platform, platform) ||
                other.platform == platform) &&
            (identical(other.distro, distro) || other.distro == distro) &&
            (identical(other.release, release) || other.release == release) &&
            (identical(other.uptime, uptime) || other.uptime == uptime));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, platform, distro, release, uptime);

  /// Create a copy of SystemOperatingSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SystemOperatingSystemInfoImplCopyWith<_$SystemOperatingSystemInfoImpl>
      get copyWith => __$$SystemOperatingSystemInfoImplCopyWithImpl<
          _$SystemOperatingSystemInfoImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SystemOperatingSystemInfoImplToJson(
      this,
    );
  }
}

abstract class _SystemOperatingSystemInfo implements SystemOperatingSystemInfo {
  const factory _SystemOperatingSystemInfo(
      {required final String platform,
      required final String distro,
      required final String release,
      required final int uptime}) = _$SystemOperatingSystemInfoImpl;

  factory _SystemOperatingSystemInfo.fromJson(Map<String, dynamic> json) =
      _$SystemOperatingSystemInfoImpl.fromJson;

  /// Operating system platform.
  @override
  String get platform;

  /// Operating system distribution.
  @override
  String get distro;

  /// Operating system release version.
  @override
  String get release;

  /// System uptime in seconds.
  @override
  int get uptime;

  /// Create a copy of SystemOperatingSystemInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SystemOperatingSystemInfoImplCopyWith<_$SystemOperatingSystemInfoImpl>
      get copyWith => throw _privateConstructorUsedError;
}

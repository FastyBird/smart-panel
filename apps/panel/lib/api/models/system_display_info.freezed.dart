// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'system_display_info.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

SystemDisplayInfo _$SystemDisplayInfoFromJson(Map<String, dynamic> json) {
  return _SystemDisplayInfo.fromJson(json);
}

/// @nodoc
mixin _$SystemDisplayInfo {
  /// Native horizontal screen resolution.
  @JsonKey(name: 'resolution_x')
  int get resolutionX => throw _privateConstructorUsedError;

  /// Native vertical screen resolution.
  @JsonKey(name: 'resolution_y')
  int get resolutionY => throw _privateConstructorUsedError;

  /// Current horizontal screen resolution.
  @JsonKey(name: 'current_res_x')
  int get currentResX => throw _privateConstructorUsedError;

  /// Current vertical screen resolution.
  @JsonKey(name: 'current_res_y')
  int get currentResY => throw _privateConstructorUsedError;

  /// Serializes this SystemDisplayInfo to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SystemDisplayInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SystemDisplayInfoCopyWith<SystemDisplayInfo> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SystemDisplayInfoCopyWith<$Res> {
  factory $SystemDisplayInfoCopyWith(
          SystemDisplayInfo value, $Res Function(SystemDisplayInfo) then) =
      _$SystemDisplayInfoCopyWithImpl<$Res, SystemDisplayInfo>;
  @useResult
  $Res call(
      {@JsonKey(name: 'resolution_x') int resolutionX,
      @JsonKey(name: 'resolution_y') int resolutionY,
      @JsonKey(name: 'current_res_x') int currentResX,
      @JsonKey(name: 'current_res_y') int currentResY});
}

/// @nodoc
class _$SystemDisplayInfoCopyWithImpl<$Res, $Val extends SystemDisplayInfo>
    implements $SystemDisplayInfoCopyWith<$Res> {
  _$SystemDisplayInfoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SystemDisplayInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? resolutionX = null,
    Object? resolutionY = null,
    Object? currentResX = null,
    Object? currentResY = null,
  }) {
    return _then(_value.copyWith(
      resolutionX: null == resolutionX
          ? _value.resolutionX
          : resolutionX // ignore: cast_nullable_to_non_nullable
              as int,
      resolutionY: null == resolutionY
          ? _value.resolutionY
          : resolutionY // ignore: cast_nullable_to_non_nullable
              as int,
      currentResX: null == currentResX
          ? _value.currentResX
          : currentResX // ignore: cast_nullable_to_non_nullable
              as int,
      currentResY: null == currentResY
          ? _value.currentResY
          : currentResY // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SystemDisplayInfoImplCopyWith<$Res>
    implements $SystemDisplayInfoCopyWith<$Res> {
  factory _$$SystemDisplayInfoImplCopyWith(_$SystemDisplayInfoImpl value,
          $Res Function(_$SystemDisplayInfoImpl) then) =
      __$$SystemDisplayInfoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: 'resolution_x') int resolutionX,
      @JsonKey(name: 'resolution_y') int resolutionY,
      @JsonKey(name: 'current_res_x') int currentResX,
      @JsonKey(name: 'current_res_y') int currentResY});
}

/// @nodoc
class __$$SystemDisplayInfoImplCopyWithImpl<$Res>
    extends _$SystemDisplayInfoCopyWithImpl<$Res, _$SystemDisplayInfoImpl>
    implements _$$SystemDisplayInfoImplCopyWith<$Res> {
  __$$SystemDisplayInfoImplCopyWithImpl(_$SystemDisplayInfoImpl _value,
      $Res Function(_$SystemDisplayInfoImpl) _then)
      : super(_value, _then);

  /// Create a copy of SystemDisplayInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? resolutionX = null,
    Object? resolutionY = null,
    Object? currentResX = null,
    Object? currentResY = null,
  }) {
    return _then(_$SystemDisplayInfoImpl(
      resolutionX: null == resolutionX
          ? _value.resolutionX
          : resolutionX // ignore: cast_nullable_to_non_nullable
              as int,
      resolutionY: null == resolutionY
          ? _value.resolutionY
          : resolutionY // ignore: cast_nullable_to_non_nullable
              as int,
      currentResX: null == currentResX
          ? _value.currentResX
          : currentResX // ignore: cast_nullable_to_non_nullable
              as int,
      currentResY: null == currentResY
          ? _value.currentResY
          : currentResY // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SystemDisplayInfoImpl implements _SystemDisplayInfo {
  const _$SystemDisplayInfoImpl(
      {@JsonKey(name: 'resolution_x') required this.resolutionX,
      @JsonKey(name: 'resolution_y') required this.resolutionY,
      @JsonKey(name: 'current_res_x') required this.currentResX,
      @JsonKey(name: 'current_res_y') required this.currentResY});

  factory _$SystemDisplayInfoImpl.fromJson(Map<String, dynamic> json) =>
      _$$SystemDisplayInfoImplFromJson(json);

  /// Native horizontal screen resolution.
  @override
  @JsonKey(name: 'resolution_x')
  final int resolutionX;

  /// Native vertical screen resolution.
  @override
  @JsonKey(name: 'resolution_y')
  final int resolutionY;

  /// Current horizontal screen resolution.
  @override
  @JsonKey(name: 'current_res_x')
  final int currentResX;

  /// Current vertical screen resolution.
  @override
  @JsonKey(name: 'current_res_y')
  final int currentResY;

  @override
  String toString() {
    return 'SystemDisplayInfo(resolutionX: $resolutionX, resolutionY: $resolutionY, currentResX: $currentResX, currentResY: $currentResY)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SystemDisplayInfoImpl &&
            (identical(other.resolutionX, resolutionX) ||
                other.resolutionX == resolutionX) &&
            (identical(other.resolutionY, resolutionY) ||
                other.resolutionY == resolutionY) &&
            (identical(other.currentResX, currentResX) ||
                other.currentResX == currentResX) &&
            (identical(other.currentResY, currentResY) ||
                other.currentResY == currentResY));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, resolutionX, resolutionY, currentResX, currentResY);

  /// Create a copy of SystemDisplayInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SystemDisplayInfoImplCopyWith<_$SystemDisplayInfoImpl> get copyWith =>
      __$$SystemDisplayInfoImplCopyWithImpl<_$SystemDisplayInfoImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SystemDisplayInfoImplToJson(
      this,
    );
  }
}

abstract class _SystemDisplayInfo implements SystemDisplayInfo {
  const factory _SystemDisplayInfo(
          {@JsonKey(name: 'resolution_x') required final int resolutionX,
          @JsonKey(name: 'resolution_y') required final int resolutionY,
          @JsonKey(name: 'current_res_x') required final int currentResX,
          @JsonKey(name: 'current_res_y') required final int currentResY}) =
      _$SystemDisplayInfoImpl;

  factory _SystemDisplayInfo.fromJson(Map<String, dynamic> json) =
      _$SystemDisplayInfoImpl.fromJson;

  /// Native horizontal screen resolution.
  @override
  @JsonKey(name: 'resolution_x')
  int get resolutionX;

  /// Native vertical screen resolution.
  @override
  @JsonKey(name: 'resolution_y')
  int get resolutionY;

  /// Current horizontal screen resolution.
  @override
  @JsonKey(name: 'current_res_x')
  int get currentResX;

  /// Current vertical screen resolution.
  @override
  @JsonKey(name: 'current_res_y')
  int get currentResY;

  /// Create a copy of SystemDisplayInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SystemDisplayInfoImplCopyWith<_$SystemDisplayInfoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

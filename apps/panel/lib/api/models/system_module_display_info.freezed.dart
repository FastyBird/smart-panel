// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'system_module_display_info.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

SystemModuleDisplayInfo _$SystemModuleDisplayInfoFromJson(
    Map<String, dynamic> json) {
  return _SystemModuleDisplayInfo.fromJson(json);
}

/// @nodoc
mixin _$SystemModuleDisplayInfo {
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

  /// Serializes this SystemModuleDisplayInfo to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SystemModuleDisplayInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SystemModuleDisplayInfoCopyWith<SystemModuleDisplayInfo> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SystemModuleDisplayInfoCopyWith<$Res> {
  factory $SystemModuleDisplayInfoCopyWith(SystemModuleDisplayInfo value,
          $Res Function(SystemModuleDisplayInfo) then) =
      _$SystemModuleDisplayInfoCopyWithImpl<$Res, SystemModuleDisplayInfo>;
  @useResult
  $Res call(
      {@JsonKey(name: 'resolution_x') int resolutionX,
      @JsonKey(name: 'resolution_y') int resolutionY,
      @JsonKey(name: 'current_res_x') int currentResX,
      @JsonKey(name: 'current_res_y') int currentResY});
}

/// @nodoc
class _$SystemModuleDisplayInfoCopyWithImpl<$Res,
        $Val extends SystemModuleDisplayInfo>
    implements $SystemModuleDisplayInfoCopyWith<$Res> {
  _$SystemModuleDisplayInfoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SystemModuleDisplayInfo
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
abstract class _$$SystemModuleDisplayInfoImplCopyWith<$Res>
    implements $SystemModuleDisplayInfoCopyWith<$Res> {
  factory _$$SystemModuleDisplayInfoImplCopyWith(
          _$SystemModuleDisplayInfoImpl value,
          $Res Function(_$SystemModuleDisplayInfoImpl) then) =
      __$$SystemModuleDisplayInfoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: 'resolution_x') int resolutionX,
      @JsonKey(name: 'resolution_y') int resolutionY,
      @JsonKey(name: 'current_res_x') int currentResX,
      @JsonKey(name: 'current_res_y') int currentResY});
}

/// @nodoc
class __$$SystemModuleDisplayInfoImplCopyWithImpl<$Res>
    extends _$SystemModuleDisplayInfoCopyWithImpl<$Res,
        _$SystemModuleDisplayInfoImpl>
    implements _$$SystemModuleDisplayInfoImplCopyWith<$Res> {
  __$$SystemModuleDisplayInfoImplCopyWithImpl(
      _$SystemModuleDisplayInfoImpl _value,
      $Res Function(_$SystemModuleDisplayInfoImpl) _then)
      : super(_value, _then);

  /// Create a copy of SystemModuleDisplayInfo
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? resolutionX = null,
    Object? resolutionY = null,
    Object? currentResX = null,
    Object? currentResY = null,
  }) {
    return _then(_$SystemModuleDisplayInfoImpl(
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
class _$SystemModuleDisplayInfoImpl implements _SystemModuleDisplayInfo {
  const _$SystemModuleDisplayInfoImpl(
      {@JsonKey(name: 'resolution_x') required this.resolutionX,
      @JsonKey(name: 'resolution_y') required this.resolutionY,
      @JsonKey(name: 'current_res_x') required this.currentResX,
      @JsonKey(name: 'current_res_y') required this.currentResY});

  factory _$SystemModuleDisplayInfoImpl.fromJson(Map<String, dynamic> json) =>
      _$$SystemModuleDisplayInfoImplFromJson(json);

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
    return 'SystemModuleDisplayInfo(resolutionX: $resolutionX, resolutionY: $resolutionY, currentResX: $currentResX, currentResY: $currentResY)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SystemModuleDisplayInfoImpl &&
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

  /// Create a copy of SystemModuleDisplayInfo
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SystemModuleDisplayInfoImplCopyWith<_$SystemModuleDisplayInfoImpl>
      get copyWith => __$$SystemModuleDisplayInfoImplCopyWithImpl<
          _$SystemModuleDisplayInfoImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SystemModuleDisplayInfoImplToJson(
      this,
    );
  }
}

abstract class _SystemModuleDisplayInfo implements SystemModuleDisplayInfo {
  const factory _SystemModuleDisplayInfo(
          {@JsonKey(name: 'resolution_x') required final int resolutionX,
          @JsonKey(name: 'resolution_y') required final int resolutionY,
          @JsonKey(name: 'current_res_x') required final int currentResX,
          @JsonKey(name: 'current_res_y') required final int currentResY}) =
      _$SystemModuleDisplayInfoImpl;

  factory _SystemModuleDisplayInfo.fromJson(Map<String, dynamic> json) =
      _$SystemModuleDisplayInfoImpl.fromJson;

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

  /// Create a copy of SystemModuleDisplayInfo
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SystemModuleDisplayInfoImplCopyWith<_$SystemModuleDisplayInfoImpl>
      get copyWith => throw _privateConstructorUsedError;
}

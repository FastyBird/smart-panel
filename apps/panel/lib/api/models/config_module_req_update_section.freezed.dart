// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_module_req_update_section.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigModuleReqUpdateSection _$ConfigModuleReqUpdateSectionFromJson(
    Map<String, dynamic> json) {
  return _ConfigModuleReqUpdateSection.fromJson(json);
}

/// @nodoc
mixin _$ConfigModuleReqUpdateSection {
  ConfigModuleReqUpdateSectionDataUnion get data =>
      throw _privateConstructorUsedError;

  /// Serializes this ConfigModuleReqUpdateSection to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConfigModuleReqUpdateSection
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConfigModuleReqUpdateSectionCopyWith<ConfigModuleReqUpdateSection>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigModuleReqUpdateSectionCopyWith<$Res> {
  factory $ConfigModuleReqUpdateSectionCopyWith(
          ConfigModuleReqUpdateSection value,
          $Res Function(ConfigModuleReqUpdateSection) then) =
      _$ConfigModuleReqUpdateSectionCopyWithImpl<$Res,
          ConfigModuleReqUpdateSection>;
  @useResult
  $Res call({ConfigModuleReqUpdateSectionDataUnion data});

  $ConfigModuleReqUpdateSectionDataUnionCopyWith<$Res> get data;
}

/// @nodoc
class _$ConfigModuleReqUpdateSectionCopyWithImpl<$Res,
        $Val extends ConfigModuleReqUpdateSection>
    implements $ConfigModuleReqUpdateSectionCopyWith<$Res> {
  _$ConfigModuleReqUpdateSectionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigModuleReqUpdateSection
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_value.copyWith(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as ConfigModuleReqUpdateSectionDataUnion,
    ) as $Val);
  }

  /// Create a copy of ConfigModuleReqUpdateSection
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ConfigModuleReqUpdateSectionDataUnionCopyWith<$Res> get data {
    return $ConfigModuleReqUpdateSectionDataUnionCopyWith<$Res>(_value.data,
        (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$ConfigModuleReqUpdateSectionImplCopyWith<$Res>
    implements $ConfigModuleReqUpdateSectionCopyWith<$Res> {
  factory _$$ConfigModuleReqUpdateSectionImplCopyWith(
          _$ConfigModuleReqUpdateSectionImpl value,
          $Res Function(_$ConfigModuleReqUpdateSectionImpl) then) =
      __$$ConfigModuleReqUpdateSectionImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({ConfigModuleReqUpdateSectionDataUnion data});

  @override
  $ConfigModuleReqUpdateSectionDataUnionCopyWith<$Res> get data;
}

/// @nodoc
class __$$ConfigModuleReqUpdateSectionImplCopyWithImpl<$Res>
    extends _$ConfigModuleReqUpdateSectionCopyWithImpl<$Res,
        _$ConfigModuleReqUpdateSectionImpl>
    implements _$$ConfigModuleReqUpdateSectionImplCopyWith<$Res> {
  __$$ConfigModuleReqUpdateSectionImplCopyWithImpl(
      _$ConfigModuleReqUpdateSectionImpl _value,
      $Res Function(_$ConfigModuleReqUpdateSectionImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigModuleReqUpdateSection
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$ConfigModuleReqUpdateSectionImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as ConfigModuleReqUpdateSectionDataUnion,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ConfigModuleReqUpdateSectionImpl
    implements _ConfigModuleReqUpdateSection {
  const _$ConfigModuleReqUpdateSectionImpl({required this.data});

  factory _$ConfigModuleReqUpdateSectionImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$ConfigModuleReqUpdateSectionImplFromJson(json);

  @override
  final ConfigModuleReqUpdateSectionDataUnion data;

  @override
  String toString() {
    return 'ConfigModuleReqUpdateSection(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigModuleReqUpdateSectionImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of ConfigModuleReqUpdateSection
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigModuleReqUpdateSectionImplCopyWith<
          _$ConfigModuleReqUpdateSectionImpl>
      get copyWith => __$$ConfigModuleReqUpdateSectionImplCopyWithImpl<
          _$ConfigModuleReqUpdateSectionImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigModuleReqUpdateSectionImplToJson(
      this,
    );
  }
}

abstract class _ConfigModuleReqUpdateSection
    implements ConfigModuleReqUpdateSection {
  const factory _ConfigModuleReqUpdateSection(
          {required final ConfigModuleReqUpdateSectionDataUnion data}) =
      _$ConfigModuleReqUpdateSectionImpl;

  factory _ConfigModuleReqUpdateSection.fromJson(Map<String, dynamic> json) =
      _$ConfigModuleReqUpdateSectionImpl.fromJson;

  @override
  ConfigModuleReqUpdateSectionDataUnion get data;

  /// Create a copy of ConfigModuleReqUpdateSection
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigModuleReqUpdateSectionImplCopyWith<
          _$ConfigModuleReqUpdateSectionImpl>
      get copyWith => throw _privateConstructorUsedError;
}

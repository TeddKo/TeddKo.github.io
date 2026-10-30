---
title: "freezed 3.0 이 생성하는 코드와 build_runner 흐름"
description: "freezed 가 불변 클래스에 만들어 주는 ==, hashCode, toString, copyWith(깊은 copyWith 포함), sealed union 과 json_serializable 연동을 코드 생성 흐름과 함께 설명하고 3.0 에서 바뀐 선언 형식과 when/map 제거를 다룹니다."
pubDatetime: 2025-04-08T21:30:00+09:00
category: dart
tags:
  - Dart
  - freezed
  - 코드 생성
  - build_runner
---

Dart 에서 값 객체를 불변으로 만들려면 `final` 필드와 생성자 외에도 `==`, `hashCode`, `toString`, 일부 필드만 바꿔 새 객체를 만드는 `copyWith` 를 직접 써야 합니다. 필드가 하나 늘 때마다 네 군데를 함께 고쳐야 해서 실수가 생기기 쉽습니다. freezed 는 이 반복 코드를 코드 생성으로 대신하는 패키지입니다. 클래스의 모양만 선언하면 빌드 단계에서 나머지를 만들어 줍니다.

이 글은 2025년 4월 기준 freezed 3.0 계열(3.0.6)을 기준으로 합니다. 2.x 와 선언 형식이 달라진 부분이 있어서 해당 지점에서 따로 짚습니다. changelog 에 따르면 3.0.4 부터 Dart 3.6.0 을 최소 버전으로 지원합니다.

## 생성되는 것

freezed 가 만드는 코드는 크게 네 가지입니다.

| 생성물                | 내용                                  |
| --------------------- | ------------------------------------- |
| `==` / `hashCode`     | 모든 필드를 비교하는 값 동등성        |
| `toString`            | 클래스 이름과 필드 값을 나열한 문자열 |
| `copyWith`            | 일부 필드만 바꾼 복사본 생성          |
| `fromJson` / `toJson` | `json_serializable` 과 연결한 직렬화  |

선언은 `const factory` 생성자 하나가 중심입니다.

```dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'person.freezed.dart';
part 'person.g.dart';

@freezed
abstract class Person with _$Person {
  const factory Person({
    required String firstName,
    required String lastName,
    required int age,
  }) = _Person;

  factory Person.fromJson(Map<String, Object?> json) => _$PersonFromJson(json);
}
```

`Person` 은 추상 클래스이고 실제 구현은 생성 파일의 `_Person` 이 맡습니다. 생성 파일의 `_$Person` mixin 과 `_Person` 클래스가 `copyWith`, `==`, `hashCode`, `toString` 을 제공합니다. 사용하는 쪽에서는 일반 클래스처럼 보입니다.

```dart
final a = Person(firstName: 'Ted', lastName: 'Ko', age: 30);
final b = a.copyWith(age: 31);

print(a == b);                     // false
print(a == a.copyWith());          // true: 필드가 모두 같으면 동등
print(b);                          // Person(firstName: Ted, lastName: Ko, age: 31)
```

3.0 은 선언 형식에서 breaking change 가 있었습니다. changelog 에는 freezed 클래스가 `abstract` 이거나 `sealed` 이거나, 직접 `_$MyClass` 를 구현해야 한다고 적혀 있습니다. 2.x 에서 `class Person with _$Person` 으로 쓰던 코드는 3.0 으로 올릴 때 `abstract class` 로 바꿔야 합니다. `with _$MyClass` 를 빠뜨린 경우에는 3.0.2 부터 생성 단계에서 오류가 납니다.

3.0 은 factory 생성자 없이 일반 클래스 모양으로도 쓸 수 있는 mixed mode 와 상속, const 가 아닌 기본값 지원도 추가했습니다. 위처럼 factory 로 쓰는 방식은 그대로 유효합니다.

## 깊은 copyWith

필드가 다시 freezed 클래스이면 `copyWith` 가 중첩된 형태로도 생성됩니다. 안쪽 객체의 필드 하나를 바꾸려고 바깥부터 `copyWith` 를 겹쳐 부를 필요가 없습니다.

```dart
@freezed
abstract class Assistant with _$Assistant {
  const factory Assistant({required String name}) = _Assistant;
}

@freezed
abstract class Director with _$Director {
  const factory Director({required String name, Assistant? assistant}) = _Director;
}

@freezed
abstract class Company with _$Company {
  const factory Company({required String name, required Director director}) = _Company;
}

final updated = company.copyWith.director.assistant?.call(name: 'John');
```

위 호출은 `Company` 부터 `Director`, `Assistant` 를 각각 복사해서 이어 붙인 새 `Company` 를 돌려줍니다. `assistant` 는 nullable 이라 `?.call` 로 호출하고 값이 null 이면 결과도 null 입니다. 깊은 copyWith 는 3.0.2 의 changelog 에 여러 버그를 고쳤다는 항목이 있습니다.

## union 과 sealed

생성자를 여러 개 두면 union(합 타입)이 됩니다. 생성자마다 별도의 클래스가 만들어지고 3.0 에서는 이를 `sealed` 로 선언합니다.

```dart
@freezed
sealed class LoadState with _$LoadState {
  const factory LoadState.loading() = Loading;
  const factory LoadState.data(String value) = Data;
  const factory LoadState.failure(Object error) = Failure;
}

String label(LoadState state) => switch (state) {
  Loading() => 'loading',
  Data(:final value) => value,
  Failure(:final error) => 'error: $error',
};
```

결과는 [Dart 3 class modifier 와 sealed](/posts/dart-sealed/) 에서 본 것과 같은 구조입니다. `LoadState` 는 sealed 이므로 switch 표현식은 세 하위 타입을 모두 다뤄야 컴파일됩니다. 새 케이스를 추가하면 분기를 빠뜨린 곳이 컴파일 오류로 드러납니다.

2.x 에서는 이 분기를 `when`, `map` 이라는 생성 메서드로 했습니다. 3.0 에서는 `map`/`when` 과 그 변형이 제거되었습니다. changelog 는 Dart 에 패턴 매칭이 들어온 뒤로 사용을 권장하지 않던 메서드였다고 설명합니다. 3.0 으로 올릴 때는 `state.when(loading: ..., data: ..., failure: ...)` 호출을 위와 같은 switch 표현식이나 `if (state case Data(:final value))` 로 바꿔야 합니다.

JSON 변환이 필요한 union 은 직렬화할 때 어느 생성자의 값인지 구분하는 키가 필요합니다. 기본 키는 `runtimeType` 이고 설정으로 바꿀 수 있습니다.

## json_serializable 연동

직렬화 코드는 `json_serializable` 이 생성하고 freezed 는 그 함수를 호출합니다. 위 `Person` 예제처럼 `part 'person.g.dart';` 를 선언하고 `fromJson` 팩토리를 `=>` 형태로 `_$PersonFromJson` 에 연결합니다. 이 형태일 때 freezed 가 `toJson` 도 함께 만듭니다.

```yaml
dependencies:
  freezed_annotation: ^3.0.0
  json_annotation: ^4.9.0

dev_dependencies:
  build_runner: ^2.4.0
  freezed: ^3.0.0
  json_serializable: ^6.9.0
```

`freezed_annotation` 과 `json_annotation` 은 코드에 어노테이션을 제공하는 런타임 의존성이고 실제로 파일을 만드는 `freezed`, `json_serializable`, `build_runner` 는 개발 의존성입니다. 버전 범위는 예시이므로 프로젝트의 SDK 제약에 맞게 조정해야 합니다.

## build_runner 와 part 파일

생성 코드는 build_runner 가 만듭니다. 소스를 분석하는 각 빌더(여기서는 freezed 와 json_serializable)가 어노테이션이 붙은 클래스를 찾아 새 파일을 씁니다.

![원본 person.dart 를 build_runner 가 읽고 freezed 와 json_serializable 빌더를 거쳐 person.freezed.dart 와 person.g.dart 를 만드는 흐름](@/assets/images/dart-freezed-codegen-flow.png)

```bash
dart run build_runner build -d
dart run build_runner watch -d
```

`build` 는 한 번 생성하고 `watch` 는 소스가 바뀔 때마다 다시 생성합니다. `-d` 는 이전에 생성된 충돌 파일을 지우는 `--delete-conflicting-outputs` 의 줄임 옵션입니다.

생성된 파일은 원본의 일부입니다. 원본이 `part 'person.freezed.dart';` 로 선언하고 생성 파일은 `part of 'person.dart';` 로 시작하기 때문에 같은 라이브러리로 컴파일됩니다. 그래서 `_Person`, `_$Person` 같은 private 식별자를 원본에서 곧바로 쓸 수 있습니다. part 선언의 파일명이 원본 파일명과 어긋나면 생성이 되지 않거나 파일을 찾지 못하는 오류가 납니다. 파일 이름을 바꿀 때는 `part` 두 줄도 함께 바꿔야 합니다.

## 참고 자료

- [freezed (pub.dev)](https://pub.dev/packages/freezed)
- [freezed changelog](https://pub.dev/packages/freezed/changelog)
- [freezed versions](https://pub.dev/packages/freezed/versions)
- [json_serializable (pub.dev)](https://pub.dev/packages/json_serializable)
- [build_runner (pub.dev)](https://pub.dev/packages/build_runner)
- [Libraries & imports (part)](https://dart.dev/language/libraries)
- [Branches: switch expressions](https://dart.dev/language/branches#switch-expressions)

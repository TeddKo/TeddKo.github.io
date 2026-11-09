---
title: "Dart sound null safety, 타입에 null 여부를 담는 방식"
description: "Dart 의 sound null safety 가 타입 계층을 어떻게 바꿨는지, ?, !, ??, late, required 의 의미와 flow analysis 에 의한 타입 승격, 필드 승격의 제약(Dart 3.2 의 private final 필드 승격)을 정리합니다."
pubDatetime: 2023-12-12T21:40:00+09:00
category: dart
tags:
  - Dart
  - null safety
  - 타입 시스템
---

null 참조 오류는 실행해 보기 전에는 드러나지 않는 부류의 버그입니다. Dart 의 null safety 는 이 문제를 타입으로 풀었습니다. `String` 은 절대 null 이 아닌 문자열이고 null 을 담을 수 있는 문자열은 `String?` 이라는 별개의 타입입니다. 컴파일러가 두 타입을 구분하기 때문에 null 일 수 있는 값을 검사 없이 쓰는 코드는 빌드 단계에서 막힙니다.

Dart 2.12(2021년 3월)에서 도입되었고 Dart 3(2023년 5월)부터는 언어의 기본 동작입니다. 공식 문서도 Dart 3 이후로 sound null safety 가 강제된다고 밝히고 있습니다. 여기서 sound 는 컴파일러가 non-nullable 로 판정한 값이 실행 중에도 null 이 될 수 없다는 보장을 뜻합니다.

## 기본은 non-nullable 입니다

타입 이름만 쓰면 null 을 담을 수 없고 뒤에 `?` 를 붙이면 담을 수 있습니다.

```dart
String name = 'dart';
String? nickname;          // 초기값 없이 선언하면 null

name = null;               // 컴파일 오류
nickname = null;           // 가능
print(nickname.length);    // 컴파일 오류: null 일 수 있는 값
```

`?` 의 위치에 따라 의미가 갈리는 경우도 있습니다. `List<String?>` 는 원소가 null 일 수 있는 리스트이고 `List<String>?` 는 리스트 자체가 null 일 수 있습니다. 둘을 함께 쓰면 `List<String?>?` 가 됩니다.

타입 계층도 이 규칙에 맞춰 바뀌었습니다. 예전에는 `Null` 이 모든 타입의 하위 타입이어서 어떤 타입의 변수에든 null 을 넣을 수 있었습니다. 지금은 null 을 포함한 모든 값의 최상위 타입이 `Object?` 이고 `Object` 는 그 아래에 놓입니다. `String?` 은 `String` 과 `Null` 의 합집합으로 볼 수 있으며 최하위 타입은 `Never` 입니다. `Never` 는 정상적으로 값을 돌려주지 않는 표현식, 예를 들어 항상 예외를 던지는 함수의 반환 타입으로 쓰입니다.

![Dart 타입 계층: 최상위 Object? 아래에 Object 와 Null 이 있고 String·int·List 는 Object 의 하위 타입이며 Never 가 최하위에 놓인다](@/assets/images/dart-null-safety-type-hierarchy.png)

## null 을 다루는 연산자

nullable 값에 접근하는 도구는 몇 가지로 정해져 있습니다.

```dart
String? name = findName(2);

print(name?.length);       // null 이면 접근하지 않고 결과도 null
print(name ?? 'unknown');  // null 이면 오른쪽 값 사용
final length = name!.length;  // null 이 아니라고 단언
name ??= 'default';        // null 일 때만 대입
```

`?.` 는 receiver 가 null 이면 멤버 접근을 건너뛰고 전체 결과를 null 로 만듭니다. 그래서 `name?.length` 의 타입은 `int?` 입니다. `??` 는 왼쪽이 null 일 때 오른쪽을 쓰고 `??=` 는 변수가 null 일 때만 대입합니다.

`!` 는 nullable 표현식을 non-nullable 타입으로 바꿉니다. 컴파일러는 이 단언을 믿고 통과시키지만 값이 실제로 null 이면 런타임에 예외가 발생합니다. 공식 문서는 `!` 를 다른 캐스트와 같은 것으로 설명합니다. 정적 안전성을 잃고 런타임에 검사되며 값이 null 이면 항상 예외를 던집니다. 그만큼 검사가 컴파일 시점에서 런타임으로 옮겨 가므로 flow analysis 로 승격시킬 수 있는 곳에서는 `!` 를 쓰지 않는 편이 낫습니다.

## late 와 required

`late` 는 non-nullable 변수의 초기화를 나중으로 미루겠다는 표시입니다. 컴파일러가 하던 보장을 런타임이 대신 맡는 셈이어서 초기화 전에 읽으면 예외가 납니다.

```dart
class Service {
  late final Config config;                 // 나중에 한 번 대입
  late final String token = _loadToken();   // 처음 읽을 때 초기화
}
```

초기화식이 붙은 `late` 필드는 지연 초기화되어 처음 접근하는 순간 식이 평가됩니다. `late final` 은 한 번만 대입할 수 있고 두 번째 대입은 예외를 던집니다.

`required` 는 named 매개변수를 반드시 넘기게 합니다. non-nullable 타입의 named 매개변수는 기본값이 없으면 null 로 둘 수 없으므로 `required` 를 붙이거나 기본값을 줘야 합니다. 반대로 nullable 매개변수는 생략하면 null 이 들어갑니다.

```dart
class User {
  final String id;
  final String? nickname;

  User({required this.id, this.nickname});
}

User(id: 'u1');                 // nickname 은 null
User(nickname: 'ted');          // 컴파일 오류: id 누락
```

`required` 와 nullability 는 서로 독립적이라 `required String? nickname` 처럼 반드시 넘기되 null 을 허용하는 선언도 가능합니다.

## flow analysis 와 타입 승격

`!` 없이도 nullable 값을 쓸 수 있는 이유는 컴파일러가 제어 흐름을 따라가며 변수의 타입을 좁히기 때문입니다. null 검사를 통과한 구간에서는 같은 변수가 non-nullable 타입으로 취급되고 이를 타입 승격이라고 부릅니다.

![flow analysis 예시: 변수 name 의 타입이 선언 직후에는 String? 이고 if (name != null) 안에서는 String 으로 승격되며 블록을 벗어나면 다시 String? 이 된다](@/assets/images/dart-null-safety-promotion.gif)

```dart
void printLength(String? name) {
  if (name == null) return;
  print(name.length);   // 여기서 name 은 String
}
```

`return`, `break`, `throw` 같은 탈출 구문도 분석에 반영됩니다. 위 코드처럼 null 이면 일찍 반환하는 패턴을 쓰면 그 아래 줄은 전부 승격된 타입으로 읽힙니다. 승격은 원래 지역 변수와 매개변수에만 적용되었고 Dart 3.2 부터는 아래에서 다룰 private final 필드도 대상입니다. 어느 경우든 검사와 사용 사이에 값이 바뀔 수 없다는 것이 증명되어야 합니다.

## 필드는 승격이 제한됩니다

필드는 사정이 다릅니다. 검사한 직후에도 다른 코드가 값을 바꾸거나 서브클래스가 getter 로 재정의했을 수 있어서 컴파일러가 같은 값임을 보장하지 못합니다. 그래서 오랫동안 필드는 승격 대상이 아니었고 지역 변수에 복사한 뒤 검사하는 우회가 필요했습니다.

Dart 3.2(2023년 11월)부터 일부 필드가 승격됩니다. 언어 버전이 3.2 이상일 때 private 이면서 final 인 필드는 승격할 수 있습니다. private 이면 다른 라이브러리가 getter 로 덮어쓸 수 없고 final 이면 검사 뒤에 값이 바뀌지 않기 때문입니다. 단, 같은 라이브러리 안에 같은 이름의 getter 나 승격할 수 없는 필드가 있거나, 필드가 external 이거나, noSuchMethod 전달자가 생기는 경우에는 private final 이어도 승격되지 않습니다.

```dart
class Profile {
  final String? _bio;
  final String? bio;
  Profile(this._bio, this.bio);

  int privateLength() {
    if (_bio != null) return _bio.length;   // 3.2 이상: 승격
    return 0;
  }

  int publicLength() {
    if (bio != null) return bio.length;     // 오류: public 필드
    return 0;
  }
}
```

public 필드나 final 이 아닌 필드는 여전히 승격되지 않습니다. 이런 필드는 지역 변수에 담아 쓰거나 `if (bio case final b?)` 처럼 패턴으로 값을 꺼내면 됩니다.

```dart
int publicLength() {
  final b = bio;
  return b == null ? 0 : b.length;
}
```

## 마이그레이션의 구조

null safety 는 패키지 단위의 언어 버전으로 켜졌습니다. `pubspec.yaml` 의 SDK 제약이 2.12 이상이면 그 패키지는 null safety 코드로 취급되고 그보다 낮으면 이전 문법으로 해석됩니다. 도입 초기에는 두 방식의 패키지가 한 앱에 섞여 있을 수 있었고 이때는 sound 보장이 전체에 걸리지 않았습니다. 의존하는 패키지가 먼저 이전되어야 그것을 쓰는 쪽이 이전될 수 있어서 순서는 의존 그래프의 아래쪽(다른 패키지에 의존하지 않는 쪽)부터였습니다.

Dart 3 에서는 이전 문법 지원이 사라졌으므로 지금 새로 만드는 코드는 이 과정을 거칠 일이 없습니다. 오래된 패키지를 쓰려면 null safety 로 이전된 버전이 있어야 합니다.

## 참고 자료

- [Sound null safety](https://dart.dev/null-safety)
- [Understanding null safety](https://dart.dev/null-safety/understanding-null-safety)
- [Fixing type promotion failures](https://dart.dev/tools/non-promotion-reasons)
- [Pattern types: Null-check](https://dart.dev/language/pattern-types#null-check)
- [Language versioning](https://dart.dev/language/versioning)
- [Dart language evolution (2.12 / 3.0 / 3.2)](https://dart.dev/resources/language/evolution)
- [Migrating to null safety (archived guide)](https://github.com/dart-community/migrate-to-null-safety)

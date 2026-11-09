---
title: "Android 개발자가 다시 보는 React Native, Flutter, Compose Multiplatform"
description: "React Native, Flutter, Compose Multiplatform 의 렌더링 구조와 코드 공유 방식, 도구, 네이티브 연동을 나란히 놓고 최신 버전과 Android/Kotlin 개발자 관점의 선택 기준을 적었습니다."
pubDatetime: 2026-11-08T23:27:00+09:00
category: mobile
tags:
  - React Native
  - Flutter
  - Compose Multiplatform
  - KMP
  - 크로스플랫폼
---

크로스플랫폼 비교 글은 대개 "그래서 뭐가 제일 좋냐"로 끝나는데, 세 프레임워크는 애초에 같은 문제를 푸는 방식이 꽤 다릅니다. React Native 는 진짜 네이티브 뷰를 JS 로 조종하고, Flutter 는 화면을 통째로 자기가 그리고, Compose Multiplatform 은 Kotlin 코드를 각 플랫폼에 맞는 방식으로 컴파일합니다. 저는 Android/Kotlin 쪽 사람이라 [Compose Multiplatform 으로 TeddReader 를 만들었고](/posts/teddreader-compose-multiplatform/), [Flutter 로는 Melos 모노레포 앱](/posts/flutter-search-favorites-melos-monorepo/)을 만들어 봤습니다. React Native 는 웹 프론트엔드 쪽 글([React, Vue, Svelte, Angular, SolidJS](/posts/react-vue-svelte/))에서 React 를 다뤘던 경험이 전부라, 이 글은 세 가지를 같은 선상에 놓고 다시 정리한 메모에 가깝습니다.

## 화면은 누가 그리는가

가장 큰 차이가 여기서 갈립니다.

![React Native 는 JS 와 Hermes 가 JSI 를 거쳐 Fabric 과 TurboModules 로 네이티브 뷰를 만들고, Flutter 는 Dart 프레임워크 위에서 Impeller 가 픽셀을 직접 그리며, Compose Multiplatform 은 공통 Kotlin 코드가 Android 에서는 Jetpack Compose 로, iOS 에서는 Skia 캔버스로 그려진다](@/assets/images/react-native-flutter-cmp-rendering.png)

![React Native, Flutter, Compose Multiplatform 을 화면 그리기, 언어, UI 모델, 로직 공유, UI 공유 항목으로 비교한 표](@/assets/images/react-native-flutter-cmp-matrix.png)

### React Native

화면에 보이는 버튼과 스크롤뷰는 iOS 에서는 UIKit, Android 에서는 `View` 입니다. JS 는 "무엇을 어떻게 배치할지"를 React 로 기술하고, 렌더러가 그 결과를 네이티브 뷰 트리로 만들어 줍니다.

이 연결 부분이 몇 년에 걸쳐 갈아엎어졌습니다. 예전에는 JS 와 네이티브가 비동기 브릿지로 JSON 비슷한 메시지를 주고받았는데, New Architecture 에서는 JSI 가 이 브릿지를 대신합니다. JS 가 C++ 객체의 참조를 직접 들고 메서드를 부르기 때문에 직렬화가 필요 없습니다. 렌더러는 Fabric, 네이티브 모듈 시스템은 TurboModules 이고, 타입이 붙은 JS 스펙에서 네이티브 인터페이스 코드를 만들어 주는 Codegen 이 그 사이를 잇습니다. 레이아웃을 동기적으로 읽을 수 있게 되어 `useLayoutEffect` 안에서 측정하고 바로 상태에 반영하는 코드가 한 프레임 안에 끝나고, Suspense 나 Transition 같은 React 의 동시성 기능도 쓸 수 있습니다.

다만 공식 문서도 못 박아 둔 대목이 있습니다. New Architecture 를 켠다고 앱이 자동으로 빨라지지는 않고, 직렬화가 병목이 아니었다면 JSI 가 큰 차이를 만들지 않는다는 겁니다.

2025년 중반부터는 정리 작업이 이어졌습니다. 0.80 에서 Legacy Architecture 가 동결됐고, 0.82 는 처음부터 끝까지 New Architecture 만으로 도는 첫 릴리스였으며, 0.84 에서 Legacy 코드가 빌드에서 빠졌습니다. JS 엔진은 Hermes 가 0.70 부터 기본이었는데, 0.82 에서 Hermes V1 이 opt-in 으로 들어왔고 0.84 부터 기본값입니다. V8 이 아니라 Hermes 를 계속 쓰고 있고, 공식 글은 컴파일러와 VM 이 크게 개선됐다고만 설명하며 수치는 내놓지 않았습니다.

### Flutter

Flutter 는 네이티브 위젯을 쓰지 않습니다. 플랫폼에서 빈 서피스만 받아 오고 그 위에 버튼, 텍스트, 스크롤을 전부 직접 그립니다. 그리는 일을 맡는 엔진이 Impeller 입니다. 셰이더를 엔진 빌드 시점에 미리 컴파일해 두어 실행 중에 셰이더를 컴파일하다 프레임이 끊기는 문제를 없애는 쪽으로 설계됐습니다. 현재 상태는 이렇습니다.

- iOS: Impeller 가 기본이자 유일한 엔진입니다. Skia 로 되돌릴 방법이 없습니다.
- Android: API 29 이상에서 기본입니다. 더 낮은 버전이나 Vulkan 이 없는 기기는 예전 OpenGL 렌더러로 내려갑니다.
- macOS, Windows, Linux: 3.47 부터 Impeller 가 기본입니다.
- 웹: 아직 Skia 계열입니다.

위젯 트리가 곧 화면이라 플랫폼 버전이나 제조사 UI 에 따라 모양이 달라질 일이 적습니다. 그 대신 네이티브 컨트롤이 아니니 접근성이나 텍스트 입력, 스크롤 감각 같은 걸 Flutter 가 직접 따라 만들어야 합니다.

웹은 3.47 기준으로 `flutter build web --release --wasm` 옵션으로 Wasm 빌드를 선택할 수 있고, 팀이 Wasm 을 기본값으로 만드는 방향으로 작업 중이라고 합니다. `dart:html` 은 쓸 수 없어서 `package:web` 으로 옮겨야 합니다.

### Compose Multiplatform

Android 에서는 말 그대로 Jetpack Compose 입니다. CMP 1.12.2 는 Jetpack Compose 1.12.1 을 기반으로 하니, Android 개발자에게 익숙한 코드와 런타임이 그대로 돕니다.

iOS 에서는 Skia 를 Kotlin 에서 쓸 수 있게 감싼 Skiko 위에 그립니다. Flutter 처럼 화면을 직접 그리는 쪽이라 UIKit 컨트롤이 보이는 구조가 아닙니다. 필요하면 UIKit 뷰를 Compose 안에 끼워 넣고, 반대로 SwiftUI 안에 Compose 화면을 넣을 수 있습니다. 1.13.0-beta01 에는 이 interop 의 safe area 처리 방식을 고르는 `UIKitInteropSafeAreaInsetsPolicy` 가 들어왔습니다.

플랫폼별 상태는 공식 문서에서 iOS 와 Desktop(JVM) 이 Stable, Kotlin/Wasm 기반 웹이 Beta 로 표시됩니다. 웹은 WasmGC 를 지원하는 브라우저가 필요합니다.

## 같은 화면, 세 가지 코드

카운터 하나를 세 방식으로 써 봤습니다. 어디까지 닮았고 어디부터 다른지 보기에 적당합니다.

```tsx
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <View style={{ padding: 24 }}>
      <Text>클릭 횟수: {count}</Text>
      <Pressable onPress={() => setCount(count + 1)}>
        <Text>증가</Text>
      </Pressable>
    </View>
  );
}
```

```dart
import 'package:flutter/material.dart';

class Counter extends StatefulWidget {
  const Counter({super.key});

  @override
  State<Counter> createState() => _CounterState();
}

class _CounterState extends State<Counter> {
  int count = 0;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Text('클릭 횟수: $count'),
          TextButton(
            onPressed: () => setState(() => count++),
            child: const Text('증가'),
          ),
        ],
      ),
    );
  }
}
```

```kotlin
@Composable
fun Counter() {
    var count by remember { mutableIntStateOf(0) }

    Column(Modifier.padding(24.dp)) {
        Text("클릭 횟수: $count")
        TextButton(onClick = { count++ }) {
            Text("증가")
        }
    }
}
```

상태가 바뀌면 화면이 다시 그려진다는 선언형 모델은 셋이 같습니다. 길이는 Compose 가 가장 짧고 Flutter 가 가장 깁니다. Flutter 는 `StatefulWidget` 과 `State` 로 클래스가 둘로 쪼개져서 그렇고, 실무에서는 Riverpod 같은 상태 관리를 얹어서 이 모양을 거의 안 쓰긴 합니다. React 쪽은 `style` 이 인라인 객체이고 `Pressable` 안에 `Text` 를 따로 넣어야 한다는 점이 낯설 수 있습니다.

## 언어와 코드 공유 방식

**React Native 는 JS/TS 와 React 를 쓰는 팀이 그대로 모바일로 넘어올 수 있다는 점이 제일 큰 무기입니다.** 웹과 비즈니스 로직, 타입, 때로는 상태 관리 코드까지 같이 쓸 수 있습니다. 네이티브 쪽은 Swift/Kotlin 으로 따로 짜야 하는 부분이 생깁니다.

Flutter 는 Dart 한 가지로 UI 와 로직을 모두 씁니다. 가장 완결된 단일 스택에 가깝고, Dart 3 부터는 [sealed 와 패턴 매칭](/posts/dart-sealed/) 같은 문법 덕에 도메인 모델링이 꽤 편해졌습니다. 최신 Dart 는 3.13 입니다. 대가는 Dart 코드가 서버나 웹 프론트엔드와 공유되는 경우가 드물다는 점입니다.

KMP 는 접근이 다릅니다. 공통 로직만 Kotlin 으로 공유하고 UI 는 Android 는 Compose, iOS 는 SwiftUI 로 각자 짜는 구성이 가능합니다. 여기서 Compose Multiplatform 을 얹으면 UI 까지 공유하는 쪽으로 한 걸음 더 가고, 화면 단위로 골라서 공유할 수도 있습니다. Google 은 KMP 를 Android 와 iOS 사이의 비즈니스 로직 공유 용도로 공식 지원한다고 밝히고 있고, 공유 범위는 핵심 로직부터 앱 전체까지 팀이 고르면 된다고 설명합니다.

Kotlin 에서 Swift 로 가는 길도 개선되고 있습니다. 지금까지는 Objective-C 헤더를 거쳐 Swift 에서 보였는데, Kotlin 2.4 에서 Swift export 가 Alpha 로 올라왔고 `suspend` 함수는 Swift `async` 로, `Flow` 는 `AsyncSequence` 로 노출됩니다. 아직 Alpha 이니 프로덕션에 바로 얹을 단계는 아닙니다. 같은 릴리스에서 Gradle 에 SwiftPM 의존성을 선언하는 Swift package import 도 들어왔습니다.

## 도구

React Native 는 사실상 Expo 가 기본 진입점입니다. 최신 Expo SDK 58 은 2026년 10월 15일에 나왔고 React Native 0.88 을 쓰는 버전입니다. 라우팅은 Expo Router 로 하고, 빌드와 배포, OTA 업데이트는 EAS 가 맡습니다. SDK 58 에서는 Expo Router 의 data loader 와 SSR, middleware, native tabs 가 stable 이 됐습니다. 디버깅은 React Native DevTools 를 씁니다.

Flutter 는 hot reload 가 대표 장점이고 DevTools 로 위젯 트리, 성능, 메모리를 한 곳에서 봅니다. `flutter` CLI 하나로 만들기, 실행, 빌드가 이어집니다.

Kotlin 쪽은 도구 사정이 조금 복잡합니다. IntelliJ IDEA 와 Android Studio 에서 JetBrains KMP 플러그인을 쓰면 프로젝트 마법사와 iOS/Android 실행·디버그 설정, 기본적인 Swift 지원이 붙습니다. 개발 속도는 Compose Hot Reload 가 쥐고 있는데, 아직은 **Desktop JVM 타깃 전용**입니다. CMP 1.10.0 부터 데스크톱 타깃이 있는 프로젝트에는 기본으로 들어가고, 1.12.0 에는 AI 에이전트가 실행 중인 앱을 조작하게 해 주는 MCP 서버가 실험 기능으로 추가됐습니다. Android 와 iOS 에서는 여전히 빌드 후 재실행이 기본입니다. Android Studio 의 Live Edit 은 `androidMain` 밖의 코드에도 되고, Compose Preview 는 `commonMain` 소스셋에서 동작합니다.

## 네이티브 연동

React Native 에서는 TurboModules 로 JS 와 Swift/Kotlin 을 잇습니다. Expo 쪽은 Expo Modules API 가 기본이고, SDK 58 에는 일반 Swift/Kotlin 클래스에 애노테이션을 붙여 모듈을 쓰는 Expo Modules 2.0 이 beta 로 들어왔습니다. 네이티브 뷰 자체가 화면에 있으니 지도, 카메라 같은 건 그 뷰를 그대로 쓸 수 있습니다.

Flutter 는 platform channel 이나 FFI 로 네이티브 코드를 부르고, 네이티브 뷰를 화면에 넣어야 하면 platform view 를 씁니다. 자체 렌더러 위에 네이티브 뷰를 끼워 넣는 구조라 비용이 따릅니다.

CMP 에서는 `expect`/`actual` 로 플랫폼 코드를 부르는 방식이 기본입니다. Android 쪽은 Kotlin 이라 별도 변환이 필요 없고, iOS 쪽은 Kotlin/Native 가 C 와 Objective-C 와 연결되며 Swift 와의 연결이 위에서 말한 Swift export 로 개선 중입니다.

## 성능에 대해

성능은 앱과 기기에 따라 너무 달라서 숫자 하나로 줄 세우기 어렵습니다. 구조에서 보이는 경향만 짚어 보겠습니다.

React Native 는 네이티브 뷰를 쓰니 플랫폼 컨트롤의 동작이 그대로 나옵니다. 병목은 대체로 JS 스레드에서 무거운 일을 하거나 리렌더를 과하게 일으킬 때 생깁니다. 0.84 부터 기본이 된 Hermes V1 은 공식 글이 실행 속도와 메모리 사용량 개선을 말하니, 업그레이드 뒤 자기 앱으로 직접 재 보는 게 제일 확실합니다.

Flutter 는 Impeller 가 셰이더를 미리 컴파일해서 첫 실행에 프레임이 끊기는 문제를 줄이려는 설계이고, 기기마다 같은 렌더링 경로를 타니 성능이 예측 가능한 편입니다. 반대로 앱 크기에는 엔진이 포함됩니다.

CMP 는 Android 에서 사실상 Jetpack Compose 이므로 성능 특성도 같습니다. iOS 는 Skia 로 직접 그리는 쪽이라 Flutter 와 비슷한 부류의 비용을 갖는데, 1.12 에서 lazy layout 스크롤을 더 매끄럽게 하는 개선이 들어간 것처럼 아직 다듬어지는 중입니다.

## 생태계와 운영 주체

|              | 운영 주체                                                                                  | 비고                                             |
| ------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| React Native | Meta 가 만들었고, 2026년 6월 0.86 때 저장소가 `facebook` 에서 `react` GitHub 조직으로 이동 | React Foundation 으로 이관되는 흐름              |
| Flutter      | Google                                                                                     | 릴리스 일정을 공개하며 약 3개월 간격으로 낸다    |
| Kotlin / CMP | JetBrains(Kotlin, CMP), Google(KMP 공식 지원, Jetpack 라이브러리)                          | Room, DataStore, Paging, ViewModel 등이 KMP 지원 |

React Native 의 변화는 눈에 띕니다. 0.86 글에 따르면 React, React Native, Metro, Yoga, 웹사이트가 모두 `react` 조직으로 옮겨졌고, 이는 React 와 React Native 가 독립 재단인 React Foundation 으로 넘어가는 흐름의 일부입니다. 거버넌스의 세부 구조까지는 글에 나오지 않습니다.

Flutter 는 Material 과 Cupertino 위젯을 SDK 코어에서 분리하는 작업을 진행 중입니다. 3.47 에서 `material_ui` 와 `cupertino_ui` 패키지가 1.0 이 되었고, 코어 라이브러리의 공식 deprecation 은 11월 가을 stable 릴리스에 예정되어 있다고 합니다.

Jetpack 라이브러리의 KMP 지원은 Google 이 직접 챙기는 영역입니다. annotation, collection, datastore, lifecycle, paging, room, savedstate, sqlite 는 Android 팀이 만들고, Compose runtime, navigation, navigation3 같은 건 JetBrains 가 Android 아티팩트를 감싸서 다른 플랫폼으로 확장합니다. Tier 1 로 CI 에서 완전히 테스트되는 건 Android, JVM, iOS 이고 웹은 Tier 3 입니다.

## 지금 상황

최신 버전을 정리하면 이렇습니다.

|                       | 최신                             | 비고                                                                     |
| --------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| React Native          | 0.88 (2026-10-19)                | 웹 방식 이벤트 디스패치가 기본, iOS `SceneDelegate` 지원, 실험적 SwiftPM |
| Expo                  | SDK 58 (2026-10-15)              | RN 0.88 기반, iOS 27 대응                                                |
| Flutter               | 3.47 (2026-08-12), 패치는 3.47.9 | Dart 3.13, 11월에 3.50 목표                                              |
| Kotlin                | 2.4.21 (2026-10-08)              | 2.4.0 은 2026-07-14                                                      |
| Compose Multiplatform | 1.12.2 (2026-10-15)              | 1.13.0-beta02 진행 중                                                    |

2025년부터 지금까지 눈에 띈 변화를 프레임워크별로 적어 봅니다.

**React Native** 는 2025년 6월 0.80 에서 Legacy Architecture 를 동결한 이후 0.82 에서 New Architecture 만으로 도는 첫 릴리스를 냈고, 0.84(2026년 2월)에서 Hermes V1 을 기본으로 하고 iOS 사전 컴파일 바이너리를 기본값으로 켰으며 Legacy 코드를 빌드에서 뺐습니다. 0.85 는 새 Animation Backend 를 넣었고, 0.87 은 Strict TypeScript API 를 기본으로 바꾸고 AGP 9 를 지원하면서 Node.js 22, Kotlin 2.0 이상을 최소 요건으로 올렸습니다. 2026년 2월에는 Meta Quest 공식 지원도 발표됐습니다.

**Expo** 는 SDK 56(2026년 5월 21일), 57(6월 30일), 58(10월 15일) 로 이어졌습니다. 58 은 iOS 27 대응을 위해 UIKit scene 기반 라이프사이클을 쓰고, Expo UI 의 목록이 행을 가상화하며 재활용하도록 바뀌었고, 새 Expo Go 는 SDK 58 만 지원합니다. 마이그레이션할 때 `expo-file-system` 의 `File.write()` 가 비동기로 바뀐 것과 `expo-sqlite` 에서 libSQL 지원이 빠진 것은 체크해야 합니다.

**Flutter** 는 3.38(2025년 11월 12일, Dart 3.10), 3.41(2026년 2월 11일, Dart 3.11), 3.44(2026년 5월 18일, Dart 3.12), 3.47(2026년 8월 12일, Dart 3.13)로 약 3개월마다 나왔습니다. 3.47 의 큰 변화는 데스크톱 Impeller 기본값 전환, Material/Cupertino 분리 패키지, iOS 최소 버전 13 에서 15 로 상향입니다. iOS 27 SDK 는 UIScene 라이프사이클을 요구해서, 커스텀 `AppDelegate` 코드나 오래된 플러그인이 있으면 수동 마이그레이션이 필요합니다. Android 쪽은 템플릿이 AGP 9 와 내장 Kotlin 기준으로 옮겨 갔습니다.

**Kotlin** 2.4.0 은 context parameters, explicit backing fields 를 Stable 로 올렸고, K1 컴파일러 지원을 끝냈습니다. Kotlin/Native 는 concurrent mark-and-sweep GC 가 기본이 됐고 기본 최소 Apple 버전이 iOS 15 로 올랐습니다. **CMP** 는 1.8.0 부터 Compose 프레임워크가 K2 컴파일러로 바뀌었고, iOS 용에는 최소 Kotlin 2.2.20 이 필요합니다. 1.12 는 웹 글꼴 자동 폴백과 Skia M150 업데이트를 담았고, 1.13 알파에서는 Android 최소 SDK 가 24 로 올라갔습니다.

## 선택 기준

저는 Android/Kotlin 개발자라서 아무래도 기울어 있습니다. 그걸 감안하고 읽어 주세요.

**이미 Android 앱이 있거나 팀이 Kotlin 에 익숙하다면 KMP 를 먼저 봅니다.** 로직만 공유하고 UI 는 각자 네이티브로 두는 구성부터 시작해서, 화면이 단순한 곳부터 Compose Multiplatform 으로 넓혀 가는 길이 위험이 가장 작습니다. Android 쪽 코드를 한 줄도 버리지 않아도 되고, 공유 범위를 언제든 되돌릴 수 있습니다. iOS 가 Stable 이라고는 해도 Hot Reload 를 쓸 수 없고 Swift export 가 아직 Alpha 라서, iOS 개발 경험은 Flutter 나 React Native 만큼 매끈하지 않습니다. iOS 개발자가 팀에 없다면 이 불편이 더 크게 느껴질 겁니다.

**팀의 주력이 웹 프론트엔드라면 React Native 가 가장 현실적입니다.** React 지식이 그대로 쓰이고, 네이티브 컨트롤을 쓰니 플랫폼다운 느낌을 얻기 쉽고, Expo 가 빌드와 배포 부담을 크게 덜어 줍니다. New Architecture 가 이미 기본이고 Legacy 가 정리된 지금은 몇 년 전의 "브릿지가 느리다"는 인상으로 평가하면 안 됩니다. 다만 네이티브 모듈이 필요한 순간 Swift/Kotlin 을 읽을 수 있는 사람이 필요하고, 의존하는 서드파티 라이브러리가 새 아키텍처를 지원하는지 따져 봐야 합니다.

**처음부터 모바일, 웹, 데스크톱을 한 코드베이스로 가고 싶고 브랜드 디자인을 모든 플랫폼에서 똑같이 보여 주려면 Flutter 가 가장 잘 맞습니다.** 렌더러가 하나라 화면이 기기마다 어긋날 일이 적고, 도구 경험도 가장 완결돼 있습니다. 플랫폼 네이티브다운 컨트롤이 중요한 앱이거나 기존 Android/iOS 코드가 많다면 Dart 로 새로 쓰는 비용을 따져 봐야 합니다.

세 프레임워크 모두 이제 "쓸 만한가"를 의심할 단계는 지났다고 생각합니다. 어느 것을 골라도 팀이 가장 오래 유지보수할 수 있는 언어가 무엇인지, 네이티브 코드에 얼마나 자주 손을 대야 하는지가 결과를 더 크게 좌우합니다. 새 프로젝트라면 작은 화면 두세 개를 직접 만들어 보고, 팀이 막힌 지점이 어디인지 보고 정하는 쪽을 권합니다.

## 참고 자료

- [React Native Blog](https://reactnative.dev/blog)
- [React Native 0.84: Hermes V1 and Legacy Architecture Removal](https://reactnative.dev/blog/2026/02/11/react-native-0.84)
- [React Native 0.86: A New Home for React Native](https://reactnative.dev/blog/2026/06/11/react-native-0.86)
- [React Native New Architecture](https://reactnative.dev/architecture/landing-page)
- [Expo Changelog](https://expo.dev/changelog)
- [Expo SDK 58](https://expo.dev/changelog/sdk-58)
- [What's new in Flutter 3.47](https://flutter.dev/blog/whats-new-in-flutter-3-47)
- [Flutter release notes](https://docs.flutter.dev/release/release-notes)
- [Flutter 3.47.0 release notes](https://docs.flutter.dev/release/release-notes/release-notes-3.47.0)
- [Impeller rendering engine](https://docs.flutter.dev/perf/impeller)
- [Flutter 릴리스 메타데이터 (releases_linux.json)](https://storage.googleapis.com/flutter_infra_release/releases/releases_linux.json)
- [What's new in Kotlin 2.4.0](https://kotlinlang.org/docs/whatsnew24.html)
- [Kotlin Releases (GitHub)](https://github.com/JetBrains/kotlin/releases)
- [Compose Multiplatform Releases (GitHub)](https://github.com/JetBrains/compose-multiplatform/releases)
- [Compose Multiplatform compatibility and versioning](https://kotlinlang.org/docs/multiplatform/compose-compatibility-and-versioning.html)
- [Supported platforms (Kotlin Multiplatform)](https://kotlinlang.org/docs/multiplatform/supported-platforms.html)
- [What's new in Compose Multiplatform 1.12](https://kotlinlang.org/docs/multiplatform/whats-new-compose-112.html)
- [Compose Hot Reload](https://kotlinlang.org/docs/multiplatform/compose-hot-reload.html)
- [Kotlin Multiplatform — Android Developers](https://developer.android.com/kotlin/multiplatform)

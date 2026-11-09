---
title: "프로세스 메모리 구조: 코드·데이터·힙·스택, 그리고 JVM 에서 객체가 놓이는 자리"
description: "프로세스 주소 공간의 코드, 데이터, BSS, 힙, 스택 영역과 스택 프레임이 쌓이고 사라지는 과정, 힙 단편화, StackOverflowError, JVM 과 ART 에서 객체와 참조의 배치, Android 의 메모리 누수 사례를 정리합니다."
pubDatetime: 2024-01-23T21:40:00+09:00
category: cs
tags:
  - 운영체제
  - 메모리
  - JVM
  - Android
---

`val list = ArrayList<Int>()` 한 줄에서 `list` 변수와 `ArrayList` 객체는 서로 다른 메모리 영역에 있습니다. 변수는 호출 스택에, 객체는 힙에 놓입니다. 이 차이는 `StackOverflowError` 와 `OutOfMemoryError` 가 갈리는 이유와 맞닿아 있습니다. Android 에서 Activity 가 해제되지 않는 누수가 생기는 이유도 같은 곳에서 나옵니다. 스레드와 프로세스의 구분은 [프로세스와 스레드 글](/posts/process-and-thread/)에서 다룬 내용을 이어받습니다.

## 주소 공간의 다섯 구획

프로세스가 실행되면 운영체제는 그 프로세스가 쓸 수 있는 가상 주소 공간을 마련하고 용도별로 영역을 나눕니다. 아래 그림은 Linux 같은 시스템에서 흔히 쓰는 배치입니다. 높은 주소에 스택이 있고 낮은 주소에 코드가 있습니다.

![프로세스 메모리 구조: 높은 주소부터 Stack(아래로 성장), 빈 구간(mmap 영역), Heap(위로 성장), BSS, Data, Code 순으로 쌓여 있고 각 영역에 저장되는 내용이 오른쪽에 적혀 있다](@/assets/images/memory-layout.png)

코드(text) 영역에는 컴파일된 기계어 명령이 들어갑니다. 읽기와 실행만 허용되어서 이 영역에 쓰기를 시도하면 운영체제가 프로세스를 종료시킵니다. 문자열 리터럴 같은 읽기 전용 상수도 보통 이 근처의 읽기 전용 영역에 놓입니다. 데이터 영역에는 초기값을 준 전역 변수와 정적 변수가 들어갑니다. BSS 영역에는 초기값이 없거나 0 으로 초기화한 전역·정적 변수가 들어갑니다. BSS 는 실행 파일에 크기만 기록되고 프로그램이 로드될 때 0 으로 채워지기 때문에 파일 크기에는 영향을 주지 않습니다.

```c
int initialized = 42;           // 데이터 영역
static int counter;             // BSS 영역
const char *msg = "hello";      // msg 는 데이터 영역, "hello" 는 읽기 전용 영역

void f(void) {
    int local = 1;              // 스택
    int *p = malloc(16);        // p 는 스택, 16 바이트 블록은 힙
}
```

이 세 영역은 프로그램이 로드되는 시점에 크기가 정해집니다. 실행 중에 크기가 변하는 쪽은 힙과 스택입니다. 힙은 낮은 주소에서 높은 주소 쪽으로, 스택은 높은 주소에서 낮은 주소 쪽으로 자라며 둘 사이에는 빈 구간이 있습니다. 공유 라이브러리와 파일 매핑(`mmap`)은 이 빈 구간에 놓이는 것이 일반적입니다. 힙을 키우는 시스템 호출은 `brk` 입니다. 큰 할당은 `mmap` 으로 별도 영역을 받는 할당기도 있습니다. 구체적인 방식은 할당기 구현에 달려 있습니다.

## 스택과 스택 프레임

함수가 호출될 때마다 스택에는 스택 프레임이 하나 쌓입니다. 프레임에는 호출이 끝난 뒤 돌아갈 복귀 주소, 매개변수(일부는 레지스터로 전달됩니다), 지역 변수, 호출자의 레지스터 값 같은 것이 담깁니다. 함수가 반환되면 그 프레임이 제거되고 실행은 복귀 주소로 돌아갑니다. 프레임의 할당과 해제는 스택 포인터를 옮기는 것만으로 끝나서 매우 빠릅니다. 반환과 동시에 지역 변수의 수명이 끝납니다.

![스택 프레임 애니메이션: main 이 fact(3) 을 호출하면 fact(3), fact(2), fact(1) 프레임이 차례로 쌓이고 fact(1) 이 1 을 반환하며 프레임이 하나씩 제거되어 fact(2) 는 2, fact(3) 은 6 을 반환하고 main 의 r 이 6 이 된다](@/assets/images/memory-stack-frames.gif)

위 애니메이션은 팩토리얼을 재귀로 계산할 때의 스택입니다. `fact(3)` 은 `fact(2)` 의 결과를 기다리느라 반환하지 못하고 프레임을 유지합니다. 가장 안쪽의 `fact(1)` 이 먼저 반환되고 안쪽부터 바깥쪽으로 프레임이 제거됩니다. 마지막에 들어온 것이 가장 먼저 나가는 후입선출이라 자료구조 스택과 같은 이름을 씁니다.

스택은 크기가 정해져 있습니다. 종료 조건 없이 재귀하거나 호출이 지나치게 깊어지면 프레임이 한도를 넘고 이를 스택 오버플로라고 부릅니다. C 에서는 스택 끝의 보호 페이지에 접근해 세그멘테이션 폴트로 프로세스가 죽습니다. JVM 에서는 `StackOverflowError` 가 던져집니다.

```kotlin
fun depth(n: Int): Int = depth(n + 1)
```

`tailrec` 을 붙이지 않은 이 함수는 호출을 반복하다 `StackOverflowError` 로 끝납니다. 스레드 스택의 기본 크기는 플랫폼마다 다릅니다. HotSpot 의 기본값은 Linux/x64 에서 1MB, Linux/AArch64 에서 2MB 이며 `-Xss` 옵션으로 조절합니다. 스택 프레임의 지역 변수는 함수가 끝나면 사라집니다. C 에서 지역 변수의 주소를 반환하면 그 포인터는 이미 해제된 영역을 가리킵니다.

## 힙: 할당, 해제, 단편화

힙은 실행 중에 크기를 정해 할당하고 직접 해제하는 영역입니다. C 에서는 `malloc` 과 `free`, Java·Kotlin 에서는 `new`(생성자 호출)와 가비지 컬렉터가 이 역할을 나눠 맡습니다. 스택과 달리 해제 순서가 할당의 역순이라는 보장이 없습니다. 그래서 할당기는 빈 블록의 목록을 관리합니다. 요청이 오면 크기가 맞는 블록을 골라 주고 해제된 블록이 서로 이웃하면 하나로 합칩니다.

해제 순서가 뒤섞이면 빈 공간이 여러 조각으로 갈라집니다. 이를 외부 단편화라고 합니다.

![힙 단편화 도식: 16 칸 힙에 A, B, C, D, E 를 할당한 뒤 B 와 D 를 해제하면 빈 공간이 2, 2, 3 칸으로 나뉘어 합계 7 칸이지만 4 칸 요청은 연속된 공간이 없어 실패한다](@/assets/images/memory-heap-fragmentation.png)

그림에서 빈 공간의 합계는 7 칸이지만 가장 큰 연속 구간이 3 칸이어서 4 칸 요청은 실패합니다. 내부 단편화도 있습니다. 할당기가 정렬 규칙이나 최소 블록 크기 때문에 요청보다 큰 블록을 내주면 블록 안쪽 일부가 쓰이지 못한 채 남습니다.

`malloc` 이 반환한 블록은 한번 주면 다른 곳으로 옮길 수 없습니다. 프로그램이 그 주소를 포인터로 들고 있기 때문입니다. 그래서 C 의 힙 단편화는 할당기의 병합과 크기별 분류로 줄이는 데 그칩니다. 가비지 컬렉터를 쓰는 런타임은 사정이 다릅니다. 참조를 통해서만 객체에 접근하므로, 살아 있는 객체를 한쪽으로 복사해 모으는 방식(복사·압축 수집)으로 빈 공간을 이어 붙일 수 있습니다.

## JVM 과 ART 가 메모리를 배치하는 방식

JVM 은 스레드마다 별도의 스택을 갖고 힙은 모든 스레드가 하나를 공유합니다. 메서드가 호출될 때마다 해당 스레드 스택에 프레임이 만들어지고 프레임 안에 지역 변수와 매개변수가 놓입니다. `Int` 같은 기본형 지역 변수는 값이 그대로 프레임에 저장됩니다. 객체는 항상 힙에 생성되고 프레임에는 그 객체의 참조만 들어갑니다.

```kotlin
fun main() {
    val count = 3                    // 값 3 이 main 의 스택 프레임에 있다
    val list = ArrayList<Int>()      // list 참조는 스택, ArrayList 객체는 힙
    list.add(count)                  // 객체 안의 배열도 힙
}
```

HotSpot 의 JIT 컴파일러는 객체가 메서드 밖으로 빠져나가지 않는 것을 증명하면 객체를 만들지 않고 필드를 지역 변수처럼 다루기도 합니다(탈출 분석). 하지만 언어의 의미 규칙은 변하지 않아서 객체는 힙에 있다고 이해하면 됩니다.

가비지 컬렉터는 도달 가능성으로 회수 대상을 정합니다. GC 루트(스레드 스택의 지역 변수, 정적 필드 등)에서 출발해 참조를 따라가며 닿는 객체는 살려 두고 나머지 공간을 회수합니다. Android 의 런타임인 ART 는 Android 8.0 부터 동시 복사(concurrent copying) 수집기를 기본으로 사용합니다. 앱이 계속 실행되는 동안 객체를 옮기며 힙을 정리하는 방식이라 앞에서 본 외부 단편화가 줄어듭니다. Android 10 부터는 이 수집기가 세대별(generational) 모드로 동작합니다.

Android 는 앱마다 힙 크기에 상한을 둡니다. 기기별 한도는 `ActivityManager.getMemoryClass()` 로 조회할 수 있습니다. 한도를 넘어서 할당하려 하면 `OutOfMemoryError` 가 발생합니다. 매니페스트의 `android:largeHeap` 으로 더 큰 한도를 요청할 수 있지만 보장되는 것은 아닙니다.

## 메모리 누수

C 의 메모리 누수는 `free` 를 호출하지 않은 채 포인터를 잃어 어디서도 가리킬 수 없는 블록이 힙에 남는 상태입니다. GC 가 관리하는 힙은 참조가 끊긴 객체를 수집기가 회수해서 이런 누수가 생기지 않습니다. 대신 프로그램이 더 이상 쓰지 않는데도 GC 루트에서 계속 닿아서 회수되지 않는 객체가 쌓이는 형태의 누수가 생깁니다.

Android 에서 흔한 유형은 수명이 긴 객체가 Activity 를 붙잡는 경우입니다.

```kotlin
object ImageCache {
    val owners = mutableListOf<Activity>()
}

class DetailActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ImageCache.owners.add(this)   // onDestroy 이후에도 참조가 남는다
    }
}
```

`ImageCache` 는 프로세스가 끝날 때까지 사는 싱글톤이어서 `owners` 에 담긴 Activity 도 함께 삽니다. Activity 는 뷰 계층과 비트맵을 참조하므로 인스턴스 하나가 그 전체를 붙잡습니다. 화면 회전처럼 Activity 가 다시 생성될 때마다 이전 인스턴스가 하나씩 쌓입니다. 같은 구조는 해제하지 않은 리스너와 콜백, Activity 를 바깥 클래스로 암묵적으로 참조하는 익명 객체나 `Handler`, 정적 필드에 저장한 `Context` 에서도 나타납니다.

해결의 방향은 수명이 긴 객체가 수명이 짧은 객체를 참조하지 않게 하는 것입니다. 등록한 리스너는 `onDestroy` 처럼 짝이 되는 콜백에서 해제합니다. 오래 살아야 하는 객체에는 Activity 대신 `Application` Context 를 넘기고 부득이하게 참조해야 하면 `WeakReference` 를 씁니다. 누수가 의심되면 Android Studio 의 Memory Profiler 로 힙 덤프를 떠서 해제되었어야 할 Activity 인스턴스가 남아 있는지, 누가 붙잡고 있는지를 참조 경로로 확인합니다. Square 의 LeakCanary 는 이 과정을 자동화한 라이브러리입니다.

## 참고 자료

- OSTEP — The Abstraction: Address Spaces — https://pages.cs.wisc.edu/~remzi/OSTEP/vm-intro.pdf
- OSTEP — Free-Space Management — https://pages.cs.wisc.edu/~remzi/OSTEP/vm-freespace.pdf
- malloc(3) — https://man7.org/linux/man-pages/man3/malloc.3.html
- mallopt(3) — https://man7.org/linux/man-pages/man3/mallopt.3.html
- JVM Specification §2.5 Run-Time Data Areas — https://docs.oracle.com/javase/specs/jvms/se21/html/jvms-2.html#jvms-2.5
- The java Command (-Xss) — https://docs.oracle.com/en/java/javase/21/docs/specs/man/java.html
- Debug ART garbage collection — https://source.android.com/docs/core/runtime/gc-debug
- Android — Overview of memory management — https://developer.android.com/topic/performance/memory-overview
- LeakCanary — https://square.github.io/leakcanary/

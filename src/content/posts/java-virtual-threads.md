---
title: "Java 21 가상 스레드, 플랫폼 스레드와 carrier 의 관계 (JEP 444)"
description: "JDK 21 에서 정식 기능이 된 가상 스레드가 플랫폼 스레드와 어떻게 다른지, carrier 스레드에 mount/unmount 되는 과정과 pinning, 풀링 금지, ThreadLocal 주의점, 어울리는 작업의 범위를 정리하고 Kotlin 코루틴과 비교합니다."
pubDatetime: 2024-05-14T21:50:00+09:00
category: java
tags:
  - Java
  - 가상 스레드
  - 동시성
  - JDK 21
---

Java 의 `Thread` 는 오랫동안 OS 스레드를 얇게 감싼 객체였습니다. 스레드를 만들면 OS 스레드가 하나 만들어지고 스레드가 끝날 때까지 그 OS 스레드를 점유합니다. OS 스레드는 개수에 한계가 있고 생성 비용도 있어서 요청마다 스레드 하나를 배정하는 단순한 서버 코드는 동시 접속이 수천을 넘어가면 스레드 수가 먼저 병목이 됩니다. 이를 피하려고 스레드 풀과 비동기 콜백, 리액티브 스트림이 쓰였는데 코드 구조가 요청 하나를 순서대로 따라가는 모양에서 멀어진다는 대가가 있었습니다.

JEP 444 는 이 문제를 스레드 쪽에서 풀었습니다. JDK 19(JEP 425)와 JDK 20(JEP 436)에서 프리뷰를 거쳐 JDK 21(2023년 9월)에서 정식 기능이 되었습니다.

## 플랫폼 스레드와 가상 스레드

가상 스레드도 `java.lang.Thread` 의 인스턴스입니다. 두 스레드는 OS 스레드와의 관계가 다릅니다. 플랫폼 스레드는 코드가 실행되는 내내 OS 스레드 하나를 붙잡고 있고 가상 스레드는 JVM 이 스케줄링하며 실행 중일 때만 OS 스레드에 올라갑니다. 그래서 적은 수의 OS 스레드 위에 매우 많은 가상 스레드가 얹힙니다.

![플랫폼 스레드는 Java 스레드와 OS 스레드가 1 대 1 로 대응하고 가상 스레드는 여러 개가 소수의 carrier 스레드에 올라가 OS 스레드를 나눠 쓴다](@/assets/images/java-virtual-threads-mapping.png)

JEP 는 가상 스레드의 목적을 규모, 곧 동시에 처리할 수 있는 요청 수(처리량)로 설명합니다. 한 요청의 지연 시간 단축은 목적에 들어 있지 않습니다.

## carrier, mount, unmount

가상 스레드를 실제로 실행하는 플랫폼 스레드를 carrier 라고 부릅니다. 스케줄러가 가상 스레드를 carrier 에 올리는 것이 mount, 내리는 것이 unmount 입니다. 스케줄러는 `ForkJoinPool` 을 FIFO 모드의 work-stealing 방식으로 쓰며 기본 병렬도는 사용 가능한 프로세서 수와 같습니다. `jdk.virtualThreadScheduler.parallelism` 시스템 프로퍼티로 바꿀 수 있습니다. 이 풀은 공용 풀(common pool)과 별개입니다.

구조가 드러나는 지점은 가상 스레드가 블로킹 연산을 만났을 때입니다. 소켓 읽기나 `sleep` 처럼 기다려야 하는 호출에서 가상 스레드는 carrier 에서 unmount 되고 비어 있는 carrier 는 다른 가상 스레드를 mount 합니다. 대기가 끝나면 스케줄러가 해당 가상 스레드를 다시 실행 대기열에 넣고 이어서 어느 carrier 에든 mount 됩니다. 이전과 같은 carrier 라는 보장은 없습니다. JDK 21 에서는 파일 시스템 연산 상당수와 `Object.wait()` 처럼 unmount 되지 않고 carrier 를 붙잡는 블로킹도 있으며, 이때 JDK 는 스케줄러 병렬도를 일시적으로 늘려 보완합니다. JDK 21 스케줄러는 가상 스레드에 시간 분할(time sharing)을 적용하지 않습니다. 실행 중인 가상 스레드는 블로킹되거나 끝날 때까지 carrier 를 내주지 않습니다.

![가상 스레드 V1 이 carrier-1 에서 I/O 로 블로킹되어 unmount 되고 parked 영역으로 간다. V2 는 carrier-2 에서 실행되다 종료되며, I/O 가 끝난 V1 은 비어 있는 carrier-2 에 이전과 다른 carrier 로 mount 된다](@/assets/images/java-virtual-threads-mount.gif)

개발자 코드에서는 이 이동이 보이지 않습니다. 같은 가상 스레드에서 `Thread.currentThread()` 를 부르면 가상 스레드 자신이 반환되고 carrier 는 드러나지 않습니다. 블로킹 API 를 그대로 호출하는 동기 코드가 논블로킹처럼 동작하는 것은 이 unmount 덕분이며, 소켓 I/O 와 `sleep` 이 대표적입니다.

## 만드는 방법

가상 스레드를 만드는 API 는 몇 가지가 있습니다.

```java
Thread t1 = Thread.ofVirtual().name("worker-1").start(() -> System.out.println("hello"));
t1.join();

Thread t2 = Thread.startVirtualThread(() -> System.out.println("hello"));
t2.join();

System.out.println(t2.isVirtual());   // true
```

`Thread.ofVirtual()` 은 `Thread.Builder` 를 돌려주며 이름 지정이나 `unstarted()` 같은 설정을 할 수 있습니다. 작업이 많을 때는 태스크마다 새 가상 스레드를 만들어 주는 executor 가 일반적입니다.

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    IntStream.range(0, 10_000).forEach(i ->
        executor.submit(() -> {
            Thread.sleep(Duration.ofSeconds(1));
            return i;
        }));
}   // close() 가 제출된 작업의 종료를 기다림
```

1만 개의 작업이 각자 1초씩 sleep 하지만 가상 스레드는 sleep 동안 carrier 를 내려놓으므로 전체가 몇 초 안에 끝납니다. 같은 코드를 크기가 고정된 스레드 풀로 실행하면 풀의 크기만큼씩 끊어서 처리되어 훨씬 오래 걸립니다. `ExecutorService` 가 `AutoCloseable` 이어서 try-with-resources 로 감싸면 모든 작업이 끝난 뒤에 블록을 벗어납니다.

## 풀링하지 않습니다

플랫폼 스레드는 비싸서 풀에 담아 재사용했습니다. 가상 스레드는 생성이 싸고 개수도 사실상 제한이 없으므로 풀로 묶는 것이 맞지 않습니다. JEP 는 가상 스레드를 풀링해서는 안 된다고 명시합니다. 가상 스레드 하나는 하나의 태스크를 표현하도록 설계되었으며 풀의 공유 자원으로 쓰이지 않습니다.

동시에 실행할 수 있는 수를 제한하고 싶을 때(예: 외부 서비스 호출 수 제한)는 풀 크기에 기대지 않고 `Semaphore` 를 사용합니다.

```java
private static final Semaphore LIMIT = new Semaphore(10);

Result call() throws InterruptedException {
    LIMIT.acquire();
    try {
        return callLimitedService();
    } finally {
        LIMIT.release();
    }
}
```

## pinning

가상 스레드가 블로킹 중에도 unmount 되지 못하고 carrier 를 붙들고 있는 상태를 pinning 이라고 합니다. JDK 21 에서 pinned 가 되는 경우는 두 가지입니다.

| 상황                               | 설명                                       |
| ---------------------------------- | ------------------------------------------ |
| `synchronized` 블록·메서드 안      | 모니터를 잡은 채로 블로킹하면 unmount 불가 |
| native 메서드·foreign 함수 실행 중 | 네이티브 스택 프레임이 걸려 있음           |

pinning 이 일어나도 프로그램이 틀리게 동작하지는 않습니다. 다만 pinned 된 채 오래 블로킹하는 가상 스레드가 많으면 carrier 가 묶여 확장성이 떨어집니다. 짧은 `synchronized` 구간은 문제가 되지 않고 구간 안에서 I/O 같은 긴 블로킹을 하는 코드가 문제입니다. 그런 곳은 `ReentrantLock` 으로 바꾸는 것이 문서의 권고입니다.

```java
lock.lock();
try {
    frequentIO();
} finally {
    lock.unlock();
}
```

pinning 은 진단 도구로 확인합니다. `-Djdk.tracePinnedThreads=full` 은 pinned 된 상태로 블로킹할 때 스택 트레이스를 출력하고 `short` 는 문제가 되는 프레임만 보여 줍니다. JFR 이벤트 `jdk.VirtualThreadPinned` 도 있으며 기본 임계값은 20ms 입니다.

## ThreadLocal

가상 스레드도 `ThreadLocal` 을 지원합니다. 그러나 가상 스레드는 수가 많고 작업마다 새로 만들어지므로, 비싼 객체를 `ThreadLocal` 에 담아 재사용하던 패턴이 오히려 비용을 키웁니다. 대표적인 예가 `SimpleDateFormat` 을 스레드별로 캐시하던 코드입니다. 풀이 없으니 재사용되지 않고 태스크마다 새 인스턴스가 생깁니다. 이런 경우에는 불변이고 공유 가능한 `DateTimeFormatter` 로 바꾸면 해결됩니다. 태스크 범위의 컨텍스트 전달에는 scoped value 가 대안으로 제시되어 있지만 JDK 21 에서는 프리뷰 기능입니다.

## 어울리는 작업

가상 스레드는 I/O 처럼 기다리는 시간이 긴 작업이 동시에 많이 걸리는 상황에 이득이 있습니다. 대기하는 동안 carrier 가 놀지 않기 때문입니다. CPU 를 계속 쓰는 계산 작업은 carrier 를 놓는 순간이 없어서 가상 스레드의 장점이 나타나지 않습니다. 그런 작업은 프로세서 수에 맞춘 플랫폼 스레드 풀이 더 적합합니다. 동시 작업의 수가 수천을 넘고 각각이 대부분의 시간을 블로킹으로 보내는지가 판단 기준입니다.

## Kotlin 코루틴과의 비교

둘 다 적은 수의 OS 스레드에서 많은 동시 작업을 돌리는 것이 목표이지만 구현 층이 다릅니다.

|                | 가상 스레드                               | Kotlin 코루틴                                         |
| -------------- | ----------------------------------------- | ----------------------------------------------------- |
| 구현 층        | JVM 런타임(`Thread` 자체)                 | 컴파일러와 라이브러리                                 |
| 일시 중단 지점 | 대부분의 블로킹 호출에서 런타임이 unmount | `suspend` 함수 호출 지점, 컴파일러가 상태 기계로 변환 |
| 기존 코드      | 블로킹 코드를 그대로 사용                 | `suspend` 로 바꿔야 함                                |
| 구조적 동시성  | 별도 API 필요(이 시점에는 프리뷰)         | `CoroutineScope`, `Job` 계층                          |
| 실행 플랫폼    | JDK 21 이상                               | JVM, Android, Native, JS 등                           |

코루틴은 함수의 색(`suspend`)이 호출 체인을 따라 퍼지는 대신 취소와 범위 관리가 언어 라이브러리에 포함되어 있습니다. 가상 스레드는 기존 동기 코드를 거의 그대로 둔 채 확장성을 얻는 대신 취소 전파와 같은 구조는 별도로 챙겨야 합니다. Android 의 런타임(ART)은 이 글을 쓰는 시점에 가상 스레드를 지원하지 않습니다.

## 참고 자료

- [JEP 444: Virtual Threads](https://openjdk.org/jeps/444)
- [JEP 425: Virtual Threads (Preview)](https://openjdk.org/jeps/425)
- [JEP 436: Virtual Threads (Second Preview)](https://openjdk.org/jeps/436)
- [JEP 446: Scoped Values (Preview)](https://openjdk.org/jeps/446)
- [JEP 453: Structured Concurrency (Preview)](https://openjdk.org/jeps/453)
- [JDK 21](https://openjdk.org/projects/jdk/21/)
- [Oracle Java 21 Core Libraries: Virtual Threads](https://docs.oracle.com/en/java/javase/21/core/virtual-threads.html)
- [Java 21 API: java.lang.Thread](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Thread.html)
- [Kotlin: Coroutines overview](https://kotlinlang.org/docs/coroutines-overview.html)
- [Kotlin: Coroutines basics (structured concurrency)](https://kotlinlang.org/docs/coroutines-basics.html#structured-concurrency)

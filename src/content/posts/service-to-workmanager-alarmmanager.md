---
title: "Service 에서 WorkManager 와 AlarmManager 로: Android 백그라운드 작업이 바뀐 과정"
description: "IntentService 와 AsyncTask 를 쓰던 시절부터 Doze, 백그라운드 실행 제한, 포그라운드 서비스 제약, 정확 알람 권한까지 버전별 제한을 정리하고, 공식 가이드의 작업 유형에 따라 WorkManager, AlarmManager, 포그라운드 서비스, 코루틴을 고르는 기준을 코드와 표로 정리했습니다."
pubDatetime: 2026-08-25T21:30:00+09:00
category: android
tags:
  - Android
  - WorkManager
  - AlarmManager
  - Service
  - Background
---

Android 에서 화면 밖에서 해야 하는 일은 오랫동안 `Service` 로 처리했습니다. 지금 공식 가이드는 같은 일을 작업의 성격에 따라 코루틴, WorkManager, AlarmManager, 포그라운드 서비스로 나눠 맡깁니다. 이 글은 `Service` 중심이던 방식이 어떤 제한을 거치며 지금의 구도로 바뀌었는지 버전 순서로 따라간 뒤, 마지막 표에서 무엇을 언제 쓸지 고릅니다.

## 예전에는 Service, IntentService, AsyncTask 였습니다

`Service` 는 화면이 없는 컴포넌트이지만 별도 스레드가 아닙니다. 공식 문서는 서비스가 호스팅 프로세스의 메인 스레드에서 실행되고 자체 스레드를 만들지 않는다고 설명합니다([서비스 개요](https://developer.android.com/develop/background-work/services)). 오래 걸리는 작업은 서비스 안에서 따로 스레드를 만들어야 ANR 을 피할 수 있습니다.

`IntentService` 는 이 스레드 관리를 대신하던 클래스입니다. AOSP 소스의 클래스 설명에 따르면 `startService(Intent)` 로 요청을 받아 워커 스레드 하나에서 Intent 를 하나씩 처리하고, 일이 떨어지면 스스로 종료합니다([IntentService.java, android-11.0.0_r1](https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-11.0.0_r1/core/java/android/app/IntentService.java)). 화면에서 돌리는 짧은 비동기 작업에는 `AsyncTask` 를 썼습니다.

```kotlin
class UploadService : IntentService("UploadService") {
    override fun onHandleIntent(intent: Intent?) {
        val path = intent?.getStringExtra("path") ?: return
        upload(path) // 워커 스레드에서 순차 실행됩니다
    }
}

context.startService(Intent(context, UploadService::class.java).putExtra("path", path))
```

두 클래스 모두 Android 11(API 30) 소스에서 `@deprecated` 입니다. `AsyncTask` 는 표준 `java.util.concurrent` 나 Kotlin 동시성 도구를 쓰라는 안내가 붙어 있고([AsyncTask.java](https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-11.0.0_r1/core/java/android/os/AsyncTask.java)), `IntentService` 는 Android 8.0 의 백그라운드 실행 제한을 그대로 받습니다. `IntentService` 는 Android 8 이후 잘 동작하지 않아 새 앱에 권장하지 않습니다.

## 버전마다 제한이 하나씩 붙었습니다

백그라운드 작업이 `Service` 에서 멀어진 이유는 플랫폼이 버전마다 제한을 더했기 때문입니다. 아래 도표는 이 글에서 다루는 제한을 버전 순서로 놓은 것입니다.

![Android 6.0 의 Doze 부터 8.0 의 백그라운드 서비스 제한, 12 의 포그라운드 서비스 시작 제한과 정확 알람 권한, 13 의 USE_EXACT_ALARM, 14 의 포그라운드 서비스 타입 필수와 정확 알람 기본 거부, 15 의 dataSync 와 mediaProcessing 시간 제한을 순서대로 나열한 타임라인](@/assets/images/service-to-workmanager-alarmmanager-timeline.png)

### Android 6.0: Doze 와 App Standby

[Doze 와 App Standby 문서](https://developer.android.com/training/monitoring-device-state/doze-standby)에 따르면 두 기능은 Android 6.0 이상의 모든 앱에 적용됩니다. 기기를 충전하지 않고 화면을 끈 채 가만히 두면 Doze 에 들어가고, 이때 네트워크 접근을 막고 wake lock 을 무시하며 `setExact()` 를 포함한 표준 알람을 다음 유지 보수 창으로 미룹니다. `JobScheduler` 도 실행되지 않고, WorkManager 가 내부적으로 `JobScheduler` 를 쓰기 때문에 WorkManager 작업도 돌지 않습니다. 유지 보수 창이 열리면 밀린 동기화, 작업, 알람이 한꺼번에 실행됩니다.

Doze 중에도 울려야 하는 알람에는 `setAndAllowWhileIdle()` 과 `setExactAndAllowWhileIdle()` 이 있고, 앱당 9분에 한 번을 넘길 수 없습니다. `setAlarmClock()` 알람은 정상적으로 울립니다.

### Android 8.0: 백그라운드 실행 제한

[백그라운드 실행 제한](https://developer.android.com/about/versions/oreo/background)(API 26)은 서비스에 직접 영향을 줍니다. 앱이 백그라운드로 가면 몇 분 동안은 서비스를 만들고 쓸 수 있고, 그 시간이 지나 idle 이 되면 시스템이 `stopSelf()` 를 부른 것처럼 백그라운드 서비스를 중지합니다. 분 단위의 정확한 값은 문서에 없고 "several minutes" 라고만 나옵니다.

포그라운드로 시작하려면 `startForegroundService()` 를 부르고, 서비스가 만들어진 뒤 5초 안에 `startForeground()` 로 알림을 띄워야 합니다. 지키지 않으면 서비스가 중지되고 앱은 ANR 로 처리됩니다. 대안은 `JobScheduler` 작업이고, 많은 경우 백그라운드 서비스를 `JobScheduler` 로 바꿀 수 있습니다.

### Android 12: 포그라운드 서비스 시작 제한과 정확 알람 권한

targetSdk 31 이상 앱은 백그라운드에서 포그라운드 서비스를 시작할 수 없고, 예외가 아니면 `ForegroundServiceStartNotAllowedException` 이 발생합니다([백그라운드 시작 제한](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start)). 예외에는 사용자에게 보이는 상태에서의 전환, 알림·위젯·액티비티 같은 UI 상호작용, 높은 우선순위 FCM 메시지, 사용자 요청 동작을 마치는 정확 알람 등이 있습니다.

targetSdk 31 이상 앱이 정확 알람을 쓰려면 이때부터 "알람 및 리마인더" 계열 권한을 선언해야 합니다. 선언하지 않으면 `SecurityException` 이 납니다([알람 예약](https://developer.android.com/develop/background-work/services/alarms/schedule)).

### Android 13: USE_EXACT_ALARM

Android 13(API 33) 부터는 `SCHEDULE_EXACT_ALARM` 과 `USE_EXACT_ALARM` 중 하나를 선언합니다. 둘의 차이는 다음과 같습니다.

|             | `USE_EXACT_ALARM` | `SCHEDULE_EXACT_ALARM` |
| ----------- | ----------------- | ---------------------- |
| 부여 방식   | 자동              | 사용자가 허용          |
| 사용자 철회 | 불가              | 가능                   |
| 사용 사례   | 제한적            | 더 넓음                |

`USE_EXACT_ALARM` 은 Google Play 정책 대상이어서, 정책 요건을 충족하는 캘린더·알람 시계 같은 앱만 매니페스트에 넣을 수 있습니다([Android 14 변경 문서](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms)).

### Android 14: 포그라운드 서비스 타입 필수, 정확 알람 기본 거부

targetSdk 34 이상 앱은 포그라운드 서비스마다 타입을 하나 이상 지정해야 합니다([Android 14 동작 변경](https://developer.android.com/about/versions/14/behavior-changes-14)). 매니페스트에 `android:foregroundServiceType` 을 적고, `FOREGROUND_SERVICE` 에 더해 타입별 권한(`FOREGROUND_SERVICE_DATA_SYNC` 등)도 요청합니다([서비스 타입](https://developer.android.com/develop/background-work/services/fgs/service-types)). `shortService` 타입은 추가 권한이 없고 약 3분 안에 끝나야 합니다.

정확 알람 쪽 규칙은 [Schedule exact alarms are denied by default](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms) 문서에 있습니다. `SCHEDULE_EXACT_ALARM` 은 targetSdk 33 이상으로 새로 설치되는 대부분의 앱에 기본 거부 상태로 시작합니다. 대상은 이 권한을 선언했고, 면제나 사전 부여 대상이 아니며, 캘린더나 알람 시계 앱이 아닌 앱입니다. Android 14 로 업그레이드하는 기기에서 이미 권한을 가진 앱은 그대로 유지하고, 백업 복원으로 옮긴 경우에는 거부 상태입니다.

### Android 15: dataSync 와 mediaProcessing 시간 제한

targetSdk 35 이상 앱의 `dataSync` 와 `mediaProcessing` 포그라운드 서비스는 타입마다 24시간 동안 합계 6시간까지만 실행됩니다([타임아웃 문서](https://developer.android.com/develop/background-work/services/fgs/timeout)). 한도에 닿으면 시스템이 `Service.onTimeout(int, int)` 를 부르고, 서비스는 몇 초 안에 `stopSelf()` 를 호출해야 합니다. 그러지 않으면 `RemoteServiceException` 으로 앱이 종료됩니다. `mediaProcessing` 은 Android 15 에서 새로 생긴 타입이고, 사용자가 앱을 포그라운드로 가져오면 타이머가 초기화됩니다. [Android 15 동작 변경](https://developer.android.com/about/versions/15/behavior-changes-15)에는 `BOOT_COMPLETED` 수신기가 `dataSync`, `camera`, `mediaPlayback`, `phoneCall`, `mediaProjection`, `microphone` 타입의 포그라운드 서비스를 시작할 수 없다는 제한도 있습니다(`microphone` 은 Android 14 부터).

## 지금은 작업 유형으로 나눕니다

[백그라운드 작업 개요](https://developer.android.com/develop/background-work/background-tasks)는 작업을 비동기 작업, 작업 예약 API, 포그라운드 서비스 세 가지로 나눕니다. 정확한 시각의 알람은 이 분류에 들어 있지 않아서, 표의 마지막 행은 [알람 예약 문서](https://developer.android.com/develop/background-work/services/alarms/schedule)를 바탕으로 이 글에서 덧붙였습니다.

| 작업                                         | 도구                                       | 비고                                                          |
| -------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| 앱이 포그라운드에 있는 동안의 비동기 작업    | 코루틴, 스레드                             | 앱이 유효한 생명주기 단계를 벗어나면 끝난다는 보장이 없습니다 |
| 사용자가 앱을 떠나도 이어져야 하는 작업      | WorkManager, 경우에 따라 `JobScheduler`    | 급한 작업은 expedited 로 표시합니다                           |
| 바로 실행해야 하고 중단되면 안 되는 작업     | 포그라운드 서비스, WorkManager 장시간 워커 | 대안 API 를 먼저 확인합니다                                   |
| 정확한 시각의 알림 (개요 밖, 알람 문서 기준) | AlarmManager 정확 알람                     | 알람 시계, 캘린더처럼 정확한 시각이 핵심인 경우               |

![세 가지 질문에 차례로 답해 코루틴, AlarmManager, 포그라운드 서비스, WorkManager 중 하나를 고르는 흐름도](@/assets/images/service-to-workmanager-alarmmanager-flow.png)

### 코루틴

[Kotlin 코루틴 가이드](https://developer.android.com/topic/libraries/architecture/coroutines)에 따르면 `viewModelScope` 에서 시작한 코루틴은 `ViewModel` 이 clear 될 때 자동으로 취소됩니다. WorkManager 문서도 코루틴을 앱이 보이는 상태를 벗어나도 이어질 필요가 없는 모든 비동기 작업에 권하며, 앱이 닫히면 멈춥니다. 화면 안의 일은 서비스 없이 코루틴으로 충분합니다.

### WorkManager

[WorkManager 문서](https://developer.android.com/develop/background-work/background-tasks/persistent)는 앱이 보이는 상태를 벗어나도 이어지는 작업에 이 라이브러리를 권합니다. 예약된 작업은 내부 SQLite 데이터베이스에 저장되어 앱 재시작과 재부팅 뒤에도 다시 예약되고, 네트워크·충전·유휴 같은 제약 조건을 선언할 수 있습니다. 작업 유형은 세 가지입니다.

| 유형      | 주기             | 사용법                                                                  |
| --------- | ---------------- | ----------------------------------------------------------------------- |
| 즉시      | 일회성           | `OneTimeWorkRequest` 와 `Worker`. 빠르게 시작해야 하면 `setExpedited()` |
| 장시간    | 일회성 또는 주기 | `Worker` 안에서 `setForeground()` 로 알림 처리                          |
| 지연 가능 | 일회성 또는 주기 | `PeriodicWorkRequest` 와 `Worker`                                       |

`PeriodicWorkRequest` 의 최소 반복 간격은 `JobScheduler` 와 같은 15분입니다.

앞의 `IntentService` 를 `CoroutineWorker` 로 바꾸면 다음과 같습니다.

```kotlin
class UploadWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val path = inputData.getString(KEY_PATH) ?: return Result.failure()
        return try {
            upload(path)
            Result.success()
        } catch (e: IOException) {
            Result.retry() // 백오프 정책에 따라 다시 예약됩니다
        }
    }

    companion object { const val KEY_PATH = "path" }
}

val request = OneTimeWorkRequestBuilder<UploadWorker>()
    .setInputData(workDataOf(UploadWorker.KEY_PATH to path))
    .setConstraints(
        Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
    )
    .build()

WorkManager.getInstance(context)
    .enqueueUniqueWork("upload", ExistingWorkPolicy.KEEP, request)
```

`IntentService` 는 Intent 가 오는 대로 돌았지만 `CoroutineWorker` 는 제약 조건이 맞을 때 실행됩니다. 실패하면 `Result.retry()` 로 지수 백오프 재시도를 맡길 수 있고, `enqueueUniqueWork` 로 같은 이름의 작업이 중복되지 않게 할 수 있습니다. `upload()` 는 예시용 자리 표시입니다.

사용자가 시작한 짧은 작업은 expedited 로 바로 시작하게 할 수 있습니다. [Expedited work 문서](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work)에 따르면 WorkManager 2.7.0 이상에서 `setExpedited()` 를 쓰고, 실행 시간 쿼터가 모자랄 때의 동작을 `OutOfQuotaPolicy` 로 정합니다. `RUN_AS_NON_EXPEDITED_WORK_REQUEST` 는 일반 작업으로 돌리고, `DROP_WORK_REQUEST` 는 요청을 취소합니다. 쿼터는 앱이 백그라운드에 있을 때만 적용됩니다. `ListenableWorker` 는 expedited 를 요청하려면 `getForegroundInfo` 를 구현해야 하고, 빠뜨리면 낮은 플랫폼 버전에서 런타임 크래시가 날 수 있습니다.

```kotlin
val request = OneTimeWorkRequestBuilder<SyncWorker>()
    .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
    .build()
```

10분을 넘을 수 있는 작업은 [장시간 워커](https://developer.android.com/develop/background-work/background-tasks/persistent/how-to/long-running)로 만듭니다. WorkManager 가 대신 포그라운드 서비스를 띄우고 설정 가능한 알림을 보여 줍니다. `CoroutineWorker` 는 `setForeground()` 를, `Worker` 는 `setForegroundAsync()` 를 부릅니다. targetSdk 34 이상이면 모든 장시간 워커에 포그라운드 서비스 타입을 지정해야 합니다. Android 16 부터는 포그라운드 서비스와 함께 실행되는 작업도 작업 실행 쿼터를 따르므로, 장시간 워커가 앱의 작업 쿼터를 소진할 수 있습니다([Android 16 동작 변경](https://developer.android.com/about/versions/16/behavior-changes-all)). 사용자 동작에 따른 다운로드라면 쿼터에서 면제되는 사용자 시작 데이터 전송 작업을 고려합니다. `setForeground()` 는 Android 12 이상에서 백그라운드 시작이 제한되면 예외를 던질 수 있어서 `try/catch` 로 감싸야 합니다.

WorkManager 는 내부적으로 `JobScheduler` 를 사용하고(Doze 문서의 설명), 플랫폼 `JobScheduler` 를 직접 쓰는 것이 알맞은 경우도 있습니다. targetSdk 34 이상에서는 `JobScheduler` 콜백이 메인 스레드에서 허용 시간을 넘기면 ANR 이 나고, `setRequiredNetworkType` 같은 제약을 쓰려면 `ACCESS_NETWORK_STATE` 선언이 필요합니다. `onStartJob` 이나 `onStopJob` 안에서 오래 걸리는 처리를 직접 돌리고 있다면, 그 처리를 비동기 스레드로 감싸 주는 WorkManager 로 옮기라는 것이 Android 14 동작 변경 문서의 권고입니다.

### AlarmManager

[알람 예약 문서](https://developer.android.com/develop/background-work/services/alarms/schedule)는 알람을 정확도로 나눕니다. 부정확 알람(`set()`, `setInexactRepeating()`, `setAndAllowWhileIdle()`, `setWindow()`)은 Doze 같은 절전 정책을 따르며 시스템이 배달 시점을 늦출 수 있고, 대부분의 앱에는 이쪽을 권합니다. 정확 알람은 알람 시계나 캘린더처럼 정확한 시각이 핵심 기능일 때만 씁니다. 자원을 많이 쓰고 시스템이 묶어 처리하기도 어렵기 때문입니다.

정확 알람 API 는 `setExact()`, `setExactAndAllowWhileIdle()`, `setAlarmClock()` 순으로 시간에 더 민감하고 자원도 더 씁니다. `setAlarmClock()` 은 시스템이 배달 시간을 조정하지 않고 저전력 모드에서도 깨워서 알람을 울립니다. 정확 알람은 Doze 에서 기기를 깨우므로 전력 효율이 나빠서, WorkManager 문서는 캘린더 일정 같은 정확한 알림에만 쓰고 반복적인 백그라운드 작업에는 쓰지 말라고 권합니다.

`SCHEDULE_EXACT_ALARM` 을 쓰는 앱은 알람을 걸기 전에 `canScheduleExactAlarms()` 로 권한을 확인하고, 없으면 `ACTION_REQUEST_SCHEDULE_EXACT_ALARM` 으로 설정 화면에 보냅니다. 사용자가 권한을 철회하면 앱이 종료되고 이후 정확 알람이 모두 취소되므로, 권한이 다시 허용될 때 오는 `ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED` 에서 알람을 다시 예약합니다.

```kotlin
fun Activity.scheduleExact(triggerAtMillis: Long, operation: PendingIntent) {
    val alarmManager = getSystemService(AlarmManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
        startActivity(
            Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
                .setData(Uri.parse("package:$packageName"))
        )
        return
    }
    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, operation)
}
```

`canScheduleExactAlarms()` 는 API 31 에서 추가된 메서드여서 버전 검사를 함께 둡니다. 정확한 시각이 필수가 아니라면 부정확 알람(`set()`, `setAndAllowWhileIdle()`, 10분 이상의 창을 둔 `setWindow()`)이나 WorkManager 를 먼저 고려합니다.

### 타입을 선언한 포그라운드 서비스

사용자가 진행 상황을 알아야 하고 중단되면 안 되는 작업은 포그라운드 서비스를 씁니다. 이 경우에도 먼저 대안 API 를 확인해야 하고, 사용자가 시작한 데이터 전송, Companion Device Manager, PiP 같은 예가 개요 문서에 나옵니다. 쓴다면 앞서 본 대로 Android 12 이상에서는 시작 시점이, Android 14 이상에서는 타입과 권한 선언이, Android 15 이상에서는 `dataSync` 와 `mediaProcessing` 의 시간 제한이 조건이 됩니다.

## 상황별 선택 표

| 상황                                         | 선택                                      | 지속성                   | 이유                                       |
| -------------------------------------------- | ----------------------------------------- | ------------------------ | ------------------------------------------ |
| 화면이 있는 동안만 의미 있는 요청            | `viewModelScope` 의 코루틴                | 없음                     | ViewModel 이 clear 되면 취소됩니다         |
| 업로드, 동기화처럼 반드시 끝나야 하는 일     | WorkManager `OneTimeWorkRequest`          | 있음                     | 제약 조건, 재시도, 재부팅 뒤 재예약        |
| 주기적 동기화                                | WorkManager `PeriodicWorkRequest`         | 있음                     | 시스템이 시점을 조정하는 지연 가능 작업    |
| 사용자가 시작한 짧은 작업                    | WorkManager expedited                     | 있음                     | 쿼터 안에서 바로 시작합니다                |
| 10분을 넘을 수 있는 작업                     | WorkManager `setForeground()`             | 있음                     | 알림과 함께 포그라운드 서비스로 실행됩니다 |
| 사용자가 진행 상황을 계속 인지해야 하는 작업 | 타입을 선언한 포그라운드 서비스           | 서비스가 살아 있는 동안  | 중단되면 안 되는 사용자 가시 작업          |
| 알람 시계, 캘린더 알림                       | AlarmManager 정확 알람                    | 앱이 다시 예약           | 정확한 시각이 핵심 기능일 때만             |
| 대략적인 시각의 알림                         | AlarmManager 부정확 알람 또는 WorkManager | 앱이 다시 예약 또는 있음 | 절전 정책에 맞게 묶어 처리됩니다           |

이 표는 공식 문서의 유형 구분에 알람 문서와 이 글에서 확인한 제한을 얹어 정리한 것이고, 작업 하나가 두 칸에 걸치는 경우가 있습니다. 예를 들어 사용자가 보는 업로드는 WorkManager 의 `setForeground()` 와 포그라운드 서비스 타입 선언을 함께 씁니다.

## 참고 자료

- [Background work overview](https://developer.android.com/develop/background-work/background-tasks)
- [Services overview](https://developer.android.com/develop/background-work/services)
- [IntentService.java (android-11.0.0_r1)](https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-11.0.0_r1/core/java/android/app/IntentService.java)
- [AsyncTask.java (android-11.0.0_r1)](https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-11.0.0_r1/core/java/android/os/AsyncTask.java)
- [Optimize for Doze and App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby)
- [Background Execution Limits (Android 8.0)](https://developer.android.com/about/versions/oreo/background)
- [Restrictions on starting a foreground service from the background](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start)
- [Foreground service types](https://developer.android.com/develop/background-work/services/fgs/service-types)
- [Foreground service timeouts](https://developer.android.com/develop/background-work/services/fgs/timeout)
- [Behavior changes: Apps targeting Android 14](https://developer.android.com/about/versions/14/behavior-changes-14)
- [Schedule exact alarms are denied by default](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms)
- [Behavior changes: Apps targeting Android 15](https://developer.android.com/about/versions/15/behavior-changes-15)
- [Behavior changes: all apps (Android 16) — JobScheduler quota optimizations](https://developer.android.com/about/versions/16/behavior-changes-all)
- [Behavior changes: Apps targeting Android 12 — Exact alarm permission](https://developer.android.com/about/versions/12/behavior-changes-12)
- [User-initiated data transfer jobs](https://developer.android.com/develop/background-work/background-tasks/uidt)
- [Schedule alarms](https://developer.android.com/develop/background-work/services/alarms/schedule)
- [Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM](https://developer.android.com/reference/android/provider/Settings)
- [WorkManager: Persistent work](https://developer.android.com/develop/background-work/background-tasks/persistent)
- [Define your WorkRequests](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work)
- [Long-running workers](https://developer.android.com/develop/background-work/background-tasks/persistent/how-to/long-running)
- [Kotlin coroutines on Android](https://developer.android.com/topic/libraries/architecture/coroutines)

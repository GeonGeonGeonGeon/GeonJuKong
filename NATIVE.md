# 건주콩 설치형 앱 (GeonJuKong)

기존 화면·데이터 코드를 Capacitor 7 기반 Android/iOS 앱 안에 포함하는 구성입니다. 웹사이트 주소를 띄우는 원격 래퍼가 아니라 앱 번들에 화면 자산을 포함합니다. Google·공유 데이터에는 네트워크가 필요합니다.

## 현재 상태

- Capacitor 설정, 네이티브 진입점, 시스템 브라우저 OAuth + PKCE, 앱 복귀 URL, 원본/JSON의 네이티브 저장·공유 연결 코드를 추가했습니다.
- Android/iOS 프로젝트 생성과 동기화, 앱 아이콘, 콜백 설정을 적용하는 스크립트를 추가했습니다.
- 네이티브 의존성은 설치되어 있으며 소스 검사와 기존 테스트 18개가 통과했습니다. 현재 Windows 실행 환경에서는 esbuild가 상위 폴더를 읽는 과정에서 접근이 거부되어 네이티브 번들 생성이 실패했습니다.
- 확인한 환경에는 Android Studio/SDK가 없고 Java 8만 있습니다. Android APK는 생성되지 않았습니다.
- Android 프로젝트는 `android/`에 있습니다. iOS 프로젝트는 아직 없으며 아래 GitHub Actions 실행 시 macOS에서 생성합니다. iOS 컴파일·서명은 아직 검증하지 않았습니다.
- 실제 기기 동작, Google 인증 복귀, WebView에서의 파일 선택/Google Picker는 아직 미검증입니다.

## 갤럭시 S23 울트라용 APK

네트워크가 허용된 개발 환경에서 다음을 준비합니다.

1. Node.js 20 이상
2. Android Studio 2024.2.1 이상 및 호환 JDK(일반적으로 Android Studio에 포함)
3. Android SDK Platform 35와 해당 Build Tools, Platform Tools. SDK 설치 후 필요한 라이선스는 개발자가 확인합니다.
4. `README.md`의 Google/Supabase 공개 설정. 설정 없이도 APK를 만들면 체험 모드로 시작합니다.

```sh
npm install --cache .npm-cache
npm run native:android
```

위 명령은 네이티브 자산 번들, Android 프로젝트 생성, 콜백·아이콘 적용, Capacitor sync를 순서대로 수행합니다. 외부 `server.url`, cleartext, 원격 사이트 전체 탐색 허용은 설정하지 않았습니다.

Android Studio에서 `android/`를 열어 Gradle Sync를 끝내고 빌드하거나 다음을 실행합니다.

```sh
npm run native:apk
```

성공하면 테스트 설치 파일은 다음 경로에 생성됩니다.

```text
android/app/build/outputs/apk/debug/건주콩.apk
```

테스트 APK는 debug 서명입니다. 장기 사용·업데이트는 Android Studio의 **Generate Signed App Bundle or APK → APK**로 release APK를 만들고 같은 서명 키를 계속 사용하세요. 키 파일은 저장소에 올리지 말고 별도로 백업해야 기존 앱을 지우지 않고 업데이트할 수 있습니다. 기기를 바꾸거나 앱을 삭제하면 체험 모드의 로컬 기록도 사라질 수 있습니다.

갤럭시에서 본인이 빌드한 APK를 열어 설치합니다. 설치 출처 허용 등 기기 보안 결정은 사용자가 직접 수행합니다. Google Play 등록은 APK 직접 배포에 필수가 아닙니다.

## 아이폰 14용 앱

### Windows에서 클라우드 빌드

Windows 자체에는 Xcode가 없어 iOS 네이티브 컴파일을 할 수 없습니다. 개인 Mac 없이 작업하려면 Windows에서 GitHub Actions의 macOS 빌드를 실행할 수 있습니다. 이 프로젝트의 수동 실행 설정은 [ios-build.yml](.github/workflows/ios-build.yml)입니다.

1. 이 프로젝트를 본인 GitHub 저장소의 기본 브랜치에 올립니다. `.github/workflows/ios-build.yml`, `package-lock.json`, 앱 소스가 포함되어야 하며 `node_modules/`, `dist/`, 인증서는 올리지 않습니다.
2. 저장소의 **Actions → iOS unsigned build → Run workflow**를 선택합니다. 저장소에서 Actions가 활성화되어 있어야 합니다.
3. macOS에서 의존성 설치, 소스 검사와 테스트, `npm run native:ios`, Xcode의 Release archive를 순서대로 실행합니다.
4. 성공한 실행의 **Artifacts → GeonJuKong-ios-unsigned**에서 결과를 내려받습니다. 안에 있는 `GeonJuKong-unsigned.xcarchive.zip`은 서명하지 않은 빌드 결과이며 7일간 보관합니다.

**이 workflow는 컴파일 확인용이며 아이폰에 설치 가능한 `.ipa`를 만들지 않습니다.** 실제 설치에는 Apple 서명과 IPA 내보내기가 추가로 필요합니다. TestFlight 배포에는 Apple Developer Program과 App Store Connect 설정이 필요하고, 등록 기기용 배포에는 해당 아이폰이 포함된 프로비저닝 프로파일이 필요합니다. 서명 인증서·개인 키·비밀번호는 저장소에 넣지 말고 빌드 서비스의 비밀 설정으로 관리합니다.

GitHub 저장소 연결 정보가 없는 현재 로컬 환경에서는 이 workflow를 실행하지 않았습니다. 실제 Xcode 컴파일 성공 여부는 Actions 실행으로 확인해야 합니다. macOS 실행 비용은 계정의 Actions 사용량과 요금에 따릅니다.

### Mac에서 직접 빌드

아이폰은 APK를 설치하지 않습니다. 같은 소스를 **Mac**으로 옮겨 Node.js 20 이상·Xcode·CocoaPods를 준비한 뒤 실행합니다. Capacitor 7의 최소 요구는 Xcode 16이지만, 2026년 4월 28일부터 App Store Connect에 업로드하는 앱은 Xcode 26 이상과 iOS 26 SDK 이상으로 빌드해야 합니다.

```sh
npm install --cache .npm-cache
npm run native:ios
```

생성된 `ios/App/App.xcworkspace`를 Xcode로 열고, Signing & Capabilities에서 본인의 Team을 선택하고 아이폰을 연결해 빌드·설치합니다. macOS/Xcode 버전 및 실제 기기 iOS 버전의 호환성도 확인해야 합니다.

설치 후 표시 이름은 `건주콩`, 영문 이름은 `GeonJuKong`입니다. 앱 ID와 OAuth URL scheme은 `com.geonjukong.couple`입니다. 앱 ID를 바꾸려면 `capacitor.config.json`, Android의 namespace·applicationId·MainActivity 패키지·문자열 리소스·매니페스트, `src/platform.js`, `scripts/native-projects.mjs`, Supabase의 허용 리디렉션 URL을 함께 변경해야 합니다.

기존 앱과 앱 ID가 다르므로 Android에서는 별개의 앱으로 설치됩니다. 기존 앱의 체험 기록과 로그인 정보는 자동으로 이동하지 않습니다. 필요한 체험 기록과 원본은 기존 앱에서 먼저 내보내세요.

Filesystem 플러그인의 파일 타임스탬프 사용 사유를 담은 `ios/App/PrivacyInfo.xcprivacy`도 준비 스크립트가 만듭니다. 기존 파일은 덮어쓰지 않습니다. Xcode에서 이 파일을 App 타깃의 리소스로 추가하고, 기존 privacy manifest가 있다면 해당 사유를 병합한 뒤 archive를 확인하세요.

무료 Apple 계정의 기기 테스트와 장기 배포는 다릅니다. 무료 테스트 서명은 주기적 재서명이 필요할 수 있고 TestFlight도 빌드 유효기간이 있습니다. 장기 사용 시 Apple Developer Program, 등록 기기용 배포/정식 배포 등 본인 계정에 맞는 방식을 선택해야 합니다. iOS는 단순 파일 다운로드만으로 Android APK처럼 영구 설치할 수 없습니다.

## Google 로그인과 공유 서비스

Supabase Authentication → URL Configuration → Redirect URLs에 정확히 다음을 추가합니다.

```text
com.geonjukong.couple://auth/callback
```

Google OAuth 클라이언트의 리디렉션 URI는 기존과 동일한 Supabase의 HTTPS `/auth/v1/callback` 주소입니다. Google 콘솔에 앱 custom scheme을 웹 클라이언트 redirect로 넣지 않습니다.

APK 전용으로 설정할 때는 Supabase Authentication → URL Configuration의 Site URL에도 `com.geonjukong.couple://auth/callback`을 입력합니다. Redirect URLs의 이전 `com.danduri.couple://auth/callback`은 새 주소로 교체합니다. Google Auth Platform의 앱 이름과 OAuth 클라이언트 이름, Picker API 키 이름, Supabase 프로젝트 표시 이름은 `GeonJuKong`으로 맞출 수 있습니다. 서비스가 발급한 프로젝트 URL·클라이언트 ID·API 키·프로젝트 번호는 이름을 바꿔 직접 작성하지 말고 발급값을 사용합니다.

설치형 로그인은 앱 내부 WebView에서 Google 로그인 페이지를 열지 않고 Capacitor Browser(시스템 브라우저 화면)를 사용합니다. 캘린더·`drive.file` 동의를 함께 받고 앱 복귀 후 PKCE code를 교환합니다. 토큰의 계정도 확인합니다. Supabase 앱 세션은 유지하지만 Google API 토큰과 Google refresh token은 영구 저장하지 않습니다. 앱을 다시 시작하거나 Google 연결이 만료되면 설정의 ‘Google 연결하기’로 다시 로그인합니다.

공유 캘린더 ID와 Drive 폴더 ID 및 회원 두 이메일 설정은 `README.md`와 같습니다. Google Picker는 웹 SDK이므로 설치형 WebView의 출처·키 제한과 두 계정의 폴더 권한을 **실제 기기에서 검증해야 합니다.** 폴더 ID 입력만으로 `drive.file` 권한이 생기지 않습니다. 이 설정을 완료하기 전 원본 업로드가 된다고 간주하면 안 됩니다. 전체 Drive 권한으로 임의 확대하지 않았습니다.

## 설치형 앱에서 달라지는 동작

- 화면과 입력·댓글·채팅은 같은 코드이며 앱 자산은 기기에 포함됩니다. 설치형에서는 서비스 워커를 등록하지 않습니다.
- Drive 원본은 시스템 브라우저 뷰어로 엽니다.
- 로컬 체험 원본과 JSON 내보내기는 앱 캐시 파일을 만들어 시스템 공유 시트에서 ‘파일에 저장’ 등으로 보관합니다. 공유 시트 열기 자체가 상대방에게 전송하는 것은 아니며 저장/전송 대상은 사용자가 선택합니다.
- 체험 원본을 공유할 때 Base64 변환이 필요하므로 큰 영상은 메모리 사용량이 늘어납니다. 실제 모드의 Drive 원본 열기를 권합니다. 캐시의 내보내기 사본은 운영체제 또는 앱 데이터 삭제로 정리할 수 있습니다.
- 사진·영상 업로드는 전경에서만 진행합니다. 백그라운드 업로드 서비스는 없습니다.
- 채팅은 전경 5초 폴링입니다. **네이티브 잠금 화면 알림은 아직 구현되지 않았습니다.** 웹 Web Push는 네이티브 WebView에서 사용할 수 없으며 Android FCM·iOS APNs 연결 작업이 별도로 필요합니다. 앱 설정도 이 제한을 표시합니다.
- 앱 데이터는 기기 WebView 저장소를 사용하므로, Safari/Chrome의 기존 체험 기록이 설치 앱으로 자동 이전되지 않습니다.

## 검증 명령

```sh
npm run check
npm test
npm run native:bundle
```

앞의 두 검사는 네이티브 패키지 설치 없이도 실행할 수 있습니다. 마지막 명령은 실제 패키지를 설치한 뒤 네이티브 번들을 만드는 검사입니다. 소스 검사·모의 테스트 통과는 APK/Xcode 빌드나 실계정 테스트 통과를 의미하지 않습니다. 현재 환경에서 마지막 검사는 상위 폴더 접근 권한 문제로 실패했으며, macOS의 네이티브 번들과 Xcode archive는 Actions에서 별도로 확인해야 합니다. 네이티브 빌드로 생성한 dist를 웹에 재배포할 때는 먼저 `npm run build`를 다시 실행해 웹 진입점으로 바꿔야 합니다.

공식 참고: [Capacitor 7 개발 환경](https://capacitorjs.com/docs/v7/getting-started/environment-setup), [GitHub macOS 실행 환경](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job), [Apple 업로드 요구 사항](https://developer.apple.com/news/upcoming-requirements/), [Apple Developer Program](https://developer.apple.com/programs/whats-included/), [App 딥 링크](https://capacitorjs.com/docs/v7/apis/app), [Browser](https://capacitorjs.com/docs/v7/apis/browser), [Filesystem](https://capacitorjs.com/docs/v7/apis/filesystem), [Share](https://capacitorjs.com/docs/v7/apis/share), [Supabase 모바일 로그인 복귀](https://supabase.com/docs/guides/auth/native-mobile-deep-linking).

@AGENTS.md

# 프로젝트

허용된 Google 계정 두 개만 쓰는 커플 앱이다. 같은 웹 코드를 PWA와 Capacitor 7 Android/iOS 앱으로 배포한다. 프레임워크 없는 JavaScript ES 모듈이며, 웹은 번들링 없이 소스를 그대로 배포하고 esbuild는 네이티브 번들에만 쓴다.

데이터 경로가 두 개이므로 기능을 바꿀 때 양쪽을 모두 확인한다.

- 체험 모드: 브라우저 IndexedDB·localStorage (`src/storage.js`)
- 공유 모드: Supabase와 Google Calendar·Drive (`src/backend.js`, `src/google.js`)

설정 절차는 `README.md`, 네이티브 빌드는 `NATIVE.md`를 본다. 다만 두 문서에는 지난 내용이 있으므로 코드와 다르면 코드를 기준으로 삼는다.

- `README.md`의 "네이티브 iOS 앱이나 APK를 생성하지 않습니다"는 PWA 설치 경로에 대한 설명이다.
- `README.md`의 구성 목록에는 없는 모듈이 있으니 `src/`를 직접 확인한다.
- `NATIVE.md`의 "현재 상태"와 검증 관련 서술은 작성 시점 기준이다.

# 명령

| 명령 | 용도 |
| --- | --- |
| `npm run dev` | 로컬 서버 http://localhost:4173 (체험 모드로 시작) |
| `npm run check` | `config.js`, `sw.js`, `src/`, `scripts/`의 구문과 JSON 검사. `tests/`와 `supabase/functions/`는 검사하지 않는다 |
| `npm test` | Node 테스트 러너로 전체 테스트 실행 |
| `npm run build` | 웹 배포용 `dist/` 생성 |
| `npm run native:bundle` | 네이티브 웹 자산 번들 생성 |
| `npm run native:apk` | Android 동기화 후 debug APK 빌드 (Android SDK 필요) |
| `npm run native:ios` | iOS 프로젝트 준비. macOS 전용이며 Windows에서는 오류로 끝난다 |

테스트 하나만 실행할 때도 npm 스크립트와 같은 옵션을 붙인다.

```sh
node --preserve-symlinks --preserve-symlinks-main --test tests/core.test.mjs
```

코드를 바꾼 뒤에는 `npm run check`와 `npm test`를 실행한다. CI의 iOS 빌드도 이 둘을 먼저 실행하므로, 실패하면 IPA가 만들어지지 않는다.

# 변경할 때 함께 고칠 곳

- 테스트 파일 추가: `package.json`의 `test` 스크립트에 파일을 직접 추가한다. glob이 아니어서 빠뜨리면 실행되지 않는다.
- 앱 셸 파일 추가·제거: `sw.js`의 `SHELL` 목록을 고치고 `CACHE` 버전을 올린다. 캐시 정책을 바꿀 때도 버전을 올린다.
- 루트 정적 파일 추가: `scripts/build.mjs`의 복사 목록에 넣는다. `src/`와 `icons/`는 통째로 복사된다.
- DB 변경: `supabase/migrations/`에 날짜로 시작하는 SQL을 추가하고, 신규 설치에도 필요하면 `supabase/schema.sql`에도 반영한다. `schema.sql`은 새 프로젝트에 한 번만 실행하는 파일이다. 사용자가 적용해야 할 파일은 `README.md`와 최종 보고에 적는다.
- iOS 네이티브 설정: `ios/`는 저장소에 없고 빌드 때 생성된다. Info.plist 등은 `scripts/native-projects.mjs`에서 고친다. 이 스크립트는 `android/`의 콜백 설정에도 적용된다.
- 앱 ID 변경: `capacitor.config.json`, Android의 namespace·applicationId·MainActivity 패키지·문자열 리소스·매니페스트, `src/platform.js`, `scripts/native-projects.mjs`, Supabase 허용 리디렉션 URL을 함께 바꾼다.

# 보안과 개인정보

- `config.js`에는 공개 값만 넣는다. `service_role` 키, Google client secret, 암호화 키, 서명 인증서는 프런트엔드·저장소·대화에 넣지 않는다.
- Google 토큰을 URL에 넣거나 Drive 파일에 공개 링크를 만들지 않는다. "전체 공개"는 두 사람 모두 열람한다는 뜻이며 인터넷 공개가 아니다.
- 서비스 워커는 앱 셸만 캐시한다. 인증 응답, API 응답, 사용자 파일, OAuth 쿼리가 있는 페이지를 캐시하지 않는다.
- 권한은 RLS로 강제한다. 글 수정·삭제는 작성자만 가능하고 `members`는 클라이언트에서 수정할 수 없다. 클라이언트 검사만으로 권한을 구현하지 않는다.
- 사용자와 합의 없이 OAuth 범위를 넓히지 않는다. `drive.readonly`는 이미 Google의 제한된 범위다.
- 게시글이나 첨부를 삭제해도 Drive·체험 저장소의 원본은 남기는 것이 현재 정책이다. 원본을 자동으로 지우는 동작을 추가하지 않는다.

# 빌드와 저장소

- 웹 배포는 `dist/` 내용만 올린다. 네이티브 번들은 `dist/index.html`의 진입점을 `src/native-entry.js`로 바꾸므로, 웹에 배포하기 전에 `npm run build`를 다시 실행한다.
- `iosBuild.bat`은 `artifacts/` 밖에 변경이 있거나 현재 커밋이 원격과 다르면 시작하지 않으며, 직접 커밋·푸시하지 않는다. workflow는 저장소 기본 브랜치에 있어야 한다.
- `artifacts/`는 `.gitignore` 대상이 아니고 IPA와 빌드 결과가 들어 있다. 커밋할 때 `git add -A` 대신 파일을 지정해서 올린다.
- 프로젝트 경로에 한글과 공백이 있고 OneDrive 아래에 있으므로 경로를 항상 따옴표로 감싼다.
- `.ps1`과 `.bat`은 현재 모두 ASCII다. Windows PowerShell 5.1은 BOM 없는 UTF-8 스크립트의 한글을 잘못 읽으므로, 이 파일의 메시지는 영어로 유지한다.

# 검증 결과 보고

- `npm test`는 DOM·저장소 어댑터와 모의 응답을 쓴다. 통과해도 실제 브라우저 레이아웃, Google·Supabase 실서비스 권한과 RLS, APK·Xcode 빌드, 실제 기기 동작을 검증한 것은 아니다.
- 직접 실행하지 않은 항목은 미검증이라고 보고한다. 실계정이나 실제 기기 확인이 필요하면 `README.md`의 운영 전 점검 목록에서 해당 항목을 사용자에게 알린다.

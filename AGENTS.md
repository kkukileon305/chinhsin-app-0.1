# Project: 沁心 (chinhsin)
대만 화어(Taiwanese Mandarin) 학습용 React Native (Expo) 모바일 앱.

## 1. Domain Rules (Language & Content)
- **Taiwan Standard:** 어휘, 문법, 문화 설명은 모두 대만 현지 표준을 엄격하게 따를 것.
- **번체자(繁體中文) & 주음부호(注音):** 중국어 텍스트는 무조건 번체자(Traditional Chinese)와 주음부호(Bopomofo)만 사용. (간체자 및 병음 Pinyin 절대 금지)

## 2. App Environment & Config
- **Web API 금지:** 앱 환경이므로 `window`, `document`, `localStorage` 등 브라우저 전용 API 절대 사용 금지.
- **Auth Storage:** Supabase 세션 관리는 브라우저 스토리지가 아닌 `AsyncStorage`를 사용할 것.
- **Env Variables:** 클라이언트에서 호출할 `.env` 변수는 반드시 `EXPO_PUBLIC_` 접두사를 붙일 것 (예: `EXPO_PUBLIC_SUPABASE_URL`). 앱 내에 Service Role Key 노출 절대 금지.
- **Static Assets:** 이미지, 아이콘 등 정적 자원은 `assets/` 폴더에서 관리하고, `app.json`에 매핑할 것.

## 3. Coding Conventions
- **Syntax (화살표 함수):** 컴포넌트, 훅, 유틸 함수 등은 모두 화살표 함수(Arrow functions)로 작성할 것. (예: `const MyScreen = () => {}`)
- **Styling:** `StyleSheet.create` 대신 NativeWind를 사용하여 `className` 속성에 Tailwind CSS를 적용할 것.

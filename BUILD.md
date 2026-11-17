# Build Arcade Console

Scores are stored per app installation using localStorage. Each player's device keeps its own best score for each game. Cloud accounts and cross-device score sync are not configured.

## Android APK

1. Install Android Studio and the Android SDK.
2. Set `ANDROID_HOME` to the SDK folder, or create `android/local.properties` with:

```text
sdk.dir=C:\\Users\\YOUR_NAME\\AppData\\Local\\Android\\Sdk
```

3. From the project root, run:

```text
npm install
npm run android:debug
```

The debug APK will be created at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

For a release APK, use `npm run android:release`. A release build must be signed before distribution.

## iOS

iOS apps must be built on macOS with Xcode and Apple signing. From a Mac:

```text
npm install
npm exec cap sync ios
npm exec cap open ios
```

Then select a signing team in Xcode and build/archive for a device or TestFlight.

## Install Without Native Builds

The project is also a PWA. Serve the project over HTTPS, open it on Android Chrome or iOS Safari, and use the browser's Add to Home Screen option.

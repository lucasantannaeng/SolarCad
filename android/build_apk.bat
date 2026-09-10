@echo off
setlocal
set "JAVA_HOME=D:\Program Files\Java\jdk-21"
set "ANDROID_HOME=D:\Android\sdk"
set "ANDROID_SDK_ROOT=D:\Android\sdk"
set "GRADLE_USER_HOME=D:\Android\gradle_user_home"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\cmdline-tools\latest\bin;%ANDROID_HOME%\platform-tools;%PATH%"

cd /d "%~dp0"
echo [SolarCAD Android Builder] JAVA_HOME=%JAVA_HOME%
echo [SolarCAD Android Builder] ANDROID_HOME=%ANDROID_HOME%
echo [SolarCAD Android Builder] GRADLE_USER_HOME=%GRADLE_USER_HOME%

if "%~1"=="" (
    call gradlew.bat assembleDebug
) else (
    call gradlew.bat %*
)

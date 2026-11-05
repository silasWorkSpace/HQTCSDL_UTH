@REM ----------------------------------------------------------------------------
@REM LivingDocs Maven Wrapper for Windows
@REM ----------------------------------------------------------------------------
@echo off
setlocal

set "MAVEN_HOME=C:\Users\silas\.m2\maven-3.9.9"
if exist "%MAVEN_HOME%\bin\mvn.cmd" (
    call "%MAVEN_HOME%\bin\mvn.cmd" %*
) else (
    where mvn >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        call mvn %*
    ) else (
        echo [ERROR] Maven not found. Please install Maven or check C:\Users\silas\.m2\maven-3.9.9.
        exit /b 1
    )
)

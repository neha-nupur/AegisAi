@echo off
REM Run the Model & Provider Service (Part C). Leave this window open.
REM Start run_provider_stub.bat FIRST, in its own window.
cd /d "%~dp0"
call ".venv\Scripts\activate.bat"
cd "Part C - Implement It"
python app.py
pause

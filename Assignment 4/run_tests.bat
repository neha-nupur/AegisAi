@echo off
REM Run the automated test suite. Does not need the two services running.
cd /d "%~dp0"
call ".venv\Scripts\activate.bat"
cd "Part C - Implement It"
python -m pytest tests\ -v
pause

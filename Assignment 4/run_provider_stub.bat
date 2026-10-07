@echo off
REM Run the stub AI provider (Part D). Leave this window open.
cd /d "%~dp0"
call ".venv\Scripts\activate.bat"
cd "Part D - Survive the Network"
python stub_provider.py
pause

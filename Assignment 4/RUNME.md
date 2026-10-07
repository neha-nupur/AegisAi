# How to run this project (Windows)

Same pattern as the CampusEats Assignment 4 exercise. Ports are different
(6000/6001 instead of 5000/5001) so you can run both projects at once
without a clash.

## 1. First time only: `setup.bat`
Creates `.venv` and installs Flask, requests, pytest, openapi-spec-validator.

## 2. Every time you want to run the service: two windows

**Window 1:** double-click `run_provider_stub.bat` → wait for
`Running on http://127.0.0.1:6001`.

**Window 2:** double-click `run_service.bat` → wait for
`Running on http://127.0.0.1:6000`.

Both must stay open.

## 3. Try it (a third, normal terminal)
```
curl -i -X POST http://localhost:6000/providers -H "Content-Type: application/json" -d "{\"name\": \"OpenAI\", \"base_url\": \"http://localhost:6001\"}"
```

## 4. Run the automated tests any time
Double-click `run_tests.bat`. Doesn't need the two service windows running.
Should end with `8 passed`.

"""
Stand-in for an external AI provider (OpenAI/Gemini/local-model-style),
exposing just a /health endpoint for provider_client.py to have something
real to call. Not part of the Model & Provider Service submission itself —
it plays the role a real provider would play once one is actually wired up.

Run alongside app.py:
    python3 stub_provider.py                # listens on :6001
    (register a provider with base_url=http://localhost:6001, then
     POST /providers/{id}/health-check)
"""

from flask import Flask, jsonify

stub = Flask(__name__)


@stub.get("/health")
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    stub.run(port=6001, debug=False)

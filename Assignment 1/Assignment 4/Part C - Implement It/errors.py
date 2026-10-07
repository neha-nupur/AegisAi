"""
Errors and request validation for the Model & Provider Service.

Every failure response is built by problem() — one shape everywhere (C6).
validate_*() functions are the hand-written enforcement AegisAI's Task 3
operation table left implicit (its errors are named — ValidationError,
ProviderNotFound — but never say what makes a body invalid in the first
place; see NOTES.md Part 4).
"""


class DomainError(Exception):
    status_code = 400
    code = "domain_error"

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


class MalformedBody(DomainError):
    status_code = 400
    code = "malformed_body"


class ValidationFailed(DomainError):
    status_code = 422
    code = "validation_failed"


class NotFound(DomainError):
    status_code = 404
    code = "not_found"


class Conflict(DomainError):
    status_code = 409
    code = "conflict"


def problem(status: int, title: str, detail: str, code: str) -> tuple:
    body = {
        "type": f"https://aegisai.example/errors/{code}",
        "title": title,
        "status": status,
        "detail": detail,
        "code": code,
    }
    return body, status


def error_response(exc: DomainError):
    titles = {
        400: "Malformed request",
        404: "Not found",
        409: "Conflict",
        422: "Unprocessable request",
    }
    return problem(exc.status_code, titles.get(exc.status_code, "Error"), exc.detail, exc.code)


# ---- Validation functions -------------------------------------------------

def validate_provider_create(body) -> dict:
    if not isinstance(body, dict):
        raise MalformedBody("Request body must be a JSON object.")

    name = body.get("name")
    base_url = body.get("base_url")
    config_reference = body.get("config_reference")

    if not isinstance(name, str) or not isinstance(base_url, str):
        raise MalformedBody("'name' and 'base_url' must be strings.")
    if config_reference is not None and not isinstance(config_reference, str):
        raise MalformedBody("'config_reference' must be a string if provided.")

    if not name.strip():
        raise ValidationFailed("'name' must not be blank.")
    if not (base_url.startswith("http://") or base_url.startswith("https://")):
        raise ValidationFailed("'base_url' must be an http(s) URL.")

    return {"name": name.strip(), "base_url": base_url.strip(), "config_reference": config_reference}


def validate_model_create(body) -> dict:
    if not isinstance(body, dict):
        raise MalformedBody("Request body must be a JSON object.")

    name = body.get("name")
    type_ = body.get("type")
    sensitivity_level = body.get("sensitivity_level")
    cost_metadata = body.get("cost_metadata")

    if not isinstance(name, str) or not isinstance(type_, str):
        raise MalformedBody("'name' and 'type' must be strings.")
    if sensitivity_level is not None and not isinstance(sensitivity_level, str):
        raise MalformedBody("'sensitivity_level' must be a string if provided.")
    if cost_metadata is not None and not isinstance(cost_metadata, dict):
        raise MalformedBody("'cost_metadata' must be an object if provided.")

    if not name.strip():
        raise ValidationFailed("'name' must not be blank.")
    if not type_.strip():
        raise ValidationFailed("'type' must not be blank.")

    return {
        "name": name.strip(),
        "type": type_.strip(),
        "sensitivity_level": sensitivity_level,
        "cost_metadata": cost_metadata,
    }


def validate_model_status_update(body) -> dict:
    if not isinstance(body, dict):
        raise MalformedBody("Request body must be a JSON object.")

    is_active = body.get("is_active")
    reason = body.get("reason")

    if isinstance(is_active, bool) is False:
        raise ValidationFailed("'is_active' must be a boolean.")
    if reason is not None and not isinstance(reason, str):
        raise MalformedBody("'reason' must be a string if provided.")

    return {"is_active": is_active, "reason": reason}

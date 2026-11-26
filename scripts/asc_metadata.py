"""Upload text metadata to App Store Connect without fastlane.

Uses an App Store Connect API key from EAS-compatible secrets:
ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY_B64 (base64 of the .p8).
"""

import base64
import json
import os
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://api.appstoreconnect.apple.com"
BUNDLE_ID = "com.noxlabs.remember"
METADATA = Path(__file__).resolve().parent.parent / "fastlane" / "metadata"


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def der_signature_to_jwt(signature: bytes) -> bytes:
    # openssl produces DER; ES256 JWT needs raw r || s.
    index = 2
    parts = []
    for _ in range(2):
        if signature[index] != 0x02:
            raise ValueError("invalid DER signature")
        length = signature[index + 1]
        index += 2
        value = signature[index:index + length].lstrip(b"\x00")
        parts.append(value.rjust(32, b"\x00"))
        index += length
    return b"".join(parts)


def bearer_token(key_path: str) -> str:
    now = int(time.time())
    header = b64url(json.dumps(
        {"alg": "ES256", "kid": os.environ["ASC_KEY_ID"], "typ": "JWT"},
        separators=(",", ":"),
    ).encode())
    payload = b64url(json.dumps(
        {
            "iss": os.environ["ASC_ISSUER_ID"],
            "iat": now,
            "exp": now + 1200,
            "aud": "appstoreconnect-v1",
        },
        separators=(",", ":"),
    ).encode())
    signature = subprocess.run(
        ["openssl", "dgst", "-sha256", "-sign", key_path],
        input=f"{header}.{payload}".encode(),
        capture_output=True,
        check=True,
    ).stdout
    return f"{header}.{payload}.{b64url(der_signature_to_jwt(signature))}"


def request(token: str, path: str, method: str = "GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        API + path,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"{method} {path}: {error.code} {error.read().decode()[:400]}") from error


def text(locale: str, name: str) -> str:
    path = METADATA / locale / f"{name}.txt"
    return path.read_text(encoding="utf-8").strip() if path.exists() else ""


def main() -> None:
    with tempfile.NamedTemporaryFile(suffix=".p8", delete=False) as key_file:
        key_file.write(base64.b64decode(os.environ["ASC_PRIVATE_KEY_B64"]))
        key_path = key_file.name
    os.chmod(key_path, 0o600)

    token = bearer_token(key_path)

    apps = request(token, "/v1/apps?" + urllib.parse.urlencode({"filter[bundleId]": BUNDLE_ID}))
    if not apps["data"]:
        raise RuntimeError(f"app with bundle id {BUNDLE_ID} not found")
    app_id = apps["data"][0]["id"]

    versions = request(token, f"/v1/apps/{app_id}/appStoreVersions?" + urllib.parse.urlencode(
        {"filter[platform]": "IOS"}
    ))
    if not versions["data"]:
        raise RuntimeError("no iOS App Store version found")
    version = versions["data"][0]

    localizations = request(token, f"/v1/appStoreVersions/{version['id']}/appStoreVersionLocalizations")
    for localization in localizations["data"]:
        locale = localization["attributes"]["locale"]
        attributes = {}
        # whatsNew нельзя редактировать у первой версии в ASC; добавим для 0.2.0.
        for field, api_field in (("description", "description"), ("keywords", "keywords")):
            value = text(locale, field)
            if value:
                attributes[api_field] = value
        if not attributes:
            continue
        request(
            token,
            f"/v1/appStoreVersionLocalizations/{localization['id']}",
            method="PATCH",
            body={"data": {"id": localization["id"], "type": "appStoreVersionLocalizations", "attributes": attributes}},
        )
        print(f"updated {locale}: {', '.join(sorted(attributes))}")


if __name__ == "__main__":
    main()

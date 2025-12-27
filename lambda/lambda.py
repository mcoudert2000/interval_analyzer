from __future__ import annotations

import os
import json
import time
import hmac
import hashlib
import base64
from urllib import request
from urllib.error import HTTPError
from urllib.parse import urlencode


STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token"

OAUTH_STATE_SECRET = os.environ["OAUTH_STATE_SECRET"].encode()
STRAVA_CLIENT_ID = os.environ["STRAVA_CLIENT_ID"]
STRAVA_CLIENT_SECRET = os.environ["STRAVA_CLIENT_SECRET"]
FRONTEND_ORIGIN = os.environ["FRONTEND_ORIGIN"]

STATE_EXPIRY_SECONDS = 300  # 5 minutes

# --- Helper functions ---
def sign_state(payload: dict) -> str:
    data = json.dumps(payload, separators=(',', ':')).encode()
    sig = hmac.new(OAUTH_STATE_SECRET, data, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(data).decode() + "." + base64.urlsafe_b64encode(sig).decode()

def verify_state(state: str) -> dict | None:
    try:
        data_b64, sig_b64 = state.split(".")
        data = base64.urlsafe_b64decode(data_b64.encode())
        sig = base64.urlsafe_b64decode(sig_b64.encode())
        expected_sig = hmac.new(OAUTH_STATE_SECRET, data, hashlib.sha256).digest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        payload = json.loads(data)
        if time.time() - payload.get("iat", 0) > STATE_EXPIRY_SECONDS:
            return None
        return payload
    except Exception:
        return None

def exchange_code_for_token(code: str) -> dict | None:
    payload = {
        "client_id": STRAVA_CLIENT_ID,
        "client_secret": STRAVA_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
    }
    data = urlencode(payload).encode("utf-8")  # form-encoded
    print(f"Exchanging code for token: {payload}")
    req = request.Request(
        STRAVA_TOKEN_URL,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    try:
        with request.urlopen(req, timeout=10) as res:
            print("Strava response:", res)
            return json.load(res)
    except HTTPError as e:
        print("HTTPError:", e.read().decode())
        return None
    except Exception as e:
        print("Other error:", e)
        return None

# --- Lambda handler ---
def lambda_handler(event, context):
    headers = {
    "Access-Control-Allow-Origin": FRONTEND_ORIGIN,  # or "*" if safe
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json"
    }

    # Preflight
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
        code = body.get("code")
        state = body.get("state")
    except Exception:
        return {"statusCode": 400, "body": json.dumps({"error": "Invalid JSON"})}

    # Generate signed state if no code/state
    if not code or not state:
        payload = {"nonce": os.urandom(16).hex(), "iat": int(time.time())}
        signed_state = sign_state(payload)
        return {"statusCode": 200, "body": json.dumps({"state": signed_state})}

    # Validate state
    if not verify_state(state):
        return {"statusCode": 400, "body": json.dumps({"error": "Invalid state"})}

    # Exchange code for access token
    token_data = exchange_code_for_token(code)
    if not token_data or "access_token" not in token_data:
        return {"statusCode": 401, "body": json.dumps({"error": "Token exchange failed"})}

    return {
        "statusCode": 200,
        "body": json.dumps({
            "access_token": token_data["access_token"],
            "expires_at": token_data.get("expires_at")
        })
    }

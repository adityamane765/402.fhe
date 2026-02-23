import requests, json, base64, os
from eth_account import Account
from eth_account.messages import encode_defunct

class FHE402Client:
    def __init__(self, private_key: str, middleware_url: str):
        self.account = Account.from_key(private_key)
        self.middleware_url = middleware_url.rstrip("/")
        self.session = requests.Session()

    def get(self, path: str) -> dict:
        url = self.middleware_url + path
        r = self.session.get(url)

        if r.status_code == 200:
            return r.json()
        if r.status_code == 402:
            challenge = r.json()
            header = self._build_payment_header(challenge)
            r = self.session.get(url, headers={"X-Payment": header})
            if r.status_code != 200:
                raise RuntimeError(f"payment failed: {r.status_code} {r.text}")
            return r.json()
        raise RuntimeError(f"request failed: {r.status_code} {r.text}")

    def _build_payment_header(self, challenge: dict) -> str:
        msg = f"{challenge['apiId']}:{challenge['nonce']}"
        encoded = encode_defunct(text=msg)
        sig = self.account.sign_message(encoded)

        payload = {
            "buyerAddress": self.account.address,
            "apiId": challenge["apiId"],
            "nonce": challenge["nonce"],
            "signature": sig.signature.hex(),
        }
        return base64.b64encode(json.dumps(payload).encode()).decode()

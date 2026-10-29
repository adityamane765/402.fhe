import os
from typing import Any

import requests

from x402_client import FHE402Client


class MCPTools:
    def __init__(self, client: FHE402Client, middleware_url: str,
                 max_call_price_micro_usdc: int, session: Any = requests):
        self.client = client
        self.middleware_url = middleware_url.rstrip("/")
        self.max_call_price_micro_usdc = max_call_price_micro_usdc
        self.session = session

    @classmethod
    def from_env(cls) -> "MCPTools":
        middleware_url = os.environ["MIDDLEWARE_URL"]
        cap_micro_usdc = int(round(float(os.getenv("MAX_CALL_PRICE_USDC", "1.00")) * 1_000_000))
        return cls(FHE402Client(os.environ["AGENT_PRIVATE_KEY"], middleware_url),
                   middleware_url, cap_micro_usdc)

    def list_paid_apis(self) -> list[dict[str, Any]]:
        response = self.session.get(f"{self.middleware_url}/v1/apis", timeout=15)
        response.raise_for_status()
        return response.json()["items"]

    def call_paid_api(self, api_id: str) -> dict[str, Any]:
        api = next((item for item in self.list_paid_apis() if item["apiId"] == str(api_id)), None)
        if api is None:
            raise ValueError(f"API {api_id} is not available")
        price = int(api["price"]["amount"])
        if price > self.max_call_price_micro_usdc:
            raise ValueError(
                f"API price exceeds the configured spending cap "
                f"({price / 1_000_000:.6f} USDC > "
                f"{self.max_call_price_micro_usdc / 1_000_000:.6f} USDC)"
            )
        return {"api": api, "result": self.client.get(api["path"])}

    def get_pending_usage(self) -> dict[str, Any]:
        address = self.client.account.address
        response = self.session.get(f"{self.middleware_url}/pending/{address}", timeout=15)
        response.raise_for_status()
        return response.json()

    def settle_usage(self) -> dict[str, int]:
        return {"settled": self.client.settle()}

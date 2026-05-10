import os, json
from dotenv import load_dotenv
from eth_account import Account
from x402_client import FHE402Client

load_dotenv()

def main():
    key = os.environ["AGENT_PRIVATE_KEY"]
    middleware_url = os.environ["MIDDLEWARE_URL"]
    address = Account.from_key(key).address

    print(f"agent: {address}")
    print(f"middleware: {middleware_url}")
    print()

    client = FHE402Client(private_key=key, middleware_url=middleware_url)

    print("→ GET /api/weather")
    weather = client.get("/api/weather")
    print(f"  200 OK — proof stored off-chain, not yet settled")
    print(f"  {json.dumps(weather, indent=2)[:300]}")
    print()

    print("→ GET /api/inference")
    inference = client.get("/api/inference")
    print(f"  200 OK — proof stored, not yet settled")
    print(f"  {json.dumps(inference, indent=2)[:300]}")
    print()

    print("→ settling all pending calls on-chain...")
    settled = client.settle()
    print(f"  {settled} call(s) settled in one tx")

if __name__ == "__main__":
    main()

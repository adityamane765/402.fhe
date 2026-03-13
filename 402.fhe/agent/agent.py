import os, json, time
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
    print(f"  200 OK — payment settled on-chain (balance decremented, revenue incremented, both encrypted)")
    print(f"  {json.dumps(weather, indent=2)[:300]}")
    print()

    # wait for settlement batch to clear the reserve
    print("  waiting for on-chain settlement...")
    time.sleep(12)

    print("→ GET /api/inference")
    inference = client.get("/api/inference")
    print(f"  200 OK — payment settled on-chain")
    print(f"  {json.dumps(inference, indent=2)[:300]}")

if __name__ == "__main__":
    main()

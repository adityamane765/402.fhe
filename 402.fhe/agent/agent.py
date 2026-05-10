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
    print("prerequisites:")
    print("  1. deposit USDC for this wallet on the dapp (buyer page)")
    print("     → balance is encrypted on-chain as euint64")
    print("  2. ensure APIs are listed and registered on the marketplace")
    print("  3. run this script — agent pays per call, settles in one tx")
    print()

    client = FHE402Client(private_key=key, middleware_url=middleware_url)

    apis = [
        ("/api/cryptoprices", "crypto prices"),
        ("/api/cryptoprices", "crypto prices"),
    ]

    for path, label in apis:
        print(f"→ GET {path}  ({label})")
        try:
            result = client.get(path)
            print(f"  200 OK — proof stored off-chain, not yet settled")
            print(f"  {json.dumps(result, indent=2)[:200]}")
        except Exception as e:
            print(f"  error: {e}")
        print()
        time.sleep(10)


    print(f"→ {len(apis)} calls made — 0 on-chain transactions yet")
    print(f"→ settling all pending calls in one tx...")
    settled = client.settle()
    print(f"  {settled} call(s) settled in a single transaction")

if __name__ == "__main__":
    main()

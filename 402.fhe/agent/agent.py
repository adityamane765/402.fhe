import os
from dotenv import load_dotenv
from x402_client import FHE402Client

load_dotenv()

def main():
    client = FHE402Client(
        private_key=os.environ["AGENT_PRIVATE_KEY"],
        middleware_url=os.environ["MIDDLEWARE_URL"],
    )

    print("calling /api/weather...")
    weather = client.get("/api/weather")
    print(f"weather: {weather}")

    print("calling /api/inference...")
    inference = client.get("/api/inference")
    print(f"inference: {inference}")

if __name__ == "__main__":
    main()

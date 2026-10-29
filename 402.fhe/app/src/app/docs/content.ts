export const navItems = [
  ["start", "Start"],
  ["caller", "Caller"],
  ["agents", "MCP"],
  ["provider", "Provider"],
  ["lifecycle", "Flow"],
  ["reference", "Reference"],
  ["troubleshooting", "Help"],
] as const;

export const tasks = [
  { number: "01", label: "Python client", title: "Call a paid API", description: "Handle the 402 challenge, sign the authorization, and retry the request from a wallet-backed client.", link: "Caller quickstart", href: "#caller", tone: "violet" },
  { number: "02", label: "MCP server", title: "Give an agent paid tools", description: "Expose API discovery, capped paid calls, pending usage, and settlement as MCP tools.", link: "MCP setup", href: "#agents", tone: "cyan" },
  { number: "03", label: "API provider", title: "Meter a JSON endpoint", description: "Create a priced listing and map its API ID to an upstream route in the middleware.", link: "Provider setup", href: "#provider", tone: "amber" },
] as const;

export const callerExample = `import os
from x402_client import FHE402Client

client = FHE402Client(
    private_key=os.environ["AGENT_PRIVATE_KEY"],
    middleware_url=os.environ["MIDDLEWARE_URL"],
)

data = client.get("/api/cryptoprices")
print(data)

# Settlement is a separate request.
print(client.settle())`;

export const callerSetup = `cd 402.fhe/agent

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# Set AGENT_PRIVATE_KEY and MIDDLEWARE_URL.
python agent.py`;

export const callerOutput = `{'bitcoin': {'usd': 68421}}
1

# Example API response, followed by the number
# of calls submitted by client.settle().`;

export const mcpConfig = `{
  "mcpServers": {
    "402-fhe": {
      "command": "/path/to/402.fhe/agent/.venv/bin/python",
      "args": ["/path/to/402.fhe/agent/mcp_server.py"],
      "env": {
        "AGENT_PRIVATE_KEY": "<dedicated-key>",
        "MIDDLEWARE_URL": "http://localhost:3001",
        "MAX_CALL_PRICE_USDC": "2.00"
      }
    }
  }
}`;

export const mcpSetup = `cd 402.fhe/agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# Set AGENT_PRIVATE_KEY, MIDDLEWARE_URL,
# and MAX_CALL_PRICE_USDC in .env.`;

export const mcpTools = [
  ["list_paid_apis", "List callable APIs with their public prices and middleware paths."],
  ["call_paid_api", "Call one API by ID after checking its price against the configured cap."],
  ["get_pending_usage", "Read unsettled call counts for the agent wallet."],
  ["settle_usage", "Submit the agent wallet's pending calls for settlement."],
] as const;

export const providerCommands = {
  register: `curl -X POST "$MIDDLEWARE_URL/register" \\
  -H "Content-Type: application/json" \\
  -d '{
    "apiId": 7,
    "path": "/api/research",
    "endpoint": "https://your-api.example/research"
  }'`,
  verify: `curl -i "$MIDDLEWARE_URL/api/research"

HTTP/1.1 402 Payment Required
{
  "scheme": "fhe-402",
  "version": 1,
  "apiId": 7,
  "nonce": "0x..."
}`,
  settle: `# Replace 0xBuyer with the caller wallet.
curl "$MIDDLEWARE_URL/pending/0xBuyer"

curl -X POST "$MIDDLEWARE_URL/settle" \\
  -H "Content-Type: application/json" \\
  -d '{ "address": "0xBuyer" }'`,
};

export const lifecycle = [
  ["01", "Request", "Caller sends a GET request to a registered middleware path."],
  ["02", "Challenge", "Middleware returns the API ID and a route-bound nonce."],
  ["03", "Authorize", "Caller signs apiId:nonce and retries with X-Payment."],
  ["04", "Accumulate", "Middleware adds the signed call to the buyer and API channel."],
  ["05", "Forward", "Middleware requests the upstream and returns its JSON response."],
  ["06", "Settle", "Either party or the 50-call threshold submits the channel count to batchSettle."],
] as const;

export const endpoints = [
  ["GET", "/v1/apis", "List active APIs with public prices and middleware paths."],
  ["GET", "/api/*", "Return a 402 challenge or forward an authorized request."],
  ["GET", "/routes", "Read API ID, path, and upstream mappings from the local registry."],
  ["POST", "/register", "Add or replace a route mapping in the local registry."],
  ["GET", "/pending/:address", "Read pending call counts for a buyer or merchant address."],
  ["POST", "/settle", "Settle pending calls involving the supplied address."],
] as const;

export const troubleshooting = [
  ["400 malformed payment header", "X-Payment is not base64-encoded JSON with the required fields.", "Decode the header and check buyerAddress, apiId, nonce, and signature."],
  ["401 invalid signature", "The signature does not recover to buyerAddress.", "Build the header with the same key used to derive buyerAddress."],
  ["401 challenge rejected", "The API ID does not match the route, or the nonce expired or was already used.", "Request a new challenge from the same route and sign its apiId:nonce value."],
  ["404 API not registered", "No route matches the requested middleware path.", "Compare the request path with GET /routes."],
  ["409 settlement in progress", "A settlement already holds one of the selected buyer and API pairs.", "Wait for it to finish, then query pending usage again."],
  ["410 listing inactive", "The on-chain API listing is not active.", "Use GET /v1/apis to choose an active listing."],
  ["502 request failed", "The middleware could not read contract state, or the upstream failed.", "Check the middleware log to identify which boundary returned the error."],
] as const;

export const boundaries = [
  "The proxy handles GET requests and expects JSON from the upstream.",
  "Route mappings are stored in routes.json. Challenges and pending calls are held in memory.",
  "API prices and settlement events are public. The middleware sees request paths, wallet addresses, and timing.",
  "Balances and merchant revenue are stored as FHE ciphertexts, but their current handles are marked for public decryption.",
  "A call is recorded before the upstream request completes. An upstream failure can therefore leave a pending call.",
  "MAX_CALL_PRICE_USDC is a per-call price ceiling. It does not limit total session spend.",
] as const;

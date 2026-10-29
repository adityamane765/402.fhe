import unittest
from unittest.mock import Mock

from mcp_tools import MCPTools


class MCPToolsTests(unittest.TestCase):
    def setUp(self):
        self.client = Mock()
        self.client.account.address = "0xBuyer"
        self.session = Mock()
        self.tools = MCPTools(self.client, "http://middleware", 500_000, self.session)

    def _catalog(self, amount="200000"):
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {
            "items": [{
                "apiId": "1",
                "name": "Crypto prices",
                "path": "/api/cryptoprices",
                "price": {"amount": amount, "asset": "USDC", "decimals": 6},
            }]
        }
        self.session.get.return_value = response

    def test_calls_discovered_api_within_spending_cap(self):
        self._catalog()
        self.client.get.return_value = {"bitcoin": {"usd": 100}}

        result = self.tools.call_paid_api("1")

        self.client.get.assert_called_once_with("/api/cryptoprices")
        self.assertEqual(result["result"]["bitcoin"]["usd"], 100)

    def test_rejects_api_above_spending_cap_before_signing(self):
        self._catalog(amount="500001")

        with self.assertRaisesRegex(ValueError, "spending cap"):
            self.tools.call_paid_api("1")

        self.client.get.assert_not_called()

    def test_rejects_unknown_api(self):
        self._catalog()

        with self.assertRaisesRegex(ValueError, "not available"):
            self.tools.call_paid_api("99")


if __name__ == "__main__":
    unittest.main()

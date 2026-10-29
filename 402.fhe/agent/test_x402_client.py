import base64
import json
import unittest

from eth_account import Account
from eth_account.messages import encode_defunct

from x402_client import FHE402Client


class PaymentHeaderTests(unittest.TestCase):
    def test_signature_is_single_prefixed_and_recovers_buyer(self):
        account = Account.create()
        client = FHE402Client(account.key.hex(), "http://localhost:3001")
        challenge = {"apiId": 7, "nonce": "0x001122"}

        header = client._build_payment_header(challenge)
        payload = json.loads(base64.b64decode(header))

        self.assertTrue(payload["signature"].startswith("0x"))
        self.assertFalse(payload["signature"].startswith("0x0x"))
        recovered = Account.recover_message(
            encode_defunct(text="7:0x001122"),
            signature=payload["signature"],
        )
        self.assertEqual(recovered.lower(), account.address.lower())


if __name__ == "__main__":
    unittest.main()


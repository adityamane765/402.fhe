const MIDDLEWARE_URL = process.env.NEXT_PUBLIC_MIDDLEWARE_URL || "http://localhost:3001";

interface Challenge {
  scheme: string;
  apiId: number;
  nonce: string;
  contract: string;
}

export async function callApi(
  path: string,
  apiId: number,
  buyerAddress: string,
  signMessage: (args: { message: string }) => Promise<string>
): Promise<unknown> {
  const url = MIDDLEWARE_URL + path;

  // first attempt — no payment
  let res = await fetch(url);

  if (res.status === 200) return res.json();

  if (res.status === 402) {
    const challenge: Challenge = await res.json();
    const message = `${challenge.apiId}:${challenge.nonce}`;
    const signature = await signMessage({ message });

    const payload = {
      buyerAddress,
      apiId: challenge.apiId,
      nonce: challenge.nonce,
      signature,
    };

    const header = btoa(JSON.stringify(payload));

    res = await fetch(url, { headers: { "X-Payment": header } });
    if (!res.ok) throw new Error(`payment failed: ${res.status}`);
    return res.json();
  }

  throw new Error(`request failed: ${res.status}`);
}

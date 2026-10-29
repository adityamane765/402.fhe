export interface RouteConfig {
  path: string;
  endpoint: string;
}

export interface ListingRecord {
  merchant: string;
  name: string;
  description: string;
  price: bigint;
  active: boolean;
}

export function toPublicApi(apiId: number, route: RouteConfig, listing: ListingRecord) {
  return {
    apiId: String(apiId),
    name: listing.name,
    description: listing.description,
    price: { amount: listing.price.toString(), asset: "USDC", decimals: 6 },
    merchant: listing.merchant,
    path: route.path,
    available: listing.active,
  };
}

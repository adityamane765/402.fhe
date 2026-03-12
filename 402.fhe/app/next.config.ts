import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@zama-fhe/relayer-sdk", "fhevmjs"],
  webpack(config, { isServer }) {
    if (isServer) {
      // these packages ship WASM and are browser-only — stub them out on the server
      config.resolve.alias["@zama-fhe/relayer-sdk/web"] = path.resolve("./src/lib/empty.ts");
      config.resolve.alias["fhevmjs"] = path.resolve("./src/lib/empty.ts");
    }
    // webpack doesn't natively handle .wasm as async chunks without this
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};

export default nextConfig;

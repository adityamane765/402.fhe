import express from "express";
import { fhe402Middleware } from "./x402Handler";
import fs from "fs";
import path from "path";

interface RouteConfig {
  path: string;
  endpoint: string;
}

const router = express.Router();

// load routes.json from middleware/ root (one level up from src/ or dist/)
const routesPath = path.resolve(__dirname, "../routes.json");
const routes: Record<string, RouteConfig> = JSON.parse(fs.readFileSync(routesPath, "utf-8"));

for (const [apiIdStr, config] of Object.entries(routes)) {
  const apiId = Number(apiIdStr);

  router.get(config.path, fhe402Middleware(apiId), async (_req, res) => {
    try {
      const upstream = await fetch(config.endpoint);
      const data = await upstream.json();
      res.json(data);
    } catch (err) {
      console.error(`proxy error for apiId ${apiId}:`, err);
      res.status(502).json({ error: "upstream error" });
    }
  });
}

export default router;

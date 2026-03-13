import express, { Request, Response } from "express";
import { fhe402Middleware } from "./x402Handler";
import fs from "fs";
import path from "path";

interface RouteConfig {
  path: string;
  endpoint: string;
}

const router = express.Router();
const routesPath = path.resolve(__dirname, "../routes.json");

function loadRoutes(): Record<string, RouteConfig> {
  try {
    return JSON.parse(fs.readFileSync(routesPath, "utf-8"));
  } catch {
    return {};
  }
}

// dynamic catch-all: look up apiId from routes.json at request time
router.get("/api/*", (req: Request, res: Response, _next) => {
  const routes = loadRoutes();
  const reqPath = "/api/" + req.params[0];

  const entry = Object.entries(routes).find(([, config]) => config.path === reqPath);
  if (!entry) {
    res.status(404).json({ error: "api not registered" });
    return;
  }

  const [apiIdStr, config] = entry;
  const apiId = Number(apiIdStr);

  fhe402Middleware(apiId)(req, res, async () => {
    try {
      const upstream = await fetch(config.endpoint);
      const data = await upstream.json();
      res.json(data);
    } catch (err) {
      console.error(`proxy error for apiId ${apiId}:`, err);
      res.status(502).json({ error: "upstream error" });
    }
  });
});

export default router;
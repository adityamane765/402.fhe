import express from "express";
import * as dotenv from "dotenv";
import demoRoutes from "./demoApi";
import { settleAll, getPendingCount, getPendingDeduction } from "./x402Handler";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
app.use(express.json());

// allow browser requests from any origin — needed for frontend on vercel/localhost
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Payment");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

const routesPath = path.resolve(__dirname, "../routes.json");

// expose current route registry so frontend can map apiId → path
app.get("/routes", (_req, res) => {
  try {
    const routes = JSON.parse(fs.readFileSync(routesPath, "utf-8"));
    res.json(routes);
  } catch {
    res.status(500).json({ error: "failed to read routes" });
  }
});

// merchant self-registration
// NOTE: new registrations only take effect for new requests.
// Already-loaded routes in demoApi.ts require a process restart to update.
app.post("/register", (req, res) => {
  const { apiId, path: apiPath, endpoint } = req.body;

  if (typeof apiId !== "number" || !apiPath || !endpoint) {
    res.status(400).json({ error: "apiId (number), path, and endpoint are required" });
    return;
  }

  try {
    const routes = JSON.parse(fs.readFileSync(routesPath, "utf-8"));
    routes[String(apiId)] = { path: apiPath, endpoint };

    fs.writeFileSync(routesPath, JSON.stringify(routes, null, 2));
    res.json({ ok: true, apiId, path: apiPath, endpoint });
  } catch (err) {
    console.error("register error:", err);
    res.status(500).json({ error: "failed to update routes" });
  }
});

// settle pending proofs — caller can be buyer or merchant, we match both sides
app.post("/settle", async (req, res) => {
  const { address } = req.body;
  try {
    const count = await settleAll(address || undefined);
    res.json({ ok: true, settled: count });
  } catch (err) {
    console.error("settle error:", err);
    res.status(500).json({ error: "settlement failed" });
  }
});

// how many unsettled calls are pending for an address (works for both buyer and merchant)
app.get("/pending/:address", (req, res) => {
  const routes = JSON.parse(fs.readFileSync(routesPath, "utf-8"));
  const address = req.params.address.toLowerCase();

  const pending: Record<number, number> = {};
  for (const apiIdStr of Object.keys(routes)) {
    const count = getPendingCount(address, Number(apiIdStr));
    if (count > 0) pending[Number(apiIdStr)] = count;
  }

  // total usdc pending deduction for this buyer — frontend uses this to show adjusted balance
  const pendingDeduction = getPendingDeduction(address).toString();

  res.json({ address, pending, pendingDeduction });
});

app.use(demoRoutes);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`middleware listening on :${port}`);
});

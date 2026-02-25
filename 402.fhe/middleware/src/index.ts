import express from "express";
import * as dotenv from "dotenv";
import demoRoutes from "./demoApi";
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

const routesPath = path.resolve(__dirname, "../../routes.json");

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

app.use(demoRoutes);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`middleware listening on :${port}`);
});

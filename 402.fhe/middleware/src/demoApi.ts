import express from "express";
import { fhe402Middleware } from "./x402Handler";

const router = express.Router();

router.get("/api/weather", fhe402Middleware(0), (_req, res) => {
  res.json({ temp: 22, city: "Paris", unit: "C" });
});

router.get("/api/inference", fhe402Middleware(1), (_req, res) => {
  res.json({ result: "The answer is 42", model: "stub-v1" });
});

export default router;

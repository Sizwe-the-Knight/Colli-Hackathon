import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { checkSessionReadiness } from "../lib/session-readiness";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/readyz", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const readiness = await checkSessionReadiness();
  res.status(readiness.status === 'ready' ? 200 : 503).json(readiness);
});

export default router;

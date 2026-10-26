import { Router, type IRouter } from "express";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import modelsRouter from "./models";
import workflowsRouter from "./workflows";
import activityRouter from "./activity";
import recommendationsRouter from "./recommendations";
import notificationsRouter from "./notifications";
import costsRouter from "./costs";
import { requireAuth } from "../lib/security";
import operationalBriefRouter from './operational-brief';

const router: IRouter = Router();

router.use(authRouter);
router.use(requireAuth);
router.use(operationalBriefRouter);
router.use(dashboardRouter);
router.use(modelsRouter);
router.use(workflowsRouter);
router.use(activityRouter);
router.use(recommendationsRouter);
router.use(notificationsRouter);
router.use(costsRouter);

export default router;

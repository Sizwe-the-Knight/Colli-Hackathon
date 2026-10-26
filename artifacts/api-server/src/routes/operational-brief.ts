import { Router, type IRouter } from 'express';
import fixture from '../../../../scripts/fixtures/usage-synthetic.json';
import { processUsage } from '../operational/usage';
import { BriefNarrator, narratorConfig } from '../operational/narrator';
import { fingerprint } from '../operational/narration-contract';
import { PostgresNarrationStore, judgeAccounts } from '../operational/narration-postgres';
import { pool } from '@workspace/db';

// Mounted behind requireAuth. This is a shared synthetic example, never an
// account import or an inference that selected providers are connected.
const router: IRouter = Router();
const config = narratorConfig(process.env);
const store = config.enabled && config.storage === 'postgres'
  ? new PostgresNarrationStore(pool, config, judgeAccounts(process.env.NEBIUS_JUDGE_ACCOUNT_IDS)) : undefined;
const narrator = new BriefNarrator(config, undefined, undefined, undefined, store);
router.get('/operational/brief', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(processUsage(fixture));
});
// Both routes inherit requireAuth and POST also inherits originProtection.
// GET is cache inspection only. Clients cannot submit reports, prompts or model IDs.
export function narrationRoutes(service: BriefNarrator): IRouter {
  const routes: IRouter = Router();
  routes.get('/operational/brief/narration', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await service.readStored(req.session.userId!, processUsage(fixture)));
  });
  routes.post('/operational/brief/narration', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const report = processUsage(fixture);
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) ||
        Object.keys(req.body).length !== 1 || typeof req.body.fingerprint !== 'string') {
      res.status(400).json({ error: 'Invalid generation request' }); return;
    }
    if (req.body.fingerprint !== fingerprint(report)) {
      res.status(409).json({ error: 'The report changed. Refresh the Brief before generating.' }); return;
    }
    res.json(await service.generate(req.session.userId!, report));
  });
  return routes;
}
router.use(narrationRoutes(narrator));
export default router;

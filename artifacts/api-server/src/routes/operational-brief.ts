import { Router, type IRouter } from 'express';
import { providerDemo } from '../operational/demo-scenario';
import { BriefNarrator, narratorConfig } from '../operational/narrator';
import { fingerprint } from '../operational/narration-contract';
import { PostgresNarrationStore, judgeAccounts } from '../operational/narration-postgres';
import { pool } from '@workspace/db';

// Mounted behind requireAuth. Preferences select examples, never connected activity.
async function accountReport(userId: number) {
  const result = await pool.query<{ providers: string | null }>(
    'SELECT providers FROM public.users WHERE id = $1', [userId]);
  if (!result.rows[0]) throw new Error('Account unavailable');
  return providerDemo(result.rows[0].providers);
}
const router: IRouter = Router();
const config = narratorConfig(process.env);
const store = config.enabled && config.storage === 'postgres'
  ? new PostgresNarrationStore(pool, config, judgeAccounts(process.env.NEBIUS_JUDGE_ACCOUNT_IDS)) : undefined;
const narrator = new BriefNarrator(config, undefined, undefined, undefined, store);
router.get('/operational/brief', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(await accountReport(req.session.userId!));
});
// Both routes inherit requireAuth and POST also inherits originProtection.
// GET is cache inspection only. Clients cannot submit reports, prompts or model IDs.
export function narrationRoutes(service: BriefNarrator): IRouter {
  const routes: IRouter = Router();
  routes.get('/operational/brief/narration', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await service.readStored(req.session.userId!, await accountReport(req.session.userId!)));
  });
  routes.post('/operational/brief/narration', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const report = await accountReport(req.session.userId!);
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

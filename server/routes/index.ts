import { Router } from 'express';
import statusRoutes from './status';

const router: Router = Router();

router.use('/api', statusRoutes);

export default router;

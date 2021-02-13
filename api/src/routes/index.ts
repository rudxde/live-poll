import { Router } from 'express';

export async function route(): Promise<Router> {
    const router = Router();
    router.use((await import('./api')).router);
    return router;
}

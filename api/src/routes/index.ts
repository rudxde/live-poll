import { Router } from 'express';

export async function route(): Promise<Router> {
    const router = Router();
    console.log(1);
    router.use((await import('./api')).router);
    return router;
}

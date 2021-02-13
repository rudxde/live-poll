import express, { Request, Response, NextFunction } from 'express';
import expressWs from 'express-ws';
import { IServiceError } from '@akrons/service-utils';
import { Environment } from './lib/environment';
import { Keys } from './lib/keys';
import { GetTokenMiddleware } from '@akrons/auth-lib';
import cors from 'cors';

async function main() {
    await Environment.loadEnvironment();
    await Keys.loadKeys();
    const { app, getWss, applyTo } = expressWs(express());

    app.use(express.json({ limit: "100mb" }));

    if (Environment.get().corsAll) {
        app.use(cors());
    } else {
        app.use(cors({
            methods: 'GET,HEAD,OPTIONS,PUT,PATCH,POST,DELETE',
            origin: Environment.get().corsOrigins?.map(String) || '',
            credentials: true,
            preflightContinue: false,
        }));
    }

    if (Environment.get().authEnabled) {
        app.use(
            (req, res, next) => {
                req.permissions = ['live-poll.default'];
                next();
            },
            GetTokenMiddleware(Keys.get()!.authPublicKey),
        )
    } else {
        app.use((req, res, next) => {
            req.permissions = ['live-poll.*'];
            next();
        });
    }

    app.use('/api', await (await import('./routes')).route());

    app.use((err: IServiceError | any, req: Request, res: Response, next: NextFunction) => {
        if (err.statusCode) {
            const is400 = err.statusCode < 500 && err.statusCode >= 400;
            if (!is400 || Environment.get().log400Errors === true) {
                console.error(err);
            }
            return res.sendStatus(err.statusCode);
        }
        console.error(err);
        res.sendStatus(500);
        next();
    });

    app.listen(Environment.get().port, Environment.get().hostname, () =>
        console.log(`Server listening on host [${Environment.get().hostname}] and port ${Environment.get().port}!`),
    );
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

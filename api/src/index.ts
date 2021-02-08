import express, { Request, Response, NextFunction } from 'express';
import expressWs from 'express-ws';
import { loadConfig } from './configuration';
const { app, getWss, applyTo } = expressWs(express());
import redis from 'redis';
import { promisify } from 'util';

async function main() {
    const { port, hostname, redisHost } = await loadConfig();

    const redisClient = redis.createClient({
        host: redisHost
    });
    const redisSubscriberClient = redis.createClient({
        host: redisHost
    });
    const redisGetAsync = promisify(redisClient.get).bind(redisClient);
    const redisSetAsync = promisify(redisClient.set).bind(redisClient);

    app.ws('/', function (ws, req) {
        let alive = true;
        sendCurrentState(alive, ws).catch(err => console.error(err));
        redisSubscriberClient.on('message', (channel, message) => {
            sendCurrentState(alive, ws).catch(err => console.error(err));
        });
        ws.send("connected");
        ws.on('message', async (x) => {
            if (x.toString() === 'keepalive') {
            } else if (x.toString() === 'clear') {
                await redisSetAsync('chart', '[]');
                redisClient.publish('update', '');
            } else {
                const message = x.toString();
                console.log('message: ' + message);
                const chart: [string, number][] = JSON.parse((await redisGetAsync('chart')) || '[]');
                const wordIndex = chart.findIndex(([key, value]) => key === message)
                if (wordIndex === -1) {
                    chart.push([message, 1]);
                } else {
                    chart[wordIndex][1] += 1;
                }
                await redisSetAsync('chart', JSON.stringify(chart));
                redisClient.publish('update', '');
            }
        });
        ws.on('close', () => {
            alive = false;
        });
    });

    redisSubscriberClient.subscribe('update');

    app.listen(port, hostname, () =>
        console.log(`Server listening on port ${port}!`),
    );

    async function sendCurrentState(alive: boolean, ws: import('ws')) {
        if (alive) {
            ws.send((await redisGetAsync('chart')) || '[]');
            // ws.send(message);
        }
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

import { Router } from 'express';
import { Router as WsRouter } from 'express-ws';
import { promisify } from 'util';
import { Client } from '../lib/client';

export const router: WsRouter = Router();

router.ws('/:id', async (ws, req) => {
    console.debug('client connected');
    let client: Client | undefined = undefined;
    try {
        client = new Client(req.params.id, req.permissions, <any>promisify(ws.send).bind(ws), ws)
        await client!.open();
        ws.on('message', (data) => {
            const stringData = data.toString();
            if (stringData !== 'keepalive' && stringData !== 'ping') {
                client!.message(stringData).catch(err => {  handleError(err, ws, client); });
            }
        });
        ws.on('error', (error) => client!.error(error).catch(err => {  handleError(err, ws, client); }));
        ws.on('close', () => client!.close().catch(err => {  handleError(err, ws, client); }));
    } catch (err) {
        handleError(err, ws, client);
    }
});

function handleError(err: Error, ws: import('ws'), client: Client | undefined): void {
    console.error(err);
    if (client) {
        client.close();
    }
    if (!ws.CLOSED && !ws.CLOSING) {
        ws.send('Error');
        ws.close();
    }
}
import { RedisAsyncClient } from './redis-async-client';
import { Client } from './client';
import { Environment } from './environment';
import { PollSettings, PollState } from 'live-poll-shared';
import { auth } from '@akrons/types';
import { NotAuthorizedError } from '@akrons/service-utils';

export class Poll {
    static openPolls: Poll[] = [];

    static redisSubscriber: RedisAsyncClient;
    static redisPublisher: RedisAsyncClient;

    private constructor(
        public id: string,
        public clients: Client[],
    ) {
        if (!Poll.redisSubscriber) {
            Poll.redisSubscriber = RedisAsyncClient.createClient({ host: Environment.get().redis.url, port: Environment.get().redis.port });
            Poll.redisSubscriber.redisClient.on('message', (channel, message) => {
                console.debug(`redis-message: channel: ${channel}, message: ${message}`);
                Poll.openPolls.find(x => x.id === channel.split('.')[0])?.redisMessage(message);
            });
            Poll.redisPublisher = Poll.redisSubscriber.duplicate();
        }
    }

    static async createInstance(id: string, client: Client): Promise<Poll> {
        const newPoll = new Poll(id, []);
        const pollSettings = await newPoll.getSettings();
        if (!pollSettings) {
            await this.createPoll(newPoll, client);
        }
        this.openPolls.push(newPoll);
        await Poll.redisSubscriber.subscribe(Poll.redisUpdateChannel(id));
        await newPoll.join(client);
        return newPoll;
    }

    static async createPoll(localPoll: Poll, client: Client): Promise<void> {
        if (!auth.hasPermission(Environment.get().createPollPermission, client.permissions)) {
            throw new NotAuthorizedError();
        }
        await localPoll.generateDefaultSettings(client);
    }

    static async getPoll(id: string, client: Client): Promise<Poll> {
        const existsLocal = this.openPolls.find(x => x.id === id);
        if (existsLocal) {
            await existsLocal.join(client);
            return existsLocal;
        }
        return await Poll.createInstance(id, client);
    }

    private async redisMessage(message: string): Promise<void> {
        const pollSettings = await this.getSettings();
        if (!pollSettings) {
            return;
        }
        const pollState = await this.getPollState();
        const pollMemberCount = await this.getMemberCount();
        switch (message as UpdateChannelMessages) {
            case UpdateChannelMessages.UPDATE_MEMBER_COUNT:
                this.clients.forEach(client => client.setMemberCount(pollMemberCount, pollSettings));
                break;
            case UpdateChannelMessages.UPDATE_POLL_STATE:
                this.clients.forEach(client => client.setState(pollState, pollSettings));
                break;
            case UpdateChannelMessages.UPDATE_SETTINGS:
                console.debug(`updated settings to: ${JSON.stringify(pollSettings, undefined, 4)}`)
                this.clients.forEach(client => {
                    client.setMemberCount(pollMemberCount, pollSettings);
                    client.setState(pollState, pollSettings);
                });
                break;
            default:
        }
    }

    async join(client: Client): Promise<void> {
        this.clients.push(client);
        await Poll.redisPublisher.incr(Poll.redisUpdateMemberCount(this.id));
        await Poll.redisPublisher.publish(Poll.redisUpdateChannel(this.id), UpdateChannelMessages.UPDATE_MEMBER_COUNT);
    }

    async leave(client: Client): Promise<void> {
        this.clients = this.clients.filter(x => x !== client);
        await Poll.redisPublisher.decr(Poll.redisUpdateMemberCount(this.id));
        await Poll.redisPublisher.publish(Poll.redisUpdateChannel(this.id), UpdateChannelMessages.UPDATE_MEMBER_COUNT);
    }

    async getSettings(): Promise<Partial<PollSettings | undefined>> {
        const settings = await Poll.redisPublisher.get(Poll.redisPollSettings(this.id));
        if (!settings) {
            return undefined;
            // return await this.generateDefaultSettings();
        }
        return JSON.parse(settings);
    }

    private async generateDefaultSettings(client: Client) {
        const userPermission = client.permissions.find(x => x.startsWith('user.'));
        const authEnabled = Environment.get().authEnabled;
        const defaultPermisions = (authEnabled && userPermission) ? userPermission : 'live-poll.*';
        const defaultSettings: PollSettings = {
            adminPermisions: defaultPermisions,
            clearPermisions: defaultPermisions,
            resultsPermisions: defaultPermisions,
            preResultsPermisions: defaultPermisions,
            postPermisions: defaultPermisions,
            countConnectionsPermisions: defaultPermisions,
            isPublished: false,
        };
        await this.setSettings(defaultSettings, false);
        return defaultSettings;
    }

    async setSettings(settings: Partial<PollSettings>, extendExisting = true): Promise<void> {
        const oldSettings = extendExisting ? await this.getSettings() : {};
        await Poll.redisPublisher.set(Poll.redisPollSettings(this.id), JSON.stringify({ ...oldSettings, ...settings }));
        await Poll.redisPublisher.publish(Poll.redisUpdateChannel(this.id), UpdateChannelMessages.UPDATE_SETTINGS);
    }

    async getPollState(): Promise<PollState> {
        const pollState = await Poll.redisPublisher.get(Poll.redisPollState(this.id));
        if (!pollState) return [];
        return JSON.parse(pollState);
    }

    async addMessage(message: string): Promise<void> {
        const state = await this.getPollState();
        const messageIndex = state.findIndex(([key, value]) => key === message)
        if (messageIndex === -1) {
            state.push([message, 1]);
        } else {
            state[messageIndex][1] += 1;
        }
        await Poll.redisPublisher.set(Poll.redisPollState(this.id), JSON.stringify(state));
        await Poll.redisPublisher.publish(Poll.redisUpdateChannel(this.id), UpdateChannelMessages.UPDATE_POLL_STATE);
    }

    async clearMessages(): Promise<void> {
        await Poll.redisPublisher.set(Poll.redisPollState(this.id), JSON.stringify([]));
        await Poll.redisPublisher.publish(Poll.redisUpdateChannel(this.id), UpdateChannelMessages.UPDATE_POLL_STATE);
    }

    async getMemberCount(): Promise<number> {
        return Number.parseInt(await Poll.redisPublisher.get(Poll.redisUpdateMemberCount(this.id)) || '0', 10);
    }

    async close(): Promise<void> {
        if (this.clients.length > 0) {
            await Promise.all(this.clients.map(client => client.close()));
            return;
        }
        await Poll.redisSubscriber.unsubscribe(Poll.redisUpdateChannel(this.id));
        Poll.openPolls = Poll.openPolls.filter(x => x !== this);
    }

    private static redisUpdateChannel(id: string): string {
        return `${id}.updates`
    }

    private static redisUpdateMemberCount(id: string): string {
        return `${id}.member-count`
    }

    private static redisPollSettings(id: string): string {
        return `${id}.settings`
    }

    private static redisPollState(id: string): string {
        return `${id}.state`
    }
}

enum UpdateChannelMessages {
    UPDATE_MEMBER_COUNT = 'member-count',
    UPDATE_SETTINGS = 'update-settings',
    UPDATE_POLL_STATE = 'update-poll-state'
}

export class PollNotInitializedError extends Error {
    constructor() {
        super(`PollNotInitializedError`);
    }
}

import { auth } from '@akrons/types';
import { isCommand, PollSettings, PollState, PostCommand, SetConfigurationCommand, MemberCountCommand, StateCommand } from 'live-poll-shared';
import { Poll, PollNotInitializedError } from './poll';

export class Client {
    poll: Poll | undefined;

    constructor(
        public pollId: string,
        public permissions: string[],
        public send: (message: string) => Promise<void>,
        public ws: import('ws'),
    ) {
    }

    async open(): Promise<void> {
        this.send(JSON.stringify({ command: 'hi', permissions: this.permissions }));
        this.poll = await Poll.getPoll(this.pollId, this);
        const pollSettings = await this.poll.getSettings();
        if(!pollSettings) {
            throw new PollNotInitializedError();
        }
        await this.setState(await this.poll.getPollState(), pollSettings);
    }

    async message(message: string): Promise<void> {
        console.debug(`message: ${message}`);
        const command: unknown = JSON.parse(message);
        if (!isCommand(command)) {
            const errorMessage = 'message is not an valid command!';
            this.send(errorMessage);
            return;
        }
        switch (command.command) {
            case 'post':
                await this.post(command);
                break;
            case 'set-configuration':
                await this.setConfiguration(command);
                break;
            case 'clear':
                await this.clear();
                break;
            default:
                this.send('unknown command!')
        }
    }

    async error(err: Error): Promise<void> {
        throw err;
    }

    async close(): Promise<void> {
        if (!this.poll) return;
        this.poll.leave(this);
        if (this.ws.OPEN) {
            this.ws.close();
        }
        this.poll.clients = this.poll.clients.filter(x => x !== this);
        if (this.poll.clients.length === 0) {
            this.poll.close();
        }
    }

    async setState(state: PollState, settings: Partial<PollSettings>): Promise<void> {
        console.debug(`client setPollState: ${JSON.stringify(state)}`);
        if (!this.poll) {
            throw new Error('no active poll')
        }
        if (
            (
                settings.isPublished &&
                auth.hasPermission(settings.resultsPermisions || 'never', this.permissions)
            )
            || auth.hasPermission(settings.preResultsPermisions || 'never', this.permissions)
        ) {
            const stateCommand: StateCommand = { command: 'state', state: state };
            await this.send(JSON.stringify(stateCommand));
        }
    }

    async setMemberCount(members: number, settings: Partial<PollSettings>): Promise<void> {
        if (!this.poll) {
            throw new Error('no active poll')
        }
        if (
            auth.hasPermission(settings.countConnectionsPermisions || 'never', this.permissions)
            || auth.hasPermission(settings.adminPermisions || 'never', this.permissions)
        ) {
            const memberCountCommand: MemberCountCommand = { command: 'members', members: members };
            await this.send(JSON.stringify(memberCountCommand));
        }
    }

    private async post(command: PostCommand): Promise<void> {
        if (!this.poll) {
            throw new Error('no active poll')
        }
        const settings = await this.poll.getSettings();
        if(!settings) {
            throw new PollNotInitializedError();
        }
        if (!auth.hasPermission(settings.postPermisions || 'never', this.permissions)) {
            console.debug(`missing permissions to post: ${settings.postPermisions || 'never'} has: ${this.permissions}.`);
            console.debug(`settings: ${JSON.stringify(settings, undefined, 4)}`);
            return;
        }
        await this.poll.addMessage(command.message);
    }

    private async setConfiguration(command: SetConfigurationCommand): Promise<void> {
        if (!this.poll) {
            throw new Error('no active poll')
        }
        await this.poll.setSettings(command);
    }

    private async clear(): Promise<void> {
        if (!this.poll) {
            throw new Error('no active poll')
        }
        const settings = await this.poll.getSettings();
        if (!settings) {
            throw new PollNotInitializedError();
        }
        if (!auth.hasPermission(settings.clearPermisions || 'never', this.permissions)) {
            return;
        }
        await this.poll.clearMessages();
    }
}

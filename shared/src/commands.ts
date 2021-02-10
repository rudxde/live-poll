import { PollSettings, PollState } from './poll';

interface Command {
    command: string;
}

export interface SetConfigurationCommand extends Command, PollSettings {
    command: 'set-configuration'
}

export interface PostCommand extends Command {
    command: 'post',
    message: string,
}

export interface ClearCommand extends Command {
    command: 'clear',
}

export interface MemberCountCommand extends Command {
    command: 'members',
    members: number,
}

export interface StateCommand extends Command {
    command: 'state',
    state: PollState,
}


// export interface PublishResultsCommand extends Command {
//     command: 'publish-results',
//     delay: number,
// }

export function isCommand(x: unknown): x is CommandT {
    if (typeof x !== 'object') return false;
    return Boolean((x as Command).command);
}

export type CommandT =
    SetConfigurationCommand
    | PostCommand
    | ClearCommand
    | MemberCountCommand
    | StateCommand;
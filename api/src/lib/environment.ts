import { loadConfiguration } from '@akrons/configuration';
import { Environment as DefaultEnvironment } from '@akrons/service-utils';


export class Environment {
    private static instance: IEnvironment | undefined;
    private constructor() { }

    static async loadEnvironment(): Promise<IEnvironment> {
        Environment.instance = await loadConfiguration(yargs => {
            return DefaultEnvironment.buildDefaultEnvironmentParameters(
                DefaultEnvironment.buildIRedisEnvironmentParameters(
                    yargs
                        .option('corsOrigins', {
                            type: 'array',
                        })
                        .option('authEnabled', {
                            type: 'boolean',
                            default: false
                        })
                        .option('authServiceName', {
                            type: 'string'
                        })
                        .implies('authEnabled', 'authServiceName')
                        .option('createPollPermission', {
                            type: 'string',
                            default: 'live-poll.create'
                        })
                ),
            )
        });
        return Environment.instance;
    }

    static get(): IEnvironment {
        if (!Environment.instance) {
            throw new Error(`Environment not loaded. Please call loadEnvironment() first!`);
        }
        return Environment.instance;
    }

}

export interface IEnvironment extends
    DefaultEnvironment.IDefaultEnvironment,
    DefaultEnvironment.IRedisEnvironment {
    corsOrigins?: (string | number)[];
    authEnabled: boolean;
    authServiceName?: string;
    createPollPermission: string;
}

import { loadConfiguration } from '@akrons/configuration';

export interface IConfiguration {
    port: number;
    hostname: string;
    redisHost: string;
}

let configuration: IConfiguration | undefined;

export async function loadConfig(): Promise<IConfiguration> {
    configuration = await loadConfiguration<IConfiguration>(argsBuilder =>
        argsBuilder
            .option('port', {
                type: 'number',
                description: 'The port the the app is listening on.',
                demandOption: true,
            })
            .option('hostname', {
                type: 'string',
                description: 'The hostname the app is listening on.',
                demandOption: true,
            })
            .option('redisHost', {
                type: 'string',
                description: 'The hostname of the redis instance.',
                demandOption: true,
            })
    );
    return configuration;
}

export function getConfiguration(): IConfiguration {
    if (!configuration) {
        throw new Error('Configuration not loaded. Please call loadConfiguration first!');
    }
    return configuration;
}

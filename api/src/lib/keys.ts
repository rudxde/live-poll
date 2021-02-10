import { loadD4sKey } from '@akrons/service-utils';
import { Environment } from './environment';

export class Keys {
    private static instance: Keys | undefined;
    private constructor(
        public authPublicKey: string,
    ) { }
    public static async loadKeys(): Promise<Keys | undefined> {
        if (!Environment.get().authEnabled) {
            return undefined;
        }
        Keys.instance = new Keys(
            await loadD4sKey(Environment.get().publicKeyPath, Environment.get().d4s, false, Environment.get().serviceName, Environment.get().authServiceName!),
        );
        return Keys.instance;
    }
    public static get(): Keys | undefined {
        return Keys.instance;
    }
}

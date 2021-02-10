
export interface PollSettings {
    adminPermisions: string,
    clearPermisions: string,
    resultsPermisions: string,
    preResultsPermisions: string,
    postPermisions: string,
    countConnectionsPermisions: string,
    isPublished: boolean,
}

export type PollState = [string, number][];

import type { levels } from '../logger/LoggerLevels'
import loadJson from '../utils/LoadJson'
import Logger from '@Logger'

import type { Assert } from 'ts-runtime-checks'

interface Config {
    allowedVersions: string[],
    logLevel: keyof typeof levels,
    rateLimit: RateLimit,
    worlds: Worlds
}

interface RateLimit {
    enabled: boolean,
    addressConnectsPerSecond: number,
    addressEventsPerSecond: number,
    userEventsPerSecond: number
}

interface Worlds {
    [key: string]: {
        port: number,
        maxUsers: number
    }
}

const config: Config = loadJson('config/config') as Assert<Config>

Logger.level = config.logLevel

export const allowedVersions = config.allowedVersions
export const rateLimit = config.rateLimit
export const worlds = config.worlds

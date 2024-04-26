import * as Data from '../data/Data'
import Delimiter from './packet/Delimiter'
import Logger from '@Logger'
import { parseXml, parseXt } from './packet/Packet'
import PluginLoader from '../plugin/PluginLoader'
import Room from '@objects/room/Room'

import EventEmitter from 'events'

import type User from '@objects/user/User'
import type World from '../World'

export default class Handler {

    users: User[]
    rooms: Record<number, Room>
    policy: string
    events: EventEmitter
    plugins: PluginLoader

    constructor(world: World) {
        this.users = world.users

        this.rooms = this.setRooms()

        this.policy = '<cross-domain-policy><allow-access-from domain="*" to-ports="*" /></cross-domain-policy>'

        this.events = new EventEmitter({ captureRejections: true })
        this.plugins = new PluginLoader(this)

        this.events.on('error', error => Logger.error(error))
    }

    setRooms() {
        const rooms: Record<number, Room> = {}

        for (const room of Data.rooms) {
            rooms[room.id] = new Room(room)
        }

        return rooms
    }

    handle(data: string, user: User) {
        try {
            const packets = data.split(Delimiter).filter(Boolean)

            for (const packet of packets) {
                Logger.info(`Received: ${packet}`)

                if (packet.startsWith('<')) this.handleXml(packet, user)

                if (packet.startsWith('%')) this.handleXt(packet, user)
            }

        } catch (error) {
            if (error instanceof Error) Logger.error(error.stack)
        }
    }

    handleXml(data: string, user: User) {
        const parsed = parseXml(data)

        if (!parsed) {
            Logger.warn(`Invalid XML data: ${data}`)
            return
        }

        if (parsed.tag === 'policy-file-request') user.sendXml(this.policy)

        if (parsed.tag === 'msg') {
            const body = parsed.find('body')

            if (body) {
                const action = body.get('action')

                if (action) {
                    this.events.emit(action, user, body)
                }
            }
        }
    }

    handleXt(data: string, user: User) {
        const parsed = parseXt(data)

        if (!parsed) {
            Logger.warn(`Invalid XT data: ${data}`)
            return
        }

        Logger.debug('Parsed args: %O', parsed)

        this.events.emit(parsed.action, user, ...parsed.args)
    }

    close(user: User) {
        user.close()

        this.users = this.users.filter(u => u !== user)

    }

}

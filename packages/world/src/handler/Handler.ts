import * as Data from '@Data'
import { delimiter, parseXml, parseXt } from './packet/Packet'
import Logger from '@Logger'
import PlayerRooms from '@objects/room/PlayerRooms'
import PluginLoader from '../plugin/PluginLoader'
import Room from '@objects/room/Room'
import { updateWorldPopulation } from '../World'
import type User from '@objects/user/User'
import type World from '../World'

import type { Element } from 'elementtree'
import EventEmitter from 'events'

type Users = Record<number, User>
export type Rooms = Record<number, Room>

const policy = '<cross-domain-policy><allow-access-from domain="*" to-ports="*" /></cross-domain-policy>'

export default class Handler {

    world: World
    rooms: Rooms
    playerRooms: PlayerRooms
    events: EventEmitter
    plugins: PluginLoader

    constructor(world: World) {
        this.world = world

        this.rooms = this.setRooms()
        this.playerRooms = new PlayerRooms()

        this.events = new EventEmitter({ captureRejections: true })
        this.plugins = new PluginLoader(this)

        this.events.on('error', error => Logger.error(error))

        this.setTables()
        this.setWaddles()
    }

    get users() {
        return this.world.users
    }

    set users(users: Users) {
        this.world.users = users
    }

    get usersLength() {
        return Object.keys(this.users).length
    }

    setRooms() {
        const rooms: Record<number, Room> = {}

        for (const room of Data.rooms) {
            const { id, name, member, maxUsers, game, spawn } = room

            rooms[room.id] = new Room(id, name, member, maxUsers, game, spawn)
        }

        return rooms
    }

    setTables() {
        for (const table of Data.tables) {
            const { id, roomId, type } = table

            if (!(roomId in this.rooms)) {
                Logger.error('Could not create table', { table })
                continue
            }

            this.rooms[roomId].addTable(id, type)
        }
    }

    setWaddles() {
        for (const waddle of Data.waddles) {
            const { id, roomId, seats, gameId } = waddle

            if (!(roomId in this.rooms) || !(gameId in this.rooms)) {
                Logger.error('Could not create waddle', { waddle })
                continue
            }

            this.rooms[roomId].addWaddle(id, seats, this.rooms[gameId])
        }
    }

    handle(data: string, user: User) {
        try {
            const packets = data.split(delimiter).filter(Boolean)

            for (const packet of packets) {
                Logger.info(`Received: ${packet}`)

                if (packet.startsWith('<')) {
                    this.handleXml(packet, user)
                }

                if (packet.startsWith('%')) {
                    this.handleXt(packet, user)
                }
            }

        } catch (error) {
            Logger.error(error)
        }
    }

    handleXml(data: string, user: User) {
        const parsed = parseXml(data)

        if (!parsed) {
            Logger.warn(`Invalid XML data: ${data}`)
            return
        }

        switch (parsed.tag) {
            case 'policy-file-request':
                user.sendXml(policy)
                break

            case 'msg':
                this.handleXmlMsg(parsed, user)
                break
        }
    }

    handleXmlMsg(parsed: Element, user: User) {
        const body = parsed.find('body')

        if (!body) {
            return
        }

        const action = body.get('action')

        if (action) {
            this.events.emit(action, user, body)
        }
    }

    handleXt(data: string, user: User) {
        const parsed = parseXt(data)

        if (!parsed) {
            Logger.warn(`Invalid XT data: ${data}`)
            return
        }

        Logger.debug('Parsed args', { parsed })

        this.events.emit(parsed.action, user, ...parsed.args)

        user.events.emit(parsed.action, user, ...parsed.args)
    }

    close(user: User) {
        Logger.info(`Closing: ${user.socket.remoteAddress}`)

        user.leaveRoom()

        this.playerRooms.closeRoom(user)

        if (user.pets) {
            user.pets.stopPetUpdate()
        }

        if (user.id && this.users[user.id] === user) {
            delete this.users[user.id]
        }

        updateWorldPopulation(this.usersLength)
    }

}
import { delimiter, makeXt } from '../../handler/packet/Packet'
import type BaseTable from '@objects/room/table/BaseTable'
import Database from '@Database'
import Errors from './Errors'
import Logger from '@Logger'
import type Room from '@objects/room/Room'
import type Waddle from '@objects/room/waddle/Waddle'
import type WaddleRoom from '@objects/room/waddle/WaddleRoom'

import BuddyCollection from '@collections/BuddyCollection'
import FurnitureCollection from '@collections/FurnitureCollection'
import IgnoreCollection from '@collections/IgnoreCollection'
import InventoryCollection from '@collections/InventoryCollection'

import type { Prisma, User as PrismaUser } from '@prisma/client'
import EventEmitter from 'events'
import { nanoid } from 'nanoid'
import type { Socket } from 'net'

export default class User implements Partial<PrismaUser> {

    socket: Socket
    rateLimitKey: string

    room: Room | null
    x: number
    y: number
    frame: number

    table: BaseTable | null
    waddle: Waddle | null
    waddleRoom: WaddleRoom | null

    buddyRequests: number[]
    events: EventEmitter

    id!: number
    username!: string
    email!: string | null
    password!: string
    loginKey!: string | null
    rank!: number
    joinTime!: Date
    coins!: number
    head!: number
    face!: number
    neck!: number
    body!: number
    hand!: number
    feet!: number
    color!: number
    photo!: number
    flag!: number

    buddies!: BuddyCollection
    furniture!: FurnitureCollection
    ignores!: IgnoreCollection
    inventory!: InventoryCollection

    constructor(socket: Socket) {
        this.socket = socket

        this.rateLimitKey = nanoid()

        this.room = null
        this.x = 0
        this.y = 0
        this.frame = 0

        this.table = null
        this.waddle = null
        this.waddleRoom = null

        this.buddyRequests = []

        // Used for temporary events
        this.events = new EventEmitter({ captureRejections: true })

        this.events.on('error', error => Logger.error(error))
    }

    send(...args: (number | string | object)[]) {
        this.write(makeXt(args))
    }

    sendXml(data: string) {
        this.write(data)
    }

    sendRoom(...args: (number | string | object)[]) {
        if (this.room) {
            this.room.send(...args)
        }
    }

    sendError(errorId: Errors) {
        this.send('e', errorId)
    }

    write(data: string) {
        Logger.debug(`Sending: ${data}`)

        this.socket.write(`${data}${delimiter}`)
    }

    joinRoom(room: Room, x = 0, y = 0) {
        if (!room) {
            return
        }

        if (room.isFull) {
            this.sendError(Errors.RoomFull)
            return
        }

        this.leaveRoom()

        this.setPosition(x, y)

        room.add(this)
    }

    leaveRoom() {
        if (this.room) {
            this.room.remove(this)
        }

        if (this.waddle) {
            this.waddle.remove(this)
        }

        if (this.waddleRoom) {
            this.waddleRoom.remove(this)
        }
    }

    setPosition(x: number, y: number) {
        this.x = x
        this.y = y
        this.frame = 1
    }

    async addItem(itemId: number) {
        this.inventory.add(itemId)
    }

    async updatePlayer(items: number[]) {
        const [color, head, face, neck, body, hand, feet, flag, photo] = items

        await this.update({ color, head, face, neck, body, hand, feet, flag, photo })

        this.sendRoom('up', this)
    }

    addFurniture(furnitureId: number) {
        this.furniture.add(furnitureId)
    }

    addBuddyRequest(userId: number, username: string) {
        if (userId === this.id) {
            return
        }

        if (this.buddies.includes(userId)) {
            return
        }

        if (this.buddyRequests.includes(userId)) {
            return
        }

        if (this.buddies.count < 100) {
            this.buddyRequests.push(userId)
        }

        this.send('bq', userId, username)
    }

    removeBuddyRequest(userId: number) {
        this.buddyRequests = this.buddyRequests.filter(requestId => requestId !== userId)
    }

    async addBuddy(buddyId: number) {
        this.buddies.add(buddyId)
    }

    async removeBuddy(buddyId: number) {
        this.buddies.remove(buddyId)
    }

    async addIgnore(ignoreId: number) {
        this.ignores.add(ignoreId)
    }

    async removeIgnore(ignoreId: number) {
        this.ignores.remove(ignoreId)
    }

    async load(username: string) {
        const user = await Database.user.findFirst({
            where: {
                username: username
            },
            include: {
                buddies: {
                    include: {
                        buddy: { select: { username: true } }
                    }
                },

                furniture: true,

                ignores: {
                    include: {
                        ignore: { select: { username: true } }
                    }
                },

                inventory: true
            }
        })

        if (!user) {
            return false
        }

        const { buddies, furniture, ignores, inventory, ...rest } = user

        Object.assign(this, rest)

        this.buddies = new BuddyCollection(this, buddies)
        this.furniture = new FurnitureCollection(this, furniture)
        this.ignores = new IgnoreCollection(this, ignores)
        this.inventory = new InventoryCollection(this, inventory)

        return true
    }

    async update(data: Prisma.UserUpdateInput) {
        try {
            await Database.user.update({
                where: {
                    id: this.id
                },
                data: data
            })

            Object.assign(this, data)

            Logger.debug(`Updated user: ${this.username}, data: %O`, data)

        } catch (error) {
            if (error instanceof Error) {
                Logger.error(`Could not update user: ${this.username}, data: %O, error: ${error.stack}`, data)
            }
        }
    }

    disconnect() {
        this.socket.destroy()
    }

    close() {
        this.leaveRoom()
    }

    toString() {
        return [
            this.id,
            this.username,
            this.color,
            this.head,
            this.face,
            this.neck,
            this.body,
            this.hand,
            this.feet,
            this.flag,
            this.photo,
            this.x,
            this.y,
            this.frame,
            1,
            0
        ].join('|')
    }

}

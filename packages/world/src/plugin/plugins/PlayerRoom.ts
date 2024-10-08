import BasePlugin, { type Num } from '../BasePlugin'

import { consts, playerRooms, whitelist } from '@mammoth/shared/data'
import Errors from '@objects/user/Errors'
import { getFurnitureString } from '@objects/room/PlayerRoom'
import type User from '@objects/user/User'

const furnitureStringRegex = /^(\d+\|){4}\d+$/

export default class PlayerRoom extends BasePlugin {

    events = {
        gf: this.getFurnitureList,
        gr: this.getRoomList,
        af: this.addFurniture,
        ur: this.updateRoom,
        au: this.addUpgrade,
        or: this.openRoom,
        cr: this.closeRoom,
        gm: this.getRoom,
        um: this.updateMusic
    }

    getFurnitureList(user: User) {
        if (user.furniture.count) {
            user.send('gf', user.furniture)
        } else {
            user.send('gf')
        }
    }

    getRoomList(user: User) {
        user.send('gr', this.playerRooms.openRooms)
    }

    addFurniture(user: User, furnitureId: Num) {
        user.addFurniture(furnitureId)
    }

    async updateRoom(user: User, ...args: (number | string)[]) {
        if (!this.playerRooms.includes(user.id)) {
            return
        }

        const playerRoom = await this.playerRooms.get(user.id)
        const [_roomId, musicId]: (number | undefined)[] = args.filter(this.isNumber)

        if (musicId !== undefined) {
            await playerRoom.setMusic(musicId)
        }

        const furniture = this.parseFurniture(user, args)

        playerRoom.setFurniture(furniture)
    }

    async addUpgrade(user: User, roomId: Num) {
        if (!this.playerRooms.includes(user.id)) {
            return
        }

        if (!(roomId in playerRooms)) {
            user.sendError(Errors.ItemNotFound)
            return
        }

        if (consts.whitelistEnabled && !whitelist.playerRooms.includes(roomId)) {
            user.sendError(Errors.ItemNotFound)
            return
        }

        const cost = playerRooms[roomId].cost

        if (user.coins < cost) {
            user.sendError(Errors.InsufficientCoins)
            return
        }

        const playerRoom = await this.playerRooms.get(user.id)

        await playerRoom.setRoom(roomId)
        await user.update({ coins: user.coins - cost })

        user.send('au', roomId, user.coins)
    }

    openRoom(user: User) {
        this.playerRooms.openRoom(user)
    }

    closeRoom(user: User) {
        this.playerRooms.closeRoom(user)
    }

    async getRoom(user: User, userId: Num) {
        const room = await this.playerRooms.findRoom(userId)

        if (room) {
            const furniture = await this.playerRooms.findFurniture(userId)

            user.send('gm', userId, room.roomId, room.musicId, room.floorId, getFurnitureString(furniture))
        }
    }

    async updateMusic(user: User, musicId: Num) {
        if (this.playerRooms.includes(user.id)) {
            const playerRoom = await this.playerRooms.get(user.id)

            playerRoom.setMusic(musicId)
        }
    }

    parseFurniture(user: User, args: (number | string)[]) {
        const furniture = []
        const quantities: Record<number, number> = {}

        for (const arg of args) {
            if (!this.isFurnitureString(arg)) {
                continue
            }

            const [id, x, y, rotation, frame] = arg.split('|').map(i => parseInt(i))

            if (!user.furniture.includes(id)) {
                continue
            }

            quantities[id] = (quantities[id] || 0) + 1

            if (quantities[id] <= user.furniture.getQuantity(id)) {
                furniture.push({ userId: user.id, furnitureId: id, x, y, rotation, frame })
            }
        }

        return furniture
    }

    isNumber(value: number | string): value is number {
        return typeof value === 'number'
    }

    isFurnitureString(value: number | string): value is string {
        return typeof value === 'string' && furnitureStringRegex.test(value)
    }

}

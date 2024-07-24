import BasePlugin, { type Num } from '../BasePlugin'

import Database from '@Database'
import { handleOnce } from '@Decorators'
import type User from '@objects/user/User'

export default class Buddy extends BasePlugin {

    events = {
        bl: this.getBuddyList,
        go: this.getBuddyOnlineList,
        gp: this.getPlayer,
        bq: this.buddyRequest,
        ba: this.buddyAccept,
        bd: this.buddyDecline,
        bm: this.buddyMessage,
        br: this.buddyRemove
    }

    @handleOnce
    getBuddyList(user: User) {
        if (user.buddies.count) {
            user.send('gb', user.buddies)
        } else {
            user.send('gb')
        }
    }

    getBuddyOnlineList(user: User) {
        const online = user.buddies.keys.filter(buddyId => buddyId in this.usersById)

        user.send('go', ...online)
    }

    getPlayer(user: User, playerId: Num) {
        if (!(playerId in this.usersById)) return

        const player = this.usersById[playerId]

        if (player.room) {
            user.send('gp', player, player.room.id)
        } else {
            user.send('gp', player)
        }
    }

    buddyRequest(user: User, buddyId: Num) {
        if (!(buddyId in this.usersById)) return

        const buddy = this.usersById[buddyId]

        if (buddy.ignores.includes(user.id)) return

        buddy.addBuddyRequest(user.id, user.username)
    }

    async buddyAccept(user: User, buddyId: Num) {
        if (!user.buddyRequests.includes(buddyId)) return

        user.removeBuddyRequest(buddyId)
        user.addBuddy(buddyId)

        if (buddyId in this.usersById) {
            const buddy = this.usersById[buddyId]

            buddy.addBuddy(user.id)
            buddy.send('ba', user.id, user.username)

            return
        }

        await Database.buddy.create({
            data: {
                userId: buddyId,
                buddyId: user.id
            }
        })
    }

    buddyDecline(user: User, buddyId: Num) {
        if (!user.buddyRequests.includes(buddyId)) return

        user.removeBuddyRequest(user.id)

        if (!(buddyId in this.usersById)) return

        this.usersById[buddyId].send('bd', user.id, user.username)
    }

    buddyMessage(user: User, buddyId: Num, messageId: Num) {
        if (!(buddyId in this.usersById)) return

        this.usersById[buddyId].send('bm', user.id, user.username, messageId)
    }

    async buddyRemove(user: User, buddyId: Num) {
        if (!user.buddies.includes(buddyId)) return

        user.removeBuddy(buddyId)

        if (buddyId in this.usersById) {
            const buddy = this.usersById[buddyId]

            buddy.removeBuddy(user.id)
            buddy.send('br', user.id, user.username)

            return
        }

        await Database.buddy.delete({
            where: {
                userId_buddyId: {
                    userId: buddyId,
                    buddyId: user.id
                }
            }
        })
    }

}
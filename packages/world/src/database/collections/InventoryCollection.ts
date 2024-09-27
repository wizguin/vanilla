import BaseCollection from '../BaseCollection'

import { items, whitelist } from '@Data'
import Database from '@Database'
import Errors from '@objects/user/Errors'
import Logger from '@Logger'
import type User from '@objects/user/User'
import { whitelistEnabled } from '@Config'

import type { Inventory } from '@prisma/client'

export default class InventoryCollection extends BaseCollection<Inventory> {

    constructor(user: User, records: Inventory[]) {
        super(user, records, 'itemId')
    }

    collect(records: Inventory[]) {
        // Filter out items that don't exist
        const exists = records.filter(r => r.itemId in items)

        super.collect(exists)
    }

    async add(itemId: number) {
        if (this.includes(itemId)) {
            this.user.sendError(Errors.ItemOwned)
            return
        }

        if (!(itemId in items)) {
            this.user.sendError(Errors.ItemNotFound)
            return
        }

        if (whitelistEnabled && !whitelist.items.includes(itemId)) {
            this.user.sendError(Errors.ItemNotFound)
            return
        }

        const cost = items[itemId].cost

        if (this.user.coins < cost) {
            this.user.sendError(Errors.InsufficientCoins)
            return
        }

        try {
            const record = await Database.inventory.create({
                data: {
                    userId: this.user.id,
                    itemId: itemId
                }
            })

            this.updateCollection(record)

            await this.user.update({ coins: this.user.coins - cost })

            this.user.send('ai', itemId, this.user.coins)

        } catch (error) {
            Logger.error(error)
        }
    }

}
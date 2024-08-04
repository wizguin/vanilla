import BasePlugin, { type Num, type Str } from '../BasePlugin'

import { createPet } from '@collections/PetCollection'
import Database from '@Database'
import type PetObject from '@objects/pet/Pet'
import type { Updates } from '@objects/pet/Pet'
import type User from '@objects/user/User'

enum Interactions {
    Rest = 'r',
    Play = 'p',
    Feed = 'f',
    Treat = 't'
}

export default class Pet extends BasePlugin {

    events = {
        cw: this.checkWord,
        n: this.namePet,
        g: this.getPets,
        r: this.sendRest,
        p: this.sendPlay,
        f: this.sendFeed,
        t: this.sendTreat,
        s: this.sendPetFrame,
        m: this.sendMovePet
    }

    checkWord(user: User, word: Str) {
        const result = Number(user.pets.checkName(word))

        user.send('cw', word, result)
    }

    namePet(user: User, typeId: Num, name: Str) {
        user.addPet(typeId, name)
    }

    async getPets(user: User, userId: number) {
        let pets: PetObject[]

        if (userId in this.usersById) {
            pets = this.usersById[userId].pets.values

        } else {
            const records = await Database.pet.findMany({
                where: { userId: userId }
            })

            pets = records.map(record => createPet(record))
        }

        user.send('p', 'g', ...pets)
    }

    sendRest(user: User, petId: Num) {
        this.sendInteraction(user, petId, Interactions.Rest, {
            hunger: -10,
            rest: 200
        })
    }

    sendPlay(user: User, petId: Num) {
        this.sendInteraction(user, petId, Interactions.Play, {
            health: 200,
            hunger: -10,
            rest: -10
        })
    }

    sendFeed(user: User, petId: Num) {
        this.sendInteraction(user, petId, Interactions.Feed, {
            hunger: 200
        })

        user.update({ coins: user.coins - 10 })
    }

    sendTreat(user: User, petId: Num, treatId: Num) {
        this.sendInteraction(user, petId, Interactions.Treat, {
            health: -10
        }, treatId)

        user.update({ coins: user.coins - 5 })
    }

    sendPetFrame(user: User, petId: Num, frame: Num) {
        if (!user.room || !user.pets.includes(petId)) {
            return
        }

        user.sendRoom('p', 's', petId, frame)
    }

    sendMovePet(user: User, petId: Num, x: Num, y: Num) {
        if (!user.room || !user.pets.includes(petId)) {
            return
        }

        user.pets.get(petId).setPosition(x, y)

        user.sendRoom('p', 'm', petId, x, y)
    }

    sendInteraction(user: User, petId: number, type: Interactions, updates: Updates, ...args: (number | string)[]) {
        if (!user.room || !user.pets.includes(petId)) {
            return
        }

        const pet = user.pets.get(petId)

        pet.updateStats(updates)

        user.sendRoom('p', type, pet, ...args)
    }

}

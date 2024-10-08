import BasePlugin, { type Num } from '../BasePlugin'

import { handleOnce } from '@Decorators'
import { isVersion130 } from '@mammoth/shared/data'
import type User from '@objects/user/User'

const nl = isVersion130 ? 'gn' : 'nl'

export default class Ignore extends BasePlugin {

    events = {
        [nl]: this.getIgnoreList,
        an: this.addIgnore,
        rn: this.removeIgnore
    }

    @handleOnce
    getIgnoreList(user: User) {
        if (user.ignores.count) {
            user.send('gn', user.ignores)
        } else {
            user.send('gn')
        }
    }

    addIgnore(user: User, ignoreId: Num) {
        if (user.ignores.includes(ignoreId)) {
            return
        }

        user.addIgnore(ignoreId)
    }

    removeIgnore(user: User, ignoreId: Num) {
        if (!user.ignores.includes(ignoreId)) {
            return
        }

        user.removeIgnore(ignoreId)
    }

}

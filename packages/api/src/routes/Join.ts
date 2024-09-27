import { type Body, schema } from '../schema/JoinSchema'
import { checkUserExists, createUser } from '../user/User'
import { buildError } from '../response/Response'
import Errors from '../errors/Errors'
import Logger from '@Logger'

import type { FastifyInstance } from 'fastify'

export default async function(app: FastifyInstance) {
    app.post<{
        Body: Body

    }>('/join.php', async (request, reply) => {
        try {
            const { error, value } = schema.validate(request.body)

            if (error) {
                reply.send(buildError(Errors.InvalidUsername))
                return
            }

            const { Username, Email, Password, Colour, IsSafeMode, ParentPassword, ParentHint } = value

            if (await checkUserExists(Username)) {
                reply.send(buildError(Errors.InvalidUsername))
                return
            }

            await createUser({
                username: Username,
                email: Email,
                password: Password,
                color: Colour,
                safeMode: IsSafeMode,
                parentPassword: ParentPassword,
                parentHint: ParentHint
            })

            Logger.info(`New user created: ${Username}`)

            reply.send(buildError(0))

        } catch (error) {
            Logger.error(error)

            reply.callNotFound()
        }
    })
}
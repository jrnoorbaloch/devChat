/* eslint-disable sort-keys */
import {
  command,
  option,
  optional,
  string,
  number,
}                 from 'cmd-ts'

import {
  log,
}                 from 'wechaty-puppet'
import { WechatyToken as DevChatToken } from 'wechaty-token'
import getPort from 'get-port'

import {
  VERSION,
}                           from '../config.ts'
import {
  IoClient,
  type IoClientOptions,
}                           from '../io-client.ts'
import { DevChatBuilder }   from '../devchat-builder.ts'
import {
  isPuppetModuleName,
  OFFICIAL_PUPPET_DEPENDENCIES,
  OFFICIAL_PUPPET_DEFAULT,
}                           from '../puppet-config.ts'

async function onError (
  this : IoClient,
  e    : Error,
) {
  log.error('Gateway', 'Error: %s', e)
  await this.quit()
  process.exit(-1)
}

const gateway = command({
  name: 'gateway',
  description: 'Publish your DIY token as a DevChat Puppet Service. (you can generate a token by running `devchat token generate`)',
  args: {
    token: option({
      description: 'Specify a TOKEN for your DIY DevChat Puppet Service (WPS). It is the standard token service for TypeScript and Polyglot DevChat (like Python, Rust, Go, etc.). If it not specified, it will be generated automatically.',
      long: 'token',
      short: 't',
      type: optional(string),
    }),
    port: option({
      description: 'Specify a Port for your DIY DevChat Puppet Service (WPS). If it not specified, it will select a free port automatically. This port MUST be public accessiable via the internet.',
      long: 'port',
      short: 'p',
      type: optional(number),
    }),
    puppet: option({
      description: 'Specify a DevChat Puppet Provider (WPP). If it not specified, it will use the environment variable `DEVCHAT_PUPPET`.',
      long: 'puppet',
      short: 'P',
      type: optional(string),
    }),
    puppetToken: option({
      description: 'Specify the DevChat Puppet Provider TOKEN. If it not specified, it will use the environment variable `DEVCHAT_PUPPET_XXX_TOKEN` (`XXX` is your WPP name).',
      long: 'puppet-token',
      short: 'T',
      type: optional(string),
    }),
  },
  handler: async args => {
    log.info('Gateway', 'DevChat version %s', VERSION)

    let {
      token,
      port,
      puppet,
      puppetToken,
    } = args

    /**
     * Token
     */
    if (!token) {
      log.info('Gateway', 'no `--token` specified, generating random DevChat Puppet Service TOKEN ...')
      token = DevChatToken.generate('insecure')
    }
    log.info('Gateway', 'DevChat Puppet Service TOKEN: %s', token)

    /**
     * Puppet Service Server Port
     */
    if (!port) {
      log.info('Gateway', 'no `--port` specified, selecting random free DevChat Puppet Service Server Port ...')
      port = await getPort({
        port: 8788,
      })

    }
    log.info('Gateway', 'DevChat Puppet Service Server Port: %d', port)

    /**
     * Puppet Provider
     */
    if (!puppet) {
      log.info('Gateway', 'no `--puppet` specified, reading from environment variable `DEVCHAT_PUPPET` for DevChat Puppet Provider ...')
      puppet = process.env['DEVCHAT_PUPPET']
      if (!puppet) {
        log.info('Gateway', `environment variable "DEVCHAT_PUPPET" is not available. Using system default puppet "${OFFICIAL_PUPPET_DEFAULT}"`)
        puppet = OFFICIAL_PUPPET_DEFAULT
      }
    }
    if (!isPuppetModuleName(puppet)) {
      console.error(`The puppet name "${puppet}" is not a valid puppet name.`)
      console.error(`Valid puppet names are: ${Object.keys(OFFICIAL_PUPPET_DEPENDENCIES).join(', ')}`)
      return 1
    }
    log.info('Gateway', 'DevChat Puppet Provider: %s', puppet)

    /**
     * Puppet Token
     */
    if (!puppetToken) {
      log.info('Gateway', 'no `--puppet-token` specified, reading from environment variable `DEVCHAT_PUPPET_TOKEN` for your DevChat Puppet Provider ...')
      puppetToken = process.env['DEVCHAT_PUPPET_TOKEN']
      if (!puppetToken) {
        log.info('Gateway', 'DEVCHAT_PUPPET_TOKEN environment variable not available. Token disabled.')
      }
    }
    log.info('Gateway', 'DevChat Puppet Provider Token: %s', puppetToken ? `"${puppetToken}"` : 'disabled')

    const devchat = DevChatBuilder.build({
      name: 'Gateway',
      puppet,
      puppetOptions: {
        token: puppetToken,
      },
    })

    const options: IoClientOptions = {
      port,
      token,
      devchat,
    }

    const client = new IoClient(options)

    client.start()
      .catch(onError.bind(client))

    const devchatToken = new DevChatToken(token)
    let address
    while (true) {
      log.info('Gateway', 'Registering DevChat Puppet Token Gateway Service Discovery ...')
      await new Promise(resolve => setTimeout(resolve, 1000))
      address = await devchatToken.discover()
      if (address) {
        log.info('Gateway', 'Registering DevChat Puppet Token Gateway Service Discovery ... success')
        break
      }
      log.info('Gateway', 'Registering DevChat Puppet Token Gateway Service Discovery ... timeout')
    }

    console.info(`

    Your have successfully ran DevChat Token Gateway with the below settings:
      1. token: ${token}
      2. port: ${port}
      3. puppet: ${puppet}
      4. puppetToken: ${puppetToken || ''}

    The DevChat Puppet Token Gateway Service Address is ${address.host}:${address.port}, please make sure it can be public accessed via the internet.

    You can save the below command to restore the token gateway in future:

    $ devchat gateway --token ${token} --port ${port} --puppet ${puppet} --puppet-token ${puppetToken || ''}

    You can set the below environment variables for your DevChat program to use the DIY token provided by this gateway:
    __________________________________________________________________________
    $ export DEVCHAT_PUPPET=wechaty-puppet-service
    $ export DEVCHAT_PUPPET_SERVICE_TOKEN=${token}
    $ npm start

    Please file an issue if you found any bug or have feature request at https://github.com/jrnoorbaloch/devChat/issues
    Join the DevChat Community Gitter Channel at https://github.com/jrnoorbaloch/devChat/discussions if you have any questions.

    `)

    return 0
  },
})

export { gateway }

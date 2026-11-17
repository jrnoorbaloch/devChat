/* eslint-disable sort-keys */
import {
  command,
}                 from 'cmd-ts'

async function handler (_args: any) {
  console.info('this command can help you manage DevChat Puppet Provider (WPP).')
  console.info('Not implemented yet, please stay tuned and contribute is welcome!')
  console.info('GitHub repo(source code): https://github.com/jrnoorbaloch/devChat/blob/main/src/cli/puppet-provider.ts')
}

const provider = command({
  name: 'provider',
  description: 'Manage DevChat Puppet Provider (WPP)',
  args: {
  },
  handler,
})

export { provider }

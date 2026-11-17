/* eslint-disable sort-keys */
import {
  command,
}                 from 'cmd-ts'

async function handler (_args: any) {
  console.info('this command can help you manage DevChat Puppet Servivce (WPS).')
  console.info('Not implemented yet, please stay tuned and contribute is welcome!')
  console.info('GitHub repo(source code): https://github.com/jrnoorbaloch/devChat/blob/main/src/cli/puppet-service.ts')
}

const service = command({
  name: 'service',
  description: 'Manage DevChat Puppet Service (WPS)',
  args: {
  },
  handler,
})

export { service }

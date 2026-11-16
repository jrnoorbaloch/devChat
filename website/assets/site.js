// devChat docs – tiny progressive enhancements: mobile sidebar toggle and copy buttons.
(() => {
  const btn = document.querySelector('.menu')
  const side = document.getElementById('sidebar')
  if (btn && side) {
    btn.addEventListener('click', () => {
      const open = side.classList.toggle('open')
      btn.setAttribute('aria-expanded', String(open))
    })
  } else if (btn) {
    // Home page has no sidebar: the menu button jumps to the docs instead.
    btn.addEventListener('click', () => { location.href = '/getting-started' })
  }

  for (const pre of document.querySelectorAll('pre')) {
    const b = document.createElement('button')
    b.className = 'copy'
    b.type = 'button'
    b.textContent = 'copy'
    b.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(pre.querySelector('code')?.innerText ?? pre.innerText)
        b.textContent = 'copied'
      } catch {
        b.textContent = 'press ctrl+c'
      }
      setTimeout(() => { b.textContent = 'copy' }, 1500)
    })
    pre.appendChild(b)
  }
})()

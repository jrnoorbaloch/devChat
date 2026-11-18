/**
 *   devChat - https://github.com/jrnoorbaloch/devChat
 *
 *   Licensed under the Apache License, Version 2.0.
 *   See the LICENSE and NOTICE files in the project root.
 */

/**
 * Render a login QR code as an SVG string, entirely on this computer.
 *
 * Why it exists: the local dashboard (`dashboard.ts`) shows the WhatsApp /
 * WeChat login QR code. The QR value is a short-lived login secret, so it is
 * drawn locally instead of being sent to any web service, and as inline SVG
 * so the dashboard needs no client-side library or asset files.
 *
 * Boundaries: reuses the QR encoder bundled in `qrcode-terminal` (already a
 * runtime dependency for terminal QR codes) through its CommonJS vendor path.
 * Pure function: text in, SVG markup out.
 */
import { createRequire } from 'node:module'

interface QRCodeModel {
  addData (data: string): void
  make (): void
  getModuleCount (): number
  isDark (row: number, col: number): boolean
}

const require = createRequire(import.meta.url)
const QRCode = require('qrcode-terminal/vendor/QRCode') as new (type: number, level: number) => QRCodeModel
const QRErrorCorrectLevel = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel') as { L: number, M: number }

/**
 * Encode `text` as a QR code and return square SVG markup about `sizePx`
 * wide (rounded so every module is a whole number of pixels).
 *
 * Uses error-correction level L like the terminal renderer (login payloads
 * are long; L keeps the code scannable at screen size) and a 4-module quiet
 * zone, which phone scanners need. Dark modules are merged per row into
 * runs, so a WhatsApp code becomes a few hundred `<rect>`s, not thousands.
 *
 * @throws Error when `text` is empty.
 */
export function qrToSvg (text: string, sizePx = 320): string {
  if (!text) {
    throw new Error('qrToSvg: text must not be empty')
  }
  const qr = new QRCode(-1, QRErrorCorrectLevel.L)
  qr.addData(text)
  qr.make()

  const count = qr.getModuleCount()
  const quiet = 4
  const total = count + quiet * 2
  const rects: string[] = []
  for (let row = 0; row < count; row++) {
    let start = -1
    for (let col = 0; col <= count; col++) {
      const dark = col < count && qr.isDark(row, col)
      if (dark && start < 0) {
        start = col
      } else if (!dark && start >= 0) {
        rects.push(`<rect x="${start + quiet}" y="${row + quiet}" width="${col - start}" height="1"/>`)
        start = -1
      }
    }
  }
  // Whole pixels per module: fractional module sizes blur the edges on 1x
  // screens and make phone cameras (and decoders) miss the code.
  const scale = Math.max(3, Math.round(sizePx / total))
  const px = total * scale
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${px}" height="${px}" shape-rendering="crispEdges" role="img" aria-label="Login QR code">`
    + `<rect width="${total}" height="${total}" fill="#fff"/><g fill="#000">${rects.join('')}</g></svg>`
}

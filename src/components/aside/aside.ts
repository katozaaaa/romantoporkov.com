import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface AsideOptions {
  root: HTMLElement
}

export default class Aside {
  root: HTMLElement

  constructor(options: AsideOptions) {
    const { root } = options
    if (!(root instanceof HTMLElement)) {
      throw new Error('No root element found')
    }
    this.root = root
    this._initPin()
  }

  _initPin() {
    ScrollTrigger.create({
      trigger: this.root,
      pin: true,
      start: 'top top',
      endTrigger: this.root.parentElement,
      end: 'bottom bottom'
    })
  }
}

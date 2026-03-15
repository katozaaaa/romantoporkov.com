import { gsap } from 'gsap'

type ModalWidth = number | string

interface ModalOptions {
  root: HTMLElement,
  width?: ModalWidth | (() => ModalWidth),
}

export default class Modal {
  _root: HTMLElement
  _width?: ModalWidth | (() => ModalWidth)
  _animation: gsap.core.Tween

  constructor(options: ModalOptions) {
    const { root, width } = options
    if (!(root instanceof HTMLElement)) {
      throw new Error('No root element found')
    }
    this._root = root

    if (width) {
      this._width = width

      if (typeof this._width !== 'function') {
        const width = this._width
        this._root.style.width = typeof width === 'string' ? width : `${width}px`
      }
    }

    this._handleOutsideClick = this._handleOutsideClick.bind(this)
    this._animation = this._setUpAnimation()
    this._initCloseButton()
  }

  open() {
    if (this._width !== undefined && typeof this._width === 'function') {
      const width = this._width()
      this._root.style.width = typeof width === 'string' ? width : `${width}px`
    }

    this.toggle(true)
  }

  close() {
    this.toggle(false)
  }

  toggle(force: boolean) {
    if (force) {
      this._animation.play()
    } else {
      this._animation.reverse()
    }
  }

  setHeaderMinHeight(minHeight: number) {
    const header = this._root.querySelector('.js-modal-header')
    if (header instanceof HTMLElement) {
      header.style.minHeight = minHeight + 'px'
    }
  }

  setBodyInnerTopOffset(topOffset: number) {
    const body = this._root.querySelector('.js-modal-body')
    if (body instanceof HTMLElement) {
      body.style.paddingTop = topOffset + 'px'
    }
  }

  _setUpAnimation() {
    return gsap.fromTo(
      this._root,
      {
        clipPath: 'polygon(100% 0%, 100% 0%, 100% 100%, 100% 100%)'
      },
      {
        duration: 0.3,
        clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
        paused: true,
        onStart: () => {
          this._root.classList.add('open')
          document.addEventListener('click', this._handleOutsideClick)
        },
        onReverseComplete: () => {
          this._root.classList.remove('open')
          document.removeEventListener('click', this._handleOutsideClick)
        }
      }
    )
  }

  _handleOutsideClick(e: MouseEvent) {
    if (e.target instanceof Element && !this._root.contains(e.target)) {
      this.close()
    }
  }

  _initCloseButton() {
    const closeButton = this._root.querySelector('.js-close-button')
    if (closeButton) {
      closeButton.addEventListener('click', this.close.bind(this))
    }
  }
}

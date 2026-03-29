import '@/main'
import UnderlinedText from '@components/underlinedText/underlinedText'
import Header from '@components/header/header'
import Footer from '@components/footer/footer'
import Aside from '@components/aside/aside'
import Modal from '@components/modal/modal'
import Form from '@components/form/form'
import { pxToRem, toRemLength } from '@scripts/utils/units'

interface PageOptions {
  root?: HTMLElement
}

export default class Page {
  _root: HTMLElement
  _header?: Header
  _footer?: Footer
  _aside?: Aside
  _contactModal?: Modal
  _contactForm?: Form

  constructor(options: PageOptions) {
    const { root } = options
    if (!(root instanceof HTMLElement)) {
      throw new Error('No root element found')
    }
    this._root = root
    this._updateModalElementsSize = this._updateModalElementsSize.bind(this)
    this._initHeader()
    this._initFooter()
    this._initAside()
    this._initContactModal()
    this._initContactForm()
    this._initUnderlinedText()
  }

  _initHeader() {
    const header = this._root.querySelector('.js-header')
    if (header instanceof HTMLElement) {
      this._header = new Header({ root: header })
    }
  }

  _initFooter() {
    const footer = this._root.querySelector('.js-footer')
    if (footer instanceof HTMLElement) {
      this._footer = new Footer({ root: footer })
    }
  }

  _initAside() {
    const aside = this._root.querySelector('.js-aside')
    if (aside instanceof HTMLElement) {
      this._aside = new Aside({ root: aside })
    }
  }

  _initContactModal() {
    const contactModal = this._root.querySelector('.js-contact-modal')

    if (!(contactModal instanceof HTMLElement)) {
      return
    }

    const modal = new Modal({
      root: contactModal,
      width: () => {
        // rem value is used in media queries, so we need to calculate it based on the current viewport width
        const isMobile = window.innerWidth <= 47.9375 * 16

        if (isMobile) {
          return '100vw'
        }

        const main = this._root.querySelector('.js-page-main')
        const pageContainer = this._root.querySelector('.js-page-container')

        let width: string | undefined = undefined
        if (
          main instanceof HTMLElement &&
          pageContainer instanceof HTMLElement
        ) {
          const rootWidth = this._root.clientWidth
          const containerWidth = pageContainer.clientWidth
          const containerComputedStyles = window.getComputedStyle(pageContainer)
          const containerRowGap =
            containerComputedStyles.getPropertyValue('row-gap')
          const containerRightPadding =
            containerComputedStyles.getPropertyValue('padding-right')

          console.log('rootWidth', rootWidth)

          width = `calc(
            ${pxToRem(main.clientWidth)} + 
            ${toRemLength(containerRightPadding)} +
            ${toRemLength(containerRowGap)} +
            ${`(${pxToRem(rootWidth)} - ${pxToRem(containerWidth)}) / 2`}
          )`
        }

        return width !== undefined ? width : '100%'
      }
    })

    this._contactModal = modal

    if (this._footer) {
      this._footer.initContactButton(modal.open.bind(modal))
    }

    this._updateModalElementsSizeWhenStylesIsLoaded()
    this._initResizeListener()
  }

  _updateModalElementsSizeWhenStylesIsLoaded() {
    // The loadStyles event is generated when styles are inserted in the head
    if (process.env.NODE_ENV === 'development') {
      document.addEventListener('loadStyles', this._updateModalElementsSize)
    } else {
      this._updateModalElementsSize()
    }
  }

  _initResizeListener() {
    window.addEventListener('resize', this._updateModalElementsSize.bind(this))
  }

  _updateModalElementsSize() {
    try {
      if (!this._contactModal) {
        return
      }
      const headerHeight = this._header?.height
      if (headerHeight) {
        this._contactModal.setHeaderMinHeight(headerHeight)
      }
    } catch (error) {
      console.error(error)
    }
  }

  _initContactForm() {
    const contactForm = this._root.querySelector('.js-contact-form')
    if (!(contactForm instanceof HTMLElement)) {
      return
    }
    this._contactForm = new Form({
      root: contactForm,
      inputConfigs: {
        name: {
          validatingCallback: (value) => {
            return /^[a-zA-Zа-яА-ЯёЁ\s\-']{2,50}$/.test(value)
          }
        },
        email: {
          validatingCallback: (value) => {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
          }
        },
        subject: {
          validatingCallback: () => {
            return true
          }
        }
      },
      onSubmit: () => {
        console.log('Sending form')
      }
    })
  }

  _initUnderlinedText() {
    this._root.querySelectorAll('.js-underlined-text').forEach((element) => {
      if (element instanceof HTMLElement) {
        new UnderlinedText({ root: element })
      }
    })
  }
}

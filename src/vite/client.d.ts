
declare module '*?vik' {
  const meta: {
    name: string
    src: string
    srcset: string
    webp: string
    avif: string
    width: number
    height: number
    placeholder: string
    blurhash: string
    thumbhash: string
    [key: string]: string | number
  }
  export default meta
}

declare module '*?thumbhash' {
  const hash: string
  export default hash
}

declare module '*?blurhash' {
  const hash: string
  export default hash
}

declare module '*?placeholder' {
  const props: {
    blurhash?: string
    thumbhash?: string
    placeholderColor?: string
    width?: number
    height?: number
  }
  export default props
}

declare module '*?placeholder=thumbhash' {
  const props: {
    thumbhash?: string
    placeholderColor?: string
    width?: number
    height?: number
  }
  export default props
}

declare module '*?placeholder=color' {
  const props: {
    placeholderColor?: string
    width?: number
    height?: number
  }
  export default props
}

declare module '*?placeholder=blurhash' {
  const props: {
    blurhash?: string
    placeholderColor?: string
    width?: number
    height?: number
  }
  export default props
}

declare module '*?color' {
  const color: string
  export default color
}

declare module '*?size' {
  const size: { width: number; height: number }
  export default size
}

declare module '*?preview' {
  const preview: string
  export default preview
}

declare module '*?aspect' {
  const aspect: number
  export default aspect
}

declare module 'virtual:vue-image-kit/placeholders' {
  const placeholders: Record<
    string,
    { blurhash?: string; thumbhash?: string; color?: string; width?: number; height?: number }
  >
  export default placeholders
}

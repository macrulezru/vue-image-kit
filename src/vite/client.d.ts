
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

export interface ImageInfo {
  src: string
  alt: string
}

export function extractImagesFromMarkdown(content: string): ImageInfo[] {
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  return Array.from(content.matchAll(imgRegex), match => ({
    src: match[2] ?? '',
    alt: match[1] ?? '',
  }))
}

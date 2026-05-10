'use client'

import { Image } from '@unpic/react'
import Zoom from 'react-medium-image-zoom'

const remoteImagePattern = /^https?:\/\//

const contentImageOperations = {
  wsrv: {
    fit: 'inside',
    q: 82,
    we: true,
  },
} as const

interface ImageZoomProps {
  src: string
  alt?: string
  index: number
}

export function ImageZoom({ src, alt, index }: ImageZoomProps) {
  const resolvedAlt = alt || `第 ${index + 1} 张图片`
  const isRemoteImage = remoteImagePattern.test(src)

  return (
    <div className="relative my-6 w-full max-w-full rounded-lg shadow-md">
      <Zoom
        a11yNameButtonZoom="放大图片"
        a11yNameButtonUnzoom="缩小图片"
        zoomMargin={24}
      >
        <Image
          src={src}
          alt={resolvedAlt}
          layout="constrained"
          width={1200}
          height={800}
          fallback={isRemoteImage ? 'wsrv' : undefined}
          operations={contentImageOperations}
          objectFit="contain"
          className="h-auto w-full rounded-lg object-contain"
          priority={index === 0}
        />
      </Zoom>
    </div>
  )
}

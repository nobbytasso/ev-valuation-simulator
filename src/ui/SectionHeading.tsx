/**
 * セクション見出し+英字キャプション併記(§6.3)。DOM構造は両テーマ共通、
 * スタイル(等幅小サイズ大文字シアン/小さな欧文ピンク系)はトークン(--caption-*)で切替える。
 */
import type { ReactNode } from 'react'
import { SECTION_CAPTIONS } from './sectionCaptions.ts'
import type { SectionCaptionKey } from './sectionCaptions.ts'

export interface SectionHeadingProps {
  captionKey: SectionCaptionKey
  children: ReactNode
  level?: 1 | 2 | 3
}

export function SectionHeading({ captionKey, children, level = 2 }: SectionHeadingProps) {
  const Tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3'
  return (
    <Tag className="section-heading">
      {children}
      <span className="section-heading__caption-en">{SECTION_CAPTIONS[captionKey]}</span>
    </Tag>
  )
}

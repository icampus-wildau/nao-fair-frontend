<script lang="ts">
import { defineComponent, h, type VNodeChild } from 'vue'
import { markdownLanguage } from '@codemirror/lang-markdown'
import type { SyntaxNode } from '@lezer/common'

export default defineComponent({
  props: { text: { type: String, required: true } },
  setup(props) {
    return () => {
      const text = props.text
      const slice = (node: SyntaxNode) => text.slice(node.from, node.to)
      const tags: Record<string, string> = { Document: 'div', Paragraph: 'p', Emphasis: 'em', StrongEmphasis: 'strong', InlineCode: 'code', Blockquote: 'blockquote', BulletList: 'ul', OrderedList: 'ol', ListItem: 'li' }
      const markers = new Set(['HeaderMark', 'EmphasisMark', 'CodeMark', 'ListMark', 'QuoteMark', 'LinkMark', 'URL', 'LinkTitle'])
      function children(node: SyntaxNode): VNodeChild[] {
        const result: VNodeChild[] = []
        let position = node.from
        for (let child = node.firstChild; child; child = child.nextSibling) {
          if (child.from > position) result.push(text.slice(position, child.from))
          if (!markers.has(child.name)) result.push(render(child))
          position = child.to
        }
        if (position < node.to) result.push(text.slice(position, node.to))
        return result
      }
      function safeHref(raw: string): string | undefined {
        try { const url = new URL(raw, location.origin); return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : undefined } catch { return undefined }
      }
      function render(node: SyntaxNode): VNodeChild {
        if (node.name === 'FencedCode' || node.name === 'CodeBlock') {
          const code: string[] = []
          for (let child = node.firstChild; child; child = child.nextSibling) if (child.name === 'CodeText') code.push(slice(child))
          return h('pre', h('code', code.length ? code.join('\n') : slice(node)))
        }
        if (node.name === 'Link') {
          const url = node.getChild('URL')
          const href = url ? safeHref(slice(url)) : undefined
          return h(href ? 'a' : 'span', href ? { href, target: '_blank', rel: 'noopener noreferrer' } : {}, children(node))
        }
        if (node.name === 'Autolink') { const raw = slice(node).replace(/^<|>$/gu, ''); return h('a', { href: safeHref(raw), target: '_blank', rel: 'noopener noreferrer' }, raw) }
        if (node.name === 'Image') return h('span', { class: 'markdown-image-alt' }, children(node))
        if (node.name === 'HorizontalRule') return h('hr')
        if (node.name === 'HardBreak') return h('br')
        const heading = /^(?:ATX|Setext)Heading([1-6])$/u.exec(node.name)
        if (heading) return h(`h${heading[1]}`, children(node))
        if (tags[node.name]) return h(tags[node.name]!, children(node))
        // Raw HTML remains escaped text, never DOM markup.
        return slice(node)
      }
      return h('div', { class: 'markdown-document' }, [render(markdownLanguage.parser.parse(text).topNode)])
    }
  },
})
</script>

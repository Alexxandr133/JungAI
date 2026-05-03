import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import './platform-update-md.css';

type Props = { source: string; className?: string };

/**
 * Текст обновления хранится как Markdown. Старые записи без разметки отображаются как обычный текст.
 */
export function PlatformUpdateBody({ source, className }: Props) {
  return (
    <div className={['platform-update-md', className].filter(Boolean).join(' ')}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

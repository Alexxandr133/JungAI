import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { AiMarkdownTable } from './AiMarkdownTable';
import '../pages/psychologist/AIChatMarkdown.css';

type Props = {
  content: string;
  className?: string;
};

export function AiAssistantMarkdown({ content, className }: Props) {
  return (
    <div className={className ? `ai-md ${className}` : 'ai-md'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          table: ({ children, ...props }) => (
            <AiMarkdownTable {...props}>{children}</AiMarkdownTable>
          ),
          th: ({ children, ...props }) => (
            <th {...props}>{children}</th>
          ),
          td: ({ children, ...props }) => (
            <td {...props}>{children}</td>
          ),
          pre: ({ children, ...props }) => (
            <pre {...props}>{children}</pre>
          ),
          code: ({ children, ...props }) => (
            <code {...props}>{children}</code>
          ),
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  );
}

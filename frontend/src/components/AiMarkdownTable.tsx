import { useRef } from 'react';
import type { ReactNode } from 'react';
import { Download } from 'lucide-react';
import { downloadTableFromElement } from '../lib/tableExport';

type Props = {
  children?: ReactNode;
};

export function AiMarkdownTable({ children, ...props }: Props & React.TableHTMLAttributes<HTMLTableElement>) {
  const tableRef = useRef<HTMLTableElement>(null);

  return (
    <div className="ai-md-table">
      <div className="ai-md-table__toolbar">
        <span className="ai-md-table__label">Таблица</span>
        <div className="ai-md-table__actions">
          <button
            type="button"
            className="ai-md-table__btn"
            title="Скачать CSV"
            onClick={() => downloadTableFromElement(tableRef.current, 'csv')}
          >
            <Download size={14} aria-hidden />
            CSV
          </button>
          <button
            type="button"
            className="ai-md-table__btn"
            title="Скачать Excel"
            onClick={() => downloadTableFromElement(tableRef.current, 'xlsx')}
          >
            <Download size={14} aria-hidden />
            XLSX
          </button>
        </div>
      </div>
      <div className="ai-md-table__scroll">
        <table ref={tableRef} {...props}>
          {children}
        </table>
      </div>
    </div>
  );
}

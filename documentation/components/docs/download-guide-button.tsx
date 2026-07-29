import { Download } from 'lucide-react';

export function DownloadGuideButton({ compact = false }: { compact?: boolean }) {
  return (
    <a
      className={`docs-download${compact ? ' docs-download-compact' : ''}`}
      href="/downloads/vizzio-full-guide.pdf"
      download
      aria-label="Download the full VIZZIO documentation guide as a PDF"
    >
      <Download aria-hidden="true" size={16} />
      <span>Download full guide</span>
    </a>
  );
}

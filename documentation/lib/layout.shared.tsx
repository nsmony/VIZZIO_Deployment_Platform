import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { DownloadGuideButton } from '@/components/docs/download-guide-button';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="vizzio-nav-brand">
          <span className="vizzio-mark" aria-hidden="true">VZ</span>
          <span>VIZZIO Documentation</span>
        </span>
      ),
      url: '/docs',
      children: <DownloadGuideButton compact />,
    },
  };
}

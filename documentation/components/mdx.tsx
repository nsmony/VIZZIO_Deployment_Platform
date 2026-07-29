import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { FeaturedCard } from './docs/featured-card';
import { SectionCard } from './docs/section-card';
import { GettingStartedPanel } from './docs/getting-started-panel';
import { DownloadGuideButton } from './docs/download-guide-button';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    FeaturedCard,
    SectionCard,
    GettingStartedPanel,
    DownloadGuideButton,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}

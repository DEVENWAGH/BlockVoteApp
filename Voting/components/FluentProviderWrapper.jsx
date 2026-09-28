'use client';

import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';
import { useEffect, useState } from 'react';

/**
 * Fluent UI provider for admin and guardian consoles.
 * Syncs with ThemeToggle's `dark` class on documentElement.
 */
export default function FluentProviderWrapper({ children }) {
  const [theme, setTheme] = useState(webLightTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const root = document.documentElement;
    const sync = () => {
      setTheme(root.classList.contains('dark') ? webDarkTheme : webLightTheme);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  if (!mounted) {
    return <div style={{ minHeight: '100%' }} suppressHydrationWarning>{children}</div>;
  }

  return (
    <FluentProvider theme={theme} style={{ minHeight: '100%' }} suppressHydrationWarning>
      {children}
    </FluentProvider>
  );
}

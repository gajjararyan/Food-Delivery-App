import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/** Web-only root document — aligns with React Native Web root setup. */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: '100%', width: '100%' }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: globalCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const globalCss = `
*, *::before, *::after {
  box-sizing: border-box;
}

html,
body,
#root {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  overflow: hidden;
  background-color: #fff8f5;
}

#root {
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  max-width: 100vw;
  min-height: 100%;
  margin: 0 auto;
  background-color: #fff8f5;
}

/* Phone-width shell centered on wide screens — no contrasting side panels */
@media (min-width: 520px) {
  #root {
    max-width: 480px;
    box-shadow: 0 0 32px rgba(30, 27, 24, 0.12);
  }
}

/* Hide scrollbars (keep scrolling) — avoids a thin “sidebar” on web */
* {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

*::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
  display: none !important;
  background: transparent;
}
`;

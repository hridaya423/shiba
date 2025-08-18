import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
        <link rel="shortcut icon" href="/favicon-32x32.png" />
        
        {/* Meta description and social sharing */}
        <meta name="description" content="Make a game, build an arcade in Tokyo Japan from November 5th - 12th." />
        <meta property="og:title" content="Shiba Arcade" />
        <meta property="og:description" content="Make a game, build an arcade in Tokyo Japan from November 5th - 12th." />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/bg.gif" />
        <meta property="og:image:type" content="image/gif" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Shiba Arcade" />
        <meta name="twitter:description" content="Make a game, build an arcade in Tokyo Japan from November 5th - 12th." />
        <meta name="twitter:image" content="/bg.gif" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

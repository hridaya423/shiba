import Head from "next/head";

export default function AppHead({ title = "Shiba Arcade" }) {
  return (
    <Head>
      <title>{title}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="icon" href="/favicon.ico" />
      
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
      
      {/* Preload commonly used audio to reduce first-play latency */}
      <link rel="preload" as="audio" href="/next.mp3" />
      <link rel="preload" as="audio" href="/prev.mp3" />
      <link rel="preload" as="audio" href="/shiba-bark.mp3" />
      <link rel="preload" as="audio" href="/MyGames.mp3" />
      <link rel="preload" as="audio" href="/Global.mp3" />
      <link rel="preload" as="audio" href="/Shop.mp3" />
      <link rel="preload" as="audio" href="/Help.mp3" />
      <link rel="preload" as="audio" href="/WelcomeToShibaArcade.mp3" />
    </Head>
  );
}



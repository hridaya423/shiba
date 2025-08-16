import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import GameCard from "@/components/GameCard";

export default function GameCarousel({ games, onSelect, playSound, playClip, setAppOpen, stopAll, selectedIndex: controlledIndex }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const numGames = games?.length ?? 0;

  const [viewportRef, embla] = useEmblaCarousel({
    loop: true,
    align: "center",
    slidesToScroll: 1,
  });

  // Audio is provided by parent via preloaded manager

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        playSound?.("next.mp3");
        if (embla) embla.scrollNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        playSound?.("prev.mp3");
        if (embla) embla.scrollPrev();
      } else if (event.key === "Enter") {
        event.preventDefault();
        const activeName = games?.[selectedIndex]?.name;
        if (activeName) {
          // Stop any currently playing audio (SFX or clip) before opening
          try { stopAll?.(); } catch (_) {}
          setAppOpen?.(activeName);
        }
      }
    },
    [embla, playSound, setAppOpen, games, selectedIndex]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  useEffect(() => {
    if (typeof controlledIndex === "number" && embla) {
      embla.scrollTo(controlledIndex);
    }
  }, [controlledIndex, embla]);

  useEffect(() => {
    if (!embla) return undefined;
    const onSelectInternal = () => {
      const idx = embla.selectedScrollSnap();
      setSelectedIndex(idx);
      if (onSelect) onSelect(idx);
      const clip = games?.[idx]?.gameClipAudio;
      if (clip) {
        playClip?.(clip);
      }
    };
    embla.on("select", onSelectInternal);
    onSelectInternal();
    return () => {
      embla.off("select", onSelectInternal);
    };
  }, [embla, onSelect, games, playClip]);

  const leftNeighborIndex = (selectedIndex - 1 + numGames) % numGames;
  const rightNeighborIndex = (selectedIndex + 1) % numGames;

  const getCardStyle = useCallback(
    (idx) => {
      const isActive = idx === selectedIndex;
      const isNeighbor = idx === leftNeighborIndex || idx === rightNeighborIndex;
      if (isActive) {
        return {
          opacity: 1,
          transform: "scale(1.0) perspective(600px) rotateY(0deg)",
          zIndex: 2,
        };
      }
      if (isNeighbor) {
        const rotateY = idx === leftNeighborIndex ? 10 : -10;
        return {
          opacity: 0.7,
          transform: `scale(0.65) perspective(600px) rotateY(${rotateY}deg)`,
          zIndex: 1,
        };
      }
      return {
        opacity: 0,
        transform: "scale(0.5) perspective(600px) rotateY(0deg)",
        zIndex: 0,
      };
    },
    [selectedIndex, leftNeighborIndex, rightNeighborIndex]
  );

  return (
    <>
      <div style={{ display: "flex", width: "100%", justifyContent: "center", alignItems: "center" }}>
        <div ref={viewportRef} style={{ overflow: "hidden", width: "90vw", maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {games.map((game, idx) => {
              const isActive = idx === selectedIndex;
              return (
                <div
                  key={game.name}
                  style={{ flex: "0 0 33.3333%", display: "flex", justifyContent: "center", alignItems: "center", padding: "2vw" }}
                >
                  <div
                    role={isActive ? "button" : "presentation"}
                    tabIndex={isActive ? 0 : -1}
                    aria-label={isActive ? `Open ${game.name}` : undefined}
                    aria-disabled={!isActive}
                    onClick={isActive ? () => { try { stopAll?.(); } catch (_) {} setAppOpen?.(game.name); } : undefined}
                    onKeyDown={isActive ? (e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        try { stopAll?.(); } catch (_) {}
                        setAppOpen?.(game.name);
                      }
                    } : undefined}
                    style={{ width: "100%", cursor: isActive ? "pointer" : "default", pointerEvents: isActive ? "auto" : "none" }}
                  >
                    <GameCard game={game} style={getCardStyle(idx)} isFocused={isActive} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}



import React, { useEffect } from "react";
import ShopItemRenderer from "./utils/ShopItemRenderer";
import useAudioManager from "./useAudioManager";

export default function ShopComponent({ profile }) {
  const { play: playSound, stopAll } = useAudioManager(["mysteryShopMusic.mp3"]);

  // Play shop music when component mounts
  useEffect(() => {
    playSound("mysteryShopMusic.mp3");
    
    // Stop music when component unmounts
    return () => {
      stopAll();
    };
  }, [playSound, stopAll]);

  // Sample shop items - you can replace these with real data
  const shopItems = [
    {
      image: "/comingSoon.png",
      itemName: "??",
      price: "0"
    },
    {
      image: "/comingSoon.png", 
      itemName: "??",
      price: "0"
    },
    {
      image: "/comingSoon.png",
      itemName: "??",
      price: "0"
    },
    {
      image: "/comingSoon.png",
      itemName: "??",
      price: "0"
    },
    {
      image: "/comingSoon.png",
      itemName: "??",
      price: "0"
    },
    {
      image: "/comingSoon.png",
      itemName: "??",
      price: "0"
    }
  ];

  return (
    <div style={{
      backgroundColor: "rgb(214, 255, 214)", // Updated background color
      minHeight: "100vh",
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      <div style={{
        width: "1000px",
        maxWidth: "100%"
      }}>
        <div style={{
          border: "2px dotted #2d5a27",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "20px",
          backgroundColor: "#fffacd" // Pastel yellow background
        }}>
          <p style={{
            fontSize: "18px",
            fontWeight: "600",
            textAlign: "center",
            margin: "0",
            color: "#2d5a27"
          }}>
            The Shiba Shop will launch at Shiba Direct on August 22nd.
          </p>
        </div>
        
        
        <div style={{ 
          textAlign: "center", 
          marginBottom: 30, 
          color: "#2d5a27",
          maxWidth: 600,
          margin: "0 auto 30px auto",
          lineHeight: 1.6
        }}>
          <p style={{ marginBottom: 16, fontSize: 16 }}>
            You currently have <strong>{profile?.sssBalance || 0} SSS</strong>.
          </p>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            gap: "8px", 
            marginBottom: "16px" 
          }}>
            <span style={{ fontSize: "16px", fontWeight: "600" }}>SSS =</span>
            <img
              src="/SSS.png"
              alt="SSS Currency"
              style={{
                width: "24px",
                height: "24px",
                objectFit: "contain"
              }}
            />
          </div>
          <p style={{ marginBottom: 16, textAlign: "left", fontSize: 14, opacity: 0.9 }}>
            You'll earn SSS from people playing your game and giving it a score. The maximum someone can give you is 25/25, which would result in 25 SSS from a single play of your game. They'll rate your game 1-5 on a scale of: Fun, Art, Creativity, Audio, and Mood.
          </p>
          <p style={{ textAlign: "left", fontSize: 14, opacity: 0.9 }}>
            People will play your game if you playtest other people's games. You'll earn playtest tickets by shipping your game (uploading a demo of your current working version) and getting approved for hours spent making your game (time logged in Hackatime).
          </p>
        </div>
        
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "20px"
        }}>
          {shopItems.map((item, index) => (
            <ShopItemRenderer
              key={index}
              image={item.image}
              itemName={item.itemName}
              price={item.price}
            />
          ))}
        </div>
      </div>
    </div>
  );
}



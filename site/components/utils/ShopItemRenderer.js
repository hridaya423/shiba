import React, { useState } from "react";

export default function ShopItemRenderer({ 
  image, 
  itemName, 
  price, 
  inStock = 0, 
  userBalance = 0,
  onBuyClick 
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const priceNumber = parseInt(price) || 0;
  const stockNumber = parseInt(inStock) || 0;
  const balanceNumber = parseInt(userBalance) || 0;
  
  const hasEnoughBalance = balanceNumber >= priceNumber;
  const hasStock = stockNumber > 0;
  const isDisabled = !hasEnoughBalance || !hasStock;
  
  const getTooltipText = () => {
    if (!hasStock) {
      return "Out of stock";
    }
    if (!hasEnoughBalance) {
      return `Insufficient balance. You need ${priceNumber - balanceNumber} more SSS`;
    }
    return "";
  };

  const getButtonText = () => {
    if (!hasStock) {
      return "Out of Stock";
    }
    return "Buy";
  };

  const handleBuyClick = () => {
    if (!isDisabled && onBuyClick) {
      onBuyClick();
    }
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      padding: "16px",
      border: "1px solid #ddd",
      backgroundColor: "#fff",
      position: "relative"
    }}>
      <img
        src={image}
        alt={itemName}
        style={{
          width: "100%",
          height: "240px",
          objectFit: "cover",
          marginBottom: "12px"
        }}
      />
      <p style={{
        margin: "0 0 8px 0",
        fontSize: "16px",
        fontWeight: "600",
        textAlign: "left"
      }}>
        {itemName}
      </p>
      
      {/* Price and Buy button row */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%"
      }}>
        {/* Price section */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <p style={{
            margin: "0",
            fontSize: "18px",
            fontWeight: "bold",
            color: "#2d5a27"
          }}>
            {price}
          </p>
          <img
            src="/SSS.png"
            alt="SSS Currency"
            style={{
              width: "20px",
              height: "20px",
              objectFit: "contain"
            }}
          />
        </div>
        
        {/* Buy button */}
        <div style={{ position: "relative" }}>
          <button
            onClick={handleBuyClick}
            disabled={isDisabled}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            style={{
              padding: "8px 16px",
              backgroundColor: isDisabled ? "#ccc" : "#2d5a27",
              color: isDisabled ? "#666" : "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: isDisabled ? "not-allowed" : "pointer",
              transition: "background-color 0.2s ease",
              minWidth: "60px"
            }}
            onMouseOver={(e) => {
              if (!isDisabled) {
                e.target.style.backgroundColor = "#1e3d1e";
              }
            }}
            onMouseOut={(e) => {
              if (!isDisabled) {
                e.target.style.backgroundColor = "#2d5a27";
              }
            }}
          >
            {getButtonText()}
          </button>
          
          {/* Tooltip */}
          {showTooltip && isDisabled && (
            <div style={{
              position: "absolute",
              bottom: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              backgroundColor: "#333",
              color: "white",
              padding: "8px 12px",
              borderRadius: "4px",
              fontSize: "12px",
              whiteSpace: "nowrap",
              zIndex: 1000,
              marginBottom: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
            }}>
              {getTooltipText()}
              <div style={{
                position: "absolute",
                top: "100%",
                left: "50%",
                transform: "translateX(-50%)",
                width: "0",
                height: "0",
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "6px solid #333"
              }}></div>
            </div>
          )}
        </div>
      </div>
      

    </div>
  );
}

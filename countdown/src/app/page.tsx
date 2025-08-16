'use client';

import { useState, useEffect } from 'react';

export default function CountdownPage() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const target = new Date();
      
      // Set target to next Monday at 4:30 PM PST
      const daysUntilMonday = (8 - now.getDay()) % 7; // 0 = Sunday, 1 = Monday, etc.
      target.setDate(now.getDate() + daysUntilMonday);
      target.setHours(16, 30, 0, 0); // 4:30 PM
      
      // If it's already past Monday 4:30 PM, target next Monday
      if (now.getDay() === 1 && now.getHours() >= 16 && now.getMinutes() >= 30) {
        target.setDate(target.getDate() + 7);
      }
      
      const difference = target.getTime() - now.getTime();
      
      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        setTimeLeft({ days, hours, minutes, seconds });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      
      <img src="/image.png" style={{width: "301px"}} />
      <div className="text-white text-9xl font-mono">
        {timeLeft.days}:{timeLeft.hours.toString().padStart(2, '0')}:{timeLeft.minutes.toString().padStart(2, '0')}:{timeLeft.seconds.toString().padStart(2, '0')}
      </div>
    </div>
  );
}

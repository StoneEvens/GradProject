import React, { useRef, useEffect } from 'react';
import defaultIdle from '../../assets/TestNPC/idle.gif';

export default function Battlefield({ opponent = null, loopInterval = 900 }) {
  const imgRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    // clear any previously-created interval immediately
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // when dying, set the die GIF once and don't force restarts
    if (opponent.isDying) {
      img.src = opponent.src;
      return undefined; // no interval while die animation plays
    }

    // Periodically reset the image src with a cache-busting query so the GIF restarts.
    intervalRef.current = setInterval(() => {
      img.src = `${opponent.src}?_=${Date.now()}`;
    }, loopInterval);

    // also set the current src immediately
    img.src = opponent.src;

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [loopInterval, opponent]);

return (
    <div
        id="battlefield"
        className="battlefield center-muted"
        style={{
            backgroundImage: 'url("../../assets/backgrounds/background1.png")',
            backgroundSize: '180%', // Zoom to fit the height
            backgroundPosition: 'center bottom', // Center-bottom alignment
            backgroundRepeat: 'no-repeat', // Prevent tiling
        }}
    >
        <div className="npc-wrap" style={{ '--npc-scale': 2.5 }}>
            <img ref={imgRef} src={opponent.src} alt={opponent ? opponent.name : 'NPC'} className="npc-idle" />
        </div>
    </div>
);
}

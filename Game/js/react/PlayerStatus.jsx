import React, { useState } from 'react';
import PlayerTooltip from './PlayerTooltip';

export default function PlayerStatus({ name = 'Player', maxHealth = 100, currentHealth = 100, avatar = 'YOU', attack = 10, defend = 5, isFalling = false }) {
  const [hover, setHover] = useState(false);
  const pct = Math.max(0, Math.min(100, (currentHealth / maxHealth) * 100));
  const avatarClass = ['avatar', 'status-avatar'];
  if (isFalling) avatarClass.push('fall');
  return (
    <div className="stats-bar player-stats-bar">
      <div className="stats-row">
        <div
          className={avatarClass.join(' ')}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          {avatar}
          {hover && (
            <div className="player-tooltip-wrap">
              <PlayerTooltip name={name} maxHealth={maxHealth} currentHealth={currentHealth} attack={attack} defend={defend} />
            </div>
          )}
        </div>
        <p className="health-text">💗: <span id="player-health-text">{Math.round(currentHealth)}</span>/{maxHealth}</p>
      </div>
      <div className="health-bar">
        <div id="player-health" className="health-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

import React from 'react';

export default function OpponentStatus({ name = 'NPC', maxHealth = 100, currentHealth = 100 }) {
  const pct = Math.max(0, Math.min(100, (currentHealth / maxHealth) * 100));
  return (
    <div className="stats-bar opponent-stats-bar">
      <div className="stats-row">
        <h2 className="health-label">{name}</h2>
        <p className="health-text">🖤: <span id="npc-health-text">{Math.round(currentHealth)}</span>/{maxHealth}</p>
      </div>
      <div className="health-bar">
        <div id="npc-health" className="health-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

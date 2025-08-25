import React from 'react';

export default function PlayerTooltip({ name, maxHealth, currentHealth, attack, defend }) {
  return (
    <div className="player-tooltip">
      <div className="pt-row"><strong>{name}</strong></div>
      <div className="pt-row">HP: {Math.round(currentHealth)} / {maxHealth}</div>
      <div className="pt-row">Attack: {attack}</div>
      <div className="pt-row">Defend: {defend}</div>
    </div>
  );
}

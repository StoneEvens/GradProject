import React, { useEffect, useState, useCallback } from 'react';
import OpponentStatus from './OpponentStatus.jsx';
import PlayerStatus from './PlayerStatus.jsx';
import QA from './QA.jsx';
import Battlefield from './Battlefield.jsx';
import GameEngine from '../../js/gameEngine';

const QUESTIONS = [
  { q: 'What is the capital of France?', choices: ['Paris','London','Berlin','Madrid'], answer: 0 },
  { q: 'Which planet is known as the Red Planet?', choices: ['Venus','Mars','Jupiter','Saturn'], answer: 1 },
  { q: 'What is 2 + 2?', choices: ['3','4','5','6'], answer: 1 }
];

export default function App() {
  const [engine] = useState(() => new GameEngine(QUESTIONS));
  const [engineState, setEngineState] = useState(engine.getState());

  useEffect(() => {
    const unsub = engine.subscribe(setEngineState);
    // ensure initial snapshot
    setEngineState(engine.getState());
    return unsub;
  }, [engine]);

  const handleAnswer = useCallback((choiceIdx) => engine.handleAnswer(choiceIdx), [engine]);

  const isFalling = !!engineState.player.isDying;
  const isShocked = !!engineState.player.isHurt;
  return (
    <div id="game-container" className={isShocked ? 'wiggle' : ''}>
      <div id="opponent-status-bar" className={isShocked ? 'wiggle' : ''}><OpponentStatus name={engineState.opponent.name} maxHealth={engineState.opponent.maxHealth} currentHealth={engineState.opponent.currentHealth} /></div>
      <div id="battlefield" className={isShocked ? 'wiggle' : ''}> <Battlefield opponent={engineState.opponent} /> </div>
      <div id="player-status-bar" className={isFalling ? 'fall' : (isShocked ? 'wiggle' : '')}><PlayerStatus name={engineState.player.name} maxHealth={engineState.player.maxHealth} currentHealth={engineState.player.currentHealth} avatar={engineState.player.avatar} isFalling={isFalling} /></div>
      <div id="qa-section" className={isShocked ? 'wiggle' : ''}><QA question={QUESTIONS[engineState.qIndex].q} choices={QUESTIONS[engineState.qIndex].choices} onAnswer={handleAnswer} canAnswer={engineState.canAnswer} selected={engineState.selected} isFalling={isFalling} /></div>
    </div>
  );
}

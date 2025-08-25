import Player from './playerClass';
import NPC from './npcClass';
import defaultIdle from '../assets/TestNPC/idle.gif';
import defaultHurt from '../assets/TestNPC/hurt.gif';
import defaultDie from '../assets/TestNPC/die.gif';

class GameEngine {
  constructor(questions = [], opts = {}) {
    this.questions = questions.slice();
    this.player = new Player({ name: opts.playerName || 'You', maxHealth: opts.playerMax || 100, avatar: opts.playerAvatar || 'YOU' });
    // accept both new 'opponent' keys and legacy 'npc' keys for compatibility
    this.opponent = new NPC({ name: opts.opponentName || opts.npcName || '高級惡魔史萊姆', maxHealth: opts.opponentMax || opts.npcMax || 100 });
    // set opponent sprite defaults (player sprite handled elsewhere or not needed)
    this.opponent.idleSrc = opts.opponentIdle || opts.npcIdle || defaultIdle;
    this.opponent.hurtSrc = opts.opponentHurt || opts.npcHurt || defaultHurt;
    this.opponent.dieSrc = opts.opponentDie || opts.npcDie || defaultDie;

    this.qIndex = 0;
    this.canAnswer = true;
    this.selected = null;
    this.subscribers = new Set();
    this.correctDamage = opts.correctDamage || 20;
    this.incorrectDamage = opts.incorrectDamage || 15;
    // duration to wait for die animation (ms)
    this.dieDuration = opts.dieDuration || 3000;
    // transient player state (kept at engine level since Player is data-only)
    this.playerIsHurt = false;
    this.playerIsDying = false;
  }

  subscribe(fn) { this.subscribers.add(fn); return () => this.subscribers.delete(fn); }

  notify() { const snapshot = this.getState(); this.subscribers.forEach(s => s(snapshot)); }

  getState() {
    const playerClone = this.player.clone();
    // attach transient flags for UI compatibility
    playerClone.isHurt = !!this.playerIsHurt;
    playerClone.isDying = !!this.playerIsDying;
    return {
      player: playerClone,
      opponent: this.opponent.clone(),
      qIndex: this.qIndex,
      canAnswer: this.canAnswer,
      selected: this.selected,
    };
  }

  reset() {
    this.player = new Player({ name: 'You', maxHealth: 100, avatar: 'YOU' });
  // opponent should be an NPC so sprite sources and transient flags persist
  this.opponent = new NPC({ name: '高級惡魔史萊姆', maxHealth: 100 });
  // player sprite sources intentionally not set here (playerClass is data-only)
    this.opponent.idleSrc = defaultIdle;
    this.opponent.hurtSrc = defaultHurt;
    this.opponent.dieSrc = defaultDie;
    this.qIndex = 0;
    this.canAnswer = true;
    this.selected = null;
    this.notify();
  }

  handleAnswer(choiceIdx) {
  // ignore input when an entity is currently dying to avoid interrupting the die animation
  if (this.opponent && this.opponent.isDying) return;
  if (this.playerIsDying) return;

  if (!this.canAnswer) return;
    this.canAnswer = false;
    const correct = this.questions[this.qIndex].answer === choiceIdx;
    this.selected = { index: choiceIdx, correct };

    if (correct) {
      this.opponent.takeDamage(this.correctDamage);
      if (!this.opponent.isAlive) {
        // lethal hit: skip transient 'hurt' and go straight to dying animation
        this.opponent.isDying = true;
        this.notify();
        const dieDuration = this.dieDuration;
        console.debug('[GameEngine] opponent died (lethal) — starting die timer', { dieDuration });
        setTimeout(() => {
          console.debug('[GameEngine] die timer fired for opponent');
          this.opponent.isDying = false;
          this.notify();
          console.debug('[GameEngine] about to alert victory');
          alert('Victory! You defeated the NPC!');
          this.reset();
        }, dieDuration);
        return;
      }
      // non-lethal: mark hurt for UI and clear shortly after
      this.opponent.isHurt = true;
      this.notify();
      setTimeout(() => { this.opponent.isHurt = false; this.notify(); }, 700);
    } else {
      this.player.takeDamage(this.incorrectDamage);
      if (!this.player.isAlive) {
        // lethal hit to player: go straight to dying animation
        this.playerIsDying = true;
        this.notify();
        const dieDuration = this.dieDuration;
        console.debug('[GameEngine] player died (lethal) — starting die timer', { dieDuration });
        setTimeout(() => {
          console.debug('[GameEngine] die timer fired for player');
          this.playerIsDying = false;
          this.notify();
          console.debug('[GameEngine] about to alert game over');
          alert('Game Over! The NPC has defeated you!');
          this.reset();
        }, dieDuration);
        return;
      }
      // non-lethal: mark hurt for UI and clear shortly after (engine-level flag)
      this.playerIsHurt = true;
      this.notify();
      setTimeout(() => { this.playerIsHurt = false; this.notify(); }, 700);
    }

    // advance question after a short delay and re-enable answering
    this.notify();
    setTimeout(() => {
      this.qIndex = (this.qIndex + 1) % this.questions.length;
      this.selected = null;
      this.canAnswer = true;
      this.notify();
    }, 900);
  }
}

export default GameEngine;

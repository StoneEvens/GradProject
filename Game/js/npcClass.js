class NPC {
  constructor({ name = 'NPC', maxHealth = 100, currentHealth = null, avatar = '' } = {}) {
    this._name = name;
    this._maxHealth = maxHealth;
    this._currentHealth = currentHealth == null ? maxHealth : currentHealth;
    // sprite sources for different states
    this._idleSrc = null;
    this._hurtSrc = null;
    this._dieSrc = null;
    // transient state used by UI (not authoritative game data)
    this._isHurt = false;
    this._isDying = false;
  }

  // getters / setters
  get name() { return this._name; }
  set name(v) { this._name = String(v); }

  get maxHealth() { return this._maxHealth; }
  set maxHealth(v) {
    this._maxHealth = Number(v) || 0;
    if (this._currentHealth > this._maxHealth) this._currentHealth = this._maxHealth;
  }

  get currentHealth() { return this._currentHealth; }
  set currentHealth(v) {
    const n = Number(v) || 0;
    this._currentHealth = Math.max(0, Math.min(n, this._maxHealth));
  }

  get idleSrc() { return this._idleSrc; }
  set idleSrc(v) { this._idleSrc = v; }

  get hurtSrc() { return this._hurtSrc; }
  set hurtSrc(v) { this._hurtSrc = v; }

  get dieSrc() { return this._dieSrc; }
  set dieSrc(v) { this._dieSrc = v; }

  get isHurt() { return !!this._isHurt; }
  set isHurt(v) { this._isHurt = !!v; }

  get isDying() { return !!this._isDying; }
  set isDying(v) { this._isDying = !!v; }

  // unified current source priority: die -> hurt -> idle (falls back to empty string)
  get src() {
    if (this._isDying && this._dieSrc) return this._dieSrc;
    if (this._isHurt && this._hurtSrc) return this._hurtSrc;
    return this._idleSrc || '';
  }

  takeDamage(amount) {
    this.currentHealth = this.currentHealth - (Number(amount) || 0);
    return this.currentHealth;
  }

  heal(amount) {
    this.currentHealth = this.currentHealth + (Number(amount) || 0);
    return this.currentHealth;
  }

  get isAlive() { return this.currentHealth > 0; }

  clone() {
    const p = new NPC({ name: this._name, maxHealth: this._maxHealth, currentHealth: this._currentHealth, avatar: this._avatar });
    p.idleSrc = this._idleSrc;
    p.hurtSrc = this._hurtSrc;
    p.dieSrc = this._dieSrc;
    p.isHurt = this._isHurt;
    p.isDying = this._isDying;
    return p;
  }
}

export default NPC;

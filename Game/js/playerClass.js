class Player {
  constructor({ name = 'Player', maxHealth = 100, currentHealth = null, avatar = '', attack = 10, defend = 5 } = {}) {
    this._name = name;
    this._maxHealth = maxHealth;
    this._currentHealth = currentHealth == null ? maxHealth : currentHealth;
    this._avatar = avatar;
    // simple stats
    this._attack = Number(attack) || 0;
    this._defend = Number(defend) || 0;
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

  get avatar() { return this._avatar; }
  set avatar(v) { this._avatar = v; }

  get attack() { return this._attack; }
  set attack(v) { this._attack = Number(v) || 0; }

  get defend() { return this._defend; }
  set defend(v) { this._defend = Number(v) || 0; }

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
    const p = new Player({ name: this._name, maxHealth: this._maxHealth, currentHealth: this._currentHealth, avatar: this._avatar, attack: this._attack, defend: this._defend });
    // ensure explicit core fields are assigned
    p.avatar = this._avatar;
    p.attack = this._attack;
    p.defend = this._defend;
    return p;
  }
}

export default Player;

function loadSprite(path){const img=new Image();img.src=path;return img;}

/** engine.js - Core game loop and globals **/
window.Indy = window.Indy || {};
(() => {
  const G = Indy;
  G.canvas = document.getElementById('game');
  G.ctx = G.canvas.getContext('2d');
  G.w = G.canvas.width;
  G.h = G.canvas.height;

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const now = ()=>performance.now();

  function makeRNG(seed=(Math.random()*2**31)|0){
    let s = seed || 123456789;
    return ()=>{ s ^= s<<13; s ^= s>>>17; s ^= s<<5; return ((s>>>0)/0xffffffff); };
  }

  G.util = { clamp, now, makeRNG };

  // Difficulty manager (continuous scaling)
  class DifficultyManager{
    constructor(){ this.level = 0; this.t = 0; }
    tick(dt){
      // grow over time but slower as it increases; soft cap
      this.t += dt;
      const inc = 0.02 * dt * (1/(1+this.level*0.35));
      this.level = Math.min(10, this.level + inc);
      // small boost if player is cruising (high hp and coins climbing fast)
      const p = G.state.player; if (p && p.hp>0.85*p.hpMax) this.level = Math.min(10, this.level + 0.008*dt);
    }
  }
  G.diff = new DifficultyManager();


  // Core state
  G.state = {
    rng: makeRNG(0x1ED15),
    last: 0,
    paused: false,
    player: null, enemies: [], projectiles: [], effects: [], particles: [], turrets: [],
    economy: null, loot: null, spawner: null, input: null, ui: null, save: null, world: null
  };

  G.loop = function loop(t){
    const S = G.state;
    if (S.paused) return;
    const dt = Math.min(0.05, (t - S.last)/1000);
    S.last = t;

    S.economy.tick(dt);
    G.diff.tick(dt);
    if (S.player.specialReadyIn > 0) S.player.specialReadyIn = Math.max(0, S.player.specialReadyIn - dt);

    S.spawner.tick(dt);
    if (S.input && S.input.update) S.input.update(dt);
    for (let p of S.particles) p.tick(dt);
    for (let e of S.enemies) e.tick(dt);
    for (let b of S.projectiles) b.tick(dt);
    for (let fx of S.effects) fx.tick(dt);

    for (let t of S.turrets) t.tick(dt);
    S.particles = S.particles.filter(x=>x.alive);
    S.enemies = S.enemies.filter(x=>!x.dead);
    S.projectiles = S.projectiles.filter(x=>x.alive);
    S.effects = S.effects.filter(x=>x.alive);

    G.world.draw(G.ctx);
    for (let p of S.particles) p.draw(G.ctx);
    for (let t of S.turrets) t.draw(G.ctx);
    for (let e of S.enemies) e.draw(G.ctx);
    for (let b of S.projectiles) b.draw(G.ctx);
    for (let fx of S.effects) fx.draw(G.ctx);
    G.world.drawHUD(G.ctx);

    G.ui.updateHUD();

    if (S.player.hp <= 0){
      G.ui.toast('Du døde! Nulstil eller indlæs gem.');
      S.paused = true;
    } else {
      requestAnimationFrame(G.loop);
    }
  };
})();

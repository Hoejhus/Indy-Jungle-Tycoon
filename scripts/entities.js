
// === SPRITE LOADING FOR ENTITIES ===
const heroSprites = {
    idle: loadSprite('assets/Chacter with outline/idle.png')
};
const enemySprites = {
    idle: loadSprite('assets/Character/idle.png')
};

function drawSprite(ctx, sprite, x, y, w, h){
    ctx.drawImage(sprite, x, y, w, h);
}


/** entities.js - Player, enemies, projectiles, effects **/
(() => {
  const G = Indy;
  const S = G.state;
  const rng = S.rng;
  const { clamp, now } = G.util;

  class Player{
    constructor(){
      this.coins = 0; this.coinMult=1; this.cps=0;
      this.hpMax=200; this.hp=200; this.armor=1;
      this.damage=24; this.range=520; this.fireRate=2.4;
      this.critChance=6; this.critMult=2.0;
      this.specialCD=12; this.specialReadyIn=0; this.autoFire=false; this.autoFireRate=1.5; this.autoDamageMult=0.6; this.lastAutoShotAt=-1; this.abilities={knockback:0, explosion:0, poisonDPS:0, poisonDur:0};
      this.lastShotAt=-1;
    }
    addCoins(n){ this.coins += Math.floor(n); }
    canShoot(t){ if(this.lastShotAt<0) return true; return ((t-this.lastShotAt)/1000) >= (1/this.fireRate); }
    shoot(t){ this.lastShotAt=t; }
    takeDamage(d){ const m=Math.max(0,d-this.armor); this.hp = clamp(this.hp - m, 0, this.hpMax); }
    heal(n){ this.hp = clamp(this.hp+n, 0, this.hpMax); }
  }

  class Economy{
    constructor(p){
      this.p=p; this.chestCost=50; this.chestOpens=0;
      this.costs = {
        damage:100, range:100, firerate:100,
        buy_turret:300, turret_dmg:200, turret_rate:200, turret_range:200, turret_synergy:250
      };
      this.multipliers = {
        damage:1.2, range:1.2, firerate:1.25,
        buy_turret:1.35, turret_dmg:1.22, turret_rate:1.22, turret_range:1.22, turret_synergy:1.25
      };
    }
    tick(dt){ this.p.addCoins(this.p.cps*dt); this.p.heal(0.6*dt); }
    purchase(cost){ if(this.p.coins>=cost){ this.p.coins-=cost; return true; } return false; }
    getCost(key){
      const c = this.costs[key]; return Math.floor(c ?? 0);
    }
    onBought(key){
      if (this.costs[key]!=null){
        this.costs[key] *= (this.multipliers[key] ?? 1.2);
      }
    }
    nextChestCost(){ return Math.floor(this.chestCost); }
    chestBought(){ this.chestOpens++; this.chestCost *= 1.15; }
  }

  class LootSystem{
    constructor(p){ this.p=p; this.sinceBetter=0; }
    table = [
      {k:'hpMax',lbl:'Maks HP', min:5,max:20, apply:v=>{this.p.hpMax+=v; this.p.hp+=v;}},
      {k:'armor',lbl:'Armor', min:1,max:3, apply:v=>this.p.armor+=v},
      {k:'damage',lbl:'Skade', min:2,max:8, apply:v=>this.p.damage+=v},
      {k:'range',lbl:'Rækkevidde', min:12,max:44, apply:v=>this.p.range+=v},
      {k:'cps',lbl:'CPS', min:.6,max:3.5, apply:v=>this.p.cps+=v},
      {k:'firerate',lbl:'Skudhast.', min:.12,max:.36, apply:v=>this.p.fireRate+=v},
      {k:'crit',lbl:'Crit %', min:1,max:3, apply:v=>this.p.critChance = Math.min(100,this.p.critChance+v)},
      {k:'specialCD',lbl:'Special CD', min:-2,max:-.5, apply:v=>this.p.specialCD=Math.max(3,this.p.specialCD+v)},
{k:'knock',lbl:'Knockback', min:20,max:60, apply:v=>this.p.abilities.knockback=Math.max(this.p.abilities.knockback, v)},
{k:'explosion',lbl:'Eksplosion Radius', min:60,max:140, apply:v=>this.p.abilities.explosion=Math.max(this.p.abilities.explosion, v)},
{k:'poison',lbl:'Poison DPS', min:1.2,max:4.0, apply:v=>{ this.p.abilities.poisonDPS += v; this.p.abilities.poisonDur = Math.max(this.p.abilities.poisonDur, 2 + v*0.6); }},
    ];
    rarities = [
      {name:'Common', w:75, class:null, mult:1.0},
      {name:'Rare', w:18, class:'rare', mult:1.5},
      {name:'Epic', w:6,  class:'epic', mult:2.25},
      {name:'Legend', w:1, class:'legend', mult:3.5},
    ];
    pickRarity(){
      const total = this.rarities.reduce((a,r)=>a+r.w,0);
      let r = rng()*total, acc=0, chosen=this.rarities[0];
      for (let x of this.rarities){ acc+=x.w; if (r<=acc) { chosen=x; break; } }
      this.sinceBetter++;
      if (this.sinceBetter>=15 && chosen.name==='Common') chosen=this.rarities[1];
      if (chosen.name!=='Common') this.sinceBetter=0;
      return chosen;
    }
    between(a,b){ return a + (b-a)*rng(); }
    open(){
      const rar = this.pickRarity();
      const item = this.table[(rng()*this.table.length)|0];
      const val = this.between(item.min,item.max)*rar.mult;
      item.apply(val);
      return {rarity:rar, item, value:Number(val.toFixed(2))};
    }
  }

  
  
  class Enemy{
    constructor(hp,speed,y,type='grunt'){
      this.x = G.w + 50; this.y = y;
      this.hp = hp; this.maxhp = hp; this.speed = speed;
      this.r = 18; this.dead=false; this.bob = Math.random()*Math.PI*2;
      this.spawnT = 0; this.type = type;
      // status
      this.vx = 0; // knockback velocity (+ pushes right)
      this.poisonT = 0; this.poisonDPS = 0;
    }
    applyPoison(dps, dur){
      // stack by refreshing duration and taking higher dps
      this.poisonDPS = Math.max(this.poisonDPS, dps);
      this.poisonT = Math.max(this.poisonT, dur);
    }
    tick(dt){
      this.spawnT += dt;
      // Forward motion + any knockback velocity
      this.x -= this.speed*dt;
      if (this.vx !== 0){
        this.x += this.vx*dt;
        // friction
        this.vx *= Math.max(0, 1 - 3*dt);
        if (Math.abs(this.vx) < 2) this.vx = 0;
      }
      this.y += Math.sin(performance.now()/300 + this.bob)*.2;
      // poison
      if (this.poisonT > 0){
        this.poisonT -= dt;
        this.hp -= this.poisonDPS * dt;
        if ((performance.now()%200)<16){ G.state.effects.push(new PoisonPuff(this.x, this.y)); }
      }
      if (this.x < 110){
        G.state.player.takeDamage(2);
        this.dead = true;
        G.state.effects.push(new HitEffect(this.x,this.y,'base'));
      }
    }
    hit(d){
      this.hp -= d;
      G.state.effects.push(new HitEffect(this.x,this.y,'hit'));
      if (this.hp<=0){
        this.dead=true;
        const baseCoin = 8;
        const typeMult = this.type==='runner'?0.8:this.type==='tank'?1.6:this.type==='elite'?2.2:this.type==='pharaoh'?4:1;
        const coins = (baseCoin*typeMult) * G.state.player.coinMult;
        G.state.player.addCoins(coins);
        G.state.effects.push(new FloatingText(this.x, this.y-24, `+${coins|0}💰`));
        for(let i=0;i<10;i++) G.state.effects.push(new Poof(this.x,this.y));
        // removed level kill hook (continuous difficulty)
      }
    }
    draw(ctx){
      ctx.save();
      ctx.translate(this.x,this.y);
      const alpha = Math.min(1, this.spawnT/0.3);
      ctx.globalAlpha = alpha;

      let body = '#c2b48a';
      if (this.type==='runner') body='#a8d8a8';
      else if (this.type==='tank') body='#c29b8a';
      else if (this.type==='elite') body='#b2a5ff';
      else if (this.type==='pharaoh') body='#e6b800';

      // poison aura
      if (this.poisonT>0){
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle='#3bbf3b';
        ctx.beginPath(); ctx.arc(0,0,this.r+6,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }

      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(0,0,this.r,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.fillRect(-6,-3,12,6);
      ctx.fillStyle = '#f00'; ctx.fillRect(-3,-1,3,2); ctx.fillRect(1,-1,3,2);

      // hp bar
      ctx.globalAlpha = 1;
      const ratio = Math.max(0, this.hp/this.maxhp);
      // background bar
      ctx.fillStyle='#000'; ctx.fillRect(-24,-34,48,7);
      // gradient fill
      const g=ctx.createLinearGradient(-24,-34,24,-34);
      g.addColorStop(0,'#9cff9c'); g.addColorStop(1,'#2ad12a');
      ctx.fillStyle=g; ctx.fillRect(-24,-34,48*ratio,7);
      // border
      ctx.strokeStyle='#202'; ctx.lineWidth=1; ctx.strokeRect(-24,-34,48,7);
      ctx.restore();
    }
  }

  
  
  class Projectile{
    constructor(x,y,vx,vy,range,base,critPct,critMult, abilitiesOverride=null, abilityScale=1){
      this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.alive=true;
      this.life=0; this.maxLife = Math.max(.1, range/Math.hypot(vx,vy));
      this.base=base; this.critPct=critPct; this.critMult=critMult;
      this.abilities = abilitiesOverride || G.state.player.abilities;
      this.abilityScale = abilityScale;
    }
    tick(dt){
      this.x+=this.vx*dt; this.y+=this.vy*dt; this.life+=dt;
      if (this.life>=this.maxLife) this.alive=false;
      if (this.x<-50||this.x>G.w+50||this.y<-50||this.y>G.h+50) this.alive=false;
      for (let e of G.state.enemies){
        if (e.dead) continue;
        const dx=this.x-e.x, dy=this.y-e.y;
        if (dx*dx+dy*dy <= (e.r*e.r)){
          const isCrit = (Math.random()*100)<this.critPct;
          const dmg = this.base * (isCrit?this.critMult:1);
          e.hit(dmg);
          G.state.effects.push(new FloatingText(e.x, e.y, `${dmg|0}`, isCrit));
          // abilities (scaled)
          const ab = this.abilities;
          const scale = this.abilityScale;
          if (ab.knockback>0){ e.vx += ab.knockback*scale; }
          if (ab.poisonDPS>0){ e.applyPoison(ab.poisonDPS*scale, Math.max(1, (ab.poisonDur||2)*scale)); }
          if (ab.explosion>0){
            G.state.effects.push(new ExplosionFX(e.x, e.y));
            const rad = ab.explosion*scale;
            for (let o of G.state.enemies){
              if (o===e || o.dead) continue;
              const dx2=o.x-e.x, dy2=o.y-e.y;
              if (dx2*dx2+dy2*dy2 <= rad*rad){
                o.hit(dmg*0.65);
                if (ab.poisonDPS>0) o.applyPoison(ab.poisonDPS*0.6*scale, Math.max(1, (ab.poisonDur||2)*0.6*scale));
                if (ab.knockback>0) o.vx += ab.knockback*0.5*scale;
              }
            }
          }
          this.alive=false; break;
        }
      }
    }
    draw(ctx){
      ctx.save();
      ctx.translate(this.x,this.y);
      // glow
      ctx.globalAlpha = .85;
      ctx.fillStyle='#ffd27a';
      ctx.beginPath(); ctx.arc(0,0,3.2,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = .25;
      ctx.beginPath(); ctx.arc(0,0,7,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  class FloatingText{
    constructor(x,y,t,crit=false){ this.x=x; this.y=y-18; this.t=t; this.life=0; this.alive=true; this.crit=crit; }
    tick(dt){ this.y-=34*dt; this.life+=dt; if(this.life>1) this.alive=false; }
    draw(ctx){
      ctx.save();
      ctx.globalAlpha=1-this.life;
      ctx.fillStyle= this.crit ? '#ffd27a' : '#fff';
      ctx.font= this.crit ? 'bold 18px sans-serif' : '16px sans-serif';
      ctx.fillText(this.t, this.x-12, this.y);
      if (this.crit){
        ctx.fillText('POW!', this.x-10, this.y-14);
      }
      ctx.restore();
    }
  }
  class HitEffect{
    constructor(x,y,type){ this.x=x; this.y=y; this.life=0; this.alive=true; this.type=type; }
    tick(dt){ this.life+=dt; if(this.life>.25) this.alive=false; }
    draw(ctx){
      const r = 8 + 40*this.life;
      const ctx2 = G.ctx;
      ctx2.save();
      ctx2.globalAlpha = 1 - this.life;
      ctx2.strokeStyle = this.type==='base' ? '#f00' : '#fff';
      ctx2.beginPath(); ctx2.arc(this.x,this.y,r,0,Math.PI*2); ctx2.stroke();
      ctx2.restore();
    }
  }
  
  class Poof{
    constructor(x,y){ this.x=x; this.y=y; this.life=0; this.alive=true; this.dir=(rng()*Math.PI*2); this.spd=60+60*rng(); }
    tick(dt){ this.life+=dt; if(this.life>.5) this.alive=false; this.x+=Math.cos(this.dir)*this.spd*dt; this.y+=Math.sin(this.dir)*this.spd*dt; }
    draw(ctx){ ctx.save(); ctx.globalAlpha=1-this.life*2; ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(this.x,this.y,3+6*(1-this.life),0,Math.PI*2); ctx.fill(); ctx.restore(); }
  }


  
  
  
  class Spawner{
    constructor(){
      this.t=0; this.next=1.0;
    }
    getPlayerDPS(){
      const p = Indy.state.player;
      const crit = 1 + (p.critChance/100)*(p.critMult-1);
      return p.damage * p.fireRate * crit;
    }
    tick(dt){
      this.t+=dt; this.next-=dt;
      if (this.next<=0){
        this.spawn();
      }
    }
    spawn(){
      const diff = Indy.diff.level; // grows smoothly over time
      const dps = Math.max(1, this.getPlayerDPS());
      // Base HP scales softly with diff
      const baseHP = Math.max(14, dps * 1.0) * (1 + diff*0.08);
      const baseSpd = 26 * (1 + diff*0.02);
      // pick enemy type biased by diff
      const type = this.pickType(diff);
      const m = this.classMods(type);
      const hp = baseHP * m.hp;
      const spd = baseSpd * m.spd;
      const y = Indy.world.baseY + (Indy.state.rng()*40 - 20);
      Indy.state.enemies.push(new Enemy(hp, spd, y, type));
      // cadence: depends on diff and player DPS. Also add "grace" if low HP.
      const grace = (Indy.state.player.hp/Indy.state.player.hpMax) < 0.35 ? 1.6 : 1.0;
      const base = 0.6 + (30 / dps);
      const diffFactor = 1.0 / (1 + diff*0.25);
      this.next = Math.min(2.2, Math.max(0.55, base*diffFactor*grace));
    }
    pickType(diff){
      const r = Math.random()*100;
      if (diff < 1.5){
        return r<20?'runner':'grunt';
      } else if (diff < 3){
        if (r<18) return 'runner';
        if (r<32) return 'tank';
        return 'grunt';
      } else if (diff < 5){
        if (r<16) return 'runner';
        if (r<32) return 'tank';
        if (r<44) return 'elite';
        return 'grunt';
      } else {
        if (r<14) return 'runner';
        if (r<30) return 'tank';
        if (r<46) return 'elite';
        if (r<52) return 'pharaoh';
        return 'grunt';
      }
    }
    classMods(type){
      if (type==='runner') return {hp:0.6, spd:1.6};
      if (type==='tank')   return {hp:2.2, spd:0.6};
      if (type==='elite')  return {hp:1.6, spd:1.0};
      if (type==='pharaoh')return {hp:6.0, spd:0.5};
      return {hp:1.0, spd:1.0}; // grunt
    }
  }

  
  
  class Input{
    constructor(){
      this.mouse={x:0,y:0}; this.aim={x:90,y:0,locked:false};
      this.space=false;
      G.canvas.addEventListener('mousemove', e=>{
        const r = G.canvas.getBoundingClientRect();
        const sx = G.canvas.width / r.width;
        const sy = G.canvas.height / r.height;
        const nx = (e.clientX - r.left) * sx; this.mouse.x = nx; if (!this.aim.locked) this.aim.x = nx;
        const ny = (e.clientY - r.top) * sy; this.mouse.y = ny; if (!this.aim.locked) this.aim.y = ny;
      });
      // Spacebar for manual fire
      window.addEventListener('keydown', e=>{
        if (e.code === 'Space'){ e.preventDefault(); this.space=true; }
        if (e.code==='KeyL'){ this.aim.locked = !this.aim.locked; if (this.aim.locked===false){ this.aim.x=this.mouse.x; this.aim.y=this.mouse.y; } }
        // X triggers special instantly without blocking fire
        if (e.code === 'KeyX'){ e.preventDefault(); if (window.Indy && Indy.ui && Indy.ui.special) Indy.ui.special(); }
      });
      window.addEventListener('keyup', e=>{
        if (e.code === 'Space'){ e.preventDefault(); this.space=false; }
      });
    }
    tryShootManual(){
      const t = now();
      if (!G.state.player.canShoot(t)) return false;
      G.state.player.shoot(t);
      const px=90, py=G.world.baseY;
      const ax=this.aim.x, ay=this.aim.y; const dx=ax-px, dy=ay-py;
      const len=Math.hypot(dx,dy)||1;
      const speed=480;
      const vx=(dx/len)*speed, vy=(dy/len)*speed;
      G.state.projectiles.push(new Projectile(px,py,vx,vy,G.state.player.range,G.state.player.damage,G.state.player.critChance,G.state.player.critMult));
      return true;
    }
    tryShootAuto(){
      const p = G.state.player;
      if (!p.autoFire) return false;
      const t = now();
      // auto fire cadence separate from manual fire
      if (p.lastAutoShotAt>=0){
        const dt = (t - p.lastAutoShotAt)/1000;
        if (dt < (1/p.autoFireRate)) return false;
      }
      p.lastAutoShotAt = t;
      const px=90, py=G.world.baseY;
      const ax=this.aim.x, ay=this.aim.y; const dx=ax-px, dy=ay-py;
      const len=Math.hypot(dx,dy)||1;
      const speed=440;
      const vx=(dx/len)*speed, vy=(dy/len)*speed;
      // weaker damage for auto
      const dmg = G.state.player.damage * G.state.player.autoDamageMult;
      G.state.projectiles.push(new Projectile(px,py,vx,vy,G.state.player.range,dmg,G.state.player.critChance*0.6,G.state.player.critMult));
      return true;
    }
    update(dt){
      // Manual fire if holding space
      if (this.space) this.tryShootManual();
      // Auto fire ticks regardless of manual; if both, both can shoot (manual remains stronger)
      this.tryShootAuto();
    }
  }

  G.Player=Player; G.Economy=Economy; G.LootSystem=LootSystem;
  G.Enemy=Enemy; G.Projectile=Projectile; G.Spawner=Spawner; G.Input=Input;
  G.FloatingText=FloatingText; G.HitEffect=HitEffect; G.Poof=Poof;

  class PoisonPuff{
    constructor(x,y){ this.x=x; this.y=y; this.life=0; this.alive=true; }
    tick(dt){ this.life+=dt; if(this.life>.5) this.alive=false; this.y-=10*dt; }
    draw(ctx){ ctx.save(); ctx.globalAlpha=1-this.life*1.8; ctx.fillStyle='#3bbf3b'; ctx.beginPath(); ctx.arc(this.x,this.y,4+8*(1-this.life),0,Math.PI*2); ctx.fill(); ctx.restore(); }
  }
  class ExplosionFX{
    constructor(x,y){ this.x=x; this.y=y; this.life=0; this.alive=true; }
    tick(dt){ this.life+=dt; if(this.life>.35) this.alive=false; }
    draw(ctx){ const r=15+120*this.life; ctx.save(); ctx.globalAlpha=1-this.life; ctx.strokeStyle='#ffcc66'; ctx.beginPath(); ctx.arc(this.x,this.y,r,0,Math.PI*2); ctx.stroke(); ctx.restore(); }
  }
  class Turret{
    constructor(idx=0){
      const spacing = 46;
      this.x = 120 + idx*spacing; this.y = G.world.baseY - 8;
      this.range = 320; this.damage = 10; this.rate = 1.2;
      this.synergy = 0.4; this.last = -1;
    }
    canShoot(t){ if (this.last<0) return true; const dt=(t-this.last)/1000; return dt >= (1/this.rate); }
    target(){
      let best=null, bd=1e9;
      for (let e of G.state.enemies){
        if (e.dead) continue;
        const dx=e.x-this.x, dy=e.y-this.y; const d2=dx*dx+dy*dy;
        if (d2 <= this.range*this.range && d2<bd){ bd=d2; best=e; }
      }
      return best;
    }
    tick(dt){
      const t = performance.now();
      const tgt = this.target(); if (!tgt) return;
      if (!this.canShoot(t)) return; this.last=t;
      const dx=tgt.x-this.x, dy=tgt.y-this.y; const len=Math.hypot(dx,dy)||1;
      const speed=430; const vx=(dx/len)*speed, vy=(dy/len)*speed;
      const abScaled = {
        knockback: (G.state.player.abilities.knockback||0)*this.synergy,
        explosion: (G.state.player.abilities.explosion||0)*this.synergy,
        poisonDPS: (G.state.player.abilities.poisonDPS||0)*this.synergy,
        poisonDur: (G.state.player.abilities.poisonDur||0)*this.synergy
      };
      G.state.projectiles.push(new Projectile(this.x,this.y,vx,vy,this.range,this.damage, G.state.player.critChance*0.5, G.state.player.critMult, abScaled, 1));
    }
    draw(ctx){
      ctx.save();
      ctx.translate(this.x, this.y);
      // pixel statue
      ctx.fillStyle='#5c4930'; ctx.fillRect(-18,4,36,8); // base
      ctx.fillStyle='#6d5326'; ctx.fillRect(-14,-24,28,28); // body
      ctx.fillStyle='#8b6b3a'; ctx.fillRect(-10,-30,20,10); // head
      ctx.fillStyle='#e0b05a'; ctx.fillRect(-3,-20,6,6); // gem
      ctx.globalAlpha=.06; ctx.beginPath(); ctx.arc(0,0,this.range,0,Math.PI*2); ctx.fillStyle='#ffd27a'; ctx.fill();
      ctx.restore();
    }
  }
  G.PoisonPuff=PoisonPuff; G.ExplosionFX=ExplosionFX; G.Turret=Turret;

})();
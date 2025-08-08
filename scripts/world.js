
// === JUNGLE BACKGROUND LOADING ===
const jungleBG = loadSprite('assets/parallax background/layer_1.png');
const junglePath = loadSprite('assets/jungle tileset/path.png');


/** world.js - Background, parallax, particles, and world props **/
(() => {
  const G = Indy;
  const S = G.state;
  const rng = S.rng;
  const { clamp } = G.util;

  class Dust {
    constructor(){
      this.reset();
    }
    reset(){
      this.x = G.w * rng();
      this.y = G.h * rng();
      this.vx = -10 - 20*rng();
      this.vy = -5 + 10*rng();
      this.size = 1 + 2*rng();
      this.life = 0;
      this.maxLife = 8 + 6*rng();
      this.alive = true;
      this.alpha = .1 + .2*rng();
    }
    tick(dt){
      this.x += this.vx*dt; this.y += this.vy*dt; this.life+=dt;
      if (this.x<-10||this.y<-10||this.y>G.h+10||this.life>this.maxLife) this.reset();
    }
    draw(ctx){
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = '#f5e6c8';
      ctx.beginPath(); ctx.arc(this.x,this.y,this.size,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  class Torch {
    constructor(x,y){ this.x=x; this.y=y; this.t=0; }
    tick(dt){ this.t+=dt; }
    draw(ctx){
      const f = (Math.sin(this.t*10)+1)/2;
      ctx.save();
      // glow
      const g=ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,50);
      g.addColorStop(0,`rgba(255,200,120,${.35+.25*f})`);
      g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(this.x,this.y,50,0,Math.PI*2); ctx.fill();
      // flame
      ctx.translate(this.x,this.y);
      ctx.rotate((Math.sin(this.t*6)*.1));
      ctx.fillStyle='#ffd27a'; ctx.beginPath();
      ctx.moveTo(0,-18); ctx.quadraticCurveTo(10,-2,0,12); ctx.quadraticCurveTo(-10,-2,0,-18); ctx.fill();
      ctx.fillStyle='#ffb347'; ctx.beginPath();
      ctx.moveTo(0,-12); ctx.quadraticCurveTo(6,-2,0,6); ctx.quadraticCurveTo(-6,-2,0,-12); ctx.fill();
      ctx.restore();
    }
  }

  class ParallaxLayer {
    constructor(speed, drawFn){ this.x=0; this.speed=speed; this.drawFn=drawFn; }
    tick(dt){ this.x = (this.x - this.speed*dt) % G.w; }
    draw(ctx){
      ctx.save();
      this.drawFn(ctx, this.x);
      this.drawFn(ctx, this.x + G.w);
      ctx.restore();
    }
  }

  function drawVines(ctx,off){
    ctx.save();
    ctx.translate(-off,0);
    for (let i=0;i<6;i++){
      const x = 150 + i*250;
      const sway = Math.sin((performance.now()/1000) + i)*20;
      ctx.strokeStyle = '#26431f';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x,0);
      ctx.bezierCurveTo(x+40+sway,100, x-30-sway,200, x+20+sway,300);
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawWalls(ctx,off){
    ctx.save();
    ctx.translate(-off,0);
    ctx.fillStyle='#3b3224';
    for (let i=0;i<8;i++){
      ctx.fillRect(i*200, G.h-140, 180, 140);
    }
    ctx.restore();
  }
  function drawForegroundStones(ctx,off){
    ctx.save();
    ctx.translate(-off,0);
    ctx.fillStyle='#5c4930';
    for (let i=0;i<16;i++){
      ctx.fillRect(i*100, G.h-80, 80, 80);
    }
    ctx.restore();
  }

  class World {
    constructor(){
      this.layers = [
        new ParallaxLayer(10, drawVines),
        new ParallaxLayer(30, drawWalls),
        new ParallaxLayer(60, drawForegroundStones),
      ];
      this.torches = [ new Torch(110, G.h-120), new Torch(240, G.h-120), new Torch(370, G.h-120) ];
      this.baseY = G.h - 140;
      // particles
      for (let i=0;i<90;i++) G.state.particles.push(new Dust());
    }
    draw(ctx){
      // base ground
      ctx.clearRect(0,0,G.w,G.h);
      const bgGrad = ctx.createLinearGradient(0,0,0,G.h);
      bgGrad.addColorStop(0,'#2a2318'); bgGrad.addColorStop(1,'#0e0b07');
      ctx.fillStyle = bgGrad; ctx.fillRect(0,0,G.w,G.h);

      // layers
      for (let L of this.layers){ L.tick(1/60); L.draw(ctx); }

      // base pad
      ctx.fillStyle = '#8b6b3a';
      ctx.fillRect(40, this.baseY-18, 44, 36);
      ctx.fillStyle = '#5c4930';
      ctx.fillRect(34, this.baseY-24, 56, 48);

      // torches
      for (let t of this.torches){ t.tick(1/60); t.draw(ctx); }
    }
    drawHUD(ctx){
      // special radius hint
      if (G.state.player.specialReadyIn <= 0){
        ctx.save();
        ctx.globalAlpha = .05;
        ctx.beginPath();
        ctx.arc(260, this.baseY, 220, 0, Math.PI*2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.restore();
      }
      // reticle
      const aim = Indy.state.input ? Indy.state.input.aim : {x:260,y:this.baseY};
      ctx.save();
      ctx.globalAlpha = .8;
      ctx.strokeStyle = '#ffd27a';
      ctx.beginPath(); ctx.arc(aim.x, aim.y, 10, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(aim.x-14,aim.y); ctx.lineTo(aim.x-4,aim.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(aim.x+14,aim.y); ctx.lineTo(aim.x+4,aim.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(aim.x,aim.y-14); ctx.lineTo(aim.x,aim.y-4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(aim.x,aim.y+14); ctx.lineTo(aim.x,aim.y+4); ctx.stroke();
      if (Indy.state.input && Indy.state.input.aim.locked){ ctx.fillStyle='#ffd27a'; ctx.globalAlpha=.6; ctx.fillText('LOCK', aim.x+12, aim.y-12); }
      ctx.restore();

      // player marker (hat)
      ctx.save();
      ctx.fillStyle='#ffd27a';
      ctx.beginPath(); ctx.arc(90, this.baseY, 12, 0, Math.PI*2); ctx.fill();
      // hat
      ctx.fillStyle='#6d4c1e';
      ctx.fillRect(78, this.baseY-14, 24, 4);
      ctx.fillRect(84, this.baseY-22, 12, 8);
      ctx.restore();
    }
  }

  G.World = World;
})();

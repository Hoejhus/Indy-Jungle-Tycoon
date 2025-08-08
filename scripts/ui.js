
/** ui.js - UI, modal, toasts, save/load, HUD **/
(() => {
  const G = Indy;
  const S = G.state;
  const $ = s=>document.querySelector(s);

  function toast(msg, cls=null){
    const t = document.getElementById('loot-toast').content.firstElementChild.cloneNode(true);
    t.textContent = msg;
    if (cls) t.classList.add(cls);
    document.getElementById('log').prepend(t);
    setTimeout(()=>t.remove(), 5000);
  }

  class UI{
    constructor(){
      this.$coins=$('#coins'); this.$cps=$('#cps'); this.$hp=$('#hp'); this.$hpMax=$('#hpMax');
      this.$armor=$('#armor'); this.$damage=$('#damage'); this.$range=$('#range');
      this.$firerate=$('#firerate'); this.$crit=$('#crit'); this.$specialcd=$('#specialcd'); this.$level=$('#level'); this.$chestCost=$('#chestCost'); this.$openChestBtn=$('#openChestBtn');
      $('#openChestBtn').addEventListener('click', ()=>this.openChest());
                              document.querySelector('#miniBar').addEventListener('click', (e)=>{
        const btn = e.target.closest('button'); if (!btn) return;
        const key = btn.id==='openChestBtn' ? 'openChest' : btn.getAttribute('data-upg');
        if (key==='openChest'){ this.openChest(); return; }
        if (key) this.buy(key);
      });

      // Modal
      this.modal = document.getElementById('modal');
      /* shortcuts */
      window.addEventListener('keydown', (e)=>{
        if (e.target && ['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
        if (e.code==='Digit1') this.buy('damage');
        if (e.code==='Digit2') this.buy('range');
        if (e.code==='Digit3') this.buy('firerate');
        if (e.code==='KeyC') this.openChest();
        if (e.code==='KeyT') this.buy('buy_turret');
      });
      this.$lootRarity = document.getElementById('lootRarity');
      this.$lootText = document.getElementById('lootText');
      this.lootFx = document.getElementById('lootFx').getContext('2d');
      this.toolbarBtns = Array.from(document.querySelectorAll('#miniBar button'));
      document.getElementById('closeModal').addEventListener('click', ()=>this.hideModal());
      this.sparkles=[];
    }
    updateHUD(){
      const p=S.player;
      this.$coins.textContent = Math.floor(p.coins);
      this.$cps.textContent = p.cps.toFixed(1);
      this.$hp.textContent = Math.floor(p.hp);
      this.$hpMax.textContent = Math.floor(p.hpMax);
      this.$armor.textContent = Math.floor(p.armor);
      this.$damage.textContent = Math.floor(p.damage);
      this.$range.textContent = Math.floor(p.range);
      this.$firerate.textContent = p.fireRate.toFixed(2);
      this.$crit.textContent = Math.floor(p.critChance);
      this.$specialcd.textContent = Math.max(0,p.specialReadyIn).toFixed(1);
      if (Indy.diff) this.$level.textContent = (1 + Indy.diff.level).toFixed(1);
      const cost = S.economy.nextChestCost();
      if (this.$chestCost) { this.$chestCost.textContent = cost; }
      else if (this.$openChestBtn) { this.$openChestBtn.title = `Åbn kiste (💰${cost})`; }
      this.updateTooltips();
    }
    updateTooltips(){
      const map = {
        damage: ['Skade', Indy.state.economy.getCost('damage')],
        range: ['Rækkevidde', Indy.state.economy.getCost('range')],
        firerate: ['Skudhast.', Indy.state.economy.getCost('firerate')],
        buy_turret: ['Køb statue', Indy.state.economy.getCost('buy_turret')],
        turret_dmg: ['Statue skade', Indy.state.economy.getCost('turret_dmg')],
        turret_rate: ['Statue rate', Indy.state.economy.getCost('turret_rate')],
        turret_range: ['Statue rækkev.', Indy.state.economy.getCost('turret_range')],
        turret_synergy: ['Statue synergi', Indy.state.economy.getCost('turret_synergy')],
      };
      for (const b of (this.toolbarBtns||[])){
        const key = b.id==='openChestBtn' ? null : b.getAttribute('data-upg');
        if (!key){ const c = Indy.state.economy.nextChestCost(); b.title = `Åbn kiste · 💰${c}`; continue; }
        const [label, cst] = map[key] || [key, 0];
        b.title = `${label} · 💰${cst}`;
      }
    }
    openChest(){
      const cost=S.economy.nextChestCost();
      if (!S.economy.purchase(cost)) { toast('Ikke nok mønter.'); return; }
      S.economy.chestBought();
      const lo = S.loot.open();
      toast(`Kiste: ${lo.rarity.name} → +${lo.value} ${lo.item.lbl}`, lo.rarity.class);
      // fancy modal
      this.showModal(lo);
      this.updateHUD();
    }
    buy(key){
      switch(key){
        case 'damage': { const c=Indy.state.economy.getCost('damage'); if(!Indy.state.economy.purchase(c)){ Indy.ui.toast('Ikke nok mønter.'); break;} S.player.damage+=5; Indy.state.economy.onBought('damage'); break; }
        case 'range': { const c=Indy.state.economy.getCost('range'); if(!Indy.state.economy.purchase(c)){ Indy.ui.toast('Ikke nok mønter.'); break;} S.player.range+=30; Indy.state.economy.onBought('range'); break; }
        case 'firerate': { const c=Indy.state.economy.getCost('firerate'); if(!Indy.state.economy.purchase(c)){ Indy.ui.toast('Ikke nok mønter.'); break;} S.player.fireRate+=0.25; Indy.state.economy.onBought('firerate'); break; }
        case 'buy_turret': {
          const arr = Indy.state.turrets; const max=5;
          if (arr.length>=max){ Indy.ui.toast('Maks 5 statuer'); break; }
          const cost = Indy.state.economy.getCost('buy_turret'); if (!Indy.state.economy.purchase(cost)){ Indy.ui.toast('Ikke nok mønter.'); break; }
          arr.push(new Indy.Turret(arr.length)); Indy.ui.toast('Tempelstatue placeret!'); Indy.state.economy.onBought('buy_turret'); break; }

        case 'turret_dmg': { const arr=Indy.state.turrets; if (!arr.length){ Indy.ui.toast('Køb statuen først.'); break; } const c=Indy.state.economy.getCost('turret_dmg'); if (!Indy.state.economy.purchase(c)){ Indy.ui.toast('Ikke nok mønter.'); break; } for (const t of arr) t.damage+=4; Indy.state.economy.onBought('turret_dmg'); break; }
        case 'turret_rate': { const arr=Indy.state.turrets; if (!arr.length){ Indy.ui.toast('Køb statuen først.'); break; } const c=Indy.state.economy.getCost('turret_rate'); if (!Indy.state.economy.purchase(c)){ Indy.ui.toast('Ikke nok mønter.'); break; } for (const t of arr) t.rate+=0.25; Indy.state.economy.onBought('turret_rate'); break; }
        case 'turret_range': { const arr=Indy.state.turrets; if (!arr.length){ Indy.ui.toast('Køb statuen først.'); break; } const c=Indy.state.economy.getCost('turret_range'); if (!Indy.state.economy.purchase(c)){ Indy.ui.toast('Ikke nok mønter.'); break; } for (const t of arr) t.range+=30; Indy.state.economy.onBought('turret_range'); break; }
        case 'turret_synergy': { const arr=Indy.state.turrets; if (!arr.length){ Indy.ui.toast('Køb statuen først.'); break; } const c=Indy.state.economy.getCost('turret_synergy'); if (!Indy.state.economy.purchase(c)){ Indy.ui.toast('Ikke nok mønter.'); break; } for (const t of arr) t.synergy=Math.min(1,t.synergy+0.1); Indy.state.economy.onBought('turret_synergy'); break; }
        default: S.player.coins+=cost; break;
      }
      toast(`Købt: ${key}`);
      this.updateHUD();
    }
    special(){
      if (S.player.specialReadyIn>0){ toast('Special på cooldown.'); return; }
      const cx=260, cy=G.world.baseY; const rad=220;
      const base=S.player.damage*2.5; let hits=0;
      for (let e of S.enemies){
        if (e.dead) continue;
        const dx=e.x-cx, dy=e.y-cy;
        if (dx*dx+dy*dy<=rad*rad){ e.hit(base); hits++; }
      }
      S.effects.push(new G.HitEffect(cx,cy,'hit'));
      S.player.specialReadyIn=S.player.specialCD;
      toast(`Piskestød ramte ${hits} fjender!`);
    }

    showModal(lo){
      this.$lootRarity.textContent = `${lo.rarity.name}`;
      this.$lootText.textContent = `+${lo.value} ${lo.item.lbl}`;
      this.$lootRarity.className='loot-rarity';
      if (lo.rarity.class) this.$lootRarity.classList.add(lo.rarity.class);
      this.modal.classList.remove('hidden');
      this.sparkles = [];
      for(let i=0;i<80;i++) this.sparkles.push(new Sparkle(250,110));
      this.animateModalFx();
    }
    hideModal(){ this.modal.classList.add('hidden'); }

    animateModalFx(){
      const ctx = this.lootFx;
      let t=0;
      const step=()=>{
        if (this.modal.classList.contains('hidden')) return;
        t+=1/60;
        ctx.clearRect(0,0,500,260);
        // chest silhouette
        ctx.save();
        ctx.translate(250,180);
        ctx.fillStyle='#6d5326'; ctx.fillRect(-80,-40,160,80);
        ctx.fillStyle='#8b6b3a'; ctx.fillRect(-70,-30,140,60);
        ctx.fillStyle='#e0b05a'; ctx.fillRect(-10,-10,20,20);
        ctx.restore();
        // sparkles
        for (let s of this.sparkles){ s.tick(1/60); s.draw(ctx); }
        this.sparkles = this.sparkles.filter(s=>s.alive);
        if (this.sparkles.length<150) this.sparkles.push(new Sparkle(250,120));
        requestAnimationFrame(step);
      };
      step();
    }

    toast(msg,cls){ toast(msg,cls); }
  }

  class Sparkle{
    constructor(x,y){
      this.x=x; this.y=y;
      this.dir = Math.random()*Math.PI*2;
      this.spd = 30+120*Math.random();
      this.r = 1+2*Math.random();
      this.life=0; this.max= .5+.8*Math.random(); this.alive=true;
    }
    tick(dt){ this.life+=dt; if(this.life>this.max) this.alive=false; this.x+=Math.cos(this.dir)*this.spd*dt; this.y+=Math.sin(this.dir)*this.spd*dt; }
    draw(ctx){
      ctx.save();
      ctx.globalAlpha = 1 - (this.life/this.max);
      ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  const Save = {
    key:'indy_tycoon_save_v2',
    save(){
      const d = {
        player: {...S.player},
        economy: { chestCost:S.economy.chestCost, chestOpens:S.economy.chestOpens },
        spawner: { wave:S.spawner.wave },
      };
      localStorage.setItem(this.key, JSON.stringify(d));
      toast('Spillet er gemt.');
    },
    load(){
      const raw = localStorage.getItem(this.key);
      if (!raw){ toast('Ingen gem fundet.'); return; }
      try{
        const d = JSON.parse(raw);
        Object.assign(S.player, d.player);
        Object.assign(S.economy, d.economy);
        Object.assign(S.spawner, d.spawner);
        Indy.ui.updateHUD();
        toast('Gem indlæst.');
      }catch(e){ console.error(e); toast('Kunne ikke indlæse gem.'); }
    }
  };

  Indy.ui = new UI();
  Indy.Save = Save;
  Indy.toast = toast;
  G.UI = UI;
})();
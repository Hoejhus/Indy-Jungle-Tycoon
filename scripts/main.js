
/** main.js - Bootstrap **/
(() => {
  const G = Indy;
  const S = G.state;

  function init(){
    S.player = new G.Player();
    S.economy = new G.Economy(S.player);
    S.loot = new G.LootSystem(S.player);
    G.world = new G.World();
    S.spawner = new G.Spawner();
    S.input = new G.Input();

    G.ui = new G.UI();
    G.ui.updateHUD();
    S.last = performance.now();
    requestAnimationFrame(G.loop);
  }

  init();
})();

const games = [
  { name: 'Car Race', icon: '🏎', help: 'Steer with LEFT/RIGHT to dodge traffic. Survive to score.' },
  { name: 'Snake Game', icon: '🐍', help: 'Use the D-pad to move. Eat fruit, grow, avoid walls and yourself.' },
  { name: 'Cricket', icon: '╱', help: 'Press S or B when the ball reaches the crease. A missed shot ends the game.' },
  { name: 'Tank Battle', icon: '◎', help: 'Move with D-pad and press S or B to shoot incoming tanks.' },
  { name: 'Sky Hop', icon: '✦', help: 'Press S/B/UP or tap to flap through bookshelf gaps. Don’t crash.' }
];
const list = document.querySelector('#gameList'), screenView = document.querySelector('#gameView'), canvasWrap = document.querySelector('#canvasWrap'), canvas = document.querySelector('#gameCanvas'), ctx = canvas.getContext('2d');
let selected = 0, activeGame = null, animation, score = 0, soundOn = true, paused = false, keys = {}, sessionStartedAt = 0, started = false, gameOver = false;
const storedBestScores = JSON.parse(localStorage.getItem('arcadeBestScores') || 'null');
const bestScores = Array.isArray(storedBestScores) && storedBestScores.length === games.length ? storedBestScores.map(value => Number(value) || 0) : [Number(localStorage.getItem('arcadeBest') || 1060), 0, 0, 0, 0];
const $ = (selector) => document.querySelector(selector);
const icons = [
  `<svg viewBox="0 0 20 24" class="mi"><rect x="6" y="0" width="8" height="4" fill="#2b2b36"/><rect x="2" y="4" width="4" height="6" fill="#2b2b36"/><rect x="14" y="4" width="4" height="6" fill="#2b2b36"/><rect x="6" y="4" width="8" height="16" fill="#2b2b36"/><rect x="1" y="14" width="5" height="8" fill="#2b2b36"/><rect x="14" y="14" width="5" height="8" fill="#2b2b36"/><rect x="8" y="6" width="4" height="12" fill="#e06658"/><rect x="8" y="8" width="4" height="4" fill="#bce3fa"/><rect x="7" y="14" width="6" height="4" fill="#e06658"/></svg>`,
  `<svg viewBox="0 0 18 22" class="mi"><path d="M 4,0 L 14,0 L 14,10 L 8,10 L 8,14 L 16,14 L 16,22 L 2,22 L 2,12 L 10,12 L 10,8 L 4,8 Z" fill="#2b2b36"/><path d="M 6,2 L 12,2 L 12,8 L 6,8 L 6,16 L 14,16 L 14,20 L 4,20 L 4,14 L 12,14 L 12,6 L 6,6 Z" fill="#68b848"/><rect x="6" y="3" width="2" height="2" fill="#f5e653"/><rect x="10" y="3" width="2" height="2" fill="#f5e653"/></svg>`,
  `<svg viewBox="0 0 20 20" class="mi"><polygon points="16,0 20,0 20,4 8,20 4,20 0,16 0,12 12,4" fill="#2b2b36"/><polygon points="16,2 18,2 14,8 12,6" fill="#9c7a63"/><polygon points="12,8 14,10 6,18 2,14" fill="#d99b52"/></svg>`,
  `<svg viewBox="0 0 22 22" class="mi"><rect x="9" y="0" width="4" height="5" fill="#2b2b36"/><rect x="4" y="4" width="14" height="3" fill="#2b2b36"/><rect x="2" y="7" width="18" height="10" fill="#2b2b36"/><rect x="4" y="17" width="14" height="2" fill="#2b2b36"/><rect x="2" y="19" width="4" height="3" fill="#2b2b36"/><rect x="16" y="19" width="4" height="3" fill="#2b2b36"/><rect x="4" y="8" width="14" height="8" fill="#6395e8"/><rect x="8" y="10" width="6" height="4" fill="#2b2b36"/></svg>`,
  `<svg viewBox="0 0 22 20" class="mi"><rect x="9" y="0" width="4" height="3" fill="#2b2b36"/><rect x="5" y="3" width="12" height="3" fill="#2b2b36"/><rect x="1" y="6" width="20" height="4" fill="#2b2b36"/><rect x="4" y="10" width="14" height="7" fill="#2b2b36"/><rect x="4" y="17" width="4" height="3" fill="#2b2b36"/><rect x="14" y="17" width="4" height="3" fill="#2b2b36"/><rect x="6" y="5" width="10" height="10" fill="#7c68d6"/><rect x="8" y="8" width="2" height="2" fill="#ffffff"/><rect x="12" y="8" width="2" height="2" fill="#ffffff"/></svg>`
];
let gameState={};
function renderMenu(){ list.innerHTML = games.map((game,index) => `<button class="game-option ${index===selected?'active':''}" data-index="${index}"><span class="sel-arrow"></span><span class="icon">${icons[index]}</span><span class="name">${game.name}</span><span class="star">${index===selected?'*':''}</span></button>`).join(''); $('#gameCount').textContent = `${String(selected+1).padStart(2,'0')}/05`; $('#bestScore').textContent = String(bestScores[selected]).padStart(5,'0'); document.querySelectorAll('.game-option').forEach(button => button.addEventListener('click',()=>{selected=Number(button.dataset.index); renderMenu();}));}
function showToast(message){const toast=$('#toast');toast.textContent=message;toast.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.remove('show'),1800)}
let audioCtx=null,masterGain=null,bgmTimer=null,bgmStep=0,bgmMode=null,wantBgm='home',audioUnlocked=false;
function ensureAudio(){if(!audioCtx){try{audioCtx=new (window.AudioContext||window.webkitAudioContext)(); masterGain=audioCtx.createGain(); masterGain.gain.value=0.85; masterGain.connect(audioCtx.destination)}catch{} } if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume().catch(()=>{}); audioUnlocked=!!audioCtx; return audioUnlocked}
function tone(freq,d=.12,type='square',vol=.03,when=0){if(!soundOn||!audioCtx) return; try{const t=audioCtx.currentTime+when,o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(masterGain||audioCtx.destination);o.start(t);o.stop(t+d+.02)}catch{}}
function beep(frequency=440,d=.08,type='square',vol=.03){if(!ensureAudio()) return; tone(frequency,d,type,vol,0)}
function haptic(name='press'){if(!navigator.vibrate)return;const patterns={press:40,move:25,hit:[40,30,60],shoot:45,jump:[30,20,40],score:[25,20,35],over:[80,40,100],pause:50,start:[30,20,40,20,30],select:30};try{navigator.vibrate(patterns[name]??patterns.press)}catch{}}
function sfx(name){haptic(name);if(!soundOn) return; ensureAudio(); const m={start:[660,.08,'square',.14],move:[420,.03,'square',.09],hit:[740,.07,'square',.16],shoot:[520,.05,'square',.15],jump:[620,.06,'triangle',.16],score:[880,.08,'square',.16],over:[180,.2,'sawtooth',.14],pause:[300,.06,'square',.12],select:[520,.05,'square',.12]}; const a=m[name]||[440,.06,'square',.12]; tone(a[0],a[1],a[2],a[3],0)}
const bgmSeq={
  home:{tempo:260,notes:[[523,.12],[659,.12],[784,.12],[659,.12],[587,.12],[659,.12],[523,.24],[392,.12],[523,.12],[659,.12],[784,.24],[659,.24]],type:'triangle',vol:.09},
  menu:{tempo:220,notes:[[440,.1],[554,.1],[659,.1],[554,.1],[440,.1],[330,.1],[392,.2],[440,.2]],type:'square',vol:.075},
  car:{tempo:150,notes:[[196,.08],[196,.08],[220,.08],[196,.08],[247,.08],[220,.08],[196,.16]],type:'sawtooth',vol:.06},
  snake:{tempo:170,notes:[[330,.08],[392,.08],[440,.08],[392,.08],[330,.08],[262,.08],[330,.16]],type:'square',vol:.07},
  cricket:{tempo:240,notes:[[392,.1],[0,.05],[440,.1],[0,.05],[523,.15],[440,.1],[392,.2]],type:'triangle',vol:.08},
  tank:{tempo:160,notes:[[110,.1],[110,.1],[130,.1],[110,.1],[146,.1],[130,.1],[110,.1],[98,.1]],type:'square',vol:.07},
  sky:{tempo:180,notes:[[523,.08],[659,.08],[784,.08],[1047,.12],[784,.08],[659,.08],[523,.16]],type:'triangle',vol:.075}
};
function stopBGM(){if(bgmTimer){clearTimeout(bgmTimer);bgmTimer=null}}
function scheduleBGM(){if(!soundOn||!audioUnlocked||!wantBgm||paused){bgmTimer=null;return} const seq=bgmSeq[wantBgm]; if(!seq){bgmTimer=null;return} const n=seq.notes[bgmStep%seq.notes.length]; bgmStep++; if(n[0]>0) tone(n[0],n[1]||.1,seq.type||'square',seq.vol||.015,0); const dur=(n[1]||.1)*1000 + (seq.tempo||180); bgmTimer=setTimeout(scheduleBGM,dur)}
function playBGM(mode){wantBgm=mode; bgmMode=mode; bgmStep=0; stopBGM(); if(!soundOn) return; if(ensureAudio()) scheduleBGM()}
function refreshBGM(){ if(!soundOn){stopBGM();return} if(wantBgm && ensureAudio() && !bgmTimer && !paused) scheduleBGM()}
function isTouch(){return ('ontouchstart' in window)||navigator.maxTouchPoints>0}
const gameBgm=['car','snake','cricket','tank','sky'];
function enterMenu(){ if(started) return; started=true; ensureAudio(); $('#startScreen')?.classList.add('hidden'); screenView.classList.remove('hidden'); $('#statusText').textContent='SELECT GAME'; renderMenu(); sfx('start'); playBGM('menu'); }
function startGame(){if(!started) enterMenu();hideGameOver();activeGame=selected;sessionStartedAt=Date.now();screenView.classList.add('hidden');canvasWrap.classList.remove('hidden');$('#playTitle').textContent=games[activeGame].name.toUpperCase();const hints=['D-PAD STEER · B MENU','D-PAD MOVE · B MENU','S/B TO HIT · B MENU','D-PAD MOVE · S/B SHOOT · B MENU','S/B/UP/TAP FLAP · B MENU'];$('#playHint').textContent=hints[activeGame]||'B TO MENU';score=0;paused=false;keys={};$('#score').textContent='00000';$('#statusText').textContent='PLAYING';cancelAnimationFrame(animation);initGame(activeGame);resizeCanvas();playBGM(gameBgm[activeGame]);requestAnimationFrame(()=>{fitArcade();loop(performance.now())});sfx('start')}
function endGame(options={}){const finalScore=Math.floor(score);if(activeGame!==null){bestScores[activeGame]=Math.max(bestScores[activeGame]||0,finalScore);localStorage.setItem('arcadeBestScores',JSON.stringify(bestScores))} showGameOver(finalScore,options)}
let goTimer=null, goMosaic=null;
function hideGameOver(){gameOver=false; const el=$('#gameOverScreen'); if(el){el.classList.add('hidden'); el.setAttribute('aria-hidden','true')} if(goTimer){clearInterval(goTimer); goTimer=null} if(goMosaic){cancelAnimationFrame(goMosaic); goMosaic=null}}
function restartCurrentGame(){ if(activeGame===null) return; hideGameOver(); score=0; paused=false; keys={}; $('#score').textContent='00000'; cancelAnimationFrame(animation); initGame(activeGame); resizeCanvas(); playBGM(gameBgm[activeGame]); loop(performance.now()); sfx('start') }
function showGameOver(finalScore,options={}){ if(gameOver) return; gameOver=true; cancelAnimationFrame(animation); stopBGM(); sfx('over'); keys={}; paused=false; if(goTimer){clearInterval(goTimer); goTimer=null} if(goMosaic){cancelAnimationFrame(goMosaic); goMosaic=null} const el=$('#gameOverScreen'); if(!el){backToMenu();return} el.classList.remove('hidden'); el.setAttribute('aria-hidden','false');
  const title=options.title||'GAME OVER'; const scorePrefix=options.scorePrefix||'SCORE'; const labelPrefix=options.buttonPrefix||'PLAY AGAIN';
  const titleText=document.getElementById('go-title-text'); if(titleText) titleText.textContent=title;
  const scoreEl=document.getElementById('go-score-text'); if(scoreEl) scoreEl.textContent=`${scorePrefix}: ${finalScore}`;
  const content=document.getElementById('game-over-content'); const layer=document.getElementById('mosaic-layer'); const label=document.getElementById('play-again-label'); const btn=document.getElementById('play-again-btn');
  const titleGroup=document.getElementById('go-title'); if(titleGroup) titleGroup.innerHTML='';
  if(content) content.setAttribute('opacity','0'); if(layer) layer.innerHTML='';
  // mosaic build
  const cols=20, rows=15, tw=400/cols, th=300/rows; const colors=['#232436','#2b2c45','#34365a','#3d3f66','#5e4bb8','#f29b91','#3a2f5f'];
  const tiles=[]; if(layer){ for(let y=0;y<rows;y++) for(let x=0;x<cols;x++){ const r=document.createElementNS('http://www.w3.org/2000/svg','rect'); r.setAttribute('x',x*tw); r.setAttribute('y',y*th); r.setAttribute('width',tw+0.6); r.setAttribute('height',th+0.6); r.setAttribute('fill',colors[(x+y*3+((x*y)%5))%colors.length]); r.setAttribute('opacity','1'); layer.appendChild(r); tiles.push({r,delay:Math.random()*420, dur:260+Math.random()*260}) } }
  const start=performance.now();
  function anim(now){ const t=now-start; let done=true; for(const it of tiles){ const p=Math.min(1,Math.max(0,(t-it.delay)/it.dur)); if(p<1) done=false; it.r.setAttribute('opacity', String(1-p)); } if(t>350 && content) content.setAttribute('opacity', String(Math.min(1,(t-350)/300))); if(!done || t<700){ goMosaic=requestAnimationFrame(anim)} else { if(layer) layer.innerHTML=''; goMosaic=null } }
  goMosaic=requestAnimationFrame(anim);
  // countdown + play again
  let count=5; if(label) label.textContent=`${labelPrefix} (${count})`;
  if(goTimer) clearInterval(goTimer);
  goTimer=setInterval(()=>{ count--; if(label) label.textContent=count>0?`${labelPrefix} (${count})`:labelPrefix; if(count<=0){ clearInterval(goTimer); goTimer=null; restartCurrentGame(); } },1000);
  if(btn){ btn.style.cursor='pointer'; btn.onclick=()=>{ if(goTimer){clearInterval(goTimer);goTimer=null} restartCurrentGame(); }; }
}
function backToMenu(){ hideGameOver(); cancelAnimationFrame(animation);activeGame=null;paused=false;keys={};canvasWrap.classList.add('hidden');screenView.classList.remove('hidden');$('#statusText').textContent='SELECT GAME';renderMenu(); if(started) playBGM('menu'); requestAnimationFrame(fitArcade);}
function resizeCanvas(){if(window.innerWidth<=600&&!canvasWrap.classList.contains('hidden')){canvas.style.height='';return}const ratio=canvas.clientWidth/560;canvas.style.height=`${430*ratio}px`}
function initGame(id){gameOver=false;gameState={};
  if(id===0){gameState={car:{x:280,y:360},traffic:[],tick:0,speed:3.2,spawn:42}}
  if(id===1){gameState={snake:[{x:14,y:10},{x:13,y:10},{x:12,y:10}],dir:{x:1,y:0},next:{x:1,y:0},food:spawnFood([{x:14,y:10},{x:13,y:10},{x:12,y:10}]),tick:0,step:10,alive:true}}
  if(id===2){gameState={runs:0,delivery:0,phase:'bowl',ballY:72,ballX:280,swing:0,cool:0,msg:'TAP / S TO HIT',resultTimer:0,popup:'',popupTimer:0,hitVx:0,hitVy:0,flash:0,outReason:''}}
  if(id===3){gameState={tank:{x:280,y:365},bullets:[],enemies:[],tick:0,spawn:50,cool:0}}
  if(id===4){gameState={p:{x:96,y:112,vy:0,w:18,h:14},pipes:[],tick:0,spawn:180,gaps:0,flapLock:false,over:0,mode:'countdown',timer:180}}
}
function spawnFood(snake){let p;do{p={x:Math.floor(Math.random()*28),y:Math.floor(Math.random()*21)}}while(snake.some(s=>s.x===p.x&&s.y===p.y));return p}
function loop(time){if(activeGame===null||gameOver)return;if(!paused){update(time);draw();$('#score').textContent=String(Math.floor(score)).padStart(5,'0')}else{draw();drawPause()}animation=requestAnimationFrame(loop)}
function update(time){ if(activeGame===0)updateRace(); if(activeGame===1)updateSnake(); if(activeGame===2)updateCricket(); if(activeGame===3)updateTank(); if(activeGame===4)updateSky(); }
function clear(color='#9edb8e'){ctx.fillStyle=color;ctx.fillRect(0,0,560,430)}
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h)}
function drawPause(){ctx.fillStyle='#24183bcc';ctx.fillRect(0,0,560,430);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='24px "Press Start 2P"';ctx.fillText('PAUSED',280,215);ctx.font='10px "Press Start 2P"';ctx.fillText('PRESS S TO RESUME',280,250)}
function draw(){ if(activeGame===0)drawRace(); if(activeGame===1)drawSnake(); if(activeGame===2)drawCricket(); if(activeGame===3)drawTank(); if(activeGame===4)drawSky(); }

// Car Race
function updateRace(){const g=gameState;g.tick++;score+=0.12;g.speed=Math.min(7.5,3.2+g.tick/900);g.spawn=Math.max(22,42-Math.floor(g.tick/500));if(keys.ArrowLeft||keys.a)g.car.x-=5.2;if(keys.ArrowRight||keys.d)g.car.x+=5.2;g.car.x=Math.max(152,Math.min(408,g.car.x));if(g.tick%g.spawn===0){const lanes=[180,240,300,360];g.traffic.push({x:lanes[Math.floor(Math.random()*lanes.length)]+(Math.random()*20-10),y:-70,w:38,h:58,c:['#ef5b65','#4da6ff','#7be36a','#ff9f43'][Math.floor(Math.random()*4)]});}
 g.traffic.forEach(t=>t.y+=g.speed);g.traffic=g.traffic.filter(t=>t.y<500);if(g.traffic.some(t=>Math.abs(t.x-g.car.x)<34&&Math.abs(t.y-g.car.y)<52))endGame()}
function drawRace(){clear('#6ab55d');rect(120,0,320,430,'#3b3a47');for(let y=-40;y<460;y+=70)rect(274,y+((gameState.tick*gameState.speed*0.8)%70),12,34,'#f8f1ba');rect(120,0,10,430,'#ef5a55');rect(430,0,10,430,'#ef5a55');rect(132,0,6,430,'#fff3');rect(422,0,6,430,'#fff3');gameState.traffic.forEach(t=>drawCar(t.x,t.y,t.c));drawCar(gameState.car.x,gameState.car.y,'#f6d54e')}
function drawCar(x,y,color){rect(x-18,y-28,36,56,color);rect(x-13,y-18,26,14,'#212a3c');rect(x-13,y+8,26,10,'#212a3c88');rect(x-20,y-16,4,10,'#29283a');rect(x+16,y-16,4,10,'#29283a');rect(x-20,y+10,4,10,'#29283a');rect(x+16,y+10,4,10,'#29283a');rect(x-16,y-26,4,4,'#fff8');rect(x+12,y-26,4,4,'#fff8')}

// Snake
function updateSnake(){const g=gameState;g.tick++; if(keys.ArrowUp&&g.dir.y!==1)g.next={x:0,y:-1}; if(keys.ArrowDown&&g.dir.y!==-1)g.next={x:0,y:1}; if(keys.ArrowLeft&&g.dir.x!==1)g.next={x:-1,y:0}; if(keys.ArrowRight&&g.dir.x!==-1)g.next={x:1,y:0}; g.step=Math.max(6,10-Math.floor(g.snake.length/6)); if(g.tick%g.step) return; g.dir=g.next; const head={x:g.snake[0].x+g.dir.x,y:g.snake[0].y+g.dir.y}; if(head.x<0||head.x>27||head.y<0||head.y>20||g.snake.some(p=>p.x===head.x&&p.y===head.y)){endGame();return} g.snake.unshift(head); if(head.x===g.food.x&&head.y===g.food.y){score+=10;sfx('score');g.food=spawnFood(g.snake)} else g.snake.pop();}
function drawSnake(){const g=gameState;clear('#a5d991');for(let x=0;x<28;x++)for(let y=0;y<22;y++)if((x+y)%2===0)rect(x*20,y*20+0,20,20,'#9fd788');rect(0,0,560,430,'#0000');ctx.strokeStyle='#5f8f4f';ctx.lineWidth=4;ctx.strokeRect(2,2,556,426);const fx=g.food.x*20+10,fy=g.food.y*20+10;ctx.fillStyle='#eb4e5e';ctx.beginPath();ctx.arc(fx,fy,7,0,Math.PI*2);ctx.fill();rect(fx-1,fy-10,2,5,'#5a3b2a');g.snake.forEach((p,i)=>{rect(p.x*20+1,p.y*20+1,18,18,i?'#3b8c5c':'#245a49');if(!i){rect(p.x*20+5,p.y*20+6,3,3,'#fff');rect(p.x*20+12,p.y*20+6,3,3,'#fff')}})}

// Cricket
function actionPressed(){return keys[' ']||keys.s||keys.b}
function updateCricket(){const g=gameState; g.swing=Math.max(0,g.swing-1); if(g.cool>0)g.cool--; g.flash=Math.max(0,g.flash-1); if(g.popupTimer>0) g.popupTimer--;
  if(g.resultTimer>0){
    g.resultTimer--;
    if(g.phase==='hit'){ g.ballX+=g.hitVx; g.ballY+=g.hitVy; g.hitVy+=0.08; }
    if(g.resultTimer===0){
      if(g.phase==='out'){ endGame({title:'SCORE',scorePrefix:'RUNS',buttonPrefix:'BAT AGAIN'}); return }
      g.delivery++; g.phase='bowl'; g.ballY=72; g.ballX=280; g.msg='NEXT BALL'; g.popup=''; g.hitVx=0; g.hitVy=0;
    }
    return;
  }
  g.ballY+=3.1;
  if(actionPressed()&&g.cool===0){
    g.cool=14; g.swing=14;
    if(g.ballY>=230&&g.ballY<=308){
      const distance=Math.abs(g.ballY-270);
      const runs=distance<10?6:distance<20?4:distance<35?2:1;
      g.runs+=runs; score=g.runs; g.phase='hit';
      g.msg=runs===6?'SIX!':runs===4?'FOUR!':runs===2?'2 RUNS':'1 RUN';
      g.popup=g.msg; g.popupTimer=50; g.flash=10;
      if(runs===6){g.hitVx=(Math.random()<.5?-1:1)*2.2; g.hitVy=-8.5}
      else if(runs===4){g.hitVx=(Math.random()<.5?-1:1)*5.2; g.hitVy=-4.2}
      else if(runs===2){g.hitVx=(Math.random()<.5?-1:1)*2.8; g.hitVy=-5.2}
      else {g.hitVx=(Math.random()<.5?-1:1)*1.8; g.hitVy=-4.2}
      g.resultTimer=runs>=4?46:38;
      sfx('hit'); sfx('score'); return;
    } else {
      g.outReason=Math.random()<0.5?'CATCH OUT':'HIT WICKET';
      g.msg=g.outReason+'!'; g.popup=g.outReason; g.popupTimer=80; g.phase='out'; g.resultTimer=70; g.flash=8; sfx('over'); return;
    }
  }
  if(g.ballY>320){
    g.outReason=Math.random()<0.5?'BOWLED':'HIT WICKET';
    g.msg=g.outReason+'!'; g.popup=g.outReason; g.popupTimer=80; g.phase='out'; g.resultTimer=70; g.flash=8; sfx('over');
  }
}
function drawCricket(){const g=gameState;clear('#78c86b');rect(0,0,560,54,'#8ed7f1');rect(0,54,560,376,'#79bd69');
  // pitch
  rect(100,60,360,330,'#d7bb8d');ctx.strokeStyle='#856b4b';ctx.lineWidth=4;ctx.strokeRect(100,60,360,330);
  rect(250,72,60,280,'#e4cb9c');rect(247,72,66,280,'#b89463');rect(247,72,66,5,'#fff');rect(247,347,66,5,'#fff');
  // stumps
  rect(264,58,4,18,'#f5e653');rect(278,58,4,18,'#f5e653');rect(292,58,4,18,'#f5e653');
  rect(264,344,4,18,'#f5e653');rect(278,344,4,18,'#f5e653');rect(292,344,4,18,'#f5e653');
  // HUD
  rect(0,0,560,32,'#f7f4eb');ctx.fillStyle='#1e1e24';ctx.font='bold 15px "Courier New",monospace';ctx.textAlign='center';
  ctx.fillText(`SCORE ${String(g.runs).padStart(5,'0')}   BALL ${g.delivery+1}`,280,21);
  // hit zone (pulse when ball near)
  const near=g.phase==='bowl' && g.ballY>210 && g.ballY<330;
  ctx.fillStyle=near?'#ffe95a':'#f5e653';ctx.fillRect(220,235,120,70);
  ctx.strokeStyle=near?'#ff7a2f':'#1e1e24';ctx.lineWidth=near?4:3;ctx.strokeRect(220,235,120,70);
  ctx.fillStyle='#1e1e24';ctx.font='bold 12px "Courier New",monospace';ctx.fillText('HIT ZONE',280,276);
  // bowler
  rect(272,88,16,26,'#3a6bc4');rect(275,70,10,20,'#f2c48d');rect(260,114,14,6,'#2b2b36');rect(286,114,14,6,'#2b2b36');
  // batsman
  rect(397,292,8,42,'#2b2b36');rect(382,270,38,25,'#3a6bc4');rect(392,250,18,22,'#f2c48d');
  ctx.save();ctx.translate(397,292);if(g.swing>0)ctx.rotate(-.95);rect(-4,-48,8,50,'#d99b52');ctx.restore();
  // ball
  const bx=g.ballX||280, by=g.ballY;
  if(!(g.phase==='hit' && by<-20 || bx<-20 || bx>580)){
    ctx.fillStyle='#c84b4b';ctx.beginPath();ctx.arc(bx,by,10,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#682d32';ctx.lineWidth=2;ctx.stroke();
  }
  // fielder accent
  ctx.fillStyle='#2b2b36';ctx.fillRect(165,140,14,30);ctx.fillRect(158,170,28,12);ctx.fillStyle='#f2c48d';ctx.beginPath();ctx.arc(172,130,10,0,Math.PI*2);ctx.fill();
  // message/footer
  ctx.fillStyle='#1e1e24';ctx.font='bold 12px "Courier New",monospace';ctx.textAlign='center';
  const hint=g.phase==='bowl'?'TAP / PRESS S OR B IN THE HIT ZONE':(g.phase==='hit'?'NICE SHOT!':g.msg);
  ctx.fillText(hint,280,415);
  // score popup
  if(g.popup && g.popupTimer>0){
    ctx.save();
    ctx.textAlign='center';
    const pop=g.popup; const out=/OUT|BOWLED|WICKET/.test(pop); const big=/SIX|FOUR|RUN/.test(pop)||out;
    ctx.font=big?'bold 32px "Courier New",monospace':'bold 26px "Courier New",monospace';
    ctx.lineWidth=5; ctx.strokeStyle='#24183b';
    ctx.fillStyle=out?'#ff9b9b':(pop==='SIX!'?'#ffcf4d':pop==='FOUR!'?'#7dffb0':'#7dff8a');
    ctx.strokeText(pop,280,170); ctx.fillText(pop,280,170);
    if(g.phase==='hit' && /\d|SIX|FOUR/.test(pop)){ctx.font='bold 14px "Courier New",monospace'; ctx.fillStyle='#fff'; ctx.strokeText(`TOTAL ${g.runs}`,280,198); ctx.fillText(`TOTAL ${g.runs}`,280,198)}
    if(g.phase==='out'){ctx.font='bold 14px "Courier New",monospace'; ctx.fillStyle='#fff'; ctx.strokeText(`FINAL SCORE ${g.runs}`,280,198); ctx.fillText(`FINAL SCORE ${g.runs}`,280,198)}
    ctx.restore();
  }
  if(g.flash>0){ctx.fillStyle=`rgba(255,255,255,${g.flash*0.04})`;ctx.fillRect(0,32,560,398)}
}

// Tank Battle
function updateTank(){const g=gameState;g.tick++; if(keys.ArrowLeft)g.tank.x-=4.2; if(keys.ArrowRight)g.tank.x+=4.2; if(keys.ArrowUp)g.tank.y-=2.5; if(keys.ArrowDown)g.tank.y+=2.5; g.tank.x=Math.max(30,Math.min(530,g.tank.x)); g.tank.y=Math.max(260,Math.min(395,g.tank.y)); if(g.cool>0)g.cool--; if(actionPressed()&&g.cool===0){g.bullets.push({x:g.tank.x,y:g.tank.y-28,vy:-8});g.cool=14;sfx('shoot')} g.spawn=Math.max(24,50-Math.floor(g.tick/350)); if(g.tick%g.spawn===0)g.enemies.push({x:40+Math.random()*480,y:-30,w:34,h:28,hp:1}); g.bullets.forEach(b=>b.y+=b.vy); g.enemies.forEach(e=>e.y+=1.4+g.tick/4000); g.bullets=g.bullets.filter(b=>b.y>-20); g.enemies.forEach(e=>{ g.bullets.forEach(b=>{if(!b.dead&&!e.dead&&Math.abs(b.x-e.x)<20&&Math.abs(b.y-e.y)<18){b.dead=true;e.dead=true;score+=20;sfx('score')}})}); g.bullets=g.bullets.filter(b=>!b.dead); if(g.enemies.some(e=>!e.dead&&(e.y>430 || (Math.abs(e.x-g.tank.x)<28&&Math.abs(e.y-g.tank.y)<26)))){endGame();return} g.enemies=g.enemies.filter(e=>!e.dead&&e.y<450); score+=0.02}
function drawTank(){const g=gameState;clear('#83bd8a');for(let x=0;x<560;x+=40){rect(x,0,2,430,'#76ad7e')}for(let y=0;y<430;y+=40){rect(0,y,560,2,'#79b18133')}g.enemies.forEach(e=>{rect(e.x-16,e.y-12,32,24,'#d65550');rect(e.x-6,e.y-22,12,12,'#d65550');rect(e.x-3,e.y-28,6,8,'#8f3330');rect(e.x-10,e.y-4,20,6,'#8f3330')});g.bullets.forEach(b=>{rect(b.x-3,b.y-8,6,14,'#fff1a8')});const t=g.tank;rect(t.x-22,t.y,44,18,'#4e679d');rect(t.x-14,t.y-14,28,16,'#5f79b0');rect(t.x-3,t.y-34,6,22,'#2d385c');rect(t.x-26,t.y+14,52,6,'#2d385c')}

// Sky Hop (Library Flap)
function updateSky(){const g=gameState;
  if(g.over>0){g.over--; if(g.over<=0) endGame(); return}
  const want=actionPressed()||keys.ArrowUp;
  if(g.mode==='countdown'||g.mode==='ready'){
    g.tick++; g.p.y=112 + Math.sin(g.tick/14)*3; g.p.vy=0;
    if(g.mode==='countdown'){g.timer--; if(g.timer<=0){g.mode='ready'; g.timer=0}}
    if(want && !g.flapLock){g.mode='play'; g.p.vy=-3.2; g.flapLock=true; sfx('jump')}
    if(!want) g.flapLock=false;
    return;
  }
  // play
  g.tick++; g.spawn--;
  if(want && !g.flapLock){g.p.vy=-3.2; g.flapLock=true; sfx('jump')}
  if(!want) g.flapLock=false;
  g.p.vy=Math.min(g.p.vy+0.12,3.2); g.p.y+=g.p.vy;
  if(g.spawn<=0){const gapY=58+Math.random()*92; g.pipes.push({x:420,gapY,gapH:88,passed:false}); g.spawn=150}
  g.pipes.forEach(p=>p.x-=1.1);
  const px=g.p.x, py=g.p.y, ph=18, pw=22;
  for(const p of g.pipes){
    if(!p.passed && p.x+34 < px){p.passed=true; g.gaps++; score=g.gaps; sfx('score')}
    const inX = px+pw>p.x && px<p.x+34;
    if(inX && (py < p.gapY || py+ph > p.gapY+p.gapH)){g.over=45; sfx('over'); return}
  }
  g.pipes=g.pipes.filter(p=>p.x>-50);
  if(py<0 || py+ph>234){g.over=45; sfx('over'); return}
}
function drawShelfUnit(x,y,type){ // 34x28
  rect(x,y,34,28,'#d9d4c7'); ctx.strokeStyle='#1e1e24'; ctx.lineWidth=1.2; ctx.strokeRect(x,y,34,28);
  rect(x+3,y+2,28,23,'#ebe7dc');
  if(type==='a'){rect(x+5,y+9,5,16,'#e07a9c');rect(x+12,y+7,5,18,'#f5c842');rect(x+19,y+8,6,17,'#68b8b8')}
  else if(type==='b'){rect(x+5,y+10,5,15,'#e05348');rect(x+12,y+7,6,18,'#4682d9');rect(x+20,y+9,5,16,'#f7941d')}
  else {rect(x+5,y+17,4,8,'#f5c842');rect(x+11,y+10,6,15,'#f7941d');rect(x+19,y+16,4,9,'#68b848');rect(x+24,y+16,4,9,'#e07a9c')}
  [ [x+5,y+9],[x+12,y+7],[x+19,y+8] ].forEach(()=>{});
  ctx.strokeStyle='#1e1e24'; ctx.lineWidth=1; // book outlines
  if(type==='a'){ctx.strokeRect(x+5,y+9,5,16);ctx.strokeRect(x+12,y+7,5,18);ctx.strokeRect(x+19,y+8,6,17)}
  else if(type==='b'){ctx.strokeRect(x+5,y+10,5,15);ctx.strokeRect(x+12,y+7,6,18);ctx.strokeRect(x+20,y+9,5,16)}
  else {ctx.strokeRect(x+5,y+17,4,8);ctx.strokeRect(x+11,y+10,6,15);ctx.strokeRect(x+19,y+16,4,9);ctx.strokeRect(x+24,y+16,4,9)}
  rect(x+1,y+25,32,3,'#b5b0a1'); ctx.strokeRect(x+1,y+25,32,3);
}
function drawShelfColumn(x,topH,gapY,gapH,kind){ // draw hanging top and standing bottom around gap
  let y=0; const topUnits=Math.ceil(topH/28);
  for(let i=0;i<topUnits;i++){const yy=topH-28*(i+1); if(yy+28<0) continue; drawShelfUnit(x,yy, i===0?'a':(kind%2? 'b':'c'))}
  // bottom
  let by=gapY+gapH; const types=['a','b','b','a','c']; let i=0; for(let yy=by; yy<234; yy+=28){drawShelfUnit(x,yy, types[(i+kind)%types.length]); i++}
}
function drawSky(){const g=gameState; const sx=560/400, sy=430/300; ctx.save(); ctx.scale(sx,sy);
  // HUD
  rect(0,0,400,28,'#f7f4eb'); ctx.fillStyle='#fff'; ctx.strokeStyle='#1e1e24'; ctx.lineWidth=.9; ctx.font='bold 14px "Courier New",monospace'; ctx.textAlign='left'; ctx.strokeText(String(Math.floor(score)).padStart(5,'0'),14,18); ctx.fillText(String(Math.floor(score)).padStart(5,'0'),14,18);
  ctx.fillStyle='#1e1e24'; ctx.textAlign='right'; ctx.font='bold 13px "Courier New",monospace'; ctx.fillText(`${String(g.gaps).padStart(2,'0')} GAPS`,386,18);
  // viewport
  ctx.save(); ctx.translate(0,28);
  rect(0,0,400,142,'#f2ede0'); rect(0,142,400,92,'#e8e3d5'); ctx.strokeStyle='#dcd6c6'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(0,142); ctx.lineTo(400,142); ctx.stroke();
  // lights
  ctx.fillStyle='#fff'; ctx.strokeStyle='#c9c3b3'; ctx.lineWidth=1; [[2,10,28,5],[92,10,46,5],[172,10,46,5],[252,10,46,5],[332,10,46,5]].forEach(r=>{rect(r[0],r[1],r[2],r[3],'#fff');ctx.strokeRect(r[0],r[1],r[2],r[3])});
  // bg shelves rails
  ctx.globalAlpha=0.65; [154,176,198,220].forEach(y=>rect(0,y,400,3,'#d1ccbe'));
  const bg=[[8,146,6,8,'#9eb8e8'],[16,145,7,9,'#e8a5b8'],[25,147,5,7,'#f2d685'],[95,146,6,8,'#8fd1c4'],[103,145,8,9,'#9eb8e8'],[142,146,7,8,'#e8a5b8'],[151,147,6,7,'#f2d685'],[208,145,8,9,'#9eb8e8'],[218,146,6,8,'#8fd1c4'],[285,146,7,8,'#e8a5b8'],[342,145,8,9,'#9eb8e8'],[352,147,6,7,'#f2d685'],[4,168,7,8,'#9eb8e8'],[13,167,6,9,'#8fd1c4'],[42,168,8,8,'#e8a5b8'],[52,167,6,9,'#9eb8e8'],[112,168,7,8,'#f2d685'],[121,167,8,9,'#e8a5b8'],[168,168,6,8,'#9eb8e8'],[176,167,7,9,'#8fd1c4'],[262,168,8,8,'#e8a5b8'],[272,167,6,9,'#f2d685'],[318,168,7,8,'#9eb8e8'],[368,167,8,9,'#8fd1c4'],[10,190,8,8,'#e8a5b8'],[20,189,6,9,'#f2d685'],[88,190,7,8,'#9eb8e8'],[97,189,8,9,'#e8a5b8'],[135,190,6,8,'#8fd1c4'],[143,189,7,9,'#f2d685'],[195,190,8,8,'#9eb8e8'],[295,189,7,9,'#e8a5b8'],[304,190,6,8,'#8fd1c4'],[355,189,8,9,'#f2d685'],[6,212,7,8,'#8fd1c4'],[15,211,8,9,'#9eb8e8'],[46,212,6,8,'#f2d685'],[108,211,7,9,'#e8a5b8'],[158,212,8,8,'#9eb8e8'],[168,211,6,9,'#8fd1c4'],[268,212,7,8,'#f2d685'],[330,211,8,9,'#e8a5b8'],[380,212,7,8,'#9eb8e8']];
  bg.forEach(b=>rect(b[0],b[1],b[2],b[3],b[4])); ctx.globalAlpha=1;
  // pipes/bookshelves
  g.pipes.forEach((p,i)=>drawShelfColumn(p.x,p.gapY,p.gapY,p.gapH,i));
  // player (purple winged jumper)
  const p=g.p; const px=p.x, py=p.y;
  rect(px+5,py,8,3,'#1e1e24'); rect(px+6,py+1,6,1,'#fff');
  rect(px+3,py+3,12,10,'#1e1e24'); rect(px+2,py+11,14,3,'#1e1e24');
  rect(px+4,py+4,10,8,'#6852c4'); rect(px+3,py+11,12,2,'#8973e6');
  const flap=(g.tick%10<5); rect(px,py+(flap?7:9),3,4,'#1e1e24'); rect(px+1,py+(flap?8:10),2,2,'#fff'); rect(px+15,py+(flap?7:9),3,4,'#1e1e24'); rect(px+15,py+(flap?8:10),2,2,'#fff');
  rect(px+5,py+6,2,2,'#1e1e24'); rect(px+11,py+6,2,2,'#1e1e24'); rect(px+7,py+9,4,1,'#1e1e24');
  // floor
  ctx.strokeStyle='#8c7a63'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(0,234); ctx.lineTo(400,234); ctx.stroke();
  for(let x=0;x<400;x+=16){for(let y=235;y<245;y+=5){rect(x,y,8,5,((x/16+y/5)%2===0)?'#e3d5b8':'#f5eedc'); rect(x+8,y,8,5,((x/16+y/5)%2!==0)?'#e3d5b8':'#f5eedc')}}
  ctx.restore();
  // footer
  rect(0,273,400,27,'#f7f4eb'); ctx.fillStyle='#1e1e24'; ctx.font='bold 11px "Courier New",monospace'; ctx.textAlign='center'; ctx.fillText('S / ↑ / TAP TO FLAP',200,290);
  if(g.mode==='countdown'||g.mode==='ready'){ctx.fillStyle='rgba(36,24,59,.55)'; ctx.fillRect(0,0,400,300); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.font='bold 34px "Courier New",monospace'; const n=Math.ceil(g.timer/60); ctx.fillText(g.mode==='ready'?'GO':String(Math.max(1,n)),200,145); ctx.font='bold 11px "Courier New",monospace'; ctx.fillText('TAP / S TO START',200,172)}
  if(g.over>0){ctx.fillStyle='#24183bcc';ctx.fillRect(0,0,400,300);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='bold 18px "Courier New",monospace';ctx.fillText('GAME OVER',200,145);ctx.font='bold 12px "Courier New",monospace';ctx.fillText(`GAPS ${g.gaps}`,200,168)}
  ctx.restore();
}

function togglePause(){if(activeGame!==null){paused=!paused;sfx('pause'); if(paused) stopBGM(); else refreshBGM()}}
function triggerControl(name, detail = {}){document.dispatchEvent(new CustomEvent(`arcade:${name}`, {detail}));}
function fitArcade(){
  const root=document.querySelector('.arcade');
  if(!root)return;
  if(window.innerWidth>600){
    document.documentElement.style.setProperty('--arcade-scale','1');
    root.style.transform='';
    root.style.top='0px';
    return;
  }
  root.style.transform='translateX(-50%) scale(1)';
  root.style.top='0px';
  const vv=window.visualViewport;
  const viewportHeight=vv?.height||window.innerHeight;
  const viewportWidth=vv?.width||window.innerWidth;
  const padX=8, padY=8;
  const naturalHeight=root.offsetHeight;
  const baseWidth=430;
  const widthScale=(viewportWidth-padX)/baseWidth;
  const heightScale=(viewportHeight-padY)/Math.max(naturalHeight,1);
  const scale=Math.min(widthScale,heightScale,1);
  const fittedScale=Math.max(scale,0.3);
  document.documentElement.style.setProperty('--arcade-scale',String(fittedScale));
  const scaledHeight=naturalHeight*fittedScale;
  const topOffset=Math.max(0,(viewportHeight-scaledHeight)/2);
  root.style.top=`${topOffset}px`;
  root.style.transform=`translateX(-50%) scale(${fittedScale})`;
}
const themes={
  lavender:{name:'Lavender',description:'Soft lavender shell',shell:'#c4a8e9',light:'#e4d8fa',dark:'#402763',deep:'#24183b',rim:'#8e73bb',rim2:'#9c7fc8',glow:'#ddd0f2',accent:'#7351bd'},
  pink:{name:'Light Pink',description:'See-through, frosted',shell:'#e9a9c5',light:'#f9deea',dark:'#5a2740',deep:'#331525',rim:'#c9829f',rim2:'#d99ab4',glow:'#f5d6e3',accent:'#b84c78'},
  purple:{name:'Electric Purple',description:'Bright arcade shell',shell:'#8b4dff',light:'#dcc8ff',dark:'#3b1678',deep:'#220d47',rim:'#6f3bcc',rim2:'#8a57e6',glow:'#cbb0ff',accent:'#5f27c7'},
  red:{name:'Cherry Red',description:'Bold retro shell',shell:'#e04b5a',light:'#ffd1d6',dark:'#5e1820',deep:'#350d12',rim:'#b63a47',rim2:'#cc5561',glow:'#f3b4bc',accent:'#a32133'},
  blue:{name:'Blue Dream',description:'Cool pixel shell',shell:'#5b7cff',light:'#d7e2ff',dark:'#1e2f6b',deep:'#121c3d',rim:'#4562d1',rim2:'#6986e8',glow:'#b9caff',accent:'#3550c9'}
};
let selectedTheme=localStorage.getItem('arcadeTheme')||'lavender';
function hexToRgb(hex){const h=hex.replace('#','');const n=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16);return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}}
function mix(hex,a,b,t){const c=hexToRgb(hex),d=hexToRgb(a),e=hexToRgb(b);const r=Math.round(c.r*(1-t)+(t>0?e.r:d.r)*Math.abs(t));const g=Math.round(c.g*(1-t)+(t>0?e.g:d.g)*Math.abs(t));const bl=Math.round(c.b*(1-t)+(t>0?e.b:d.b)*Math.abs(t));return `rgb(${r},${g},${bl})`}
function applyTheme(theme){selectedTheme=themes[theme]?theme:'lavender';const t=themes[selectedTheme];const r=document.documentElement.style;document.body.dataset.theme=selectedTheme;r.setProperty('--shell',t.shell);r.setProperty('--shell-light',t.light);r.setProperty('--shell-dark',t.dark);r.setProperty('--shell-deep',t.deep);r.setProperty('--shell-rim',t.rim);r.setProperty('--shell-rim2',t.rim2);r.setProperty('--shell-glow',t.glow);r.setProperty('--shell-accent',t.accent);r.setProperty('--shell-hi',mix(t.shell,'#ffffff','#000000',0.45));r.setProperty('--shell-mid',mix(t.shell,'#ffffff','#000000',0.08));r.setProperty('--shell-lo',mix(t.shell,'#ffffff','#000000',-0.18));localStorage.setItem('arcadeTheme',selectedTheme);$('#themeName').textContent=t.name;$('#themeDescription').textContent=t.description;document.querySelectorAll('.theme-swatch').forEach(swatch=>swatch.classList.toggle('active',swatch.dataset.theme===selectedTheme));triggerControl('theme',{theme:selectedTheme})}
function openTheme(){ensureAudio();applyTheme(selectedTheme);$('#themeModal').classList.remove('hidden')}
function closeTheme(){applyTheme(selectedTheme);$('#themeModal').classList.add('hidden')}
applyTheme(selectedTheme);
function openHelp(){const t=activeGame===null?games[selected].help:games[activeGame].help;$('#helpTitle').textContent=activeGame===null?'HOW TO PLAY':'CONTROLS';$('#helpText').textContent=t;$('#helpModal').classList.remove('hidden');triggerControl('help',{activeGame})}

window.addEventListener('keydown',event=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(event.key))event.preventDefault();
  const k=event.key, kl=k.toLowerCase(); ensureAudio();
  if(!started){ if(k==='Enter'||kl==='s'||k===' '||kl==='b'){enterMenu()} if(kl==='t')openTheme(); if(kl==='h')openHelp(); return; }
  if(activeGame===null){
    if(k==='ArrowUp'){selected=(selected+4)%5;renderMenu();sfx('move')}
    if(k==='ArrowDown'){selected=(selected+1)%5;renderMenu();sfx('move')}
    if(k==='Enter'||kl==='s'||k===' ')startGame();
  } else {
    keys[k]=true; keys[kl]=true;
    if(k==='Escape')backToMenu();
    if(kl==='p' && activeGame!==4 && activeGame!==2)togglePause();
  }
  if(kl==='t')openTheme();
  if(kl==='h')openHelp();
});
window.addEventListener('keyup',event=>{keys[event.key]=false;keys[event.key.toLowerCase()]=false});
document.querySelectorAll('[data-key]').forEach(button=>{const key=button.dataset.key;const activate=()=>{if(activeGame===null){if(key==='ArrowUp'){selected=(selected+4)%5;renderMenu();sfx('move')}else if(key==='ArrowDown'){selected=(selected+1)%5;renderMenu();sfx('move')}else if(key==='s'||key==='b')startGame()}else{if(key==='b'&&activeGame!==3&&activeGame!==2)backToMenu();if(key==='s'&&(activeGame===0||activeGame===1))togglePause()}};const down=event=>{event.preventDefault();button.dataset.pointerHandled='true';clearTimeout(button.pointerTimer);button.pointerTimer=setTimeout(()=>delete button.dataset.pointerHandled,500);haptic('press');keys[key]=true;keys[key.toLowerCase?key.toLowerCase():key]=true;try{button.setPointerCapture?.(event.pointerId)}catch{}
  activate()}; const up=()=>{keys[key]=false;keys[key.toLowerCase?key.toLowerCase():key]=false}; button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('pointerleave',up);button.addEventListener('touchstart',event=>{event.preventDefault();if(!button.dataset.pointerHandled){haptic('press');activate()}},{passive:false});button.addEventListener('click',()=>{if(button.dataset.pointerHandled)return;activate()});});
document.addEventListener('contextmenu',e=>{if(window.innerWidth<=600)e.preventDefault()});
$('#startScreen')?.addEventListener('click',()=>{ensureAudio();enterMenu()});$('#startScreen')?.addEventListener('pointerdown',e=>{e.preventDefault();ensureAudio();enterMenu()});$('#backButton').addEventListener('click',()=>{hideGameOver();backToMenu()});$('#closeButton').addEventListener('click',()=>{ hideGameOver(); if(activeGame!==null) backToMenu(); else if(started){ started=false; screenView.classList.add('hidden'); $('#startScreen')?.classList.remove('hidden'); $('#statusText').textContent='READY TO PLAY'; playBGM('home'); } });$('#soundButton').addEventListener('click',()=>{ensureAudio();soundOn=!soundOn;$('#soundButton').textContent=soundOn?'🔊':'🔇';showToast(soundOn?'SOUND ON':'SOUND OFF'); if(soundOn) refreshBGM(); else stopBGM();});$('#themeButton').addEventListener('click',openTheme);$('#helpButton').addEventListener('click',()=>{ensureAudio();openHelp()});$('#helpClose').addEventListener('click',()=>$('#helpModal').classList.add('hidden'));$('#themeClose').addEventListener('click',closeTheme);$('#themeDone').addEventListener('click',closeTheme);document.querySelectorAll('.theme-swatch').forEach(swatch=>swatch.addEventListener('click',()=>applyTheme(swatch.dataset.theme)));
started=false; $('#startScreen')?.classList.remove('hidden'); screenView.classList.add('hidden'); canvasWrap.classList.add('hidden'); $('#statusText').textContent='READY TO PLAY';
renderMenu();fitArcade();requestAnimationFrame(fitArcade);
window.addEventListener('resize',()=>{resizeCanvas();fitArcade()});
window.visualViewport?.addEventListener('resize',()=>{resizeCanvas();fitArcade()});
window.addEventListener('orientationchange',()=>{setTimeout(()=>{resizeCanvas();fitArcade()},200)});

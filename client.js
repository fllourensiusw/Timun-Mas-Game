(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const canvas = $('gameCanvas'), ctx = canvas.getContext('2d');
  const W = 1100, H = 720;
  const MAPS = [
    {name:'Desa Timun Mas',sub:'The Giant Is Coming',theme:'village',exit:[1030,360],gate:[890,360]},
    {name:'Hutan Bambu',sub:'The Magical Seeds',theme:'forest',exit:[1035,360],gate:[900,360]},
    {name:'Sungai Garam',sub:'The Salt River',theme:'river',exit:[1030,360],gate:[885,360]},
    {name:'Gunung Jarum',sub:'The Needle Mountain',theme:'mountain',exit:[1030,360],gate:[895,360]},
    {name:'Gerbang Laut Ajaib',sub:'The Final Escape',theme:'coast',exit:[1038,360],gate:[900,360],trap:[720,360]},
  ];
  const ITEM = {
    vine_seed:{label:'Magical cucumber seeds',glyph:'✿',where:'The glowing leaf in the village garden or three leaf markers in Hutan Bambu.',effect:'Grow vines that slow Buto Ijo for about 7 seconds.',story:'Born from the magical cucumber that brought Timun Mas into the world.'},
    seed_bag:{label:'Magical cucumber seeds',glyph:'✿',where:'The three glowing leaf markers in Hutan Bambu.',effect:'Plant one seed bag per marker; vines delay Buto Ijo for about 7 seconds.',story:'Mbok Srini’s cucumber seeds become a living barrier.'},
    salt:{label:'Magical salt',glyph:'✦',where:'The blue river symbol beside the repaired bridge.',effect:'Raise a magical current that slows Buto Ijo for about 8 seconds.',story:'A gift to help the companions cross the salt river.'},
    needle:{label:'Magical needles',glyph:'⌁',where:'Three needle symbols along the mountain trail.',effect:'Grow a thorn barrier that slows Buto Ijo for about 6 seconds. A side path stays open for companions.',story:'A gift from Mbok Srini for the dangerous mountain path.'},
    terasi:{label:'Magical shrimp paste (terasi)',glyph:'◉',where:'The glowing golden trap zone at the final coast.',effect:'Create sticky mud. On the final map, lure Buto Ijo into the zone to trap him.',story:'Mbok Srini’s last magical gift, made into a trap for the giant.'},
    key:{label:'Village gate key',glyph:'⚿',where:'Hidden around Desa Timun Mas; look for the golden marker.',effect:'Use at the village gate after finding all three route clues.',story:'An ordinary key that opens the escape route.'},
    planks:{label:'Bridge planks',glyph:'▤',where:'Scattered along the riverbanks.',effect:'Use two planks at the broken bridge, then add magical salt.',story:'Ordinary materials the companions need to repair the crossing.'},
  };
  const INTRO = [
    ['A promise came due.','Mbok Srini wished for a child. Buto Ijo gave her a magical cucumber seed, promising a daughter—and swearing to return for her when she grew up. From the cucumber, Timun Mas was born.'],
    ['Mbok Srini sent her running.','When the giant returned, Mbok Srini gave Timun Mas magical cucumber seeds, needles, salt, and shrimp paste (terasi). Each gift could delay Buto Ijo long enough to escape.'],
    ['You are her companions.','Join as 2–4 human companions. Timun Mas is an AI-controlled NPC who follows you; Buto Ijo is an AI-controlled pursuer. Move with WASD or the arrow keys, interact with E or Space, rescue captured teammates, and guide Timun Mas to safety. This is a creative game adaptation inspired by Indonesian folklore.'],
  ];
  let introStep=0, selectedColor='red', socket=null, connectMode=null, connectArgs=null, room=null, myId=null, isHost=false, serverOrigin=location.origin;
  let keys=new Set(), touchDirs=new Set(), interactHeld=false, lastSend=0, previousInv={}, seenAcquire=new Set(), lastMessage='', lastMap=-1, toastTimer=0, previousMode='';
  let scale=1, offsetX=0, offsetY=0, raf=0;
  const tokenKey='timunMasRoomToken', roomKey='timunMasRoomCode';

  function websocketUrl(){
    const configured=String(window.GAME_SERVER_URL||'').trim();
    if(!configured)return `${location.protocol==='https:'?'wss':'ws'}://${location.host}`;
    const url=new URL(configured,location.origin);
    if(url.protocol==='https:')url.protocol='wss:';
    if(url.protocol==='http:')url.protocol='ws:';
    if(!['ws:','wss:'].includes(url.protocol))throw new Error('GAME_SERVER_URL must use ws:// or wss://.');
    return url.toString().replace(/\/$/,'');
  }

  function show(id){$(id).classList.remove('hidden');}
  function hide(id){$(id).classList.add('hidden');}
  function setIntro(index){introStep=index;const s=INTRO[index];$('introTitle').textContent=s[0];$('introText').textContent=s[1];$('storyDots').innerHTML=INTRO.map((_,i)=>`<span class="${i===index?'active':''}"></span>`).join('');$('nextStory').innerHTML=index===INTRO.length-1?'Set up a room <span>→</span>':'Continue <span>→</span>';}
  function enterSetup(){hide('introScreen');show('lobbyScreen');show('entryPanel');hide('roomPanel');$('playerName').focus();}
  $('nextStory').addEventListener('click',()=>introStep<INTRO.length-1?setIntro(introStep+1):enterSetup());
  $('skipStory').addEventListener('click',enterSetup);
  document.querySelectorAll('.color-choice').forEach(b=>b.addEventListener('click',()=>{selectedColor=b.dataset.color;document.querySelectorAll('.color-choice').forEach(x=>x.classList.toggle('selected',x===b));}));
  $('roomCode').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5));
  const params=new URLSearchParams(location.search);if(params.get('room'))$('roomCode').value=params.get('room').toUpperCase().slice(0,5);

  function connect(mode,args){
    if(socket&&socket.readyState===WebSocket.OPEN){socket.close();}
    connectMode=mode;connectArgs=args;$('lobbyError').textContent='';$('roomError').textContent='';$('connectionLabel').textContent='Connecting…';$('liveDot').classList.remove('connected');
    try{socket=new WebSocket(websocketUrl());}catch(e){$('lobbyError').textContent=e.message||'Could not connect to the game server.';return;}
    socket.addEventListener('open',()=>{if(connectMode==='create')socket.send(JSON.stringify({type:'create',...connectArgs}));else socket.send(JSON.stringify({type:'join',...connectArgs}));});
    socket.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data);}catch{return;}if(m.type==='joined'){myId=m.id;localStorage.setItem(tokenKey,m.token);localStorage.setItem(roomKey,m.code);if(['localhost','127.0.0.1'].includes(location.hostname)&&m.lanOrigin)serverOrigin=m.lanOrigin;$('connectionLabel').textContent=`Room ${m.code}`;$('liveDot').classList.add('connected');}
      else if(m.type==='state'){room=m.room;updateView();}
      else if(m.type==='error'){const target=$('roomPanel').classList.contains('hidden')?'lobbyError':'roomError';$(target).textContent=m.message;}
    });
    socket.addEventListener('close',()=>{if(room?.game?.started&&!room.game.ended){$('connectionLabel').textContent='Disconnected · reconnecting';$('liveDot').classList.remove('connected');setTimeout(()=>reconnect(),1400);}});
    socket.addEventListener('error',()=>{if(!room){$('lobbyError').textContent=window.GAME_SERVER_URL?'Game server unavailable. Check the server URL and deployment status.':'Room server unavailable. Start server.mjs, then reload this page.';}});
  }
  function reconnect(){if(socket?.readyState===WebSocket.OPEN)return;const code=localStorage.getItem(roomKey),token=localStorage.getItem(tokenKey);if(code&&token)connect('join',{code,token,name:$('playerName').value,color:selectedColor});}
  $('createRoom').addEventListener('click',()=>{const name=$('playerName').value.trim()||'Companion';connect('create',{name,color:selectedColor,difficulty:$('difficulty').value});});
  $('joinRoom').addEventListener('click',()=>{const code=$('roomCode').value.trim();if(code.length!==5){$('lobbyError').textContent='Enter the five-character room code.';return;}const fresh=params.get('newCompanion')==='1';connect('join',{code,name:$('playerName').value.trim()||'Companion',color:selectedColor,token:fresh?'':localStorage.getItem(tokenKey)||''});});
  $('difficulty').addEventListener('change',()=>send({type:'difficulty',value:$('difficulty').value}));
  function send(payload){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(payload));}
  $('readyButton').addEventListener('click',()=>{const self=room?.players?.find(p=>p.id===myId);send({type:'ready',ready:!self?.ready});});
  $('startButton').addEventListener('click',()=>send({type:'start'}));
  $('leaveRoom').addEventListener('click',()=>{hide('roomPanel');show('entryPanel');document.body.classList.remove('in-game');room=null;myId=null;if(socket)socket.close();});
  $('copyInvite').addEventListener('click',async()=>{const code=room?.code;if(!code)return;const base=new URL(serverOrigin);const u=new URL(location.pathname,base);u.searchParams.set('room',code);try{await navigator.clipboard.writeText(u.toString());$('copyInvite').textContent='Copied!';}catch{$('copyInvite').textContent=`Code ${code}`;}setTimeout(()=>$('copyInvite').textContent='Copy invite',1800);});
  $('backToLobby').addEventListener('click',()=>{showToast(`Room ${room?.code||''} · Share the room code with companions.`);});

  function updateView(){if(!room)return;$('connectionLabel').textContent=`Room ${room.code}`;$('liveDot').classList.add('connected');isHost=room.hostId===myId;document.body.classList.toggle('in-game',!!room.started);
    if(!room.started){show('lobbyScreen');show('roomPanel');hide('entryPanel');hide('gameScreen');renderLobby();return;}
    // Endings are shared server state. Keep the overlay open until the server
    // confirms a restart, then clear each client's ending and per-run UI state.
    if(!room.game?.ended&&previousMode){previousMode='';hide('endingModal');lastMap=-1;previousInv={};seenAcquire.clear();lastMessage='';}
    hide('lobbyScreen');show('gameScreen');renderGame();
    if(room.game?.ended){showEnding(room.game.ended);}
  }
  function renderLobby(){
    $('roomTitle').textContent=`ROOM · ${room.code}`;$('inviteCode').textContent=room.code;$('difficultyPill').textContent=room.difficulty;$('difficulty').value=room.difficulty;$('difficultyWrap').classList.toggle('hidden',!isHost);$('startButton').classList.toggle('hidden',!isHost);
    const readyCount=room.players.filter(p=>p.connected&&p.ready).length;
    $('roster').innerHTML=room.players.map(p=>`<div class="roster-card"><span class="avatar ${esc(p.color)}">${esc(p.name.slice(0,1).toUpperCase())}</span><div><strong>${esc(p.name)}${p.host?' · host':''}</strong><small>${p.connected?'Connected':'Disconnected'}</small></div><span class="roster-status ${p.ready?'ready':''}">${p.ready?'✓ Ready':'Not ready'}</span></div>`).join('');
    const self=room.players.find(p=>p.id===myId);$('readyButton').textContent=self?.ready?'✓ Ready · change':'○ Mark ready';$('startButton').disabled=readyCount<2;$('startButton').textContent=readyCount<2?`Need 2 ready (${readyCount}/2)`:`Start adventure · ${readyCount} ready`;
    if(!isHost)$('roomError').textContent='Waiting for the host to start the adventure.';
  }
  function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function own(){return room?.game?.players?.find(p=>p.id===myId);}
  function renderGame(){const g=room.game,p=own();if(!p)return;
    if(g.map!==lastMap){lastMap=g.map;lastMessage='';previousInv={};hide('endingModal');showToast(g.message||`Map ${g.map+1}: ${MAPS[g.map].name}`);}
    const m=MAPS[g.map];$('mapCounter').textContent=`MAP ${g.map+1} OF 5`;$('mapHeading').innerHTML=`${esc(m.name)} <span>· ${esc(m.sub)}</span>`;$('gameDifficulty').textContent=room.difficulty;$('objectiveText').textContent=objective(g);$('threatText').textContent=g.buto.mode==='chasing'?'Chasing a companion':g.buto.mode==='threatening Timun Mas'?'Threatening Timun Mas':g.buto.mode==='trapped'?'Trapped!':g.buto.mode==='slowed'?'Slowed by magic':g.buto.mode==='drawn to terasi'?'Drawn to the trap':g.buto.mode==='searching'?'Searching nearby':'Recovering';$('npcStatus').textContent=g.npc.mode==='fleeing'?'Fleeing from Buto Ijo':g.npc.mode==='heading to exit'?'Heading to the exit':'Following a companion';
    const nearest=room.game.players.filter(x=>x.connected&&!x.captured).map(x=>Math.hypot(x.x-g.buto.x,x.y-g.buto.y)).sort((a,b)=>a-b)[0]||500;$('threatMeter').style.width=`${Math.max(5,Math.min(100,100-nearest/4.5))}%`;
    $('rosterMini').textContent=room.players.map(x=>`${x.name}${x.captured?' · caged':!x.connected?' · offline':''}`).join('  ·  ');
    $('gameMessage').textContent=g.message||'';renderInventory(p);renderRescue(p);
    const inv={};for(const it of p.inventory)inv[it.kind]=(inv[it.kind]||0)+it.uses;
    for(const [kind,count] of Object.entries(inv)){if((count>(previousInv[kind]||0))&&!seenAcquire.has(kind)){seenAcquire.add(kind);const meta=ITEM[kind];if(meta)showItemToast(`${meta.glyph} ${meta.label} · ${meta.effect} Find the matching marker; hold Interact.`);}}
    for(const kind of Object.keys(previousInv)){if(inv[kind]<(previousInv[kind]||0)&&ITEM[kind]&&['vine_seed','seed_bag','salt','needle','terasi'].includes(kind)){showItemToast(`${ITEM[kind].label} used · ${ITEM[kind].effect}`);}}
    previousInv=inv;
    if(g.message&&g.message!==lastMessage&&/rescued|caught|trap|magical|current|vines|barrier/i.test(g.message)){lastMessage=g.message;if(/rescued|caught|trap/i.test(g.message))showToast(g.message);}
    updateTouchVisibility();
  }
  function objective(g){const p=g.progress;if(g.map===0)return p.gateUnlocked?'Escort Timun Mas through the open village gate.':`Find route clues (${p.clues}/3) and the gate key, then open the village gate.`;if(g.map===1)return`Collect seed bags and plant at leaf markers (${p.planted.length}/3).`;if(g.map===2)return`Repair the bridge (${p.planksUsed}/2 planks), then use salt at the river marker.`;if(g.map===3)return`Grow thorn barriers (${p.needles.length}/3) and activate levers (${p.levers.length}/2).`;return`Collect gate seals (${p.seals}/3), set the terasi trap, then escort Timun Mas to the exit.`;}
  function renderInventory(p){const slots=$('inventorySlots');slots.innerHTML='';if(!p.inventory.length)slots.innerHTML='<div class="empty-slot">Empty · 2 slots</div>';for(const it of p.inventory){const meta=ITEM[it.kind]||{label:it.kind,glyph:'◈'};const el=document.createElement('div');el.className='inv-slot';el.innerHTML=`<span>${meta.glyph}</span><span>${esc(meta.label)}</span><b>×${it.uses}</b>`;slots.appendChild(el);}}
  function renderRescue(p){const others=room.game.players.filter(x=>x.captured);$('rescueStatus').textContent=p.captured?'You are caged · hold Interact for a teammate to rescue you.':others.length?`Rescue ${others.map(x=>x.name).join(', ')} · hold Interact beside a cage.`:'';}
  function showToast(text){const el=$('mapToast');el.textContent=text;show('mapToast');clearTimeout(toastTimer);toastTimer=setTimeout(()=>hide('mapToast'),3600);}
  function showItemToast(text){const el=$('itemToast');el.textContent=text;show('itemToast');clearTimeout(toastTimer);toastTimer=setTimeout(()=>hide('itemToast'),6500);}
  function guide(){const p=own();const mag=['vine_seed','salt','needle','terasi'];const content=mag.map(k=>{const kinds=k==='vine_seed'?['vine_seed','seed_bag']:[k];const i=p?.inventory?.filter(v=>kinds.includes(v.kind)).reduce((a,v)=>a+v.uses,0)||0;return`<article class="item-guide-card"><h3>${ITEM[k].glyph} ${ITEM[k].label}</h3><p><b>Story:</b> ${ITEM[k].story}</p><p><b>Effect:</b> ${ITEM[k].effect}</p><small><b>Use:</b> ${ITEM[k].where} &nbsp; <b>How:</b> hold Interact at the glowing marker. &nbsp; <b>Uses carried:</b> ${i}</small></article>`;}).join('');const ordinary=['key','planks'].map(k=>`<article class="item-guide-card"><h3>${ITEM[k].glyph} ${ITEM[k].label}</h3><p>${ITEM[k].effect}</p><small><b>Where:</b> ${ITEM[k].where} &nbsp; <b>Uses carried:</b> ${p?.inventory?.filter(v=>v.kind===k).reduce((a,v)=>a+v.uses,0)||0}</small></article>`).join('');$('itemGuideGrid').innerHTML=content+ordinary;show('guideModal');}
  $('guideButton').addEventListener('click',guide);$('closeGuide').addEventListener('click',()=>hide('guideModal'));$('guideModal').addEventListener('click',e=>{if(e.target===$('guideModal'))hide('guideModal');});
  function showEnding(ending){if(previousMode===ending)return;previousMode=ending;const win=ending==='victory';$('endingEyebrow').textContent=win?'The escape is complete':'A difficult ending';$('endingTitle').textContent=win?'Beyond the magical coast.':'Buto Ijo caught them.';$('endingText').textContent=win?'Timun Mas and her companions cross the final gate safely. Buto Ijo remains trapped in the sticky magical mud. Together, the companions helped her choose her own future.': 'Every companion was captured. In this telling, Buto Ijo reaches Timun Mas before the team can finish the escape. Gather again and try a new path.';$('endingActions').innerHTML=`<button class="button primary" id="newLayoutButton" ${!isHost?'disabled':''}>Play again · New layout</button><button class="button secondary" id="sameLayoutButton" ${!isHost?'disabled':''}>Replay same layout</button>`;show('endingModal');const requestRestart=sameLayout=>{const a=$('newLayoutButton'),b=$('sameLayoutButton');if(a)a.disabled=true;if(b)b.disabled=true;send({type:'restart',sameLayout});setTimeout(()=>{if(room?.game?.ended){if($('newLayoutButton'))$('newLayoutButton').disabled=!isHost;if($('sameLayoutButton'))$('sameLayoutButton').disabled=!isHost;}},3000);};$('newLayoutButton').onclick=()=>requestRestart(false);$('sameLayoutButton').onclick=()=>requestRestart(true);}

  function combinedDir(){const has=k=>keys.has(k)||touchDirs.has(k);let x=(has('right')||has('d')||has('arrowright')?1:0)-(has('left')||has('a')||has('arrowleft')?1:0);let y=(has('down')||has('s')||has('arrowdown')?1:0)-(has('up')||has('w')||has('arrowup')?1:0);return{x,y};}
  function gameActive(){return room?.game?.started&&!room.game.ended&&$('gameScreen').classList.contains('hidden')===false;}
  function beginInteract(){if(!interactHeld){interactHeld=true;send({type:'interact'});}}
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','e'].includes(k)&&gameActive()){e.preventDefault();if(k==='e'||k===' '){if(!e.repeat)beginInteract();}else keys.add(k);}});
  window.addEventListener('keyup',e=>{const k=e.key.toLowerCase();keys.delete(k);if(k==='e'||k===' ')interactHeld=false;});
  $('touchInteract').addEventListener('pointerdown',e=>{e.preventDefault();beginInteract();});for(const type of ['pointerup','pointercancel','pointerleave'])$('touchInteract').addEventListener(type,()=>interactHeld=false);
  document.querySelectorAll('[data-dir]').forEach(b=>{const d=b.dataset.dir;b.addEventListener('pointerdown',e=>{e.preventDefault();touchDirs.add(d);b.setPointerCapture(e.pointerId);});for(const t of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(t,()=>touchDirs.delete(d));});
  function updateTouchVisibility(){const touch=('ontouchstart'in window)||navigator.maxTouchPoints>0;$('touchControls').style.display=touch?'flex':'none';}
  setInterval(()=>{if(socket?.readyState!==WebSocket.OPEN||!room?.game?.started)return;const now=performance.now();if(now-lastSend<65)return;lastSend=now;const d=combinedDir();send({type:'input',x:d.x,y:d.y,interact:interactHeld});},50);

  function resizeCanvas(){const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);scale=Math.min(canvas.width/W,canvas.height/H);offsetX=(canvas.width-W*scale)/2;offsetY=(canvas.height-H*scale)/2;}
  window.addEventListener('resize',resizeCanvas);new ResizeObserver(resizeCanvas).observe(canvas);
  function roundRect(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}}
  function text(c,str,x,y,size=14,color='#f5f1e3',align='center'){c.font=`700 ${size}px 'DM Sans',system-ui,sans-serif`;c.textAlign=align;c.textBaseline='middle';c.lineWidth=3;c.strokeStyle='#0b1712cc';c.strokeText(str,x,y);c.fillStyle=color;c.fillText(str,x,y);}
  function path(c,points,width,color){c.beginPath();c.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)c.lineTo(points[i][0],points[i][1]);c.lineCap='round';c.lineJoin='round';c.lineWidth=width;c.strokeStyle=color;c.stroke();}
  function drawWorld(){const c=ctx,g=room?.game,m=MAPS[g?.map||0],theme=m.theme;
    const palettes={village:['#648858','#78945e'],forest:['#294e36','#315a3d'],river:['#77935d','#8aa36b'],mountain:['#727e65','#63715d'],coast:['#a3a16b','#8e9b65']};const [base,patch]=palettes[theme];c.fillStyle=base;c.fillRect(0,0,W,H);
    for(let i=0;i<180;i++){const x=(i*157+19)%W,y=(i*277+43)%H;c.globalAlpha=.1;c.fillStyle=i%2?'#d3dfa2':'#183d29';c.beginPath();c.ellipse(x,y,13+(i%7),4+(i%4),.4,0,Math.PI*2);c.fill();}c.globalAlpha=1;
    if(theme==='village'){path(c,[[65,360],[260,360],[450,380],[660,355],[890,360],[1080,360]],92,'#c5aa6b');path(c,[[65,360],[260,360],[450,380],[660,355],[890,360],[1080,360]],80,'#d1b97a');house(c,335,120,'Mbok Srini’s house');house(c,650,490,'Shed');well(c,540,236);garden(c,205,490);fence(c,205,303,300);fence(c,725,304,390);}
    if(theme==='forest'){path(c,[[65,360],[220,330],[320,390],[430,425],[535,390],[630,320],[750,298],[855,345],[980,375],[1080,360]],105,'#91a36a');path(c,[[65,360],[220,330],[320,390],[430,425],[535,390],[630,320],[750,298],[855,345],[980,375],[1080,360]],91,'#c1b780');for(let x=40;x<1080;x+=54){for(const y of [75,635])bamboo(c,x+(x%3)*6,y+(x%2)*15,24+(x%4)*3); }for(const [x,y] of [[125,190],[245,560],[910,220],[840,540]])bush(c,x,y);}
    if(theme==='river'){path(c,[[55,360],[340,360],[430,355],[680,360],[810,360],[1080,360]],110,'#c4aa70');c.fillStyle='#398db0';c.fillRect(0,275,W,165);c.globalAlpha=.65;for(let i=0;i<18;i++){path(c,[[i*72,310+(i%3)*35],[i*72+40,305+(i%3)*35],[i*72+75,310+(i%3)*35]],3,'#b6e7dc');}c.globalAlpha=1;path(c,[[420,360],[630,360]],40,'#987b4e');for(let i=0;i<(g?.progress.planksUsed||0);i++)path(c,[[445+i*46,342],[445+i*46,378]],5,'#d0a15c');house(c,240,500,'River hut');roundRect(c,790,190,120,45,8,'#886845','#d9bb79');text(c,'Dock',850,212,12);}
    if(theme==='mountain'){path(c,[[35,610],[210,550],[350,490],[450,420],[555,355],[660,305],[780,250],[920,210],[1080,160]],98,'#a3a18a');path(c,[[35,610],[210,550],[350,490],[450,420],[555,355],[660,305],[780,250],[920,210],[1080,160]],79,'#c1bda0');for(let i=0;i<8;i++){const x=70+i*138,y=70+(i%3)*45;rock(c,x,y,45+(i%3)*10);}rock(c,580,570,65);text(c,'SAFE SIDE PATH',780,485,11,'#dddfbd');}
    if(theme==='coast'){c.fillStyle='#347d91';c.fillRect(0,0,W,170);for(let i=0;i<11;i++)path(c,[[i*110,145+(i%2)*10],[i*110+42,137+(i%2)*10],[i*110+82,145+(i%2)*10]],3,'#b8e2ce');path(c,[[50,360],[280,360],[445,340],[605,370],[780,360],[1080,360]],130,'#d7c17c');path(c,[[50,360],[280,360],[445,340],[605,370],[780,360],[1080,360]],110,'#dfcd91');for(const [x,y] of [[300,225],[360,480],[840,250],[850,480]])rock(c,x,y,48);roundRect(c,135,250,92,74,8,'#756f53','#d4c98b');text(c,'RUINS',181,287,11,'#f4e6bb');}
    drawMarkers(c,g,m);
    if(g){for(const it of g.items)drawItem(c,it);drawCharacter(c,g.npc,'npc',g.npc.mode||'');drawCharacter(c,g.buto,'buto',g.buto.mode||'');for(const p of g.players)drawCharacter(c,p,p.id===myId?'self':'player','');drawPrompt(c,g,m);}
    drawCompass(c,g);
  }
  function house(c,x,y,label){roundRect(c,x,y,138,105,6,'#b9794b','#e0c183');c.fillStyle='#784635';c.beginPath();c.moveTo(x-10,y+10);c.lineTo(x+67,y-40);c.lineTo(x+148,y+10);c.closePath();c.fill();roundRect(c,x+53,y+49,32,56,3,'#64432e');roundRect(c,x+15,y+42,28,26,3,'#b7cfb2','#f1daa0');roundRect(c,x+96,y+42,28,26,3,'#b7cfb2','#f1daa0');text(c,label,x+68,y+123,10,'#fbefcc');}
  function well(c,x,y){c.fillStyle='#a9afa1';c.beginPath();c.ellipse(x,y,30,20,0,0,Math.PI*2);c.fill();c.fillStyle='#4a6350';c.beginPath();c.ellipse(x,y,20,12,0,0,Math.PI*2);c.fill();path(c,[[x-24,y-25],[x-24,y-41],[x+22,y-41],[x+22,y-25]],5,'#5b4834');text(c,'WELL',x,y+37,9);}
  function garden(c,x,y){roundRect(c,x,y,155,80,10,'#61704a','#c7b771');for(let i=0;i<5;i++){for(let j=0;j<3;j++){c.fillStyle='#91b569';c.beginPath();c.ellipse(x+19+i*28,y+16+j*22,8,4,-.45,0,Math.PI*2);c.fill();}}text(c,'CUCUMBER GARDEN',x+77,y+97,9,'#f5ebc7');}
  function fence(c,x,y,w){path(c,[[x,y],[x+w,y]],4,'#d6c497');for(let i=0;i<=w;i+=24)path(c,[[x+i,y-9],[x+i,y+10]],3,'#d6c497');}
  function bamboo(c,x,y,h){c.fillStyle='#699655';roundRect(c,x,y,8,h,4,'#699655','#b0c26c');path(c,[[x+4,y+6],[x+4,y+h-6]],1,'#c7d27e');for(let i=12;i<h;i+=18)path(c,[[x,y+i],[x+8,y+i]],1,'#c7d27e');c.fillStyle='#4a824b';c.beginPath();c.ellipse(x-10,y+16,14,5,-.5,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(x+16,y+34,15,5,.4,0,Math.PI*2);c.fill();}
  function bush(c,x,y){c.fillStyle='#3e7045';for(let i=0;i<4;i++){c.beginPath();c.arc(x+(i%2)*16,y+Math.floor(i/2)*14,14,0,Math.PI*2);c.fill();}c.fillStyle='#a7c073';c.beginPath();c.arc(x+7,y+4,4,0,Math.PI*2);c.fill();}
  function rock(c,x,y,r){c.fillStyle='#687364';c.beginPath();c.moveTo(x-r,y+r*.3);c.lineTo(x-r*.5,y-r*.8);c.lineTo(x+r*.18,y-r);c.lineTo(x+r,y-r*.25);c.lineTo(x+r*.68,y+r*.7);c.closePath();c.fill();path(c,[[x-r*.5,y-r*.55],[x,y-r*.2],[x+r*.4,y-r*.35]],3,'#a5aa8b');}
  function marker(c,x,y,glyph,label,color='#e8cd78',active=true){c.save();c.globalAlpha=active?1:.45;c.beginPath();c.arc(x,y,25+Math.sin(performance.now()/280)*2,0,Math.PI*2);c.fillStyle=color+'26';c.fill();c.strokeStyle=color;c.lineWidth=2;c.setLineDash([4,4]);c.beginPath();c.arc(x,y,23,0,Math.PI*2);c.stroke();c.setLineDash([]);c.fillStyle='#13271d';c.beginPath();c.arc(x,y,15,0,Math.PI*2);c.fill();c.fillStyle=color;c.font='bold 19px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(glyph,x,y+1);text(c,label,x,y+38,9,'#fff1c7');c.restore();}
  function drawMarkers(c,g,m){if(!g)return;const p=g.progress;
    if(g.map===0){marker(c,300,520,'✿','VINE LEAF','#b3dc83',true);marker(c,m.gate[0],m.gate[1],'⚿',p.gateUnlocked?'GATE OPEN':'GATE', '#edcf72',!p.gateUnlocked);marker(c,m.exit[0],m.exit[1],'➜','EXIT','#d5ebaa',true);}
    if(g.map===1){[[420,185],[590,520],[780,335]].forEach((s,i)=>marker(c,s[0],s[1],p.planted.includes(i)?'✓':'✿',p.planted.includes(i)?'VINES':'PLANT','#b3dc83',!p.planted.includes(i)));marker(c,m.exit[0],m.exit[1],'➜','EXIT','#d5ebaa',p.planted.length===3);}
    if(g.map===2){marker(c,525,365,g.progress.planksUsed<2?'▤':'✦',g.progress.planksUsed<2?'REPAIR':'SALT','#92d9e9',g.progress.planksUsed<2||!g.progress.saltUsed);marker(c,m.exit[0],m.exit[1],'➜','EXIT','#d5ebaa',g.progress.planksUsed>=2&&g.progress.saltUsed);}
    if(g.map===3){[[385,205],[600,520],[805,300]].forEach((s,i)=>marker(c,s[0],s[1],p.needles.includes(i)?'✓':'⌁',p.needles.includes(i)?'THORNS':'NEEDLE','#e6c986',!p.needles.includes(i)));(g.leverSpots?.length?g.leverSpots:[[500,185],[735,535]]).forEach((s,i)=>marker(c,s[0],s[1],p.levers.includes(i)?'✓':'⚒',p.levers.includes(i)?'OPEN':'LEVER','#e3b989',!p.levers.includes(i)));marker(c,m.exit[0],m.exit[1],'➜','EXIT','#d5ebaa',p.needles.length===3&&p.levers.length===2);}
    if(g.map===4){marker(c,m.trap[0],m.trap[1],p.butoTrapped?'✦':'◉',p.butoTrapped?'TRAPPED':'TERASI TRAP','#e9c35d',!p.butoTrapped);marker(c,m.gate[0],m.gate[1],p.seals>=3?'✦':'◇',`SEALS ${p.seals}/3`,'#c9deeb',p.seals<3);marker(c,m.exit[0],m.exit[1],'➜','EXIT','#d5ebaa',p.seals>=3);}
  }
  function drawItem(c,it){const meta=ITEM[it.kind]||{glyph:it.kind==='clue'?'⌕':'◇',label:it.kind};const color=it.kind==='salt'?'#a3e1f1':it.kind==='seal'?'#e2e8bc':it.kind==='clue'?'#ffe5a0':'#d9e99f';const bob=Math.sin(performance.now()/240+it.x)*3;c.save();c.shadowColor=color;c.shadowBlur=13;c.fillStyle='#11271b';c.beginPath();c.arc(it.x,it.y+bob,17,0,Math.PI*2);c.fill();c.strokeStyle=color;c.lineWidth=2;c.stroke();c.shadowBlur=0;c.fillStyle=color;c.font='bold 18px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(meta.glyph||'◈',it.x,it.y+bob+1);text(c,it.kind==='clue'?'ROUTE CLUE':it.kind==='seal'?'GATE SEAL':meta.label,it.x,it.y+29,8,'#fff2ca');c.restore();}
  function drawCharacter(c,p,kind,mode){if(!p)return;const x=p.x,y=p.y;if(kind==='buto'&&mode==='trapped'){c.save();c.strokeStyle='#e6ce75';c.lineWidth=6;for(let i=-2;i<=2;i++){path(c,[[x+i*10-28,y-28],[x+i*10-28,y+28]],4,'#b2a15a');}path(c,[[x-30,y+28],[x+30,y+28]],4,'#d7c471');c.restore();}
    c.save();if(kind==='buto'){c.fillStyle='#07110d66';c.beginPath();c.ellipse(x,y+21,26,9,0,0,Math.PI*2);c.fill();c.fillStyle='#28744b';c.beginPath();c.ellipse(x,y,24,28,0,0,Math.PI*2);c.fill();c.fillStyle='#3c8b55';c.beginPath();c.arc(x,y-10,21,0,Math.PI*2);c.fill();c.fillStyle='#f2d773';c.beginPath();c.arc(x-7,y-13,3,0,Math.PI*2);c.arc(x+7,y-13,3,0,Math.PI*2);c.fill();c.fillStyle='#122319';c.fillRect(x-6,y-2,12,3);c.strokeStyle='#baed82';c.lineWidth=2;c.beginPath();c.arc(x,y,32,0,Math.PI*2);c.stroke();text(c,mode==='trapped'?'BUTO IJO · TRAPPED':'BUTO IJO',x,y-43,10,'#ffe39b');}
    else if(kind==='npc'){c.fillStyle='#09140e55';c.beginPath();c.ellipse(x,y+16,15,6,0,0,Math.PI*2);c.fill();c.fillStyle='#e1b873';c.beginPath();c.arc(x,y-3,13,0,Math.PI*2);c.fill();c.fillStyle='#b94c43';c.beginPath();c.ellipse(x,y+11,13,16,0,0,Math.PI*2);c.fill();c.fillStyle='#416d40';c.beginPath();c.ellipse(x,y-16,14,4,-.1,Math.PI,Math.PI*2);c.fill();text(c,'TIMUN MAS · NPC',x,y-34,9,'#ffe4a5');}
    else{const col={red:'#e96e62',blue:'#64a6e0',green:'#65b982',yellow:'#e6c24d'}[p.color]||'#cbd9a3';c.fillStyle='#09140e66';c.beginPath();c.ellipse(x,y+14,16,7,0,0,Math.PI*2);c.fill();c.fillStyle=col;c.beginPath();c.arc(x,y,15,0,Math.PI*2);c.fill();c.strokeStyle=kind==='self'?'#fff4ca':'#f3f2d6';c.lineWidth=kind==='self'?3:2;c.stroke();c.fillStyle='#183120';c.beginPath();c.arc(x,y-3,6,0,Math.PI*2);c.fill();text(c,p.name,x,y-28,10,kind==='self'?'#fff1b8':'#f0f4e8');if(p.captured){roundRect(c,x-20,y-30,40,55,4,null,'#f0d276');for(let i=-1;i<=1;i++)path(c,[[x+i*10,y-30],[x+i*10,y+25]],2,'#e7cd78');text(c,'CAGED',x,y+40,9,'#ffe69b');}}
    c.restore();}
  function drawPrompt(c,g,m){const p=g.players.find(x=>x.id===myId);if(!p)return;let prompt='';const d=(x,y)=>Math.hypot(p.x-x,p.y-y);const item=g.items.find(i=>d(i.x,i.y)<56);if(item)prompt=`Hold Interact · pick up ${item.kind==='clue'?'route clue':item.kind==='seal'?'gate seal':(ITEM[item.kind]?.label||item.kind)}`;else if(g.players.some(x=>x.captured&&x.id!==myId&&d(x.x,x.y)<66))prompt='Hold Interact · rescue teammate';else if(g.map===0&&d(m.gate[0],m.gate[1])<75)prompt='Hold Interact · open village gate';else if(g.map===0&&d(300,520)<70)prompt='Hold Interact · use magical seeds';else if(g.map===1&&[[420,185],[590,520],[780,335]].some(s=>d(s[0],s[1])<68))prompt='Hold Interact · plant magical seeds';else if(g.map===2&&d(525,365)<78)prompt='Hold Interact · repair bridge / use salt';else if(g.map===3&&[[385,205],[600,520],[805,300],...(g.leverSpots||[[500,185],[735,535]])].some(s=>d(s[0],s[1])<70))prompt='Hold Interact · activate marker';else if(g.map===4&&d(m.trap[0],m.trap[1])<80)prompt='Hold Interact · set the terasi trap';else if(d(m.exit[0],m.exit[1])<80)prompt='Hold Interact · leave with Timun Mas';if(prompt){roundRect(c,W/2-175,H-54,350,30,15,'#0d1d15e8','#d3c17a88');text(c,prompt,W/2,H-39,10,'#fff2c9');}}
  function drawCompass(c,g){if(!g)return;roundRect(c,16,16,165,29,10,'#0c1b14bb','#ffffff35');text(c,'N',32,30,9,'#e4d28a');text(c,MAPS[g.map].name,106,30,10,'#e8eddf');}
  function frame(){if(!canvas.width)resizeCanvas();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#1a3828';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.setTransform(scale,0,0,scale,offsetX,offsetY);drawWorld();raf=requestAnimationFrame(frame);}
  updateTouchVisibility();resizeCanvas();frame();setIntro(0);
})();

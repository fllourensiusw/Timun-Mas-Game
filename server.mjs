import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const W = 1100, H = 720;
const DIFFICULTY = {
  Easy: { playerSpeed: 3.1, enemySpeed: 2.17, detect: 265, rescue: 1000, itemUses: 1 },
  Normal: { playerSpeed: 3.1, enemySpeed: 2.25, detect: 350, rescue: 1800, itemUses: 1 },
  Hard: { playerSpeed: 3.1, enemySpeed: 3.72, detect: 440, rescue: 2600, itemUses: 1 },
};
const MAPS = [
  { name: 'Desa Timun Mas', subtitle: 'The Giant Is Coming', theme: 'village', start: [125, 360], enemy: [965, 360], npc: [170, 395], exit: [1030, 360], gate: [890, 360], trap: null },
  { name: 'Hutan Bambu', subtitle: 'The Magical Seeds', theme: 'forest', start: [110, 365], enemy: [980, 360], npc: [155, 398], exit: [1035, 360], gate: [900, 360], trap: null },
  { name: 'Sungai Garam', subtitle: 'The Salt River', theme: 'river', start: [110, 360], enemy: [970, 365], npc: [155, 395], exit: [1030, 360], gate: [885, 360], trap: null },
  { name: 'Gunung Jarum', subtitle: 'The Needle Mountain', theme: 'mountain', start: [110, 360], enemy: [975, 360], npc: [155, 395], exit: [1030, 360], gate: [895, 360], trap: null },
  { name: 'Gerbang Laut Ajaib', subtitle: 'The Final Escape', theme: 'coast', start: [105, 360], enemy: [980, 360], npc: [150, 395], exit: [1038, 360], gate: [900, 360], trap: [720, 360] },
];
const SPAWNS = {
  clue: [[250,210],[400,550],[650,210],[760,520]], key: [[820,590],[325,350]],
  vine_seed: [[290,585],[620,570],[770,220],[450,200]], seed_bag: [[240,210],[480,565],[760,205],[800,540]],
  planks: [[260,210],[450,565],[760,205]], salt: [[310,560],[780,200]], needle: [[280,215],[520,570],[790,210]],
  terasi: [[265,220],[480,565],[770,205]], seal: [[260,215],[490,570],[780,205],[790,535]],
};
const ITEM_META = {
  vine_seed: { label: 'Magical cucumber seeds', glyph: '✿', guide: 'From the cucumber that brought Timun Mas into the world. Plant them at leaf markers to grow vines that slow Buto Ijo for a few seconds.' },
  seed_bag: { label: 'Seed bag', glyph: '✿', guide: 'Magical cucumber seeds from Mbok Srini. Plant them at leaf markers to grow vines that slow Buto Ijo.' },
  salt: { label: 'Magical salt', glyph: '✦', guide: 'A gift for the river crossing. Use it at the blue river marker to raise a magical current that delays Buto Ijo.' },
  needle: { label: 'Magical needles', glyph: '⌁', guide: 'A gift for the mountain path. Use one at each needle marker to grow thorns that slow Buto Ijo; the side path stays safe.' },
  terasi: { label: 'Magical shrimp paste (terasi)', glyph: '◉', guide: 'Mbok Srini’s final gift. Use it at the glowing trap zone to make sticky mud. It can slow Buto Ijo; on the final map it traps him when he reaches the zone.' },
  key: { label: 'Village gate key', glyph: '⚿', guide: 'A small iron key hidden in the village. Bring it to the gate after finding all three route clues.' },
  planks: { label: 'Bridge planks', glyph: '▤', guide: 'Two sturdy planks. Bring them to the broken bridge to repair the crossing.' },
};
const COLORS = new Set(['red','blue','green','yellow']);
const rooms = new Map();
const sockets = new Set();
function lanAddress(){
  const addresses=Object.values(networkInterfaces()).flatMap(entries=>entries||[]).filter(a=>(a.family==='IPv4'||a.family===4)&&!a.internal).map(a=>a.address);
  return addresses.find(a=>a.startsWith('192.168.')||a.startsWith('10.')||/^172\.(1[6-9]|2\d|3[01])\./.test(a))||addresses[0]||'localhost';
}

function roomCode() { let s=''; const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; do { s=Array.from({length:5},()=>chars[Math.random()*chars.length|0]).join(''); } while (rooms.has(s)); return s; }
function rng(seed) { let x = seed >>> 0; return () => { x += 0x6D2B79F5; let t=x; t=Math.imul(t ^ t>>>15,t|1); t^=t+Math.imul(t ^ t>>>7,t|61); return ((t ^ t>>>14)>>>0)/4294967296; }; }
function shuffled(list, random) { const a=list.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function newProgress() { return { clues:0, gateUnlocked:false, planted:[], planksUsed:0, saltUsed:false, needles:[], levers:[], seals:0, trapArmed:false, butoTrapped:false }; }
function seededLevers(seed){const r=rng(seed^0x5EED);const first=shuffled([[500,185],[465,215],[535,205]],r)[0];const second=shuffled([[735,535],[790,500],[690,545]],r)[0];return[first,second];}
function buildItems(room, mapIndex, seed) {
  const random=rng(seed + mapIndex*9973), items=[];
  const easy=room.difficulty==='Easy', hard=room.difficulty==='Hard';
  const add=(kind,count,uses=1)=>{
    const positions=shuffled(SPAWNS[kind],random);
    for(let i=0;i<count;i++) items.push({ id:`${mapIndex}-${kind}-${i}-${seed}`,kind,x:positions[i%positions.length][0],y:positions[i%positions.length][1],uses });
  };
  if(mapIndex===0){ add('clue',3); add('key',1); add('vine_seed',2,easy?3:hard?1:2); }
  if(mapIndex===1){ add('seed_bag',easy?4:3,1); }
  if(mapIndex===2){ add('planks',1,easy?3:2); add('salt',1,1); }
  if(mapIndex===3){ add('needle',1,easy?4:3); }
  if(mapIndex===4){ add('terasi',1,easy?2:1); add('seal',3); }
  return items;
}
function makeGame(room, seed) {
  room.seed=seed; room.game={started:true,ended:null,map:0,progress:newProgress(),items:buildItems(room,0,seed),leverSpots:[],players:{},npc:{x:MAPS[0].npc[0],y:MAPS[0].npc[1]},buto:{x:MAPS[0].enemy[0],y:MAPS[0].enemy[1],mode:'search',slowUntil:0,trapArmed:false},message:'Find three route clues and the gate key.',transition:0};
  let i=0; for(const p of Object.values(room.players)){ p.x=MAPS[0].start[0]+i*34; p.y=MAPS[0].start[1]+(i%2?30:-30); p.captured=false; p.captureProgress=0; p.inventory=[]; p.input={x:0,y:0,interact:false}; p.interactPulse=false; p.slot=i++; room.game.players[p.id]=p; }
}
function enterMap(room,index) {
  const g=room.game,m=MAPS[index]; g.map=index;g.progress=newProgress();g.items=buildItems(room,index,room.seed);g.leverSpots=index===3?seededLevers(room.seed):[];g.npc={x:m.npc[0],y:m.npc[1]};g.buto={x:m.enemy[0],y:m.enemy[1],mode:'search',slowUntil:0,trapArmed:false};g.transition=4;g.message=`New layout · ${m.name}: ${m.subtitle}`;
  let i=0;for(const p of Object.values(room.players)){p.x=m.start[0]+i*34;p.y=m.start[1]+(i%2?30:-30);p.captured=false;p.captureProgress=0;p.inventory=[];p.input={x:0,y:0,interact:false};p.interactPulse=false;p.slot=i++;}
}
function publicRoom(room) {
  const g=room.game;
  return {code:room.code,hostId:room.hostId,difficulty:room.difficulty,seed:room.seed,started:!!g?.started,players:Object.values(room.players).map(p=>({id:p.id,name:p.name,color:p.color,ready:p.ready,connected:p.connected,host:p.id===room.hostId,captured:p.captured})),game:g?{started:g.started,ended:g.ended,map:g.map,progress:g.progress,items:g.items,leverSpots:g.leverSpots,npc:g.npc,buto:{...g.buto,slowUntil:Math.max(0,g.buto.slowUntil-Date.now())},players:Object.values(g.players).map(p=>({id:p.id,name:p.name,color:p.color,x:p.x,y:p.y,captured:p.captured,captureProgress:p.captureProgress,connected:p.connected,inventory:p.inventory})),message:g.message,transition:g.transition}:null};
}
function sendJson(ws,obj){ if(ws?.readyState===1) wsSend(ws,JSON.stringify(obj)); }
function broadcast(room){const data={type:'state',room:publicRoom(room)};for(const p of Object.values(room.players))if(p.ws?.readyState===1)sendJson(p.ws,data);}
function err(ws,message){sendJson(ws,{type:'error',message});}
function sanitizeName(value){return String(value||'Companion').replace(/[<>\n\r]/g,'').trim().slice(0,18)||'Companion';}
function bindPlayer(ws,room,p){p.ws=ws;p.connected=true;p.disconnectedAt=0;ws.playerId=p.id;ws.roomCode=room.code;sendJson(ws,{type:'joined',id:p.id,token:p.token,code:room.code,lanOrigin:`http://${lanAddress()}:${PORT}`});broadcast(room);}
function findPlayer(ws){const r=rooms.get(ws.roomCode);return r?{room:r,player:r.players[ws.playerId]}:null;}
function closeRoomIfEmpty(room){if(Object.values(room.players).every(p=>!p.connected)&&!room.game?.started)rooms.delete(room.code);}

function handle(ws,msg){
  if(!msg||typeof msg!=='object')return;
  if(msg.type==='create'){
    const code=roomCode(), id=crypto.randomUUID(), token=crypto.randomBytes(18).toString('hex');
    const room={code,hostId:id,difficulty:['Easy','Normal','Hard'].includes(msg.difficulty)?msg.difficulty:'Normal',seed:Math.random()*0x7fffffff|0,players:{},game:null};
    const p={id,token,name:sanitizeName(msg.name),color:COLORS.has(msg.color)?msg.color:'red',ready:false,connected:true,ws,created:Date.now(),x:125,y:360,captured:false,captureProgress:0,inventory:[],input:{x:0,y:0,interact:false},interactPulse:false,slot:0};room.players[id]=p;rooms.set(code,room);bindPlayer(ws,room,p);return;
  }
  if(msg.type==='join'){
    const room=rooms.get(String(msg.code||'').toUpperCase());if(!room)return err(ws,'Room not found. Check the five-character code.');
    if(msg.token){const prior=Object.values(room.players).find(p=>p.token===msg.token);if(prior){if(prior.ws&&prior.ws!==ws){try{prior.ws.close(4001,'reconnected elsewhere');}catch{}}bindPlayer(ws,room,prior);return;}}
    if(room.game?.started)return err(ws,'This adventure has already started. Reconnect with your saved session or create a new room.');
    if(Object.values(room.players).length>=4)return err(ws,'This room is full (4 companions maximum).');
    const id=crypto.randomUUID(),p={id,token:crypto.randomBytes(18).toString('hex'),name:sanitizeName(msg.name),color:COLORS.has(msg.color)?msg.color:'blue',ready:false,connected:true,ws,created:Date.now(),x:125,y:360,captured:false,captureProgress:0,inventory:[],input:{x:0,y:0,interact:false},interactPulse:false,slot:Object.keys(room.players).length};room.players[id]=p;bindPlayer(ws,room,p);return;
  }
  const found=findPlayer(ws);if(!found)return;const {room,player}=found;if(!player)return;
  if(msg.type==='ready'&&!room.game?.started){player.ready=!!msg.ready;broadcast(room);return;}
  if(msg.type==='difficulty'&&player.id===room.hostId&&!room.game?.started){if(DIFFICULTY[msg.value])room.difficulty=msg.value;broadcast(room);return;}
  if(msg.type==='start'&&player.id===room.hostId&&!room.game?.started){const ready=Object.values(room.players).filter(p=>p.connected&&p.ready);if(ready.length<2)return err(ws,'At least two connected companions must be ready.');const seed=Math.random()*0x7fffffff|0;makeGame(room,seed);broadcast(room);return;}
  if(msg.type==='restart'&&player.id===room.hostId&&room.game?.ended){const seed=msg.sameLayout?room.seed:(Math.random()*0x7fffffff|0);makeGame(room,seed);broadcast(room);return;}
  if(msg.type==='input'&&room.game?.started&&!room.game.ended){player.input={x:Math.max(-1,Math.min(1,Number(msg.x)||0)),y:Math.max(-1,Math.min(1,Number(msg.y)||0)),interact:!!msg.interact};return;}
  if(msg.type==='interact'&&room.game?.started&&!room.game.ended){player.interactPulse=true;return;}
  if(msg.type==='guide')return;
}

function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function collides(x,y,r){return x<r||y<r||x>W-r||y>H-r;}
function move(e,dx,dy,r=14){let x=e.x+dx,y=e.y;if(!collides(x,y,r))e.x=x;x=e.x;y=e.y+dy;if(!collides(x,y,r))e.y=y;e.x=Math.max(r,Math.min(W-r,e.x));e.y=Math.max(r,Math.min(H-r,e.y));}
function invItem(p,kind){return p.inventory.find(i=>i.kind===kind&&i.uses>0);}
function give(p,kind,uses=1){const stack=invItem(p,kind);if(stack){stack.uses+=uses;return true;}if(p.inventory.length>=2)return false;p.inventory.push({kind,uses});return true;}
function consume(p,kind){const it=invItem(p,kind);if(!it)return false;it.uses--;if(it.uses<=0)p.inventory=p.inventory.filter(v=>v!==it);return true;}
function objective(room){const {game:g}=room,p=g.progress,i=g.map;if(i===0)return p.gateUnlocked?'Escort Timun Mas through the open village gate.':`Find route clues (${p.clues}/3) and the gate key, then open the village gate.`;if(i===1)return `Collect seed bags and plant at leaf markers (${p.planted.length}/3).`;if(i===2)return `Repair the bridge (${p.planksUsed}/2 planks), then use salt at the river marker.`;if(i===3)return `Grow thorn barriers (${p.needles.length}/3) and activate levers (${p.levers.length}/2).`;return `Collect gate seals (${p.seals}/3), set the terasi trap, then escort Timun Mas to the exit.`;}
function interactAt(room,p){const g=room.game,m=MAPS[g.map],q=g.progress;
  const cageDist=Object.values(g.players).filter(t=>t.captured).map(t=>({t,d:dist(p,t)})).sort((a,b)=>a.d-b.d)[0];
  if(cageDist&&cageDist.d<55){cageDist.t.captureProgress+=50;if(cageDist.t.captureProgress>=(DIFFICULTY[room.difficulty].rescue)){cageDist.t.captured=false;cageDist.t.captureProgress=0;cageDist.t.x=p.x+20;cageDist.t.y=p.y+20;g.message=`${cageDist.t.name} has been rescued!`;}return;}
  const obj=g.items.filter(it=>dist(p,it)<43).sort((a,b)=>dist(p,a)-dist(p,b))[0];
  if(obj){
    if(obj.kind==='clue'){q.clues++;g.items=g.items.filter(i=>i!==obj);g.message=`Route clue found (${q.clues}/3).`;return;}
    if(obj.kind==='seal'){q.seals++;g.items=g.items.filter(i=>i!==obj);g.message=`Gate seal found (${q.seals}/3).`;return;}
    const uses=obj.uses; if(!give(p,obj.kind,uses)) {g.message='Inventory full — use or share an item first.';return;}g.items=g.items.filter(i=>i!==obj);g.message=`${ITEM_META[obj.kind]?.label||obj.kind} collected.`;return;
  }
  const near=(pt,range=58)=>pt&&dist(p,{x:pt[0],y:pt[1]})<range;
  if(g.map===0&&near(m.gate)){
    if(q.gateUnlocked){g.message='The village gate is open. Bring Timun Mas to the path exit.';return;}
    if(q.clues<3){g.message=`Find all three route clues first (${q.clues}/3).`;return;}
    if(!consume(p,'key')){g.message='Find the village gate key. It is marked with a golden ⚿.';return;}
    q.gateUnlocked=true;g.message='The village gate is open! Escort Timun Mas to the exit.';return;
  }
  if(g.map===0&&near([300,520],62)){if(!consume(p,'vine_seed')){g.message='Use magical cucumber seeds at the glowing garden leaf.';return;}g.buto.slowUntil=Date.now()+7000;g.message='Magical vines slow Buto Ijo!';return;}
  if(g.map===1){const spots=[[420,185],[590,520],[780,335]];const ix=spots.findIndex((s,i)=>!q.planted.includes(i)&&near(s,56));if(ix>=0){if(!consume(p,'seed_bag')){g.message='Bring a seed bag to a glowing leaf marker.';return;}q.planted.push(ix);g.buto.slowUntil=Date.now()+7000;g.message='Magical vines slow Buto Ijo!';if(q.planted.length===3)g.message='All vines have grown. The forest path is clear!';return;}}
  if(g.map===2&&near([525,365],65)){if(q.planksUsed<2){if(!consume(p,'planks')){g.message='Bring bridge planks here (two uses required).';return;}q.planksUsed++;g.message=`Bridge repaired (${q.planksUsed}/2 planks).`;return;}if(!q.saltUsed){if(!consume(p,'salt')){g.message='Use magical salt at the blue river marker.';return;}q.saltUsed=true;g.buto.slowUntil=Date.now()+8000;g.message='A magical current surges across the river!';return;}}
  if(g.map===3){const spots=[[385,205],[600,520],[805,300]];const ix=spots.findIndex((s,i)=>!q.needles.includes(i)&&near(s,56));if(ix>=0){if(!consume(p,'needle')){g.message='Bring magical needles to a glowing needle marker.';return;}q.needles.push(ix);g.buto.slowUntil=Date.now()+6500;g.message='A thorn barrier delays Buto Ijo. The side path is safe.';return;}const levers=g.leverSpots||[[500,185],[735,535]];const li=levers.findIndex((s,i)=>!q.levers.includes(i)&&near(s,55));if(li>=0){q.levers.push(li);g.message=`Mountain lever activated (${q.levers.length}/2).`;return;}}
  if(g.map===4&&near(m.trap,68)){if(!q.trapArmed){if(!consume(p,'terasi')){g.message='Bring magical terasi to the glowing trap zone.';return;}q.trapArmed=true;g.buto.trapArmed=true;g.message='Sticky mud is ready. Lure Buto Ijo into the glowing trap zone!';return;}g.message=q.butoTrapped?'Buto Ijo is trapped. Get Timun Mas to the glowing exit!':'Trap is ready — lead Buto Ijo into the mud.';return;}
  if(near(m.exit,62)){
    const ready=g.map===0?q.gateUnlocked:g.map===1?q.planted.length===3:g.map===2?q.planksUsed>=2&&q.saltUsed:g.map===3?q.needles.length===3&&q.levers.length===2:q.seals>=3;
    if(!ready){g.message=objective(room);return;}
    if(dist(g.npc,{x:m.exit[0],y:m.exit[1]})<72){if(g.map===4){if(!q.butoTrapped){g.message='Buto Ijo must be trapped before everyone escapes!';return;}g.ended='victory';g.message='Timun Mas and her companions escape safely.';return;}if(g.map===4) return;enterMap(room,g.map+1);return;}
    g.message='Wait for Timun Mas to reach the exit.';return;
  }
}

function tickRoom(room,dt){const g=room.game;if(!g?.started||g.ended)return;const m=MAPS[g.map],diff=DIFFICULTY[room.difficulty],now=Date.now();g.transition=Math.max(0,g.transition-dt/1000);
  const connected=Object.values(g.players).filter(p=>p.connected);
  for(const p of Object.values(g.players)){
    if(!p.connected)continue;
    const interactPulse=p.interactPulse;p.interactPulse=false;
    if(!p.captured){const n=Math.hypot(p.input.x,p.input.y)||1;move(p,p.input.x/n*diff.playerSpeed,p.input.y/n*diff.playerSpeed,14);if(p.input.interact||interactPulse)interactAt(room,p);}
  }
  const free=connected.filter(p=>!p.captured);
  if(connected.length&&free.length===0){g.ended='defeat';g.message='Buto Ijo has captured the companions — and Timun Mas.';return;}
  const nearest=(from,list)=>list.map(p=>({p,d:dist(from,p)})).sort((a,b)=>a.d-b.d)[0];
  if(free.length){const t=nearest(g.buto,free);const npcDist=dist(g.buto,g.npc);let target=t.d<diff.detect?t.p:(npcDist<diff.detect*.62?g.npc:null);g.buto.mode=target?(target===g.npc?'threatening Timun Mas':'chasing'):'searching';
    if(g.map===4&&g.buto.trapArmed&&!g.progress.butoTrapped){target={x:m.trap[0],y:m.trap[1]};g.buto.mode='drawn to terasi';}
    if(now<g.buto.slowUntil)g.buto.mode='slowed';
    if(g.progress.butoTrapped){g.buto.mode='trapped';}
    else if(target){const d=dist(g.buto,target);if(d>2){let speed=now<g.buto.slowUntil?0.55:diff.enemySpeed;const dx=(target.x-g.buto.x)/d*speed,dy=(target.y-g.buto.y)/d*speed;move(g.buto,dx,dy,18);}
      if(g.map===4&&g.buto.trapArmed&&dist(g.buto,{x:m.trap[0],y:m.trap[1]})<50){g.progress.butoTrapped=true;g.buto.mode='trapped';g.message='Buto Ijo is trapped in the magical mud! Reach the exit with Timun Mas.';}
      else if(target!==g.npc&&dist(g.buto,target)<27){const caught=target;caught.captured=true;caught.x=64+(Object.values(g.players).filter(p=>p.captured).length-1)*38;caught.y=78;caught.captureProgress=0;for(const it of caught.inventory){g.items.push({id:`drop-${crypto.randomUUID()}`,kind:it.kind,x:caught.x+Math.random()*26-13,y:caught.y+38,uses:it.uses,dropped:true});}caught.inventory=[];g.message=`${caught.name} was caught! Reach the cage and hold Interact to rescue them.`;}
    }else{const patrolX=m.enemy[0]-85+Math.sin(now/4700)*130,patrolY=m.enemy[1]+Math.cos(now/3200)*125,d=Math.hypot(patrolX-g.buto.x,patrolY-g.buto.y)||1;move(g.buto,(patrolX-g.buto.x)/d*.55,(patrolY-g.buto.y)/d*.55,18);}
  }
  if(free.length){const threat=!g.progress.butoTrapped&&dist(g.npc,g.buto)<155;let target;if(threat){target={x:Math.max(80,Math.min(W-70,g.npc.x+(g.npc.x-g.buto.x)*1.7)),y:Math.max(70,Math.min(H-70,g.npc.y+(g.npc.y-g.buto.y)*1.7))};g.npc.mode='fleeing';}else{
      const allReady=g.map===0?g.progress.gateUnlocked:g.map===1?g.progress.planted.length===3:g.map===2?g.progress.planksUsed>=2&&g.progress.saltUsed:g.map===3?g.progress.needles.length===3&&g.progress.levers.length===2:g.progress.seals>=3;
      target=allReady?{x:m.exit[0],y:m.exit[1]}:nearest(g.npc,free).p;g.npc.mode=allReady?'heading to exit':'following';
    }const d=dist(g.npc,target);if(d>43){move(g.npc,(target.x-g.npc.x)/d*1.65,(target.y-g.npc.y)/d*1.65,13);}}
  for(const p of Object.values(room.players))if(!p.connected&&now-p.disconnectedAt>120000){delete room.players[p.id];delete g.players[p.id];}
}

function wsFrame(data,opcode=1){const payload=Buffer.from(data),len=payload.length;let head;if(len<126){head=Buffer.from([0x80|opcode,len]);}else if(len<65536){head=Buffer.alloc(4);head[0]=0x80|opcode;head[1]=126;head.writeUInt16BE(len,2);}else{head=Buffer.alloc(10);head[0]=0x80|opcode;head[1]=127;head.writeBigUInt64BE(BigInt(len),2);}return Buffer.concat([head,payload]);}
function wsSend(ws,data){if(ws.readyState===1)ws.socket.write(wsFrame(typeof data==='string'?data:JSON.stringify(data)));}
function parseFrames(ws,chunk){ws.buffer=Buffer.concat([ws.buffer,chunk]);while(ws.buffer.length>=2){const b0=ws.buffer[0],b1=ws.buffer[1];let len=b1&127,off=2;if(len===126){if(ws.buffer.length<4)return;len=ws.buffer.readUInt16BE(2);off=4;}else if(len===127){if(ws.buffer.length<10)return;const big=ws.buffer.readBigUInt64BE(2);if(big>1_000_000n){ws.socket.destroy();return;}len=Number(big);off=10;}const masked=!!(b1&128);if(masked)off+=4;if(ws.buffer.length<off+len)return;let payload=ws.buffer.subarray(off,off+len);if(masked){const key=ws.buffer.subarray(off-4,off);payload=Buffer.from(payload);for(let i=0;i<payload.length;i++)payload[i]^=key[i%4];}ws.buffer=ws.buffer.subarray(off+len);const opcode=b0&15;if(opcode===8){ws.socket.end(wsFrame('',8));return;}if(opcode===9){ws.socket.write(wsFrame(payload,10));continue;}if(opcode===1){try{handle(ws,JSON.parse(payload.toString('utf8')));}catch(e){console.error('message error',e);}}}}

const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');let pathname=decodeURIComponent(url.pathname);if(pathname==='/')pathname='/index.html';const file=path.resolve(ROOT,'.'+pathname);if(!file.startsWith(ROOT+path.sep)&&file!==ROOT){res.writeHead(403);return res.end('Forbidden');}fs.readFile(file,(e,data)=>{if(e){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(data);});});
server.on('upgrade',(req,socket)=>{const key=req.headers['sec-websocket-key'];if(!key){socket.destroy();return;}const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');const ws={socket,readyState:1,buffer:Buffer.alloc(0)};sockets.add(ws);socket.on('data',d=>parseFrames(ws,d));socket.on('close',()=>disconnect(ws));socket.on('end',()=>disconnect(ws));socket.on('error',()=>disconnect(ws));});
function disconnect(ws){if(!sockets.has(ws))return;sockets.delete(ws);ws.readyState=3;const f=findPlayer(ws);if(f?.player&&f.player.ws===ws){f.player.connected=false;f.player.disconnectedAt=Date.now();f.player.input={x:0,y:0,interact:false};f.player.interactPulse=false;if(f.room.hostId===f.player.id){const next=Object.values(f.room.players).filter(p=>p.connected).sort((a,b)=>a.created-b.created)[0];if(next)f.room.hostId=next.id;}broadcast(f.room);closeRoomIfEmpty(f.room);}}
setInterval(()=>{const dt=.05;for(const room of rooms.values()){tickRoom(room,dt);broadcast(room);}},50);
server.listen(PORT,'0.0.0.0',()=>console.log(`Timun Mas server listening on http://localhost:${PORT}`));

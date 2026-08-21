const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname,"public")));\napp.get("/health",(req,res)=>res.json({ok:true,service:"telgsabz"}));

const server = http.createServer(app);
const wss = new WebSocket.Server({server});

const DATA = path.join(__dirname,"data.json");
let db = {users:{}, messages:[]};
try { db = JSON.parse(fs.readFileSync(DATA,"utf8")); } catch {}
const online = new Map();

function save(){ fs.writeFileSync(DATA, JSON.stringify(db,null,2)); }
function id(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }

app.post("/api/register",(req,res)=>{
  const name=String(req.body.name||"").trim();
  const phone=String(req.body.phone||"").replace(/\D/g,"");
  if(name.length<2 || phone.length<8) return res.status(400).json({error:"نام یا شماره موبایل نامعتبر است."});
  if(!db.users[phone]) db.users[phone]={id:phone,name,phone};
  else db.users[phone].name=name;
  save();
  res.json({user:db.users[phone]});
});

app.get("/api/users",(req,res)=>{
  const q=String(req.query.q||"").toLowerCase();
  res.json(Object.values(db.users).filter(u=>u.name.toLowerCase().includes(q)||u.phone.includes(q)));
});

app.get("/api/messages",(req,res)=>{
  const a=String(req.query.a||""), b=String(req.query.b||"");
  res.json(db.messages.filter(m=>(m.from===a&&m.to===b)||(m.from===b&&m.to===a)));
});

wss.on("connection",(ws)=>{
  ws.on("message",(raw)=>{
    let data; try{data=JSON.parse(raw)}catch{return}
    if(data.type==="login"){
      ws.user=String(data.user||""); online.set(ws.user,ws);
      ws.send(JSON.stringify({type:"ready",user:ws.user}));
      return;
    }
    if(data.type==="message"){
      if(!ws.user || !data.to || !String(data.text||"").trim()) return;
      const msg={id:id(),from:ws.user,to:String(data.to),text:String(data.text).trim(),time:new Date().toISOString()};
      db.messages.push(msg); save();
      const target=online.get(msg.to);
      if(target && target.readyState===WebSocket.OPEN) target.send(JSON.stringify({type:"message",message:msg}));
      ws.send(JSON.stringify({type:"message",message:msg}));
    }
  });
  ws.on("close",()=>{ if(ws.user && online.get(ws.user)===ws) online.delete(ws.user); });
});

const port=process.env.PORT||3000;
server.listen(port,()=>console.log("Telgsabz running on port "+port));

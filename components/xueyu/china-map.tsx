'use client';
import {useState} from 'react';
import {Plus,Minus,RotateCcw,Layers,LocateFixed,ArrowUpRight} from 'lucide-react';
import shapes from '@/lib/data/china-map.json';
import {universities} from '@/lib/catalog';
const counts=universities.reduce((a,s)=>{a[s.province]=(a[s.province]||0)+1;return a},{} as Record<string,number>);
export default function ChinaMap({province,onProvince,onSchool,schoolName}:{province:string;onProvince:(s:string)=>void;onSchool:()=>void;schoolName:string}){
 const [depth,setDepth]=useState(true),[zoom,setZoom]=useState(1),[hover,setHover]=useState(''),[layer,setLayer]=useState('density');
 const selected=shapes.find(p=>p.short===province);const h=hover?shapes.find(p=>p.short===hover):undefined;
 return <div className={'map-card '+(depth?'depth':'flat')}>
  <div className="map-topline"><div><span className="eyebrow">GEOGRAPHIC INTELLIGENCE</span><h2>中国高校学科全景 <span className="tiny-tag">CHINA</span></h2></div><span className="map-hint"><span className="live-dot"/> 点选省份，探索高校</span></div>
  <div className="map-location"><LocateFixed size={13}/><span>全国</span><span className="muted">/</span><b>{province||'全部省份'}</b><select aria-label="选择省份" value={province} onChange={e=>onProvince(e.target.value)}>{shapes.filter(p=>p.short).map(p=><option key={p.id} value={p.short}>{p.name}</option>)}</select></div>
  <div className="map-viewport">
   <div className="map-radar radar-one"/><div className="map-radar radar-two"/><div className="map-grid"/>
   <svg className="china-svg" viewBox="0 0 860 620" aria-label="中国省级行政区高校分布地图" role="group">
    <defs>
     <linearGradient id="provinceFill" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stopColor="#21475a"/><stop offset="1" stopColor="#142d40"/></linearGradient>
     <linearGradient id="provinceHot" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stopColor="#427779"/><stop offset="1" stopColor="#244653"/></linearGradient>
     <linearGradient id="provinceGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e9d292"/><stop offset="1" stopColor="#9f8244"/></linearGradient>
     <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#65e3d0" stopOpacity="0"/><stop offset="1" stopColor="#65e3d0" stopOpacity=".65"/></linearGradient>
     <filter id="pointGlow"><feGaussianBlur stdDeviation="3"/></filter>
     <filter id="mapShadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="15" stdDeviation="12" floodColor="#000" floodOpacity=".6"/></filter>
    </defs>
    <g transform={`translate(${430*(1-zoom)} ${300*(1-zoom)}) scale(${zoom})`} className="map-zoom">
     {depth&&<g transform="translate(0 12)" filter="url(#mapShadow)" aria-hidden="true">{shapes.map(p=><path key={p.id} d={p.d} fill="#0b1b2b" stroke="#3d6373" strokeWidth=".7"/>)}</g>}
     {depth&&<g transform="translate(0 7)" aria-hidden="true">{shapes.map(p=><path key={p.id} d={p.d} fill="#102a3b" stroke="#38616b" strokeWidth=".55"/>)}</g>}
     <g className="map-provinces">{shapes.map(p=><g key={p.id} className={'province '+(province===p.short?'is-selected':'')} style={{transform:province===p.short&&depth?'translateY(-5px)':undefined}}><path d={p.d} fill={province===p.short?'url(#provinceGold)':layer==='density'&&(counts[p.short]||0)>=7?'url(#provinceHot)':'url(#provinceFill)'} stroke={province===p.short?'#f9e2a1':hover===p.short?'#91cec5':'#46747d'} strokeWidth={province===p.short?1.8:.75} role={p.short?'button':undefined} tabIndex={p.short?0:undefined} aria-label={`${p.name}，${counts[p.short]||0}所收录高校`} onMouseEnter={()=>setHover(p.short)} onMouseLeave={()=>setHover('')} onClick={()=>p.short&&onProvince(p.short)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onProvince(p.short)}}}/></g>)}</g>
     <g className="map-labels" aria-hidden="true">{shapes.filter(p=>p.short&&!['香港','澳门'].includes(p.short)).map(p=><text key={p.id} x={p.x+(p.short==='北京'?-10:p.short==='天津'?18:p.short==='上海'?18:0)} y={p.y+(p.short==='北京'?-8:p.short==='天津'?9:0)} fill={province===p.short?'#fff2cb':'#9ab9c5'}>{p.short}</text>)}<path d="M568 463l45 15h25M561 466l41 24h21" fill="none" stroke="#4e7584" strokeWidth=".6"/><text x="652" y="481">香港</text><text x="636" y="493">澳门</text></g>
     <g pointerEvents="none" aria-hidden="true">{shapes.filter(p=>(counts[p.short]||0)>=5&&p.short!==province).map(p=><g key={p.id} transform={`translate(${p.x} ${p.y-12})`}><path d={`M-3 0l-5 -${15+counts[p.short]}h16L3 0Z`} fill="url(#beam)"/><ellipse rx="8" ry="3" fill="#74e1c1" opacity=".25"/><circle r="2.2" fill="#9ce7cb"/><circle r="7" className="map-pulse" fill="none" stroke="#90dfc2" strokeWidth=".7" style={{animationDelay:(counts[p.short]%3)+'s'}}/></g>)}</g>
     {selected&&<g className="selected-beacon" transform={`translate(${selected.x} ${selected.y-16})`} pointerEvents="none"><ellipse rx="16" ry="6" fill="#eed78d" opacity=".15"/><ellipse rx="10" ry="4" fill="none" stroke="#f4d784" strokeWidth="1"/><path d="M-3 0l-3-44h12L3 0Z" fill="#f4d784" opacity=".16"/><path d="M0 0v-36" stroke="#f6d981" strokeWidth="1.6"/><circle cy="-36" r="4" fill="#f8dda0"/><circle cy="-36" r="7" fill="#f8dda0" opacity=".3" filter="url(#pointGlow)"/></g>}
    </g>
    <g className="sea-inset"><rect x="709" y="474" width="109" height="121" rx="4" fill="#0c1927" stroke="#293c4e"/>{shapes.map(p=><path key={p.id} d={p.inset} fill="#284654" stroke="#7b9da4" strokeWidth=".7"/>)}<text x="764" y="587" textAnchor="middle" fill="#78939f" fontSize="9">南海诸岛</text></g>
    <g className="compass" transform="translate(57 480)"><path d="M0-20 5 0 0-5-5 0Z" fill="#cad7dd"/><path d="M0 16 5 0 0 5-5 0Z" fill="#36505d"/><text y="-27" textAnchor="middle" fill="#829eae" fontSize="9">N</text></g>
   </svg>
   {selected&&zoom===1&&<button className="map-callout" style={{left:`${Math.min(73,Math.max(26,selected.x/860*100-14))}%`,top:`${Math.min(65,Math.max(17,selected.y/620*100-14))}%`}} onClick={onSchool}><span className="callout-dot"/><span><small>{province} · {counts[province]||0} 所建设高校</small><strong>{counts[province]?schoolName:'暂无该范围数据'}</strong></span><ArrowUpRight size={14}/></button>}
   {h&&hover!==province&&<div className="map-hover">{h.name}<b>{counts[h.short]||0}</b><span>所收录高校</span></div>}
   <div className="map-tools"><button title="放大地图" aria-label="放大地图" onClick={()=>setZoom(Math.min(1.7,zoom+.2))}><Plus size={16}/></button><button title="缩小地图" aria-label="缩小地图" onClick={()=>setZoom(Math.max(.7,zoom-.2))}><Minus size={16}/></button><span/><button title="重置视图" aria-label="重置视图" onClick={()=>setZoom(1)}><RotateCcw size={15}/></button></div>
   <div className="map-mode"><button className={depth?'active':''} onClick={()=>setDepth(true)}>3D 视图</button><button className={!depth?'active':''} onClick={()=>setDepth(false)}>2D</button></div>
  </div>
  <div className="map-bottom"><div className="layer-tabs"><Layers size={13}/><button onClick={()=>setLayer('density')} className={layer==='density'?'active':''}>高校分布</button><button onClick={()=>setLayer('boundary')} className={layer==='boundary'?'active':''}>行政区划</button></div><div className="map-legend"><span>收录密度</span><i/><span>低</span><span>高</span></div></div>
 </div>
}

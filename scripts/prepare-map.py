"""Project the source GeoJSON without inventing province boundaries.
Source: DataV GeoAtlas 100000_full.json. North-up Albers equal-area projection.
"""
import json, math, sys
src=sys.argv[1]
j=json.load(open(src)); n=(math.sin(math.radians(25))+math.sin(math.radians(47)))/2
C=math.cos(math.radians(25))**2+2*n*math.sin(math.radians(25))
def raw(p):
 lon,lat=p[:2];rho=math.sqrt(C-2*n*math.sin(math.radians(lat)))/n;t=n*math.radians(lon-105)
 return [rho*math.sin(t),rho*math.cos(t)]
def polygons(f):return f['geometry']['coordinates'] if f['geometry']['type']=='MultiPolygon' else [f['geometry']['coordinates']]
pts=[raw(p) for f in j['features'] for poly in polygons(f) for ring in poly for p in ring if p[1]>=18]
x0=min(p[0] for p in pts);x1=max(p[0] for p in pts);y0=min(p[1] for p in pts);y1=max(p[1] for p in pts)
s=min(780/(x1-x0),485/(y1-y0));ox=(860-(x1-x0)*s)/2;oy=37

def project(p):
 x,y=raw(p);return [round(ox+(x-x0)*s,1),round(oy+(y-y0)*s,1)]
def path(points,proj):
 pp=[proj(p) for p in points];keep=[p for i,p in enumerate(pp) if i==0 or p!=pp[i-1]]
 return 'M'+'L'.join(str(a)+','+str(b) for a,b in keep)+'Z'
res=[]
for f in j['features']:
 prop=f['properties'];paths=[];inset=[]
 for poly in polygons(f):
  for ring in poly:
   if max(p[1] for p in ring)<18:inset.append(path(ring,lambda p:[round(716+(p[0]-105)*5.5,1),round(462+(22-p[1])*5.5,1)]))
   else:paths.append(path(ring,project))
 name=prop.get('name','');short=name.replace('特别行政区','').replace('维吾尔自治区','').replace('壮族自治区','').replace('回族自治区','').replace('自治区','').replace('省','').replace('市','')
 center=project(prop.get('centroid',prop.get('center',[110,35])))
 if short=='甘肃':center=project([103.8,37.5])
 res.append({'id':str(prop['adcode']),'name':name,'short':short,'d':' '.join(paths),'inset':' '.join(inset),'x':center[0],'y':center[1]})
json.dump(res,open('lib/data/china-map.json','w'),ensure_ascii=False,separators=(',',':'))
print([(s['short'],s['x'],s['y']) for s in res if s['short'] in ['北京','浙江','海南','香港','澳门']])

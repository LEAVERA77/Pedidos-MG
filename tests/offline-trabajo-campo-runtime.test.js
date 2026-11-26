import { describe,it,expect } from 'vitest';
import { actualizarConfigCampo,agregarTrabajoCampo,mezclarTrabajosCampo,sincronizarTrabajosCampo } from '../modules/offline-trabajo-campo-runtime.js';
import { leerColaCampo } from '../modules/offline-trabajo-campo-cola.js';
const storage=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v)}};
const ctx={usuario_id:7,tenant_id:1,business_type:'electricidad'};
const id='987fbc97-4bed-4078-8f07-9141ba07c9f3';
const now=Date.now();const iso=new Date(now).toISOString();
const pedido={id:10,tai:7,es:'Asignado',av:0,la:-31.3,ln:-60.1,np:'P-10',fasi:'2026-01-01T00:00:00.000Z',fa:null,fotos:[]};
const gps={lat:-31.3,lng:-60.1,accuracy:5,timestamp:now-1000,fuente:'gps'};
const cfg={...ctx,habilitada:true,radio_metros:100};
async function cargar(s){await actualizarConfigCampo(ctx,{storage:s,token:'jwt',apiUrl:p=>p,fetchFn:async()=>new Response(JSON.stringify(cfg),{status:200})})}
const guardar=(s,p,e)=>agregarTrabajoCampo(ctx,p,e,{storage:s,nuevoId:()=>id,ahora:now});
describe('flujo local del trabajo de campo',()=>{
 it('requiere configurar y localizar antes de guardar, y conserva inicio, avance, material y cierre',async()=>{
  const s=storage();expect(()=>guardar(s,pedido,{tipo:'inicio',fecha:iso,gps})).toThrow(/configuración/);await cargar(s);
  let p=guardar(s,pedido,{tipo:'inicio',fecha:iso,gps});expect(p.es).toBe('En ejecución');
  p=guardar(s,p,{tipo:'avance',fecha:iso,avance:25,fotos:['data:image/png;base64,YWJj']});
  p=guardar(s,p,{tipo:'material',fecha:iso,descripcion:'Cable',cantidad:2,unidad:'m'});
  p=guardar(s,p,{tipo:'cierre',fecha:iso,campos:{trabajo_realizado:'Listo',tecnico_cierre:'Técnico',foto_cierre:null,firma_cliente:null,checklist_seguridad:'{}'}});
  expect(p.es).toBe('Cerrado');expect(p.fotos).toHaveLength(1);expect(leerColaCampo(s)[0].eventos).toHaveLength(4);
  expect(mezclarTrabajosCampo([],ctx,s)[0].tr).toBe('Listo');expect(mezclarTrabajosCampo([],{...ctx,usuario_id:8},s)).toEqual([]);
 });
 it('guarda local antes de actualizar estado y nunca confirma si no hay espacio',async()=>{
  const s=storage();await cargar(s);s.setItem=()=>{throw Error('quota')};expect(()=>guardar(s,pedido,{tipo:'inicio',fecha:iso,gps})).toThrow(/espacio/);expect(pedido.es).toBe('Asignado');expect(leerColaCampo(s)).toHaveLength(0);
 });
 it('conserva el diario congelado ante respuesta perdida y lo elimina solo con confirmación posterior',async()=>{
  const s=storage();await cargar(s);guardar(s,pedido,{tipo:'inicio',fecha:iso,gps});const cuerpos=[];
  const opt={storage:s,token:'jwt',apiUrl:p=>p,fetchFn:async (_u,o)=>{cuerpos.push(o.body);if(cuerpos.length===1)throw Error('corte');return new Response(JSON.stringify({ok:true,pedido_id:10,operacion_id:id,repetida:true}),{status:200})}};
  expect((await sincronizarTrabajosCampo(ctx,opt)).errores).toHaveLength(1);expect(leerColaCampo(s)[0].congelado).toBe(true);
  expect(()=>guardar(s,pedido,{tipo:'inicio',fecha:iso,gps})).toThrow();
  expect((await sincronizarTrabajosCampo(ctx,opt)).confirmados).toBe(1);expect(cuerpos[0]).toBe(cuerpos[1]);expect(leerColaCampo(s)).toHaveLength(0);
 });
 it('conserva el diario y no lo envía con otra cuenta o ante conflicto',async()=>{
  const s=storage();await cargar(s);guardar(s,pedido,{tipo:'inicio',fecha:iso,gps});let llamadas=0;
  const opt={storage:s,token:'jwt',apiUrl:p=>p,fetchFn:async()=>{llamadas++;return new Response('{"error":"conflicto"}',{status:409})}};
  expect((await sincronizarTrabajosCampo({...ctx,usuario_id:8},opt)).confirmados).toBe(0);expect(llamadas).toBe(0);
  expect((await sincronizarTrabajosCampo(ctx,opt)).errores).toHaveLength(1);expect(leerColaCampo(s)).toHaveLength(1);
 });
});

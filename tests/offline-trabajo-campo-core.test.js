import { describe,it,expect } from 'vitest';
import { validarInicioOffline,nuevoDiarioCampo,agregarEventoCampo } from '../modules/offline-trabajo-campo-core.js';
const now = 1770000000000;
const pedido = {id:4,tai:7,es:'Asignado',av:5,la:-31.3,ln:-60.1,fasi:'2026-01-01T00:00:00Z',fa:null};
const config = {usuario_id:7,tenant_id:1,business_type:'electricidad',habilitada:true,radio_metros:100};
const gps = {lat:-31.3,lng:-60.1,fuente:'gps',accuracy:12,timestamp:now-1000};
const args = {pedido,gps,config,usuarioId:7,tenantId:1,businessType:'electricidad',ahora:now};
const diario = () => nuevoDiarioCampo({pedido,usuarioId:7,tenantId:1,businessType:'electricidad',operacionId:'987fbc97-4bed-4078-8f07-9141ba07c9f3'});
describe('validación de campo offline',()=>{
 it('acepta GPS reciente próximo con la configuración de usuario, tenant y rubro',()=>{expect(validarInicioOffline(args).ok).toBe(true)});
 it('no acepta GPS antiguo, sin precisión, otro proveedor ni fechas futuras',()=>{for(const delta of [{timestamp:now-61000},{accuracy:null},{accuracy:150},{fuente:'network'},{timestamp:now+6000},{lat:null}])expect(validarInicioOffline({...args,gps:{...gps,...delta}}).ok).toBe(false)});
 it('no acepta lejanía, falta de coordenadas o configuración de otra organización',()=>{
  expect(validarInicioOffline({...args,gps:{...gps,lat:-31.31}}).ok).toBe(false);
  expect(validarInicioOffline({...args,pedido:{...pedido,la:null}}).ok).toBe(false);
  expect(validarInicioOffline({...args,config:{...config,tenant_id:2}}).ok).toBe(false);
 });
 it('impide usar pedidos de otro técnico',()=>expect(validarInicioOffline({...args,usuarioId:8}).ok).toBe(false));
 it('conserva materiales válidos dentro del diario de un pedido iniciado',()=>{
  let d=agregarEventoCampo(diario(),{tipo:'inicio',gps,fecha:'2026-01-01T01:00:00Z'});
  d=agregarEventoCampo(d,{tipo:'material',descripcion:'Cable',cantidad:2,unidad:'m',fecha:'2026-01-01T01:10:00Z'});
  expect(d.eventos[1]).toMatchObject({tipo:'material',descripcion:'Cable',cantidad:2,unidad:'m'});
  expect(()=>agregarEventoCampo(d,{tipo:'material',descripcion:'Cable',cantidad:0,unidad:'m',fecha:'2026-01-01T01:11:00Z'})).toThrow();
 });
 it('permite inicio, avances y cierre, sin retrocesos y sin editar un diario congelado',()=>{
  let d=diario(); d=agregarEventoCampo(d,{tipo:'inicio',gps,fecha:'2026-01-01T01:00:00Z'});
  d=agregarEventoCampo(d,{tipo:'avance',avance:20,fecha:'2026-01-01T02:00:00Z'});
  expect(()=>agregarEventoCampo(d,{tipo:'avance',avance:10,fecha:'2026-01-01T02:30:00Z'})).toThrow();
  d=agregarEventoCampo(d,{tipo:'cierre',campos:{trabajo_realizado:'Reparado',tecnico_cierre:'Equipo'},fecha:'2026-01-01T03:00:00Z'});
  expect(d.eventos.map(e=>e.tipo)).toEqual(['inicio','avance','cierre']);
  expect(()=>agregarEventoCampo(d,{tipo:'avance',avance:30,fecha:'2026-01-01T04:00:00Z'})).toThrow();
  expect(()=>agregarEventoCampo({...diario(),congelado:true},{tipo:'inicio',gps,fecha:'x'})).toThrow();
 });
});

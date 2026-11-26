import { describe,it,expect } from 'vitest';
import { leerColaCampo,guardarDiarioCampo,congelarDiarioCampo,confirmarDiarioCampo,COLA_CAMPO_KEY } from '../modules/offline-trabajo-campo-cola.js';
const store=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v)}};
const op=()=>({tipo:'TRABAJO_CAMPO',operacion_id:'uno',usuario_id:7,tenant_id:1,pedido_id:9,business_type:'agua',base:{estado:'Asignado'},congelado:false,eventos:[{tipo:'inicio'}]});
const ctx={usuario_id:7,tenant_id:1,business_type:'agua'};
describe('cola de trabajo de campo',()=>{
 it('guarda antes de confirmar, congela y elimina solo al confirmar la operación exacta',()=>{const s=store(),d=op();guardarDiarioCampo(d,s);const f=congelarDiarioCampo('uno',ctx,s);expect(f.congelado).toBe(true);expect(()=>guardarDiarioCampo({...f,eventos:[]},s)).toThrow();expect(congelarDiarioCampo('uno',ctx,s)).toEqual(f);confirmarDiarioCampo(f,s);expect(leerColaCampo(s)).toEqual([])});
 it('conserva la operación si se cambió usuario o rubro',()=>{const s=store();guardarDiarioCampo(op(),s);expect(()=>congelarDiarioCampo('uno',{...ctx,usuario_id:8},s)).toThrow();expect(()=>congelarDiarioCampo('uno',{...ctx,business_type:'municipio'},s)).toThrow();expect(leerColaCampo(s)).toHaveLength(1)});
 it('si no hay espacio no afirma que guardó ni destruye el registro anterior',()=>{const s=store();guardarDiarioCampo(op(),s);s.setItem=()=>{throw Error('quota')};expect(()=>guardarDiarioCampo({...op(),eventos:[...op().eventos,{tipo:'avance'}]},s)).toThrow(/espacio/);expect(leerColaCampo(s)[0].eventos).toHaveLength(1)});
 it('no borra contenido corrupto ni elimina una respuesta que no coincide',()=>{const s=store();s.setItem(COLA_CAMPO_KEY,'{');expect(()=>guardarDiarioCampo(op(),s)).toThrow();expect(s.getItem(COLA_CAMPO_KEY)).toBe('{');const t=store();guardarDiarioCampo(op(),t);const f=congelarDiarioCampo('uno',ctx,t);expect(()=>confirmarDiarioCampo({...f,pedido_id:10},t)).toThrow();expect(leerColaCampo(t)).toHaveLength(1)});
});

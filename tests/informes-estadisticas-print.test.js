import { afterEach, expect, it, vi } from 'vitest';

vi.mock('../modules/informes-estadisticas-pdf-capture.js', () => ({
    prepararVistaCapturaEstadisticasPdf: vi.fn(async () => {}),
    coleccionSeccionesPdfEstadisticas: vi.fn(() => []),
    capturaPdfBloqueResumenEstadisticas: vi.fn(),
    html2canvasCapturaElemento: vi.fn(),
    pdfMmAjustarImagen: vi.fn(),
    escAttrPrint: vi.fn(),
}));
import { prepararVistaCapturaEstadisticasPdf } from '../modules/informes-estadisticas-pdf-capture.js';
import { generarPdfEstadisticasMultipaginaENRE, imprimirInformeConGraficos, setInformesEstadisticasPrintDeps } from '../modules/informes-estadisticas-print.js';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('impide exportaciones simultáneas y libera el bloqueo si la carga falla', async () => {
    let fail;
    const loading = new Promise((_resolve, reject) => { fail = reject; });
    const toast = vi.fn();
    vi.stubGlobal('html2canvas', () => {});
    vi.stubGlobal('window', { jspdf: { jsPDF: function () {} } });
    vi.stubGlobal('document', { getElementById: () => null });
    setInformesEstadisticasPrintDeps({ esAdmin: () => true, neonOk: () => true, cargarEstadisticas: () => loading, toast });
    const first = generarPdfEstadisticasMultipaginaENRE();
    await imprimirInformeConGraficos();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('Ya se está generando'), 'info');
    fail(new Error('falló la carga'));
    await expect(first).rejects.toThrow('falló la carga');
    expect(prepararVistaCapturaEstadisticasPdf).toHaveBeenCalledWith(false);
    setInformesEstadisticasPrintDeps({ esAdmin: () => false, toast });
    await generarPdfEstadisticasMultipaginaENRE();
    expect(toast).toHaveBeenCalledWith('Solo administrador', 'error');
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    aplicarChartsLayoutExportPdf,
    partirEtiquetaPdf,
    chartWrapNecesitaPaginaCompleta,
} from '../modules/informes-estadisticas-pdf-charts-layout.js';
import { pdfMmAjustarImagen } from '../modules/informes-estadisticas-pdf-capture.js';

function fixture({ failing = false } = {}) {
    let style = 'height: 260px; color: red';
    const container = {
        style: { setProperty: vi.fn() },
        getAttribute: () => style,
        setAttribute: (_name, value) => { style = value; },
        removeAttribute: () => { style = null; },
    };
    const canvas = { closest: () => container };
    const labels = ['abreviado'];
    const datasets = [{ data: [4], backgroundColor: ['blue'] }];
    const callback = () => 'valor';
    const options = { indexAxis: 'y', scales: { y: { ticks: { callback } } }, plugins: { legend: { display: true } } };
    const chart = {
        config: { type: 'bar', options }, data: { labels, datasets }, _gnLabelsFull: ['Un nombre completo y extenso de distribuidor'],
        get options() { return this.config.options; },
        set options(value) { this.config.options = value; },
        resize: vi.fn(), update: vi.fn(() => { if (failing) { failing = false; throw Error('fallo'); } }),
    };
    vi.stubGlobal('document', { getElementById: () => canvas });
    return { chart, container, labels, datasets, options, callback, style: () => style };
}

afterEach(() => {
    aplicarChartsLayoutExportPdf(() => ({}), false);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('exportación de gráficos de estadísticas', () => {
    it('conserva texto y divide palabras extremadamente largas', () => {
        expect(partirEtiquetaPdf('Pedido de factibilidad (nuevo servicio)', 16)).toEqual(['Pedido de', 'factibilidad', '(nuevo servicio)']);
        const long = 'identificador'.repeat(10);
        const lines = partirEtiquetaPdf(long, 20);
        expect(lines.join('')).toBe(long);
        expect(lines.every((line) => line.length <= 20)).toBe(true);
        expect(partirEtiquetaPdf(null)).toEqual(['']);
    });

    it('ajusta copias y restaura las referencias y los estilos del panel', () => {
        const f = fixture();
        aplicarChartsLayoutExportPdf(() => ({ 'chart-tipos': f.chart }), true);
        expect(f.chart.options).not.toBe(f.options);
        expect(f.chart.options.scales.y.ticks.callback).toBe(f.callback);
        expect(f.chart.data.datasets).not.toBe(f.datasets);
        expect(f.chart.data.labels[0].join(' ')).toBe(f.chart._gnLabelsFull[0]);
        expect(f.container.style.setProperty).toHaveBeenCalledWith('height', expect.any(String), 'important');
        f.chart.data.datasets[0].backgroundColor[0] = 'red';
        aplicarChartsLayoutExportPdf(() => ({}), false);
        expect(f.chart.options).toBe(f.options);
        expect(f.chart.data.datasets).toBe(f.datasets);
        expect(f.chart.data.labels).toBe(f.labels);
        expect(f.datasets[0].backgroundColor).toEqual(['blue']);
        expect(f.style()).toBe('height: 260px; color: red');
    });

    it('restaura el gráfico si falla su preparación', () => {
        const f = fixture({ failing: true });
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        aplicarChartsLayoutExportPdf(() => ({ 'chart-tipos': f.chart }), true);
        expect(f.chart.options).toBe(f.options);
        expect(f.chart.data.labels).toBe(f.labels);
        expect(f.chart.data.datasets).toBe(f.datasets);
        expect(f.style()).toBe('height: 260px; color: red');
    });

    it('identifica horizontal y conserva proporciones al ajustar a la hoja', () => {
        vi.stubGlobal('window', { __gnChartsEstadisticas: { arbitrary: { config: { type: 'bar' }, options: { indexAxis: 'y' } } } });
        expect(chartWrapNecesitaPaginaCompleta({ querySelector: () => ({ id: 'arbitrary' }) })).toBe(true);
        const { iw, ih } = pdfMmAjustarImagen(760, 1520, 190, 240);
        expect(ih).toBe(240);
        expect(iw).toBe(120);
    });
});

/**
 * Cuerpo JSON y fetch unificado para POST /api/auth/login (multitenant).
 * En pantalla de login NO usar tenant de JWT/pmg/config: solo hint explícito del wizard.
 * Si el hint está obsoleto (sessionStorage viejo), reintenta sin tenant_id.
 * made by leavera77
 */

let _tenantIdResolver = () => NaN;
let _loginInFlight = false;
let _lastLoginAttemptAt = 0;

/** @param {() => number} fn — legacy; el login ya no envía tenant desde el resolver. */
export function initAuthLoginApiTenantResolver(fn) {
    _tenantIdResolver = typeof fn === 'function' ? fn : () => NaN;
}

/** Clave sessionStorage: tenant elegido en asistente / selector (única fuente para acotar login). */
export const AUTH_LOGIN_TENANT_HINT_KEY = 'pmg_login_tenant_hint';

/** @param {number|string|null|undefined} tenantId — clientes.id */
export function setAuthLoginTenantHint(tenantId) {
    try {
        const n = Number(tenantId);
        if (Number.isFinite(n) && n > 0) {
            sessionStorage.setItem(AUTH_LOGIN_TENANT_HINT_KEY, String(n));
        }
    } catch (_) {}
}

export function clearAuthLoginTenantHint() {
    try {
        sessionStorage.removeItem(AUTH_LOGIN_TENANT_HINT_KEY);
    } catch (_) {}
}

/** Tenant solo si el usuario lo eligió en wizard/selector (no sesión anterior ni config.json). */
export function getExplicitLoginTenantHint() {
    try {
        const s = sessionStorage.getItem(AUTH_LOGIN_TENANT_HINT_KEY);
        const h = Number(s);
        if (Number.isFinite(h) && h > 0) return h;
    } catch (_) {}
    return null;
}

function buildLoginBody(usuario, password, tenantId) {
    const o = { usuario: String(usuario || '').trim(), password: String(password ?? '') };
    const tid = tenantId != null ? Number(tenantId) : NaN;
    if (Number.isFinite(tid) && tid > 0) o.tenant_id = tid;
    return JSON.stringify(o);
}

/** @param {string} usuario @param {string} password */
export function authLoginJsonBody(usuario, password) {
    const tid = getExplicitLoginTenantHint();
    return buildLoginBody(usuario, password, tid);
}

/**
 * POST /api/auth/login con reintento sin tenant si hay hint obsoleto (401).
 * @param {string} usuario
 * @param {string} password
 * @param {(path: string) => string} apiUrlFn
 * @param {typeof fetch} fetchFn
 * @param {{ signal?: AbortSignal, timeoutMs?: number }} [opts]
 * @returns {Promise<{ resp: Response, data: object }>}
 */
export async function fetchAuthLoginApi(usuario, password, apiUrlFn, fetchFn, opts = {}) {
    const ms = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 28000;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    const signal = opts.signal || ctl.signal;

    const post = async (tenantId) => {
        const resp = await fetchFn(apiUrlFn('/api/auth/login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: buildLoginBody(usuario, password, tenantId),
            signal,
        });
        const data = await resp.json().catch(() => ({}));
        return { resp, data };
    };

    try {
        const hint = getExplicitLoginTenantHint();
        if (hint != null) {
            const r1 = await post(hint);
            const ok1 =
                r1.resp.ok ||
                (r1.resp.status === 403 && r1.data?.code === 'must_change_password');
            if (ok1) return r1;
            if (r1.resp.status === 401) {
                const r2 = await post(null);
                const ok2 =
                    r2.resp.ok ||
                    (r2.resp.status === 403 && r2.data?.code === 'must_change_password');
                if (ok2) {
                    clearAuthLoginTenantHint();
                    return r2;
                }
            }
            return r1;
        }
        return await post(null);
    } finally {
        clearTimeout(t);
    }
}

/**
 * Fragmento SQL ` AND col = tid` para login Neon legado; solo con hint explícito.
 * @param {(v: string|number) => string} escFn
 * @param {() => Promise<string|null>} getColFn
 */
export async function buildNeonLoginTenantSqlFrag(escFn, getColFn) {
    const hint = getExplicitLoginTenantHint();
    if (hint == null) return '';
    const colU = typeof getColFn === 'function' ? await getColFn() : null;
    if (!colU || hint < 1) return '';
    return ` AND ${colU} = ${escFn(hint)}`;
}

/** Evita doble envío simultáneo (click + Enter); ventana corta, no bloquea un segundo intento manual. */
export function beginLoginAttempt() {
    const now = Date.now();
    if (_loginInFlight || now - _lastLoginAttemptAt < 350) return false;
    _loginInFlight = true;
    _lastLoginAttemptAt = now;
    return true;
}

export function endLoginAttempt() {
    _loginInFlight = false;
}

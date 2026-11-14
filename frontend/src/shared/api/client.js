// Pembungkus fetch untuk semua pemanggilan REST API backend.
// Memasang token Bearer, mengubah error backend menjadi ApiError,
// dan memberi tahu AuthContext bila sesi berakhir (401).

const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(/\/+$/, '')

// Token disimpan di memori (bukan localStorage), sesuai saran docs/API.md.
let authToken = null
let unauthorizedHandler = null

export function setAuthToken(token) {
  authToken = token
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

export class ApiError extends Error {
  constructor({ status, code, message, details = null, requestId = null }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
  }
}

const DEFAULT_MESSAGES = {
  400: 'Permintaan tidak valid.',
  401: 'Sesi berakhir. Silakan login ulang.',
  403: 'Akun Anda tidak berhak membuka data ini.',
  404: 'Data tidak ditemukan.',
  409: 'Data berubah di komputer lain. Muat ulang sebelum melanjutkan.',
  422: 'Periksa kembali isian Anda.',
  429: 'Terlalu banyak percobaan. Coba lagi nanti.',
  503: 'Server sedang sibuk. Coba lagi.',
}

function buildUrl(path, query) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.append(key, String(value))
  }
  const queryString = params.toString()
  return `${BASE_URL}${path}${queryString ? `?${queryString}` : ''}`
}

async function request(method, path, { body, query, responseType = 'json' } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  let response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.',
    })
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const error = payload?.error
    const apiError = new ApiError({
      status: response.status,
      code: error?.code ?? `HTTP_${response.status}`,
      message: error?.message ?? DEFAULT_MESSAGES[response.status] ?? 'Terjadi kesalahan di server.',
      details: error?.details ?? null,
      requestId: error?.request_id ?? response.headers.get('X-Request-Id'),
    })
    // 401 saat login (kata sandi salah) tidak perlu memicu logout.
    if (response.status === 401 && authToken && unauthorizedHandler) unauthorizedHandler(apiError)
    throw apiError
  }

  if (response.status === 204) return null
  if (responseType === 'blob') return response.blob()
  return response.json()
}

export const api = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body }),
  put: (path, body, options) => request('PUT', path, { ...options, body }),
  patch: (path, body, options) => request('PATCH', path, { ...options, body }),
  // Untuk file PDF/Excel (nota, laporan).
  download: (path, query) => request('GET', path, { query, responseType: 'blob' }),
}

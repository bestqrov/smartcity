export interface IApiResponse<T = unknown> {
  data: T | null;
  error: string | null;
  status: number;
  ok: boolean;
}

export type RequestInterceptor = (
  url: string,
  options: RequestInit
) => RequestInit | Promise<RequestInit>;

export type ResponseInterceptor = (
  response: Response
) => Response | Promise<Response>;

export interface ApiClientOptions {
  getToken?: () => string | null | Promise<string | null>;
  locale?: string;
  headers?: Record<string, string>;
  requestInterceptors?: RequestInterceptor[];
  responseInterceptors?: ResponseInterceptor[];
}

export interface IApiClient {
  get<T = unknown>(path: string, params?: Record<string, string>): Promise<IApiResponse<T>>;
  post<T = unknown>(path: string, body?: unknown): Promise<IApiResponse<T>>;
  put<T = unknown>(path: string, body?: unknown): Promise<IApiResponse<T>>;
  patch<T = unknown>(path: string, body?: unknown): Promise<IApiResponse<T>>;
  delete<T = unknown>(path: string): Promise<IApiResponse<T>>;
  setLocale(locale: string): void;
  addRequestInterceptor(interceptor: RequestInterceptor): void;
  addResponseInterceptor(interceptor: ResponseInterceptor): void;
}

async function parseResponseBody<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return (await response.json()) as T;
    } catch {
      return null;
    }
  }
  return null;
}

async function buildApiResponse<T>(response: Response): Promise<IApiResponse<T>> {
  if (response.ok) {
    const data = await parseResponseBody<T>(response);
    return { data, error: null, status: response.status, ok: true };
  }

  let error = response.statusText || 'Unknown error';
  try {
    const body = await response.json();
    if (body?.message) error = body.message;
    else if (body?.error) error = body.error;
  } catch {
    // keep statusText as error
  }

  return { data: null, error, status: response.status, ok: false };
}

export function createApiClient(
  baseURL: string,
  options: ApiClientOptions = {}
): IApiClient {
  let currentLocale = options.locale || 'fr';
  const requestInterceptors: RequestInterceptor[] = [
    ...(options.requestInterceptors || []),
  ];
  const responseInterceptors: ResponseInterceptor[] = [
    ...(options.responseInterceptors || []),
  ];

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>
  ): Promise<IApiResponse<T>> {
    let url = `${baseURL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': currentLocale,
      ...(options.headers || {}),
    };

    if (options.getToken) {
      const token = await options.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    let fetchOptions: RequestInit = {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    };

    // Apply request interceptors
    for (const interceptor of requestInterceptors) {
      fetchOptions = await interceptor(url, fetchOptions);
    }

    try {
      let response = await fetch(url, fetchOptions);

      // Apply response interceptors
      for (const interceptor of responseInterceptors) {
        response = await interceptor(response);
      }

      return buildApiResponse<T>(response);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Network request failed';
      return { data: null, error: message, status: 0, ok: false };
    }
  }

  return {
    get<T = unknown>(path: string, params?: Record<string, string>) {
      return request<T>('GET', path, undefined, params);
    },
    post<T = unknown>(path: string, body?: unknown) {
      return request<T>('POST', path, body);
    },
    put<T = unknown>(path: string, body?: unknown) {
      return request<T>('PUT', path, body);
    },
    patch<T = unknown>(path: string, body?: unknown) {
      return request<T>('PATCH', path, body);
    },
    delete<T = unknown>(path: string) {
      return request<T>('DELETE', path);
    },
    setLocale(locale: string) {
      currentLocale = locale;
    },
    addRequestInterceptor(interceptor: RequestInterceptor) {
      requestInterceptors.push(interceptor);
    },
    addResponseInterceptor(interceptor: ResponseInterceptor) {
      responseInterceptors.push(interceptor);
    },
  };
}

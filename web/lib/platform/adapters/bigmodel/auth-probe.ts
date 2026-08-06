import type {
  IAuthProbe,
  AuthSignals,
  PlatformAuth,
} from '../../types';

export interface BigmodelAuthHeaders {
  authorization: string;
  'bigmodel-organization': string;
  'bigmodel-project': string;
}

export function isBigmodelAuthValid(auth: PlatformAuth | null): auth is PlatformAuth & { headers: BigmodelAuthHeaders } {
  if (!auth) return false;
  const h = auth.headers;
  return !!h.authorization && !!h['bigmodel-organization'] && !!h['bigmodel-project'];
}

export class BigmodelAuthProbe implements IAuthProbe {
  readonly platform = 'bigmodel';

  async isAuthenticated(auth?: PlatformAuth | null): Promise<boolean> {
    return isBigmodelAuthValid(auth ?? (await this.capture()));
  }

  async capture(): Promise<PlatformAuth | null> {
    try {
      const cookies = document.cookie.split(';').reduce((acc, c) => {
        const [k, ...vParts] = c.trim().split('=');
        acc[k] = vParts.join('=');
        return acc;
      }, {} as Record<string, string>);

      const jwt = cookies['bigmodel_token_production'];
      const org = localStorage.getItem('Bigmodel-Organization');
      const proj = localStorage.getItem('Bigmodel-Project');
      if (!jwt || !org || !proj) return null;

      return {
        platform: this.platform,
        capturedAt: Date.now(),
        headers: {
          authorization: jwt.replace(/^Bearer\s+/i, ''),
          'bigmodel-organization': org,
          'bigmodel-project': proj,
        },
        metadata: { source: 'live-page' },
      };
    } catch {
      return null;
    }
  }

  getSignals(auth: PlatformAuth | null): AuthSignals {
    if (!isBigmodelAuthValid(auth)) {
      return { ok: false, source: 'none' };
    }
    const source = (auth.metadata?.source as 'live-page' | 'cache') ?? 'cache';
    const ageMs = typeof auth.capturedAt === 'number' ? Math.max(0, Date.now() - auth.capturedAt) : 0;
    const raw = auth.headers.authorization.replace(/^Bearer\s+/i, '');
    return {
      ok: true,
      source,
      ageMs,
      tokenSuffix: raw.length > 12 ? '…' + raw.slice(-6) : raw,
    };
  }
}

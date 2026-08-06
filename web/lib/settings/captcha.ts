import { storage } from '#imports';

export interface CaptchaConfig {
  /** Max captchas to solve in one batch session */
  batchSessionLimit: number;
}

export const CAPTCHA_CONFIG_DEFAULT: CaptchaConfig = {
  batchSessionLimit: 100,
};

const STORAGE_KEY = 'local:captchaConfig';

export const captchaStore = {
  async get(): Promise<CaptchaConfig> {
    try {
      const stored = await storage.getItem<Partial<CaptchaConfig>>(STORAGE_KEY);
      return {
        ...CAPTCHA_CONFIG_DEFAULT,
        ...(stored || {}),
      };
    } catch {
      return { ...CAPTCHA_CONFIG_DEFAULT };
    }
  },

  async set(config: CaptchaConfig): Promise<void> {
    await storage.setItem(STORAGE_KEY, config);
  },
};

/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly RESEND_API_KEY: string;
  readonly SEND_EMAIL_FROM: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

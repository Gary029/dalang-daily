declare module '*.css';

interface ImportMetaEnv {
  readonly VITE_LOCAL?: string;
  /** where public/ files are served from ('/' on Reddit, '/dalang-daily/' on Pages) */
  readonly BASE_URL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

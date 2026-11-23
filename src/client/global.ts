declare module '*.css';

interface ImportMetaEnv {
  readonly VITE_LOCAL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

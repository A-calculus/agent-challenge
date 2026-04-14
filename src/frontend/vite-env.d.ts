/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EXTENSION_BUILDER_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}


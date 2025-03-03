declare module '@byojs/storage/idb' {
  export function get<T = any>(key: string): Promise<T | undefined>
  export function set<T = any>(key: string, value: T): Promise<boolean>
  export function remove(key: string): Promise<boolean>
  export function keys(): Promise<string[]>
}

declare module '@byojs/storage/local-storage' {
  export function get<T = any>(key: string): Promise<T | undefined>
  export function set<T = any>(key: string, value: T): Promise<boolean>
  export function remove(key: string): Promise<boolean>
  export function keys(): Promise<string[]>
}

declare module '@byojs/storage/session-storage' {
  export function get<T = any>(key: string): Promise<T | undefined>
  export function set<T = any>(key: string, value: T): Promise<boolean>
  export function remove(key: string): Promise<boolean>
  export function keys(): Promise<string[]>
}

declare module '@byojs/storage/opfs' {
  export function get<T = any>(key: string): Promise<T | undefined>
  export function set<T = any>(key: string, value: T): Promise<boolean>
  export function remove(key: string): Promise<boolean>
  export function keys(): Promise<string[]>
} 
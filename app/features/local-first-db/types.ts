import type { Session } from '../../../lib/types'

export type Timestamp = string // ISO string format
export type DocumentId = string

export interface LocalDocument<T> {
  id: DocumentId
  data: T
  lastModified: Timestamp
  version: number
  deleted?: boolean
  conflicts?: Array<{
    data: T
    lastModified: Timestamp
    version: number
  }>
}

export interface LocalFirstStore<T> {
  get(id: DocumentId): Promise<LocalDocument<T> | null>
  getAll(): Promise<LocalDocument<T>[]>
  put(id: DocumentId, data: T): Promise<LocalDocument<T>>
  delete(id: DocumentId): Promise<void>
  sync(): Promise<void>
  subscribe(callback: (docs: LocalDocument<T>[]) => void): () => void
}

export interface StorageAdapter {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  keys(): Promise<string[]>
}

export interface LocalFirstDBOptions {
  name: string
  storage?: StorageAdapter
  syncInterval?: number // in milliseconds
  conflictResolver?: <T>(doc1: LocalDocument<T>, doc2: LocalDocument<T>) => LocalDocument<T>
}

export type SessionDocument = LocalDocument<Session> 
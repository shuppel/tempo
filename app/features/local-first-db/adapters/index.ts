import { StorageAdapter } from '../types'
import { get, set, remove, keys } from '@byojs/storage/idb'
import { get as getLocal, set as setLocal, remove as removeLocal, keys as keysLocal } from '@byojs/storage/local-storage'
import { get as getSession, set as setSession, remove as removeSession, keys as keysSession } from '@byojs/storage/session-storage'
import { get as getOPFS, set as setOPFS, remove as removeOPFS, keys as keysOPFS } from '@byojs/storage/opfs'

// Memory storage fallback for server-side
class MemoryStorageAPI implements StorageAPI {
  private store: Map<string, any> = new Map()

  async get(key: string): Promise<any> {
    return this.store.get(key)
  }

  async set(key: string, value: any): Promise<boolean> {
    this.store.set(key, value)
    return true
  }

  async remove(key: string): Promise<boolean> {
    return this.store.delete(key)
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys())
  }
}

interface StorageAPI {
  get: typeof get
  set: typeof set
  remove: typeof remove
  keys: typeof keys
}

// Adapter wrapper for BYOJS/storage
class BYOJSStorageAdapter implements StorageAdapter {
  private storage: StorageAPI
  private prefix: string

  constructor(storage: StorageAPI, prefix: string = '') {
    this.storage = storage
    this.prefix = prefix
  }

  private getKey(key: string): string {
    return this.prefix ? `${this.prefix}-${key}` : key
  }

  async get(key: string): Promise<string | null> {
    try {
      const value = await this.storage.get(this.getKey(key))
      return value ? JSON.stringify(value) : null
    } catch (error) {
      console.error('Storage get error:', error)
      return null
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      const parsedValue = JSON.parse(value)
      await this.storage.set(this.getKey(key), parsedValue)
    } catch (error) {
      console.error('Storage set error:', error)
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.storage.remove(this.getKey(key))
    } catch (error) {
      console.error('Storage delete error:', error)
      throw error
    }
  }

  async clear(): Promise<void> {
    try {
      if (this.prefix) {
        // Only clear items with our prefix
        const allKeys = await this.keys()
        await Promise.all(allKeys.map((key: string) => this.delete(key)))
      } else {
        // Remove all keys
        const allKeys = await this.storage.keys()
        await Promise.all(allKeys.map((key: string) => this.storage.remove(key)))
      }
    } catch (error) {
      console.error('Storage clear error:', error)
      throw error
    }
  }

  async keys(): Promise<string[]> {
    try {
      const allKeys = await this.storage.keys()
      if (!this.prefix) return allKeys

      return allKeys.filter((key: string) => key.startsWith(this.prefix))
    } catch (error) {
      console.error('Storage keys error:', error)
      return []
    }
  }
}

export type StorageType = 'indexedDB' | 'localStorage' | 'sessionStorage' | 'opfs' | 'memory'

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined'

// Storage API implementations with memory fallback
const memoryStorage = new MemoryStorageAPI()
const storageAPIs: Record<StorageType, StorageAPI> = {
  indexedDB: isBrowser ? { get, set, remove, keys } : memoryStorage,
  localStorage: isBrowser ? { get: getLocal, set: setLocal, remove: removeLocal, keys: keysLocal } : memoryStorage,
  sessionStorage: isBrowser ? { get: getSession, set: setSession, remove: removeSession, keys: keysSession } : memoryStorage,
  opfs: isBrowser ? { get: getOPFS, set: setOPFS, remove: removeOPFS, keys: keysOPFS } : memoryStorage,
  memory: memoryStorage
}

// Factory function to create the appropriate storage adapter
export const createStorageAdapter = (type: StorageType, prefix?: string): StorageAdapter => {
  // Default to memory storage in server-side environment
  if (!isBrowser && type !== 'memory') {
    console.warn(`Storage type '${type}' not available in server environment, falling back to memory storage`)
    type = 'memory'
  }

  const storage = storageAPIs[type]
  if (!storage) {
    throw new Error(`Unknown storage adapter type: ${type}`)
  }
  return new BYOJSStorageAdapter(storage, prefix)
} 
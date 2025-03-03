import { StorageAdapter } from '../types'
import { get, set, remove, keys } from '@byojs/storage/idb'
import { get as getLocal, set as setLocal, remove as removeLocal, keys as keysLocal } from '@byojs/storage/local-storage'
import { get as getSession, set as setSession, remove as removeSession, keys as keysSession } from '@byojs/storage/session-storage'
import { get as getOPFS, set as setOPFS, remove as removeOPFS, keys as keysOPFS } from '@byojs/storage/opfs'

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

      return allKeys
        .filter((key: string) => key.startsWith(this.prefix))
        .map((key: string) => key.slice(this.prefix.length + 1))
    } catch (error) {
      console.error('Storage keys error:', error)
      return []
    }
  }
}

export type StorageType = 'indexedDB' | 'localStorage' | 'sessionStorage' | 'opfs'

// Storage API implementations
const storageAPIs: Record<StorageType, StorageAPI> = {
  indexedDB: { get, set, remove, keys },
  localStorage: { get: getLocal, set: setLocal, remove: removeLocal, keys: keysLocal },
  sessionStorage: { get: getSession, set: setSession, remove: removeSession, keys: keysSession },
  opfs: { get: getOPFS, set: setOPFS, remove: removeOPFS, keys: keysOPFS }
}

// Factory function to create the appropriate storage adapter
export const createStorageAdapter = (type: StorageType, prefix?: string): StorageAdapter => {
  const storage = storageAPIs[type]
  if (!storage) {
    throw new Error(`Unknown storage adapter type: ${type}`)
  }
  return new BYOJSStorageAdapter(storage, prefix)
} 
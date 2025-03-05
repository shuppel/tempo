import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { LocalFirstDB } from '../LocalFirstDB'
import { createStorageAdapter } from '../adapters'
import type { LocalDocument } from '../types'

describe('LocalFirstDB', () => {
  let db: LocalFirstDB<any>
  const TEST_DB_NAME = 'test_db'

  beforeEach(() => {
    vi.useFakeTimers()
    db = new LocalFirstDB({
      name: TEST_DB_NAME,
      storage: createStorageAdapter('localStorage', TEST_DB_NAME),
      syncInterval: 1000
    })
  })

  afterEach(async () => {
    if (db) {
      db.destroy()
    }
    vi.clearAllTimers()
    vi.useRealTimers()
    
    // Clean up localStorage
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.startsWith(TEST_DB_NAME)) {
        localStorage.removeItem(key)
      }
    })
  })

  it('should create a new instance with correct configuration', () => {
    expect(db).toBeInstanceOf(LocalFirstDB)
  })

  it('should save and retrieve data with metadata', async () => {
    const testData = { id: '1', value: 'test' }
    const now = new Date().toISOString()
    vi.setSystemTime(new Date(now))
    
    // Save data
    const saved = await db.put(testData.id, testData)
    expect(saved).toEqual({
      id: testData.id,
      data: testData,
      lastModified: now,
      version: 1
    })
    
    // Retrieve data
    const retrieved = await db.get(testData.id)
    expect(retrieved).toEqual(saved)
  })

  it('should version documents on update', async () => {
    const testData = { id: '1', value: 'test' }
    
    // Initial save
    const saved1 = await db.put(testData.id, testData)
    expect(saved1.version).toBe(1)
    
    // Update
    const updated = await db.put(testData.id, { ...testData, value: 'updated' })
    expect(updated.version).toBe(2)
  })

  it('should handle document conflicts', async () => {
    const testData = { id: '1', value: 'test' }
    
    // Save initial version
    const doc1 = await db.put(testData.id, testData)
    
    // Simulate time passing
    vi.advanceTimersByTime(1000)
    
    // Save conflicting version
    const doc2 = await db.put(testData.id, { ...testData, value: 'conflict' })
    
    // Check conflict handling
    expect(doc2.version).toBe(2)
    expect(doc2.conflicts).toBeDefined()
    if (doc2.conflicts) {
      expect(doc2.conflicts[0].data).toEqual(testData)
    }
  })

  it('should notify subscribers of changes', async () => {
    const subscriber = vi.fn()
    db.subscribe(subscriber)
    
    const testData = { id: '1', value: 'test' }
    await db.put(testData.id, testData)
    
    expect(subscriber).toHaveBeenCalled()
    const calls = subscriber.mock.calls
    expect(calls[0][0][0].data).toEqual(testData)
  })

  it('should mark documents as deleted', async () => {
    const testData = { id: '1', value: 'test' }
    
    // Save and delete
    await db.put(testData.id, testData)
    await db.delete(testData.id)
    
    // Check deleted status
    const doc = await db.get(testData.id)
    expect(doc?.deleted).toBe(true)
  })

  it('should sync on interval', async () => {
    const subscriber = vi.fn()
    db.subscribe(subscriber)
    
    // Add some data
    await db.put('1', { id: '1', value: 'test1' })
    await db.put('2', { id: '2', value: 'test2' })
    
    // Advance timer to trigger sync
    vi.advanceTimersByTime(1000)
    
    // Should have been notified of all docs
    expect(subscriber).toHaveBeenCalled()
    const calls = subscriber.mock.calls
    expect(calls[calls.length - 1][0]).toHaveLength(2)
  })

  it('should persist data across instances', async () => {
    const testData = { id: '1', value: 'test' }
    
    // Save in first instance
    await db.put(testData.id, testData)
    
    // Create new instance
    const db2 = new LocalFirstDB({
      name: TEST_DB_NAME,
      storage: createStorageAdapter('localStorage', TEST_DB_NAME),
      syncInterval: 1000
    })
    
    // Check data persists
    const retrieved = await db2.get(testData.id)
    expect(retrieved?.data).toEqual(testData)
    
    // Clean up
    db2.destroy()
  })
}) 
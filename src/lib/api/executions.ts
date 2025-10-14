/**
 * Executions API
 * CRUD operations for test executions
 */

import {db} from '@/lib/db'
import type {TestExecution} from '@/types/database'

/**
 * Create a new test execution
 */
export async function createExecution(data: Omit<TestExecution, 'id' | 'createdAt'>): Promise<TestExecution> {
  const execution: Omit<TestExecution, 'id'> = {
    ...data,
    createdAt: new Date(),
  }

  const id = await db.executions.add(execution as TestExecution)
  return { ...execution, id } as TestExecution
}

/**
 * Get execution by ID
 */
export async function getExecution(id: number): Promise<TestExecution | undefined> {
  return db.executions.get(id)
}

/**
 * Get executions by test case
 */
export async function getExecutionsByTestCase(testCaseId: number, limit: number = 20): Promise<TestExecution[]> {
  return db.getExecutionsByTestCase(testCaseId, limit)
}

/**
 * Get executions by spec
 */
export async function getExecutionsBySpec(specId: number, limit: number = 50): Promise<TestExecution[]> {
  return db.executions
    .where('specId')
    .equals(specId)
    .reverse()
    .limit(limit)
    .toArray()
}

/**
 * Get executions by endpoint
 */
export async function getExecutionsByEndpoint(endpointId: number, limit: number = 50): Promise<TestExecution[]> {
  return db.executions
    .where('endpointId')
    .equals(endpointId)
    .reverse()
    .limit(limit)
    .toArray()
}

/**
 * Get recent executions
 */
export async function getRecentExecutions(limit: number = 50): Promise<TestExecution[]> {
  return db.getRecentExecutions(limit)
}

/**
 * Update execution
 */
export async function updateExecution(id: number, data: Partial<Omit<TestExecution, 'id' | 'testCaseId' | 'specId' | 'endpointId' | 'createdAt'>>): Promise<void> {
  await db.executions.update(id, data)
}

/**
 * Delete execution
 */
export async function deleteExecution(id: number): Promise<void> {
  await db.executions.delete(id)
}

/**
 * Get executions by status
 */
export async function getExecutionsByStatus(
  specId: number,
  status: 'pending' | 'running' | 'pass' | 'fail' | 'error',
  limit: number = 50
): Promise<TestExecution[]> {
  return db.executions
    .where(['specId', 'status'])
    .equals([specId, status])
    .reverse()
    .limit(limit)
    .toArray()
}

/**
 * Get executions by environment
 */
export async function getExecutionsByEnvironment(specId: number, environment: string, limit: number = 50): Promise<TestExecution[]> {
  return db.executions
    .where(['specId', 'environment'])
    .equals([specId, environment])
    .reverse()
    .limit(limit)
    .toArray()
}

/**
 * Get execution summary for spec
 */
export async function getSpecExecutionSummary(specId: number) {
  const executions = await db.executions.where('specId').equals(specId).toArray()

  const total = executions.length
  const passed = executions.filter(e => e.status === 'pass').length
  const failed = executions.filter(e => e.status === 'fail').length
  const errors = executions.filter(e => e.status === 'error').length
  const pending = executions.filter(e => e.status === 'pending').length
  const running = executions.filter(e => e.status === 'running').length

  // Calculate average response time
  const completedExecutions = executions.filter(e => e.duration !== undefined)
  const avgResponseTime = completedExecutions.length > 0
    ? completedExecutions.reduce((sum, e) => sum + (e.duration || 0), 0) / completedExecutions.length
    : 0

  // Get last execution
  const lastExecution = executions.length > 0
    ? executions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0]
    : null

  return {
    total,
    passed,
    failed,
    errors,
    pending,
    running,
    passRate: total > 0 ? (passed / total) * 100 : 0,
    avgResponseTime,
    lastExecutionAt: lastExecution?.startedAt,
  }
}

/**
 * Get execution summary for test case
 */
export async function getTestCaseExecutionSummary(testCaseId: number) {
  const executions = await db.executions.where('testCaseId').equals(testCaseId).toArray()

  const total = executions.length
  const passed = executions.filter(e => e.status === 'pass').length
  const failed = executions.filter(e => e.status === 'fail').length
  const errors = executions.filter(e => e.status === 'error').length

  // Calculate average response time
  const completedExecutions = executions.filter(e => e.duration !== undefined)
  const avgResponseTime = completedExecutions.length > 0
    ? completedExecutions.reduce((sum, e) => sum + (e.duration || 0), 0) / completedExecutions.length
    : 0

  // Get trend (last 10 executions)
  const recentExecutions = executions
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, 10)

  const recentPassed = recentExecutions.filter(e => e.status === 'pass').length

  return {
    total,
    passed,
    failed,
    errors,
    passRate: total > 0 ? (passed / total) * 100 : 0,
    avgResponseTime,
    recentPassRate: recentExecutions.length > 0 ? (recentPassed / recentExecutions.length) * 100 : 0,
    trend: recentExecutions.length >= 2 ? calculateTrend(recentExecutions) : 'stable' as 'improving' | 'declining' | 'stable',
  }
}

/**
 * Calculate trend from recent executions
 */
function calculateTrend(executions: TestExecution[]): 'improving' | 'declining' | 'stable' {
  if (executions.length < 2) return 'stable'

  const firstHalf = executions.slice(Math.floor(executions.length / 2))
  const secondHalf = executions.slice(0, Math.floor(executions.length / 2))

  const firstHalfPassRate = firstHalf.filter(e => e.status === 'pass').length / firstHalf.length
  const secondHalfPassRate = secondHalf.filter(e => e.status === 'pass').length / secondHalf.length

  const diff = secondHalfPassRate - firstHalfPassRate

  if (diff > 0.1) return 'improving'
  if (diff < -0.1) return 'declining'
  return 'stable'
}

/**
 * Delete old executions (cleanup)
 */
export async function deleteOldExecutions(daysToKeep: number = 30): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

  const oldExecutions = await db.executions
    .where('startedAt')
    .below(cutoffDate)
    .toArray()

  await db.executions
    .where('startedAt')
    .below(cutoffDate)
    .delete()

  return oldExecutions.length
}

/**
 * Get execution statistics by date range
 */
export async function getExecutionStatsByDateRange(
  specId: number,
  startDate: Date,
  endDate: Date
) {
  const executions = await db.executions
    .where('specId')
    .equals(specId)
    .filter(e => e.startedAt >= startDate && e.startedAt <= endDate)
    .toArray()

  // Group by date
  const executionsByDate = new Map<string, TestExecution[]>()
  executions.forEach(execution => {
    const dateKey = execution.startedAt.toISOString().split('T')[0]
    if (!executionsByDate.has(dateKey)) {
      executionsByDate.set(dateKey, [])
    }
    executionsByDate.get(dateKey)!.push(execution)
  })

  // Calculate stats per date
  const stats = Array.from(executionsByDate.entries()).map(([date, execs]) => {
    const passed = execs.filter(e => e.status === 'pass').length
    const failed = execs.filter(e => e.status === 'fail').length
    const errors = execs.filter(e => e.status === 'error').length

    return {
      date,
      total: execs.length,
      passed,
      failed,
      errors,
      passRate: execs.length > 0 ? (passed / execs.length) * 100 : 0,
    }
  })

  return stats.sort((a, b) => a.date.localeCompare(b.date))
}

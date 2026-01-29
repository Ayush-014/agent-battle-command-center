import type { PrismaClient } from '@prisma/client';

export interface SuccessRateDataPoint {
  timestamp: Date;
  hour: string;
  completed: number;
  failed: number;
  total: number;
  successRate: number;
}

export interface SuccessRateSummary {
  overall: {
    completed: number;
    failed: number;
    total: number;
    successRate: number;
  };
  timeline: SuccessRateDataPoint[];
  trend: {
    direction: 'up' | 'down' | 'stable';
    change: number; // Percentage change
  };
}

export class SuccessRateService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get success rate data for a given time period
   */
  async getSuccessRate(
    period: 'hourly' | 'daily' = 'hourly',
    hours: number = 24
  ): Promise<SuccessRateSummary> {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Get all completed or failed tasks in the time period
    const tasks = await this.prisma.task.findMany({
      where: {
        status: { in: ['completed', 'aborted', 'failed'] },
        completedAt: { gte: cutoffTime },
      },
      orderBy: { completedAt: 'asc' },
    });

    // Group by time bucket
    const timeline: SuccessRateDataPoint[] = [];
    const bucketMap = new Map<string, { completed: number; failed: number }>();

    for (const task of tasks) {
      if (!task.completedAt) continue;

      const timestamp = new Date(task.completedAt);

      // Round down to hour or day
      if (period === 'hourly') {
        timestamp.setMinutes(0, 0, 0);
      } else {
        timestamp.setHours(0, 0, 0, 0);
      }

      const key = timestamp.toISOString();

      if (!bucketMap.has(key)) {
        bucketMap.set(key, { completed: 0, failed: 0 });
      }

      const bucket = bucketMap.get(key)!;

      if (task.status === 'completed') {
        bucket.completed++;
      } else {
        bucket.failed++;
      }
    }

    // Convert to timeline array
    for (const [key, data] of bucketMap.entries()) {
      const total = data.completed + data.failed;
      const successRate = total > 0 ? (data.completed / total) * 100 : 0;

      timeline.push({
        timestamp: new Date(key),
        hour: key,
        completed: data.completed,
        failed: data.failed,
        total,
        successRate,
      });
    }

    // Sort by timestamp
    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Calculate overall stats
    const totalCompleted = tasks.filter(t => t.status === 'completed').length;
    const totalFailed = tasks.filter(t => t.status === 'aborted' || t.status === 'failed').length;
    const totalTasks = totalCompleted + totalFailed;
    const overallSuccessRate = totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0;

    // Calculate trend (compare first half to second half)
    const trend = this.calculateTrend(timeline);

    return {
      overall: {
        completed: totalCompleted,
        failed: totalFailed,
        total: totalTasks,
        successRate: overallSuccessRate,
      },
      timeline,
      trend,
    };
  }

  /**
   * Calculate success rate trend
   */
  private calculateTrend(timeline: SuccessRateDataPoint[]): {
    direction: 'up' | 'down' | 'stable';
    change: number;
  } {
    if (timeline.length < 2) {
      return { direction: 'stable', change: 0 };
    }

    const midpoint = Math.floor(timeline.length / 2);
    const firstHalf = timeline.slice(0, midpoint);
    const secondHalf = timeline.slice(midpoint);

    const firstAvg = this.averageSuccessRate(firstHalf);
    const secondAvg = this.averageSuccessRate(secondHalf);

    const change = secondAvg - firstAvg;

    let direction: 'up' | 'down' | 'stable' = 'stable';
    if (change > 5) {
      direction = 'up';
    } else if (change < -5) {
      direction = 'down';
    }

    return { direction, change };
  }

  /**
   * Calculate average success rate from data points
   */
  private averageSuccessRate(points: SuccessRateDataPoint[]): number {
    if (points.length === 0) return 0;

    const total = points.reduce((sum, p) => sum + p.successRate, 0);
    return total / points.length;
  }

  /**
   * Get success rate by agent type
   */
  async getSuccessRateByAgent(): Promise<
    Array<{
      agentType: string;
      completed: number;
      failed: number;
      total: number;
      successRate: number;
    }>
  > {
    const tasks = await this.prisma.task.findMany({
      where: {
        status: { in: ['completed', 'aborted', 'failed'] },
      },
      include: {
        assignedAgent: {
          include: {
            agentType: true,
          },
        },
      },
    });

    const byAgent = new Map<string, { completed: number; failed: number }>();

    for (const task of tasks) {
      const agentType = task.assignedAgent?.agentType.name || 'unknown';

      if (!byAgent.has(agentType)) {
        byAgent.set(agentType, { completed: 0, failed: 0 });
      }

      const stats = byAgent.get(agentType)!;

      if (task.status === 'completed') {
        stats.completed++;
      } else {
        stats.failed++;
      }
    }

    const result: Array<{
      agentType: string;
      completed: number;
      failed: number;
      total: number;
      successRate: number;
    }> = [];

    for (const [agentType, stats] of byAgent.entries()) {
      const total = stats.completed + stats.failed;
      const successRate = total > 0 ? (stats.completed / total) * 100 : 0;

      result.push({
        agentType,
        completed: stats.completed,
        failed: stats.failed,
        total,
        successRate,
      });
    }

    // Sort by total tasks (most active first)
    result.sort((a, b) => b.total - a.total);

    return result;
  }
}

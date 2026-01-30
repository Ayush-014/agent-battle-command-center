import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config.js';
import { prisma } from './db/client.js';
import { tasksRouter } from './routes/tasks.js';
import { agentsRouter } from './routes/agents.js';
import { queueRouter } from './routes/queue.js';
import { executeRouter } from './routes/execute.js';
import { metricsRouter } from './routes/metrics.js';
import { chatRouter } from './routes/chat.js';
import { executionLogsRouter } from './routes/execution-logs.js';
import trainingDataRouter from './routes/training-data.js';
import { taskPlanningRouter } from './routes/task-planning.js';
import { codeReviewsRouter } from './routes/code-reviews.js';
import { costMetricsRouter } from './routes/cost-metrics.js';
import { setupWebSocket } from './websocket/handler.js';
import { TaskQueueService } from './services/taskQueue.js';
import { HumanEscalationService } from './services/humanEscalation.js';
import { ChatService } from './services/chatService.js';
import { ResourcePoolService } from './services/resourcePool.js';

const app = express();
const httpServer = createServer(app);

// Socket.io setup
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Make io and services available to routes
app.set('io', io);

// Initialize resource pool for parallel task execution
const resourcePool = ResourcePoolService.getInstance();
resourcePool.initialize(io);

const taskQueue = new TaskQueueService(prisma, io);
const humanEscalation = new HumanEscalationService(prisma, io, taskQueue);
const chatService = new ChatService(io);

app.set('taskQueue', taskQueue);
app.set('humanEscalation', humanEscalation);
app.set('chatService', chatService);
app.set('resourcePool', resourcePool);

// Routes
app.use('/api/tasks', tasksRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/queue', queueRouter);
app.use('/api/execute', executeRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/execution-logs', executionLogsRouter);
app.use('/api/training-data', trainingDataRouter);
app.use('/api/task-planning', taskPlanningRouter);
app.use('/api/code-reviews', codeReviewsRouter);
app.use('/api/cost-metrics', costMetricsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket setup
setupWebSocket(io);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.env === 'development' ? err.message : undefined,
  });
});

// Start server
async function start() {
  try {
    await prisma.$connect();
    console.log('Connected to database');

    // Start human escalation checker
    humanEscalation.startChecker();

    httpServer.listen(config.server.port, config.server.host, () => {
      console.log(`API server running on http://${config.server.host}:${config.server.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  humanEscalation.stopChecker();
  await prisma.$disconnect();
  process.exit(0);
});

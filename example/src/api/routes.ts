/**
 * API route definitions for the example application
 */

import { Router } from 'express';
import { Container } from 'inversify';
import { UserController } from './UserController';

export function createApiRouter(container: Container): Router {
  const router = Router();
  const userController = container.get<UserController>(UserController);

  // User management routes
  router.post('/users',
    userController.createUser.bind(userController)
  );

  router.get('/users',
    userController.listUsers.bind(userController)
  );

  router.get('/users/statistics',
    userController.getUserStatistics.bind(userController)
  );

  router.get('/users/:id',
    userController.getUser.bind(userController)
  );

  router.put('/users/:id',
    userController.updateUser.bind(userController)
  );

  router.delete('/users/:id',
    userController.deleteUser.bind(userController)
  );

  // Health check endpoint
  router.get('/health', (req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  });

  return router;
}
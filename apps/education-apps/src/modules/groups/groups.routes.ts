import { Router } from 'express';
import * as groupsController from './groups.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);

router.post('/', groupsController.createGroup);
router.get('/', groupsController.getAllGroups);
router.get('/:id', groupsController.getGroupById);
router.put('/:id', groupsController.updateGroup);
router.delete('/:id', groupsController.deleteGroup);

export default router;

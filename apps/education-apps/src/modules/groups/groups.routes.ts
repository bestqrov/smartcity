import { Router } from 'express';
import * as groupsController from './groups.controller';

const router = Router();

router.post('/', groupsController.createGroup);
router.get('/', groupsController.getAllGroups);
router.get('/:id', groupsController.getGroupById);
router.put('/:id', groupsController.updateGroup);
router.delete('/:id', groupsController.deleteGroup);

export default router;

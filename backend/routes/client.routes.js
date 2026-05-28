import express from 'express';
import auth from '../middleware/auth.middleware.js';
import { getAllClients, createClient, deleteClient } from '../controllers/client.controller.js';

const router = express.Router();

router.get('/', auth, getAllClients);
router.post('/', auth, createClient);
router.delete('/:id', auth, deleteClient);

export default router;
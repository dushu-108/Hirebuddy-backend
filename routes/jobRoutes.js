import { Router } from 'express';
import { searchJobs } from '../controllers/jobController.js';

const router = Router();

// Search jobs
router.get('/search', searchJobs);

export default router;
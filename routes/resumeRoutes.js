// backend/routes/resumeRoutes.js
import express from 'express';
import { handleResumeUpload } from '../controllers/resumeController.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({ dest: 'uploads/' }); // Configure multer for file uploads

// POST /api/resume/upload
router.post('/upload', upload.single('resume'), handleResumeUpload);

export default router;
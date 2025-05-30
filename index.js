import { configDotenv } from 'dotenv';
import express, { json } from 'express';
import connectDB from './db/connect.js';
import resumeRoutes from './routes/resumeRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import cors from 'cors';

configDotenv();

const app = express();

// Enable CORS for the frontend
const corsOptions = {
  origin: 'http://localhost:5173',
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));
app.use(json());
const PORT = process.env.PORT || 3000;

app.use('/api/resume', resumeRoutes);
app.use('/api/jobs', jobRoutes);

app.listen(PORT, () => {
  connectDB();
  console.log(`Server running on port ${PORT}`);
});

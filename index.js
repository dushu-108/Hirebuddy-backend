import { configDotenv } from 'dotenv';
import express, { json } from 'express';
import connectDB from './db/connect.js';
import resumeRoutes from './routes/resumeRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import cors from 'cors';

configDotenv();

const app = express();

// Enable CORS for the frontend
const allowedOrigins = [
  'http://localhost:5173',
  'https://hirebuddy-pv9i.onrender.com'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
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

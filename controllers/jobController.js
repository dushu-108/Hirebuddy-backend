import Job from '../models/job.js';

export const searchJobs = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const searchRegex = new RegExp(query, 'i');
    
    const jobs = await Job.find({
      $or: [
        { job_title: { $regex: searchRegex } },
        { company_name: { $regex: searchRegex } },
        { job_location: { $regex: searchRegex } },
        { job_description: { $regex: searchRegex } },
      ],
    });

    res.json(jobs);
  } catch (error) {
    console.error('Error searching jobs:', error);
    res.status(500).json({ message: 'Error searching jobs' });
  }
};
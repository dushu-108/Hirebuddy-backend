import { Schema, model } from 'mongoose';

const JobSchema = new Schema({
  company_name: String,
  job_title: String,
  job_location: String,
  apply_link: String,
  job_description: String,
  source: String
});

export default model('Job', JobSchema);

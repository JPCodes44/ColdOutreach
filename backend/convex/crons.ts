import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Pick up bounce notices and replies for recently sent outreach.
crons.interval(
  'check Gmail inbox for bounces and replies',
  { minutes: 30 },
  internal.mailbox.checkMailbox,
  {},
);

export default crons;

// The e2e suite runs offline: real environment variables win over apps/api/.env in @nestjs/config.
process.env.AI_PROVIDER = 'mock';

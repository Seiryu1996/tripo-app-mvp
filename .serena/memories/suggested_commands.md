# Development Commands

## Docker Commands (Primary Development Environment)
```bash
# Build and start containers
docker compose build
docker compose up

# Execute commands in container
docker compose exec app npm run dev
docker compose exec app npm run build
docker compose exec app npm run lint
docker compose exec app npm run test
docker compose exec app npm run test:watch
docker compose exec app npm run test:coverage

# Database operations
docker compose exec app npm run db:generate
docker compose exec app npm run db:push
docker compose exec app npm run db:migrate  
docker compose exec app npm run db:studio
docker compose exec app npm run db:seed
docker compose exec app npm run db:reset

# Container management
docker compose down
docker compose restart
docker compose logs
docker compose logs -f
```

## Local Development Commands
```bash
# Dependencies
npm ci

# Development server
npm run dev

# Build and production
npm run build
npm run start

# Code quality
npm run lint

# Testing
npm run test
npm run test:watch
npm run test:coverage

# Database operations
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:studio
npm run db:seed
npm run db:reset
```

## System Commands (Linux)
- `ls` - List files and directories
- `cd` - Change directory  
- `grep` - Search text patterns
- `find` - Find files and directories
- `git` - Version control operations
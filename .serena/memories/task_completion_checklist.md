# Task Completion Checklist

## Before Completing Any Coding Task

### Code Quality Checks
1. **Linting**: Run `npm run lint` or `docker compose exec app npm run lint`
2. **Type Checking**: Ensure TypeScript compilation passes (built into Next.js build)
3. **Testing**: Run relevant tests with `npm run test` if applicable

### Build Verification
1. **Build Check**: Run `npm run build` or `docker compose exec app npm run build` to ensure the application builds successfully
2. **No Build Errors**: Verify no TypeScript errors or build failures

### Database Operations (if applicable)
1. **Schema Sync**: Run `npm run db:generate` after schema changes
2. **Database Push**: Run `npm run db:push` for schema updates
3. **Seeding**: Use `npm run db:seed` for test data if needed

### Docker Environment Verification
1. **Container Build**: Ensure `docker compose build` completes successfully
2. **Application Start**: Verify `docker compose up` starts without errors
3. **Service Health**: Check that all services are running properly

### Final Checks
- Code follows project conventions and style guidelines
- No console errors or warnings in development
- Functionality works as expected in browser testing
- API endpoints respond correctly if modified
- No security vulnerabilities introduced

## Notes
- The project uses Docker as primary development environment
- Always test in Docker environment before considering task complete
- Use `docker compose logs` to check for runtime errors
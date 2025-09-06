# Code Style and Conventions

## Language and Framework Conventions
- **TypeScript**: Strict mode enabled with comprehensive type checking
- **Next.js**: App Router pattern with page.tsx files
- **React**: Functional components with hooks
- **Tailwind CSS**: Utility-first CSS framework for styling

## File and Directory Structure
- Pages: `src/app/[route]/page.tsx`
- API Routes: `src/app/api/[endpoint]/route.ts`
- Components: `src/components/` with PascalCase naming
- UI Components: `src/components/ui/` (Radix UI based)
- Services: `src/services/` with camelCase naming
- Libraries: `src/lib/` for utilities and configurations

## Naming Conventions
- **Files**: kebab-case for directories, PascalCase for component files
- **Components**: PascalCase (e.g., `ModelViewer.tsx`, `Navigation.tsx`)
- **Services**: camelCase with Service suffix (e.g., `modelService.ts`)
- **API Routes**: RESTful naming in route.ts files
- **Database**: Prisma schema with PascalCase models

## Import Conventions
- Path aliases: `@/*` maps to `./src/*`
- UI components imported from `@/components/ui/`
- Services imported from `@/services/`
- Utilities imported from `@/lib/`

## Component Structure
- Export default for main component
- Use TypeScript interfaces for props
- Radix UI components for accessible UI elements
- Tailwind classes for styling

## Database Conventions
- Prisma ORM with generated client
- Models in PascalCase (User, Model)
- Fields in camelCase
- Enums for status fields (e.g., ModelStatus: PENDING, PROCESSING, COMPLETED, FAILED)
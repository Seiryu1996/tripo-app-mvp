# Tripo 3D Model Generator MVP - Project Overview

## Purpose
This is a web application that uses the Tripo API to generate 3D models from text or images. It's designed as an MVP (Minimum Viable Product) for AI-powered 3D model generation.

## Tech Stack
- **Frontend**: Next.js 14 with App Router
- **Backend**: Next.js API Routes  
- **Database**: TiDB (MySQL compatible)
- **ORM**: Prisma
- **Authentication**: JWT with NextAuth
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI components
- **3D Rendering**: Three.js with three-stdlib
- **Testing**: Jest with Testing Library
- **Containerization**: Docker

## Key Features
### Admin Features
- User creation, editing, and deletion
- Admin dashboard

### User Features  
- Login authentication
- Text-to-3D model generation
- Image-to-3D model generation
- Generation history viewing
- 3D model downloads

## Project Structure
- `src/app/` - Next.js app router pages and API routes
- `src/components/` - React components including UI components
- `src/lib/` - Utility libraries (auth, prisma, utils)
- `src/services/` - Business logic services (model, tripo, user services)
- `prisma/` - Database schema and migrations

## Development Environment
- Uses Docker for containerization
- Supports hot reloading in development
- TypeScript with strict configuration
- Path aliases configured (@/* -> ./src/*)